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

import base64
import hashlib
import hmac
import json as _json
import os
import secrets
import time
import uuid
from contextlib import asynccontextmanager
from typing import List, Literal, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .models import Base, ExamType, Task, User, Variant
from .security import (
    generate_recovery_code,
    hash_password,
    needs_rehash,
    normalize_recovery_code,
    verify_password,
)

# Все секреты и параметры — только из переменных окружения (см. .env.example).
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://komi:komi_secret@localhost:5432/repetytor")
# HMAC_SECRET — основной; SECRET_KEY оставлен как обратной-совместимый alias.
HMAC_SECRET = os.getenv("HMAC_SECRET") or os.getenv("SECRET_KEY") or "dev-secret-change-me"
SECRET_KEY = HMAC_SECRET
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")

# Мастер-аккаунт преподавателя (создаётся автоматически при старте).
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "daniil")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Pudov-Ege-2026")
ADMIN_TEACHER_CODE = os.getenv("ADMIN_TEACHER_CODE", "PUDOV-PRO")
ADMIN_FULL_NAME = os.getenv("ADMIN_FULL_NAME", "Даниил Андреевич Пудов")

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with Session() as s:
        yield s


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
        await conn.run_sync(Base.metadata.create_all)
    try:
        await ensure_admin()
    except Exception as exc:  # не даём сбою сида уронить запуск API
        print(f"[startup] не удалось создать мастер-аккаунт: {exc}")
    yield


app = FastAPI(title="Репетитор из Коми · API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)


# ─────────────────────────── схемы ───────────────────────────
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
@app.post("/api/tasks/import", response_model=ImportReport)
async def import_tasks(body: TaskImportIn, db: AsyncSession = Depends(get_db)):
    """Массовая загрузка. Дубликаты (экзамен+номер+условие) пропускаются."""
    added = skipped = 0
    errors: List[str] = []
    for i, t in enumerate(body.tasks, start=1):
        if not t.is_second_part and not (t.correct_answer or "").strip():
            errors.append(f"задача {i}: для части 1 обязателен correct_answer")
            continue
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
        db.add(Task(**t.model_dump()))
        added += 1
    await db.commit()
    return ImportReport(added=added, skipped=skipped, errors=errors)


@app.get("/api/tasks", response_model=List[TaskOut])
async def list_tasks(
    exam_type: Optional[ExamType] = None,
    task_number: Optional[int] = Query(default=None, ge=1, le=25),
    topic: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Task).where(Task.is_published.is_(True))
    if exam_type:
        stmt = stmt.where(Task.exam_type == exam_type)
    if task_number is not None:
        stmt = stmt.where(Task.task_number == task_number)
    if topic:
        stmt = stmt.where(Task.topic == topic)
    rows = (await db.execute(stmt.order_by(Task.task_number))).scalars().all()
    return [TaskOut.from_orm_(t) for t in rows]


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
    uid = uuid.UUID(user_id) if user_id else None

    solved_ids = []
    if uid:
        rows = (await db.execute(
            select(TaskProgress.task_id).where(TaskProgress.user_id == uid)
        )).scalars().all()
        solved_ids = list(rows)

    stmt = (
        select(Task)
        .where(Task.is_published.is_(True), Task.task_number == number, Task.is_second_part.is_(False))
        .order_by(Task.id)
    )
    pool = list((await db.execute(stmt)).scalars().all())
    unsolved = [t for t in pool if t.id not in solved_ids]

    end = None if limit is None else offset + limit
    items = unsolved[offset:end]
    return {
        "items": [TaskOut.from_orm_(t) for t in items],
        "meta": {
            "total": len(pool),
            "solved": len(pool) - len(unsolved),
            "remaining": len(unsolved),
            "hasMore": end is not None and end < len(unsolved),
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
    if correct and body.user_id:
        uid = uuid.UUID(body.user_id)
        existing = (await db.execute(
            select(TaskProgress).where(
                TaskProgress.user_id == uid, TaskProgress.task_id == task.id
            )
        )).scalar_one_or_none()
        if not existing:
            db.add(TaskProgress(user_id=uid, task_id=task.id))
            await db.commit()

    return {
        "correct": correct,
        "normalized_given": normalize_answer(body.answer),
        "normalized_answer": normalize_answer(task.correct_answer),
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

def _sign(body: str) -> str:
    return hmac.new(SECRET_KEY.encode(), body.encode(), hashlib.sha256).hexdigest()


def create_token(user_id: str, role: str, ttl: int = 7 * 24 * 3600) -> str:
    payload = _json.dumps(
        {"sub": user_id, "role": role, "exp": int(time.time()) + ttl}, separators=(",", ":")
    )
    body = base64.urlsafe_b64encode(payload.encode()).decode()
    return f"{body}.{_sign(body)}"


def decode_token(token: str) -> dict:
    try:
        body, sig = token.split(".", 1)
    except ValueError:
        raise HTTPException(401, "Некорректный токен")
    if not hmac.compare_digest(sig, _sign(body)):
        raise HTTPException(401, "Недействительная подпись токена")
    try:
        payload = _json.loads(base64.urlsafe_b64decode(body.encode()))
    except Exception:
        raise HTTPException(401, "Некорректный токен")
    if payload.get("exp", 0) < time.time():
        raise HTTPException(401, "Токен истёк")
    return payload


class LoginIn(BaseModel):
    email: str
    password: str


@app.post("/api/v1/auth/login")
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)):
    """Вход: возвращает токен и роль. Пароли проверяются через bcrypt;
    legacy plaintext-пароли (демо-аккаунты) при успешном входе
    автоматически заменяются хешем (бесшовная миграция)."""
    user = (await db.execute(select(User).where(User.email == body.email.lower()))).scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Неверный e-mail или пароль")
    # Бесшовная миграция: plaintext → bcrypt при первом успешном входе.
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)
        await db.commit()
    return {
        "token": create_token(str(user.id), user.role.value),
        "role": user.role.value,
        "nickname": user.nickname,
    }


async def get_current_teacher(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Зависимость: только авторизованный преподаватель."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Требуется авторизация (Bearer-токен)")
    payload = decode_token(authorization.split(" ", 1)[1].strip())
    if payload.get("role") != "teacher":
        raise HTTPException(403, "Доступно только преподавателям")
    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(401, "Некорректный токен")
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(401, "Пользователь не найден")
    return user


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Зависимость: любой авторизованный пользователь (ученик/преподаватель)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Требуется авторизация (Bearer-токен)")
    payload = decode_token(authorization.split(" ", 1)[1].strip())
    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(401, "Некорректный токен")
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(401, "Пользователь не найден")
    return user


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
