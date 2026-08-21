"""Первичная схема: users, variants и сопутствующие таблицы.

Точное отражение app/models.py. Покрывает обязательные по ТЗ таблицы
``users`` и ``variants``, а также задачи, попытки и прогресс тренажёра,
чтобы alembic upgrade head поднимал рабочую базу целиком.

Revision ID: 0001_initial
Revises:
Create Date: 2026-02-11

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── перечисления ────────────────────────────────────────────────
    op.execute("CREATE TYPE exam_type AS ENUM ('ege', 'oge')")
    op.execute("CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin')")
    op.execute(
        "CREATE TYPE attempt_status AS ENUM ('correct', 'incorrect', 'calc_error', 'skipped')"
    )

    # ── users ───────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(128), nullable=False),
        sa.Column("full_name", sa.String(160), nullable=False),
        sa.Column("nickname", sa.String(32), nullable=False, unique=True),
        sa.Column(
            "role",
            sa.Enum("student", "teacher", "admin", name="user_role", create_type=False),
            nullable=False,
            server_default="student",
        ),
        # Задел под Telegram-бота: напоминания о стриках, мини-тесты.
        sa.Column("telegram_id", sa.BigInteger(), unique=True, nullable=True),
        # Стрики и XP (инкрементируются, если решена хотя бы одна задача за сутки).
        sa.Column("streak_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("best_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_solve_day", sa.String(10), nullable=True),
        sa.Column("xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # ── tasks (банк задач) ──────────────────────────────────────────
    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "exam_type",
            sa.Enum("ege", "oge", name="exam_type", create_type=False),
            nullable=False,
        ),
        sa.Column("task_number", sa.Integer(), nullable=False),
        sa.Column("topic", sa.String(120), nullable=False),
        sa.Column("condition_text", sa.Text(), nullable=False),
        sa.Column("solution_text", sa.Text(), nullable=True),
        sa.Column("correct_answer", sa.String(100), nullable=True),
        sa.Column("is_second_part", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("difficulty_level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("source", sa.String(255), nullable=True),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("difficulty_level BETWEEN 1 AND 3", name="ck_tasks_difficulty"),
        sa.CheckConstraint(
            "is_second_part = TRUE OR correct_answer IS NOT NULL",
            name="ck_tasks_part1_needs_answer",
        ),
    )
    op.create_index("ix_tasks_exam_number", "tasks", ["exam_type", "task_number"])
    op.create_index("ix_tasks_exam_topic", "tasks", ["exam_type", "topic"])

    # ── variants (загруженные преподавателем КИМы) ──────────────────
    op.create_table(
        "variants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        # Короткий уникальный хэш для публичной ссылки (?variant=VAR-XXXXXXXX).
        sa.Column("short_code", sa.String(16), nullable=False, unique=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("subject", sa.String(32), nullable=False, server_default="math_profile"),
        sa.Column("time_limit_minutes", sa.Integer(), nullable=False, server_default="235"),
        # Массив объектов задач: [{ id, number, topic, latex_statement, answer,
        #                          solution_latex, points, type }, ...]
        sa.Column("tasks_json", postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_by_teacher_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_variants_short_code", "variants", ["short_code"])
    op.create_index("ix_variants_teacher", "variants", ["created_by_teacher_id"])

    # ── variant_tasks (M:N вариант ↔ задача банка) ──────────────────
    op.create_table(
        "variant_tasks",
        sa.Column(
            "variant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("variants.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.UniqueConstraint("variant_id", "position", name="uq_variant_position"),
    )

    # ── variant_attempts (попытки учеников) ─────────────────────────
    op.create_table(
        "variant_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "variant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("variants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("primary_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("secondary_score", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint("primary_score BETWEEN 0 AND 31", name="ck_attempts_primary"),
        sa.CheckConstraint("secondary_score BETWEEN 0 AND 100", name="ck_attempts_secondary"),
    )
    op.create_index("ix_attempts_student", "variant_attempts", ["student_id", "started_at"])

    # ── task_attempts (результаты задач в попытке) ──────────────────
    op.create_table(
        "task_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "attempt_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("variant_attempts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("correct", "incorrect", "calc_error", "skipped", name="attempt_status", create_type=False),
            nullable=False,
        ),
        sa.Column("given_answer", sa.String(100), nullable=True),
        sa.UniqueConstraint("attempt_id", "task_id", name="uq_task_once"),
    )

    # ── task_progress (решённые задачи темы; дедуп ленты) ───────────
    op.create_table(
        "task_progress",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "solved_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", "task_id", name="uq_progress_user_task"),
    )
    op.create_index("ix_progress_user_topic", "task_progress", ["user_id"])


def downgrade() -> None:
    op.drop_table("task_progress")
    op.drop_table("task_attempts")
    op.drop_table("variant_attempts")
    op.drop_table("variant_tasks")
    op.drop_table("variants")
    op.drop_table("tasks")
    op.drop_table("users")
    op.execute("DROP TYPE attempt_status")
    op.execute("DROP TYPE user_role")
    op.execute("DROP TYPE exam_type")
