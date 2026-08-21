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

import uuid
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .models import Base, ExamType, Task

DATABASE_URL = "postgresql+asyncpg://komi:komi_secret@localhost:5432/repetytor"
engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with Session() as s:
        yield s


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="Репетитор из Коми · API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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
    source: Optional[str] = None


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

    @classmethod
    def from_orm_(cls, t: Task) -> "TaskOut":
        return cls(
            id=str(t.id), exam_type=t.exam_type, task_number=t.task_number,
            topic=t.topic, condition_text=t.condition_text,
            solution_text=t.solution_text, is_second_part=t.is_second_part,
            difficulty_level=t.difficulty_level,
        )


class ImportReport(BaseModel):
    added: int
    skipped: int
    errors: List[str]


class RegisterIn(BaseModel):
    email: str
    password: str
    full_name: str
    nickname: str = Field(min_length=2, max_length=32)
    telegram_id: Optional[int] = None  # задел под Telegram-бота


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
    from .models import User
    exists = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if exists:
        raise HTTPException(409, "Такой e-mail уже зарегистрирован")
    user = User(
        email=body.email,
        password_hash=body.password,  # в проде — bcrypt: passlib.hash.bcrypt.hash(...)
        full_name=body.full_name,
        nickname=body.nickname,
        telegram_id=body.telegram_id,
    )
    db.add(user)
    await db.commit()
    return {"id": str(user.id), "nickname": user.nickname}
