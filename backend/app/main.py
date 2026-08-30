"""Репетитор из Коми · FastAPI.

Ключевые эндпоинты по ТЗ:
  POST /api/tasks/import   — массовая загрузка задач (JSON)
  GET  /api/tasks          — список задач (фильтры exam_type / task_number / topic)
  GET  /api/tasks/topics   — темы для тепловой карты
  POST /api/auth/register  — регистрация (опционально telegram_id)

Запуск:  uvicorn app.main:app --reload
Док-во:  /docs (Swagger UI)
"""
from __future__ import annotations

import os
import secrets
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Literal, Optional

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Низкоуровневые примитивы вынесены в отдельные модули, чтобы зависимости
# авторизации (deps.py) импортировались без циклического импорта.
from .database import Session, engine, get_db
from .deps import get_current_teacher, get_current_user
from .models import Base, ExamType, Material, Skill, StudentExamLine, Subtopic, StudentSkill, Task, TaskSkill, TrainingMode, User, Variant
from .services.mastery_engine import recalculate_with_diff
from .services.readiness_engine import EXAM_MODES, background_recalculate_readiness
from .security import (
    create_token,
    generate_recovery_code,
    hash_password,
    needs_rehash,
    normalize_recovery_code,
    verify_password,
)

# Все секреты и параметры — только из переменных окружения (см. .env.example).
#
# CORS — прод-безопасный:
#   • Если CORS_ORIGINS задан (продакшен) — разрешены ТОЛЬКО перечисленные
#     домены, например CORS_ORIGINS=https://репетитор-из-коми.ру
#   • Иначе (девелопмент) — только локальные хосты и приватные LAN-адреса
#     на любом порту (regex, НЕ "*"). Публичные домены не проходят.
#   Никогда не используем allow_origins=["*"] вместе с credentials.
_CORS_ORIGINS_ENV = os.getenv("CORS_ORIGINS", "").strip()
if _CORS_ORIGINS_ENV:
    ALLOWED_ORIGINS: List[str] = [o.strip() for o in _CORS_ORIGINS_ENV.split(",") if o.strip()]
    ALLOWED_ORIGIN_REGEX: Optional[str] = None
else:
    ALLOWED_ORIGINS = []
    ALLOWED_ORIGIN_REGEX = (
        r"^https?://(localhost|127\.0\.0\.1"
        r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
        r"|192\.168\.\d{1,3}\.\d{1,3}"
        r"|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$"
    )

# Мастер-аккаунт преподавателя (создаётся автоматически при старте).
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "daniil")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Pudov-Ege-2026")
# Код привязки учеников — отсылка к реке Сысоле (Сыктывкар), без фамилии.
ADMIN_TEACHER_CODE = os.getenv("ADMIN_TEACHER_CODE", "SYSOLA-PRO")
ADMIN_FULL_NAME = os.getenv("ADMIN_FULL_NAME", "Даниил Андреевич Пудов")


async def ensure_admin() -> None:
    """Автоматически гарантирует наличие мастер-аккаунта преподавателя.

    Вызывается при старте. Идемпотентна: существующий аккаунт не пересоздаётся,
    но роль и код привязки поддерживаются в актуальном состоянии.
    """
    from .models import User, UserRole

    async with Session() as db:
        existing = (
            await db.execute(select(User).where(User.nickname == ADMIN_USERNAME))
        ).scalar_one_or_none()
        if existing is not None:
            existing.role = UserRole.TEACHER
            existing.teacher_code = ADMIN_TEACHER_CODE
            existing.full_name = ADMIN_FULL_NAME
            # Миграция: если мастер-аккаунт ещё на plaintext-пароле — хешируем.
            if needs_rehash(existing.password_hash) and existing.password_hash == ADMIN_PASSWORD:
                existing.password_hash = hash_password(ADMIN_PASSWORD)
            await db.commit()
            return
        db.add(
            User(
                email=f"{ADMIN_USERNAME}@repetitor.local",
                password_hash=hash_password(ADMIN_PASSWORD),  # bcrypt
                full_name=ADMIN_FULL_NAME,
                nickname=ADMIN_USERNAME,
                role=UserRole.TEACHER,
                teacher_code=ADMIN_TEACHER_CODE,
            )
        )
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        # Если схемой управляет Alembic (таблица alembic_version существует),
        # НЕ вызываем create_all — иначе конфликт DuplicateObjectError
        # при последующих миграциях. create_all — только для «чистой» БД,
        # где миграции ещё не накатывались.
        from sqlalchemy import text as _text

        managed = (
            await conn.execute(
                _text(
                    "SELECT 1 FROM information_schema.tables "
                    "WHERE table_name = 'alembic_version'"
                )
            )
        ).first()
        if managed is None:
            await conn.run_sync(Base.metadata.create_all)
    # Папка для файлов методичек (рядом с uploads/).
    MATERIALS_DIR.mkdir(parents=True, exist_ok=True)
    # Продакшен-контроль: предупреждаем, если секреты не сменены с дефолтных.
    from .security import HMAC_SECRET

    if HMAC_SECRET in ("dev-secret-change-me", "change-me", ""):
        print(
            "[startup] ⚠️  HMAC_SECRET не сменён! Для продакшена задайте "
            "HMAC_SECRET в .env (например, через `openssl rand -hex 32`)."
        )

    try:
        await ensure_admin()
    except Exception as exc:  # не даём сбою сида уронить запуск API
        print(f"[startup] не удалось создать мастер-аккаунт: {exc}")
    yield


app = FastAPI(title="Репетитор из Коми · API", lifespan=lifespan)
# CORS: разрешаем ЛЮБОЙ локальный источник — localhost / 127.0.0.1 / локальный IP
# с любым портом. Важно: используем allow_origin_regex (конкретный origin в ответе),
# а не «*» вместе с allow_credentials — wildcard + credentials браузер блокирует,
# из-за чего падала загрузка файлов с заголовком Authorization.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)


# ─────────────────────────── схемы ───────────────────────────
class TaskSkillIn(BaseModel):
    """Один навык, проверяемый задачей (для построения иерархии).

    ``subtopic_title`` — подтема, внутри которой живёт навык;
    если подтемы ещё нет — она будет создана внутри линии.
    ``weight`` — вес навыка для задачи (0.0–1.0): 1.0 = основной навык,
    меньше — косвенный.
    """
    title: str = Field(min_length=1, max_length=200)
    subtopic_title: str = Field(min_length=1, max_length=200)
    weight: float = Field(default=1.0, ge=0.0, le=1.0)


class TaskIn(BaseModel):
    """Одна задача при импорте — формат совпадает с фронтендом."""
    exam_type: ExamType
    task_number: int = Field(ge=1, le=25)
    topic: str = Field(min_length=1, max_length=120)
    condition_text: str = Field(min_length=1)
    solution_text: Optional[str] = None
    correct_answer: Optional[str] = Field(default=None, max_length=100)
    is_second_part: bool = False
    difficulty_level: int = Field(default=1, ge=1, le=3)
    # Критерии ФИПИ для части 2 (разбалловка на 1/2/3 балла).
    criteria: Optional[str] = None
    # Чертёж/график: https://… или data-URL image/….
    image_url: Optional[str] = Field(default=None, max_length=2000)
    source: Optional[str] = None
    # Привязка к линии КИМ (1–20); None = использовать task_number.
    line_number: Optional[int] = Field(default=None, ge=1, le=20)
    # Навыки, проверяемые задачей (создаются/находятся автоматически).
    skills: List[TaskSkillIn] = Field(default_factory=list)

    @field_validator("image_url")
    @classmethod
    def _valid_image(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if v and not (v.startswith("http://") or v.startswith("https://") or v.startswith("image/")):
            raise ValueError("image_url должен быть https://… или image/… (data-URL)")
        return v or None


class TaskImportIn(BaseModel):
    tasks: List[TaskIn]


class TaskOut(BaseModel):
    """Полная задача (для преподавателя): с решением и критериями."""
    id: str
    exam_type: ExamType
    task_number: int
    topic: str
    condition_text: str
    solution_text: Optional[str]
    is_second_part: bool
    difficulty_level: int
    criteria: Optional[str] = None
    image_url: Optional[str] = None

    @classmethod
    def from_orm_(cls, t: Task) -> "TaskOut":
        return cls(
            id=str(t.id), exam_type=t.exam_type, task_number=t.task_number,
            topic=t.topic, condition_text=t.condition_text,
            solution_text=t.solution_text, is_second_part=t.is_second_part,
            difficulty_level=t.difficulty_level,
            criteria=t.criteria, image_url=t.image_url,
        )


class TaskStudentOut(BaseModel):
    """Задача для ученика: БЕЗ решения, критериев и эталона.

    Безопасность: публичные списки/ленты не должны отдавать решения —
    иначе ученик получает все ответы разом, не решая. Разбор выдаётся
    отдельным эндпоинтом только после верного решения.
    """
    id: str
    exam_type: ExamType
    task_number: int
    topic: str
    condition_text: str
    is_second_part: bool
    difficulty_level: int
    image_url: Optional[str] = None

    @classmethod
    def from_orm_(cls, t: Task) -> "TaskStudentOut":
        return cls(
            id=str(t.id), exam_type=t.exam_type, task_number=t.task_number,
            topic=t.topic, condition_text=t.condition_text,
            is_second_part=t.is_second_part,
            difficulty_level=t.difficulty_level,
            image_url=t.image_url,
        )


class ImportReport(BaseModel):
    added: int
    skipped: int
    errors: List[str]


class RegisterIn(BaseModel):
    email: Optional[str] = None
    password: str = Field(min_length=4, max_length=128)
    full_name: Optional[str] = None
    nickname: str = Field(min_length=2, max_length=32)
    telegram_id: Optional[int] = None  # задел под Telegram-бота
    # Опциональный код преподавателя: если задан и найден — ученик
    # привязывается к преподавателю (teacher_id) для проверки 2-й части.
    teacher_code: Optional[str] = None


# ─────────────────────────── здоровье ───────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ─────────────────────────── задачи ───────────────────────────
async def create_task_with_skills(db: AsyncSession, t: TaskIn) -> Task:
    """Создаёт задачу и иерархию «подтема → навык → TaskSkill».

    Алгоритм для каждого навыка из ``t.skills``:
      1) найти (по линии+названию) или создать Subtopic;
      2) найти (по линии+подтеме+названию) или создать Skill;
      3) создать связующую запись TaskSkill с указанным весом (без дублей).

    Вынесена в отдельную функцию, чтобы логику можно было юнит-тестировать
    независимо от HTTP-эндпоинта.
    """
    # Поля самой задачи (line_number и skills — не поля модели Task).
    task_fields = t.model_dump(exclude={"line_number", "skills"})
    task = Task(**task_fields)
    db.add(task)
    await db.flush()  # чтобы получить task.id

    # Линия КИМ: явная line_number либо номер задания (для ЕГЭ они совпадают).
    line_number = t.line_number or t.task_number

    # Иерархия: для каждого навыка — подтема → навык → связь TaskSkill.
    for sk in t.skills:
        # 1) Найти или создать подтему внутри линии.
        subtopic = (await db.execute(
            select(Subtopic).where(
                Subtopic.line_number == line_number,
                Subtopic.title == sk.subtopic_title,
            )
        )).scalar_one_or_none()
        if subtopic is None:
            subtopic = Subtopic(line_number=line_number, title=sk.subtopic_title)
            db.add(subtopic)
            await db.flush()

        # 2) Найти или создать навык внутри подтемы.
        skill = (await db.execute(
            select(Skill).where(
                Skill.line_number == line_number,
                Skill.subtopic_id == subtopic.id,
                Skill.title == sk.title,
            )
        )).scalar_one_or_none()
        if skill is None:
            skill = Skill(
                line_number=line_number,
                subtopic_id=subtopic.id,
                title=sk.title,
                difficulty=t.difficulty_level,
            )
            db.add(skill)
            await db.flush()

        # 3) Связь Task → Skill с весом (без дублей).
        existing_link = (await db.execute(
            select(TaskSkill).where(
                TaskSkill.task_id == task.id,
                TaskSkill.skill_id == skill.id,
            )
        )).scalar_one_or_none()
        if existing_link is None:
            db.add(TaskSkill(task_id=task.id, skill_id=skill.id, weight=sk.weight))

    return task


@app.post("/api/tasks/import", response_model=ImportReport)
async def import_tasks(
    body: TaskImportIn,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Массовая загрузка задач (только преподаватель).

    Валидация формата — в Pydantic (TaskImportIn): некорректный JSON
    отклоняется ещё до входа (422). Дубликаты (экзамен+номер+условие)
    пропускаются. Одна плохая строка НЕ губит весь батч: ошибки
    собираются в отчёт, остальные строки сохраняются (savepoint на ряд).
    """
    added = skipped = 0
    errors: List[str] = []
    for i, t in enumerate(body.tasks, start=1):
        if not t.is_second_part and not (t.correct_answer or "").strip():
            errors.append(f"задача {i}: для части 1 обязателен correct_answer")
            continue
        try:
            dup = (await db.execute(
                select(Task).where(
                    Task.exam_type == t.exam_type,
                    Task.task_number == t.task_number,
                    Task.condition_text == t.condition_text,
                )
            )).scalar_one_or_none()
            if dup:
                skipped += 1
                continue
            async with db.begin_nested():  # savepoint: сбой строки откатывает только её
                await create_task_with_skills(db, t)
            added += 1
        except Exception as exc:  # нарушение констрейнта и т.п. — не роняем батч
            errors.append(f"задача {i}: {exc.__class__.__name__}")
    await db.commit()
    return ImportReport(added=added, skipped=skipped, errors=errors)


@app.get("/api/tasks")
async def list_tasks(
    exam_type: Optional[ExamType] = None,
    task_number: Optional[int] = Query(default=None, ge=1, le=25),
    topic: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Публичный список задач с ПАГИНАЦИЕЙ (limit/offset) — держит 10 000+ записей.

    Решения и критерии НЕ отдаются (TaskStudentOut). Сортировка стабильная
    (task_number, id), чтобы страницы не «прыгали» между запросами.
    """
    from sqlalchemy import func as sa_func

    base = select(Task).where(Task.is_published.is_(True))
    if exam_type:
        base = base.where(Task.exam_type == exam_type)
    if task_number is not None:
        base = base.where(Task.task_number == task_number)
    if topic:
        base = base.where(Task.topic == topic)

    total = (await db.execute(select(sa_func.count()).select_from(base.subquery()))).scalar_one()
    rows = (
        await db.execute(base.order_by(Task.task_number, Task.id).limit(limit).offset(offset))
    ).scalars().all()

    return {
        "items": [TaskStudentOut.from_orm_(t) for t in rows],
        "meta": {"total": int(total), "limit": limit, "offset": offset, "hasMore": offset + limit < total},
    }


@app.get("/api/tasks/topics")
async def topics(exam_type: ExamType = ExamType.EGE, db: AsyncSession = Depends(get_db)):
    """Список тем с числом задач — для банка и тепловой карты."""
    rows = (await db.execute(
        select(Task).where(Task.exam_type == exam_type, Task.is_published.is_(True))
    )).scalars().all()
    by_topic: dict[str, int] = {}
    for t in rows:
        by_topic[t.topic] = by_topic.get(t.topic, 0) + 1
    return [{"topic": k, "count": v} for k, v in sorted(by_topic.items())]


# ─────────────────── тренажёр темы: лента + проверка ───────────────────
from .models import TaskProgress  # noqa: E402


def normalize_answer(raw: str) -> str:
    """« 0,15 » → «0.15»: регистр, пробелы и запятая не значат."""
    return "".join(raw.lower().split()).replace(",", ".")


def answers_match(given: str, reference: str) -> bool:
    """Числовое сравнение: 0.150 == 0,15 == 0.15 (не строковое!)."""
    g, r = normalize_answer(given), normalize_answer(reference)
    if g == r:
        return True
    try:
        return abs(float(g) - float(r)) < 1e-9
    except ValueError:
        return False


@app.get("/api/topics/{number}/feed")
async def topic_feed(
    number: int,
    limit: Optional[int] = Query(default=5, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    user_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Страница пула темы: ТОЛЬКО нерешённые задачи пользователя.

    Дедупликация — LEFT JOIN task_progress по (user_id, task_id):
    решённые верно задачи в выдачу не попадают, limit/offset считаются
    внутри отфильтрованного списка (зеркалит демо-режим фронтенда).
    user_id временно передаётся параметром; в проде — из JWT.
    """
    from sqlalchemy import func as sa_func

    uid = uuid.UUID(user_id) if user_id else None

    pool_filter = [
        Task.is_published.is_(True),
        Task.task_number == number,
        Task.is_second_part.is_(False),
    ]
    # Подзапрос id решённых ВЕРНО задач пользователя (использует PK user_id+task_id).
    solved_subq = None
    if uid:
        solved_subq = (
            select(TaskProgress.task_id)
            .where(TaskProgress.user_id == uid, TaskProgress.solved.is_(True))
        )

    base = select(Task).where(*pool_filter)
    if solved_subq is not None:
        base = base.where(Task.id.notin_(solved_subq))

    # Пул и нерешённые считаем в SQL (COUNT), а не грузим всё в Python.
    total = (await db.execute(select(sa_func.count()).select_from(base.subquery()))).scalar_one()
    all_count = (
        await db.execute(select(sa_func.count()).select_from(select(Task).where(*pool_filter).subquery()))
    ).scalar_one()

    end = None if limit is None else offset + limit
    stmt = base.order_by(Task.id)
    if limit is not None:
        stmt = stmt.limit(limit).offset(offset)
    items = (await db.execute(stmt)).scalars().all()

    # Решения не отдаём (TaskStudentOut) — разбор только после верного решения.
    return {
        "items": [TaskStudentOut.from_orm_(t) for t in items],
        "meta": {
            "total": int(all_count),
            "solved": int(all_count - total),
            "remaining": int(total),
            "hasMore": end is not None and end < total,
        },
    }


class CheckIn(BaseModel):
    answer: str
    user_id: Optional[str] = None  # в проде — из JWT


@app.post("/api/tasks/{task_id}/check")
async def check_task(task_id: str, body: CheckIn, db: AsyncSession = Depends(get_db)):
    """Проверка ответа с числовой нормализацией; верный ответ
    фиксируется в task_progress → задача больше не попадёт в ленту."""
    task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Задача не найдена")
    if not task.correct_answer:
        raise HTTPException(400, "Задача части 2 проверяется преподавателем вручную")

    correct = answers_match(body.answer, task.correct_answer)
    skills_impacted: list = []
    if body.user_id:
        from .models import AttemptStatus, TaskAttempt, VariantAttempt

        uid = uuid.UUID(body.user_id)
        existing = (await db.execute(
            select(TaskProgress).where(
                TaskProgress.user_id == uid, TaskProgress.task_id == task.id
            )
        )).scalar_one_or_none()
        if existing is None:
            # первая попытка — создаём запись (пока не решена)
            db.add(TaskProgress(user_id=uid, task_id=task.id, solved=correct))
        else:
            # каждая попытка учитывается; «решена» фиксируется один раз
            existing.attempt_count = (existing.attempt_count or 0) + 1
            if correct:
                existing.solved = True
                if existing.solved_at is None:
                    from datetime import datetime, timezone as _tz
                    existing.solved_at = datetime.now(_tz.utc)

        # Тренировочная сессия (без варианта) + попытка задачи, чтобы
        # движок Mastery пересчитал уровень затронутых навыков.
        session = VariantAttempt(student_id=uid, variant_id=None)
        db.add(session)
        await db.flush()
        ta = TaskAttempt(
            attempt_id=session.id,
            task_id=task.id,
            status=AttemptStatus.CORRECT if correct else AttemptStatus.INCORRECT,
            given_answer=body.answer,
            mode=TrainingMode.TOPIC_TRAINING,
            difficulty=task.difficulty_level,
        )
        db.add(ta)
        await db.flush()

        # Пересчёт Mastery с возвратом дельты (синхронно, чтобы ученик
        # сразу увидел изменение уровня навыка).
        skills_impacted = await recalculate_with_diff(db, uid, [ta.id])
        await db.commit()

    # Безопасность: правильный ответ НИКОГДА не возвращается при неверном
    # ответе — иначе ученик может отправить что угодно и прочитать эталон
    # из ответа API, не решая задачу. Эталон отдаём только когда ответ верен
    # (подтверждение). Разбор после неудачи идёт через /solution, который
    # открывает решение, если была хотя бы одна попытка.
    return {
        "correct": correct,
        "normalized_given": normalize_answer(body.answer),
        "normalized_answer": normalize_answer(task.correct_answer) if correct else None,
        # Навыки, затронутые попыткой, и изменение mastery по каждому.
        "skills_impacted": skills_impacted,
    }


@app.get("/api/tasks/{task_id}/solution")
async def get_solution(
    task_id: str,
    user_id: Optional[str] = None,  # в проде — из JWT
    db: AsyncSession = Depends(get_db),
):
    """Разбор задачи — после того, как ученик СДЕЛАЛ ПОПЫТКУ.

    Дизайн-решение: разбор открывается после любой попытки (верной или
    неверной), а не только после верного решения. Это позволяет ученику
    посмотреть разбор после неудачи и понять ошибку — так полезнее для
    обучения. Безопасность сохраняется: без попытки (записи в
    task_progress) разбор не выдаётся, иначе 403.
    """
    task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Задача не найдена")
    if not user_id:
        raise HTTPException(403, "Разбор доступен после попытки решения")
    progress = (await db.execute(
        select(TaskProgress).where(
            TaskProgress.user_id == uuid.UUID(user_id), TaskProgress.task_id == task.id
        )
    )).scalar_one_or_none()
    # Попытка была, если запись существует (она создаётся при первой проверке,
    # даже неверной). attempt_count > 0 — явный признак сделанной попытки.
    if not progress or not progress.attempt_count:
        raise HTTPException(403, "Разбор открывается после попытки решения задачи")
    return {
        "solution_text": task.solution_text,
        "criteria": task.criteria,
        "attempts": progress.attempt_count,
        "solved": progress.solved,
    }


# ─────────────────────────── регистрация ───────────────────────────
@app.post("/api/auth/register", status_code=201)
async def register(body: RegisterIn, db: AsyncSession = Depends(get_db)):
    """Регистрация без обязательной почты.

    Возвращает одноразовый резервный код (recovery_code) — он заменяет
    восстановление по e-mail. Ученик должен сохранить его: по коду + нику
    можно сбросить пароль через /api/auth/recover.
    """
    from .models import User
    nick = body.nickname.strip().lower()
    exists = (await db.execute(select(User).where(User.nickname == nick))).scalar_one_or_none()
    if exists:
        raise HTTPException(409, "Такой ник уже занят")

    # Привязка к преподавателю по коду (если указан и найден).
    teacher_id: Optional[uuid.UUID] = None
    if body.teacher_code:
        from .models import UserRole as _UR
        teacher = (
            await db.execute(
                select(User).where(User.teacher_code == body.teacher_code.strip().upper(), User.role == _UR.TEACHER)
            )
        ).scalar_one_or_none()
        if teacher is not None:
            teacher_id = teacher.id

    recovery_code = generate_recovery_code()
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),  # bcrypt, plaintext никогда не сохраняется
        full_name=body.full_name,
        nickname=nick,
        telegram_id=body.telegram_id,
        teacher_id=teacher_id,
        recovery_code_hash=hash_password(normalize_recovery_code(recovery_code)),
    )
    db.add(user)
    await db.commit()
    return {
        "id": str(user.id),
        "nickname": user.nickname,
        "teacher_id": str(teacher_id) if teacher_id else None,
        "recovery_code": recovery_code,  # показывается один раз
        # Сразу выдаём токен, чтобы ученик мог работать с БД без повторного входа.
        "token": create_token(str(user.id), user.role.value),
        "role": user.role.value,
        "user": _user_public(user),
    }


class RecoverIn(BaseModel):
    nickname: str
    recovery_code: str
    new_password: str = Field(min_length=4, max_length=128)


@app.post("/api/auth/recover")
async def recover_password(body: RecoverIn, db: AsyncSession = Depends(get_db)):
    """Восстановление пароля БЕЗ почты — по нику + резервному коду.

    Код выдаётся один раз при регистрации. При успешном сбросе пароль
    меняется; код остаётся действительным (многоразовый), пока пользователь
    не сменит его. Бесплатно, не требует почтового сервиса.
    """
    from .models import User
    user = (
        await db.execute(select(User).where(User.nickname == body.nickname.strip().lower()))
    ).scalar_one_or_none()
    if user is None or not user.recovery_code_hash:
        raise HTTPException(400, "Неверный ник или код")
    if not verify_password(normalize_recovery_code(body.recovery_code), user.recovery_code_hash):
        raise HTTPException(400, "Неверный ник или код")
    user.password_hash = hash_password(body.new_password)
    await db.commit()
    return {"ok": True, "message": "Пароль обновлён"}


class ResetStudentPasswordIn(BaseModel):
    student_nick: str
    new_password: str = Field(min_length=4, max_length=128)


@app.post("/api/teacher/reset-student-password")
async def reset_student_password(
    body: ResetStudentPasswordIn,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Преподаватель сбрасывает пароль привязанному ученику (вместо почты).

    Учитель передаёт новый пароль ученику лично. Разрешено только для
    учеников, привязанных к этому преподавателю (по teacher_id).
    """
    from .models import User, UserRole
    student = (
        await db.execute(select(User).where(User.nickname == body.student_nick.strip().lower()))
    ).scalar_one_or_none()
    if student is None or student.role != UserRole.STUDENT:
        raise HTTPException(404, "Ученик не найден")
    if student.teacher_id != teacher.id:
        raise HTTPException(403, "Этот ученик не привязан к вам")
    student.password_hash = hash_password(body.new_password)
    await db.commit()
    return {"ok": True, "message": f"Пароль для @{student.nickname} обновлён"}


# ══════════════════════════════════════════════════════════════════════
# Авторизация (HMAC-токены, без внешних зависимостей) + варианты (API v1)
# ══════════════════════════════════════════════════════════════════════

class LoginIn(BaseModel):
    email: Optional[str] = None
    password: str
    # Универсальный вход: можно войти по нику (как на фронтенде) или по email.
    nickname: Optional[str] = None


def _user_public(user: User) -> dict:
    """Публичное представление пользователя для фронтенда."""
    return {
        "id": str(user.id),
        "nickname": user.nickname,
        "full_name": user.full_name,
        "role": user.role.value,
        "email": user.email,
        "teacher_id": str(user.teacher_id) if user.teacher_id else None,
        "teacher_code": user.teacher_code,
    }


@app.post("/api/v1/auth/login")
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)):
    """Вход по нику или email: возвращает токен, роль и профиль.

    Пароли проверяются через bcrypt; legacy plaintext-пароли
    (демо-аккаунты) при успешном входе автоматически заменяются хешем
    (бесшовная миграция).
    """
    from .models import User
    user: Optional[User] = None
    if body.nickname:
        user = (
            await db.execute(select(User).where(User.nickname == body.nickname.strip().lower()))
        ).scalar_one_or_none()
    if user is None and body.email:
        user = (
            await db.execute(select(User).where(User.email == body.email.lower()))
        ).scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Неверный логин или пароль")
    # Бесшовная миграция: plaintext → bcrypt при первом успешном входе.
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)
        await db.commit()
    return {
        "token": create_token(str(user.id), user.role.value),
        "role": user.role.value,
        "nickname": user.nickname,
        "user": _user_public(user),
    }


class BindTeacherIn(BaseModel):
    teacher_code: str = Field(min_length=1, max_length=24)


@app.post("/api/students/bind-teacher")
async def bind_teacher(
    body: BindTeacherIn,
    student: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Привязка ученика к преподавателю по коду приглашения.

    Находит преподавателя по ``teacher_code`` и обновляет ``teacher_id``
    в профиле ученика. Вся накопленная статистика ученика (попытки,
    решения, XP, журнал ошибок) уже связана с его ``user_id``/ником,
    поэтому после привязки она моментально становится видна в кабинете
    репетитора (выборка идёт по ``teacher_id``). Локальные демо-данные
    из localStorage синхронизируются на фронтенде при этом же вызове.
    """
    from .models import UserRole

    code = body.teacher_code.strip().upper()
    teacher = (
        await db.execute(
            select(User).where(User.teacher_code == code, User.role == UserRole.TEACHER)
        )
    ).scalar_one_or_none()
    if teacher is None:
        raise HTTPException(404, f"Преподаватель с кодом {code} не найден")
    if teacher.id == student.id:
        raise HTTPException(400, "Нельзя привязаться к самому себе")

    student.teacher_id = teacher.id
    await db.commit()
    return {
        "ok": True,
        "teacher": {
            "id": str(teacher.id),
            "nickname": teacher.nickname,
            "full_name": teacher.full_name,
            "code": teacher.teacher_code,
        },
    }


@app.delete("/api/students/bind-teacher")
async def unbind_teacher(
    student: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Отвязка ученика от преподавателя (смена кода = отвязка + новая привязка)."""
    student.teacher_id = None
    await db.commit()
    return {"ok": True}


# ─────────────────────────── Pydantic-схемы ───────────────────────────

class TaskSchema(BaseModel):
    """Одна задача варианта. Строгая валидация LaTeX-полей, ответов и типов."""

    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(min_length=1)
    number: int = Field(ge=1)
    topic: str = Field(min_length=1, max_length=120)
    # Условие с LaTeX обязательно.
    latex_statement: str = Field(min_length=1)
    # Эталон для части 1; для части 2 должен быть null.
    answer: Optional[str] = None
    solution_latex: Optional[str] = None
    points: int = Field(ge=0, default=1)
    type: Literal["short_answer", "detailed_answer"]

    @field_validator("answer", "solution_latex", "latex_statement")
    @classmethod
    def _strip_str(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if isinstance(v, str) else v

    @model_validator(mode="after")
    def _answer_by_type(self) -> "TaskSchema":
        if self.type == "short_answer" and not self.answer:
            raise ValueError("для short_answer обязательно поле answer")
        if self.type == "detailed_answer":
            # Развёрнутый ответ проверяет преподаватель — эталон не нужен.
            self.answer = None
        return self


class VariantCreateSchema(BaseModel):
    """Входной JSON варианта (формат совпадает с фронтендом)."""

    model_config = ConfigDict(populate_by_name=True)

    variantTitle: str = Field(min_length=1, max_length=200)
    subject: Literal["math_profile", "math_base"] = "math_profile"
    timeLimitMinutes: int = Field(ge=1, le=600, default=235)
    tasks: List[TaskSchema] = Field(min_length=1)

    @field_validator("tasks")
    @classmethod
    def _unique_numbers(cls, v: List[TaskSchema]) -> List[TaskSchema]:
        nums = [t.number for t in v]
        if len(nums) != len(set(nums)):
            raise ValueError("номера задач должны быть уникальны")
        return v


class VariantTaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    number: int
    topic: str
    latex_statement: str
    answer: Optional[str]
    solution_latex: Optional[str]
    points: int
    type: str


class VariantOut(BaseModel):
    """Структурированный вариант для прохождения (публичный)."""

    id: str
    variantTitle: str
    subject: str
    timeLimitMinutes: int
    tasks: List[VariantTaskOut]
    publicUrl: str


# ─────────────────────────── помощники ───────────────────────────

_SHORT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # без 0/O/1/I


def _make_short_code(n: int = 8) -> str:
    return "VAR-" + "".join(secrets.choice(_SHORT_ALPHABET) for _ in range(n))


def _variant_to_out(v: Variant) -> VariantOut:
    base = os.getenv("PUBLIC_BASE_URL", "http://localhost:5173")
    return VariantOut(
        id=str(v.id),
        variantTitle=v.title,
        subject=v.subject,
        timeLimitMinutes=v.time_limit_minutes,
        tasks=[VariantTaskOut(**t) for t in v.tasks_json],
        publicUrl=f"{base}/?variant={v.short_code}",
    )


# ─────────────────────────── эндпоинты ───────────────────────────

@app.post("/api/v1/variants/upload", status_code=201)
async def upload_variant(
    body: VariantCreateSchema,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Загрузка варианта. Только для авторизованных преподавателей.

    Валидируется Pydantic-схемой, сохраняется в БД (задачи — в JSONB),
    возвращает variant_id и публичную короткую ссылку.
    """
    # Генерируем уникальный короткий код (страхуемся от коллизий).
    for _ in range(5):
        code = _make_short_code()
        exists = (await db.execute(select(Variant).where(Variant.short_code == code))).scalar_one_or_none()
        if exists is None:
            break
    else:  # pragma: no cover
        raise HTTPException(500, "Не удалось сгенерировать уникальный код")

    variant = Variant(
        short_code=code,
        title=body.variantTitle,
        subject=body.subject,
        time_limit_minutes=body.timeLimitMinutes,
        tasks_json=[t.model_dump() for t in body.tasks],
        created_by_teacher_id=teacher.id,
    )
    db.add(variant)
    await db.commit()
    await db.refresh(variant)

    return {
        "variant_id": str(variant.id),
        "short_code": variant.short_code,
        "public_url": _variant_to_out(variant).publicUrl,
    }


@app.get("/api/v1/variants/{variant_id}", response_model=VariantOut)
async def get_variant(variant_id: str, db: AsyncSession = Depends(get_db)):
    """Публичное получение варианта (без авторизации).

    Принимает как UUID, так и короткий код из ссылки.
    """
    stmt = select(Variant)
    try:
        stmt = stmt.where(Variant.id == uuid.UUID(variant_id))
    except ValueError:
        stmt = select(Variant).where(Variant.short_code == variant_id)
    variant = (await db.execute(stmt)).scalar_one_or_none()
    if variant is None:
        raise HTTPException(404, "Вариант не найден")
    return _variant_to_out(variant)


# ─────────────────────────── методички ───────────────────────────
# Метаданные — в БД (materials), сам файл — на диске в MATERIALS_DIR.
# Скачивание идёт через /api/materials/{id}/download, поэтому файл
# живёт на сервере и виден всем ученикам (а не в чьём-то localStorage).
MATERIALS_DIR = Path(__file__).resolve().parent.parent / "materials"
ALLOWED_MATERIAL_TYPES = {"application/pdf", "application/x-pdf"}


class MaterialOut(BaseModel):
    id: str
    title: str
    tag: str
    topic: str
    part: int
    pages: int
    downloads: int
    file_size_kb: Optional[int] = None
    has_file: bool

    @classmethod
    def from_orm_(cls, m: Material) -> "MaterialOut":
        return cls(
            id=str(m.id), title=m.title, tag=m.tag, topic=m.topic,
            part=m.part, pages=m.pages, downloads=m.downloads,
            file_size_kb=m.file_size_kb, has_file=bool(m.file_name),
        )


@app.get("/api/materials", response_model=List[MaterialOut])
async def list_materials(db: AsyncSession = Depends(get_db)):
    """Список методичек (публичный) — для раздела «Теория»."""
    rows = (await db.execute(select(Material).order_by(Material.created_at.desc()))).scalars().all()
    return [MaterialOut.from_orm_(m) for m in rows]


@app.post("/api/materials/upload", response_model=MaterialOut, status_code=201)
async def upload_material(
    title: str = Form(...),
    tag: str = Form("Методичка"),
    topic: str = Form("Общее"),
    part: int = Form(0),
    pages: int = Form(1),
    file: Optional[UploadFile] = File(None),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Загрузка методички (только преподаватель).

    Файл сохраняется на диск в materials/, метаданные — в БД.
    """
    file_name: Optional[str] = None
    file_size_kb: Optional[int] = None

    if file is not None:
        if (file.content_type or "") not in ALLOWED_MATERIAL_TYPES and not (file.filename or "").lower().endswith(".pdf"):
            raise HTTPException(400, "Нужен файл PDF")
        data = await file.read()
        if not data:
            raise HTTPException(400, "Пустой файл")
        MATERIALS_DIR.mkdir(parents=True, exist_ok=True)
        file_name = f"mat-{uuid.uuid4().hex}.pdf"
        (MATERIALS_DIR / file_name).write_bytes(data)
        file_size_kb = len(data) // 1024

    m = Material(
        title=title.strip() or "Методичка",
        tag=tag.strip() or "Методичка",
        topic=topic.strip() or "Общее",
        part=part, pages=max(1, pages),
        file_name=file_name, file_size_kb=file_size_kb,
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return MaterialOut.from_orm_(m)


@app.get("/api/materials/{material_id}/download")
async def download_material(material_id: str, db: AsyncSession = Depends(get_db)):
    """Скачивание файла методички (публичный). Инкрементирует счётчик скачиваний."""
    try:
        mid = uuid.UUID(material_id)
    except ValueError:
        raise HTTPException(404, "Методичка не найдена")
    m = (await db.execute(select(Material).where(Material.id == mid))).scalar_one_or_none()
    if m is None or not m.file_name:
        raise HTTPException(404, "Файл методички не найден")
    path = MATERIALS_DIR / m.file_name
    if not path.is_file():
        raise HTTPException(404, "Файл методички отсутствует на сервере")
    m.downloads += 1
    await db.commit()
    safe_title = "".join(c if c.isalnum() else "_" for c in m.title)[:60] or "metodichka"
    return FileResponse(path, media_type="application/pdf", filename=f"{safe_title}.pdf")


@app.delete("/api/materials/{material_id}", status_code=204)
async def delete_material(
    material_id: str,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Удаление методички (только преподаватель). Удаляет и файл с диска."""
    try:
        mid = uuid.UUID(material_id)
    except ValueError:
        raise HTTPException(404, "Методичка не найдена")
    m = (await db.execute(select(Material).where(Material.id == mid))).scalar_one_or_none()
    if m is None:
        raise HTTPException(404, "Методичка не найдена")
    if m.file_name:
        try:
            (MATERIALS_DIR / m.file_name).unlink(missing_ok=True)
        except OSError:
            pass
    await db.delete(m)
    await db.commit()


# ═══════════════════ Попытки вариантов (связь с БД) ═══════════════════

# Шкала ФИПИ: первичный балл (0–33, структура 2027) → тестовый (0–100).
# ⚠️ ЗАГЛУШКА до публикации официальной шкалы для ЕГЭ-2027. Совпадает с фронтендом.
PRIMARY_TO_SECONDARY = {
    0: 0, 1: 5, 2: 9, 3: 14, 4: 18, 5: 22, 6: 26, 7: 31, 8: 36, 9: 41, 10: 46, 11: 51,
    12: 56, 13: 61, 14: 65, 15: 68, 16: 71, 17: 74, 18: 77, 19: 80, 20: 82, 21: 84,
    22: 86, 23: 88, 24: 90, 25: 92, 26: 94, 27: 95, 28: 96, 29: 97, 30: 98, 31: 99,
    32: 100, 33: 100,
}

# Максимальный первичный балл (структура 2027): 13×1 + 2+3+2+2+3+4+4 = 33.
MAX_PRIMARY_SCORE = 33


def primary_to_secondary(primary: int) -> int:
    return PRIMARY_TO_SECONDARY.get(max(0, min(MAX_PRIMARY_SCORE, primary)), 0)


class AttemptTaskAnswer(BaseModel):
    task_number: int
    answer: str
    # Секунды, потраченные на задачу (для Time Penalty в Readiness). None = неизвестно.
    time_spent: Optional[int] = None


class AttemptSubmitIn(BaseModel):
    variant_id: str
    answers: List[AttemptTaskAnswer]
    time_spent_seconds: Optional[int] = None
    # Режим попытки: practice / topic_training / mixed_training / diagnostic /
    # exam / exam_simulation. Readiness пересчитывается только для
    # exam / diagnostic / exam_simulation. None трактуется как practice.
    mode: Optional[str] = None


@app.post("/api/v1/attempts/submit", status_code=201)
async def submit_attempt(
    body: AttemptSubmitIn,
    background_tasks: BackgroundTasks,
    student: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Отправка попытки: автопроверка части 1, подсчёт баллов, запись в БД.

    Часть 1 проверяется сразу (по эталону), часть 2 — 0 баллов до ручной
    проверки преподавателем. Попытка становится видна в кабинете репетитора.
    """
    from .models import AttemptStatus, TaskAttempt, VariantAttempt

    try:
        vid = uuid.UUID(body.variant_id)
    except ValueError:
        raise HTTPException(404, "Вариант не найден")
    variant = (await db.execute(select(Variant).where(Variant.id == vid))).scalar_one_or_none()
    if variant is None:
        raise HTTPException(404, "Вариант не найден")

    # Карта ответов ученика: номер → ответ и номер → время (секунды).
    given = {a.task_number: a.answer for a in body.answers}
    given_time = {a.task_number: a.time_spent for a in body.answers}

    # Режим попытки: None трактуем как practice.
    mode_enum: Optional[TrainingMode] = None
    if body.mode:
        try:
            mode_enum = TrainingMode(body.mode)
        except ValueError:
            mode_enum = TrainingMode.PRACTICE

    primary = 0
    task_rows = []
    for t in variant.tasks_json:
        if t.get("type") != "short_answer":
            continue  # часть 2 — вручную
        number = t.get("number")
        reference = t.get("answer")
        if not reference:
            continue
        ans = given.get(number)
        if ans is None or not str(ans).strip():
            status = AttemptStatus.SKIPPED
        elif answers_match(str(ans), str(reference)):
            status = AttemptStatus.CORRECT
            primary += 1
        else:
            status = AttemptStatus.INCORRECT
        task_rows.append((number, status, ans, given_time.get(number)))

    secondary = primary_to_secondary(primary)
    attempt = VariantAttempt(
        student_id=student.id,
        variant_id=variant.id,
        primary_score=primary,
        secondary_score=secondary,
    )
    db.add(attempt)
    await db.flush()  # чтобы получить attempt.id

    # Записываем результат каждой задачи части 1 (с режимом и временем) и собираем id.
    created_task_attempt_ids = []
    tasks_by_number = {t.get("number"): t for t in variant.tasks_json}
    for number, status, ans, time_spent in task_rows:
        t = tasks_by_number.get(number)
        if not t or not t.get("id"):
            continue
        ta = TaskAttempt(
            attempt_id=attempt.id,
            task_id=uuid.UUID(t["id"]),
            status=status,
            given_answer=ans,
            mode=mode_enum,
            time_spent=time_spent,
        )
        db.add(ta)
        created_task_attempt_ids.append(ta.id)
    await db.commit()

    # Mastery пересчитываем СИНХРОННО, чтобы вернуть ученику дельту уровня
    # по каждому затронутому навыку (требование Этапа 7).
    skills_impacted: list = []
    if created_task_attempt_ids:
        skills_impacted = await recalculate_with_diff(
            db, student.id, created_task_attempt_ids
        )
        # Readiness — ТОЛЬКО если попытка экзаменационная
        # (exam / diagnostic / exam_simulation) — фоном.
        if mode_enum in EXAM_MODES:
            background_tasks.add_task(
                background_recalculate_readiness, student.id, created_task_attempt_ids
            )

    return {
        "id": str(attempt.id),
        "primary_score": primary,
        "secondary_score": secondary,
        "answered": len(task_rows),
        # Навыки, затронутые попыткой, и изменение mastery по каждому.
        "skills_impacted": skills_impacted,
    }


@app.get("/api/teacher/students")
async def teacher_students(
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Кабинет репетитора: его ученики + статистика (баллы, попытки)."""
    from .models import UserRole, VariantAttempt
    from sqlalchemy import func as sa_func

    students = (
        await db.execute(select(User).where(User.teacher_id == teacher.id, User.role == UserRole.STUDENT))
    ).scalars().all()

    result = []
    for s in students:
        stats = (
            await db.execute(
                select(
                    sa_func.count(VariantAttempt.id),
                    sa_func.avg(VariantAttempt.secondary_score),
                    sa_func.max(VariantAttempt.secondary_score),
                ).where(VariantAttempt.student_id == s.id)
            )
        ).one()
        attempts_count, avg_score, best_score = stats
        result.append({
            "id": str(s.id),
            "nickname": s.nickname,
            "full_name": s.full_name,
            "attempts": int(attempts_count or 0),
            "avg_score": round(float(avg_score), 1) if avg_score is not None else None,
            "best_score": int(best_score) if best_score is not None else None,
        })

    return {"students": result}


@app.get("/api/admin/students")
async def admin_students(
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Статистика сайта: ВСЕ ученики из БД (не только привязанные к учителю).

    Используется панелью «Статистика сайта» (SiteStatsPanel), чтобы
    отображать реально зарегистрированных пользователей из БД, а не
    локальную демо-копию. Доступно преподавателю/админу.
    """
    from .models import UserRole, VariantAttempt, TaskProgress
    from sqlalchemy import func as sa_func

    students = (
        await db.execute(select(User).where(User.role == UserRole.STUDENT))
    ).scalars().all()

    result = []
    for s in students:
        stats = (
            await db.execute(
                select(
                    sa_func.count(VariantAttempt.id),
                    sa_func.avg(VariantAttempt.secondary_score),
                    sa_func.max(VariantAttempt.secondary_score),
                ).where(VariantAttempt.student_id == s.id)
            )
        ).one()
        attempts_count, avg_score, best_score = stats
        solved = (
            await db.execute(
                select(sa_func.count(TaskProgress.task_id)).where(
                    TaskProgress.user_id == s.id, TaskProgress.solved == True
                )
            )
        ).scalar()
        result.append({
            "id": str(s.id),
            "nickname": s.nickname,
            "full_name": s.full_name,
            "goal": None,
            "streak_days": s.streak_days,
            "xp": s.xp,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "attempts": int(attempts_count or 0),
            "avg_score": round(float(avg_score), 1) if avg_score is not None else None,
            "best_score": int(best_score) if best_score is not None else None,
            "solved": int(solved or 0),
        })

    return {"students": result}


@app.get("/api/students/{student_id}/profile/readiness")
async def student_readiness_profile(
    student_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Готовность ученика к каждой линии КИМ (Этап 5).

    Возвращает массив по линиям 1–20:
      line_number, readiness, confidence, total/correct exam attempts,
      average_exam_time, last_exam_at,
      а также aggregated_mastery — усреднённый Mastery навыков линии,
      чтобы фронтенд показал разрыв: «знаешь на 90%, на экзамене — 40%».

    НЕ прогнозирует общий тестовый балл (0–100) — только готовность к линиям.
    """
    from .services.readiness_engine import _aggregated_mastery_for_line

    try:
        sid = uuid.UUID(student_id)
    except ValueError:
        raise HTTPException(404, "Ученик не найден")

    student = (await db.execute(select(User).where(User.id == sid))).scalar_one_or_none()
    if student is None:
        raise HTTPException(404, "Ученик не найден")

    lines = (
        await db.execute(
            select(StudentExamLine).where(StudentExamLine.student_id == sid)
        )
    ).scalars().all()
    by_line = {ln.line_number: ln for ln in lines}

    result = []
    for line_number in range(1, 21):
        ln = by_line.get(line_number)
        mastery = await _aggregated_mastery_for_line(db, sid, line_number)
        result.append({
            "line_number": line_number,
            "readiness": ln.readiness if ln else None,
            "confidence": ln.confidence if ln else None,
            "total_exam_attempts": ln.total_exam_attempts if ln else 0,
            "correct_exam_attempts": ln.correct_exam_attempts if ln else 0,
            "average_exam_time": ln.average_exam_time if ln else None,
            "last_exam_at": ln.last_exam_at.isoformat() if (ln and ln.last_exam_at) else None,
            # Усреднённый Mastery навыков линии (None, если данных нет) —
            # для показа разрыва «знаешь 90%, на экзамене 40%».
            "aggregated_mastery": round(mastery * 100, 1) if mastery is not None else None,
        })

    return {"student_id": str(sid), "lines": result}


@app.get("/api/students/{student_id}/profile/mastery")
async def student_mastery_profile(
    student_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Дерево освоения навыков ученика (Этап 7).

    Возвращает иерархию: линия КИМ → подтема → навык, где у каждого
    навыка есть mastery (0–100), confidence, attempts, correct_attempts,
    average_time, last_practiced, stability.

    Фронтенд строит из этого дерево навыков и блок слабых мест.
    """
    from .models import StudentSkill, Subtopic

    try:
        sid = uuid.UUID(student_id)
    except ValueError:
        raise HTTPException(404, "Ученик не найден")

    student = (await db.execute(select(User).where(User.id == sid))).scalar_one_or_none()
    if student is None:
        raise HTTPException(404, "Ученик не найден")

    # Все навыки (группируем по line_number → subtopic).
    skills = (await db.execute(select(Skill))).scalars().all()
    subtopics = (await db.execute(select(Subtopic))).scalars().all()
    subtopic_by_id = {st.id: st for st in subtopics}

    # Освоение ученика по навыкам.
    student_skills = (
        await db.execute(select(StudentSkill).where(StudentSkill.student_id == sid))
    ).scalars().all()
    ss_by_skill = {ss.skill_id: ss for ss in student_skills}

    lines: dict = {}
    for sk in skills:
        line_number = sk.line_number
        st = subtopic_by_id.get(sk.subtopic_id)
        subtopic_id = str(st.id) if st else None
        subtopic_title = st.title if st else "Общее"
        subtopic_order = st.order if st else 0

        ss = ss_by_skill.get(sk.id)
        skill_obj = {
            "skill_id": str(sk.id),
            "title": sk.title,
            "difficulty": sk.difficulty,
            "mastery": ss.mastery if ss else None,
            "confidence": ss.confidence if ss else None,
            "attempts": ss.attempts if ss else 0,
            "correct_attempts": ss.correct_attempts if ss else 0,
            "average_time": ss.average_time if ss else None,
            "last_practiced": ss.last_practiced.isoformat() if (ss and ss.last_practiced) else None,
            "stability": ss.stability if ss else None,
        }

        line = lines.setdefault(line_number, {})
        key = (subtopic_id, subtopic_title, subtopic_order)
        line.setdefault(key, []).append(skill_obj)

    result = []
    for line_number in sorted(lines.keys()):
        subtopics_out = []
        for (subtopic_id, subtopic_title, subtopic_order), skill_list in lines[line_number].items():
            subtopics_out.append({
                "subtopic_id": subtopic_id,
                "title": subtopic_title,
                "order": subtopic_order,
                "skills": skill_list,
            })
        subtopics_out.sort(key=lambda s: s["order"])
        result.append({"line_number": line_number, "subtopics": subtopics_out})

    return {"student_id": str(sid), "lines": result}


class ErrorPatternIn(BaseModel):
    # calculation / theory / model / method / reading / time / careless / unknown
    pattern: str


@app.post("/api/task_attempts/{task_attempt_id}/error_pattern", status_code=201)
async def classify_error_pattern(
    task_attempt_id: str,
    body: ErrorPatternIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Классификация ошибки (Этап 7).

    Ученик или преподаватель выбирает категорию ошибки:
    невнимательность, теория, вычисления, метод и т.д.
    Категория влияет на снижение Mastery (careless слабее, чем theory).
    """
    from .models import ErrorPattern, TaskAttempt, TaskErrorPattern

    try:
        pattern_enum = ErrorPattern(body.pattern)
    except ValueError:
        raise HTTPException(400, f"Неизвестная категория ошибки: {body.pattern}")

    try:
        ta_id = uuid.UUID(task_attempt_id)
    except ValueError:
        raise HTTPException(404, "Попытка не найдена")

    ta = (
        await db.execute(select(TaskAttempt).where(TaskAttempt.id == ta_id))
    ).scalar_one_or_none()
    if ta is None:
        raise HTTPException(404, "Попытка не найдена")

    # Обновляем существующую классификацию или создаём новую.
    existing = (
        await db.execute(
            select(TaskErrorPattern).where(TaskErrorPattern.task_attempt_id == ta_id)
        )
    ).scalar_one_or_none()
    if existing:
        existing.pattern = pattern_enum
        existing.assigned_by_user_id = user.id
        existing.source = "teacher" if user.role == UserRole.TEACHER else "manual"
    else:
        db.add(TaskErrorPattern(
            task_attempt_id=ta_id,
            pattern=pattern_enum,
            assigned_by_user_id=user.id,
            source="teacher" if user.role == UserRole.TEACHER else "manual",
        ))
    await db.commit()

    return {"task_attempt_id": task_attempt_id, "pattern": pattern_enum.value}
