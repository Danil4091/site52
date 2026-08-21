"""Доменная модель «Репетитор из Коми» (PostgreSQL + SQLAlchemy 2.0).

Поля задач — ровно по ТЗ:
  id, exam_type (ege/oge), task_number (1–19), condition_text,
  solution_text, correct_answer, is_second_part, difficulty_level.
Плюс telegram_id у пользователей — задел под Telegram-бота
(напоминания о стриках, мини-тесты).
"""
from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import (
    Boolean, BigInteger, CheckConstraint, DateTime, Enum as PyEnum,
    ForeignKey, Index, Integer, String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class ExamType(str, Enum):
    EGE = "ege"
    OGE = "oge"


class AttemptStatus(str, Enum):
    CORRECT = "correct"
    INCORRECT = "incorrect"
    CALC_ERROR = "calc_error"
    SKIPPED = "skipped"


class UserRole(str, Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


def _now():
    return func.now()


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    nickname: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    role: Mapped[UserRole] = mapped_column(PyEnum(UserRole, name="user_role"), default=UserRole.STUDENT, nullable=False)

    # Задел под Telegram-бота: напоминания о стриках, мини-тесты.
    telegram_id: Mapped[Optional[int]] = mapped_column(BigInteger, unique=True)

    # Стрики: инкрементируется, если решена хотя бы одна задача за сутки.
    streak_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    best_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_solve_day: Mapped[Optional[str]] = mapped_column(String(10))  # YYYY-MM-DD
    xp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    attempts: Mapped[List["VariantAttempt"]] = relationship(back_populates="student")


class Task(Base):
    """Задача банка — ровно по ТЗ."""
    __tablename__ = "tasks"
    __table_args__ = (
        Index("ix_tasks_exam_number", "exam_type", "task_number"),
        Index("ix_tasks_exam_topic", "exam_type", "topic"),
        CheckConstraint("difficulty_level BETWEEN 1 AND 3", name="ck_tasks_difficulty"),
        CheckConstraint(
            "is_second_part = TRUE OR correct_answer IS NOT NULL",
            name="ck_tasks_part1_needs_answer",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_type: Mapped[ExamType] = mapped_column(PyEnum(ExamType, name="exam_type"), nullable=False)
    task_number: Mapped[int] = mapped_column(Integer, nullable=False)          # 1–19 (ЕГЭ), до 25 (ОГЭ)
    topic: Mapped[str] = mapped_column(String(120), nullable=False)
    condition_text: Mapped[str] = mapped_column(Text, nullable=False)          # LaTeX: $…$ / $$…$$
    solution_text: Mapped[Optional[str]] = mapped_column(Text)
    correct_answer: Mapped[Optional[str]] = mapped_column(String(100))         # NULL для части 2
    is_second_part: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    difficulty_level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    source: Mapped[Optional[str]] = mapped_column(String(255))
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Variant(Base):
    __tablename__ = "variants"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    exam_type: Mapped[ExamType] = mapped_column(PyEnum(ExamType, name="exam_type"), nullable=False)
    exam_year: Mapped[int] = mapped_column(Integer, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class VariantTask(Base):
    """M:N вариант ↔ задача; position = номер в КИМ."""
    __tablename__ = "variant_tasks"
    __table_args__ = (UniqueConstraint("variant_id", "position", name="uq_variant_position"),)
    variant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("variants.id", ondelete="CASCADE"), primary_key=True)
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)


class VariantAttempt(Base):
    __tablename__ = "variant_attempts"
    __table_args__ = (
        Index("ix_attempts_student", "student_id", "started_at"),
        CheckConstraint("primary_score BETWEEN 0 AND 31", name="ck_attempts_primary"),
        CheckConstraint("secondary_score BETWEEN 0 AND 100", name="ck_attempts_secondary"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    variant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("variants.id", ondelete="CASCADE"), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    primary_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    secondary_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    student: Mapped["User"] = relationship(back_populates="attempts")


class TaskAttempt(Base):
    __tablename__ = "task_attempts"
    __table_args__ = (UniqueConstraint("attempt_id", "task_id", name="uq_task_once"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("variant_attempts.id", ondelete="CASCADE"), nullable=False)
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[AttemptStatus] = mapped_column(PyEnum(AttemptStatus, name="attempt_status"), nullable=False)
    given_answer: Mapped[Optional[str]] = mapped_column(String(100))


class TaskProgress(Base):
    """Прогресс тренажёра: какие задачи темы пользователь решил ВЕРНО.

    Именно по связи (user_id, task_id) лента исключает дубли:
    в выдачу попадают только ещё не решённые задачи.
    """
    __tablename__ = "task_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "task_id", name="uq_progress_user_task"),
        Index("ix_progress_user_topic", "user_id"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True)
    solved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
