"""Фундамент адаптивной системы (этап 3): иерархия знаний + расширенные попытки.

Создаёт:
  subtopics, skills, task_skills, student_skills,
  task_error_patterns, training_sessions, recommendations;
расширяет task_attempts (time_spent, difficulty, mode, hint_used, solution_viewed).

Расчёт Mastery / Exam Readiness / рекомендаций здесь НЕ делается —
только структура данных (как и требует этап 3).

Revision ID: 0006_adaptive_foundation
Revises: 0005_materials
Create Date: 2026-02-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_adaptive_foundation"
down_revision: Union[str, None] = "0005_materials"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _create_enum_if_not_exists(name: str, values: str) -> None:
    """Создаёт ENUM, игнорируя duplicate_object (идемпотентно)."""
    op.execute(
        sa.text(
            f"""
            DO $$ BEGIN
                CREATE TYPE {name} AS ENUM ({values});
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )


def upgrade() -> None:
    # ── перечисления (идемпотентно) ─────────────────────────────────
    _create_enum_if_not_exists(
        "training_mode",
        "'practice', 'topic_training', 'mixed_training', 'diagnostic', 'exam', 'exam_simulation'",
    )
    _create_enum_if_not_exists(
        "error_pattern",
        "'calculation', 'theory', 'model', 'method', 'reading', 'time', 'careless', 'unknown'",
    )

    # ── subtopics: подтемы внутри линии ─────────────────────────────
    op.create_table(
        "subtopics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("line_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("line_number", "title", name="uq_subtopic_line_title"),
    )
    op.create_index("ix_subtopics_line", "subtopics", ["line_number"])

    # ── skills: атомарные навыки ────────────────────────────────────
    op.create_table(
        "skills",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("line_number", sa.Integer(), nullable=False),
        sa.Column("subtopic_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("difficulty", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("prerequisites", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("difficulty BETWEEN 1 AND 3", name="ck_skills_difficulty"),
        sa.ForeignKeyConstraint(["subtopic_id"], ["subtopics.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_skills_line", "skills", ["line_number"])
    op.create_index("ix_skills_subtopic", "skills", ["subtopic_id"])

    # ── task_skills: связь Task → Skill (M:N, с весом) ──────────────
    op.create_table(
        "task_skills",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("skill_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False, server_default="1.0"),
        sa.CheckConstraint("weight BETWEEN 0 AND 1", name="ck_task_skill_weight"),
        sa.UniqueConstraint("task_id", "skill_id", name="uq_task_skill"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_task_skills_task", "task_skills", ["task_id"])
    op.create_index("ix_task_skills_skill", "task_skills", ["skill_id"])

    # ── student_skills: срез освоения навыка учеником ───────────────
    op.create_table(
        "student_skills",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("skill_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("mastery", sa.Float(), nullable=False, server_default="0"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("correct_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("average_time", sa.Float(), nullable=True),
        sa.Column("last_practiced", sa.DateTime(timezone=True), nullable=True),
        sa.Column("easy_accuracy", sa.Float(), nullable=True),
        sa.Column("medium_accuracy", sa.Float(), nullable=True),
        sa.Column("hard_accuracy", sa.Float(), nullable=True),
        sa.Column("stability", sa.Float(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("mastery BETWEEN 0 AND 100", name="ck_student_skill_mastery"),
        sa.CheckConstraint("confidence BETWEEN 0 AND 100", name="ck_student_skill_confidence"),
        sa.UniqueConstraint("student_id", "skill_id", name="uq_student_skill"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_student_skills_student", "student_skills", ["student_id"])
    op.create_index("ix_student_skills_skill", "student_skills", ["skill_id"])

    # ── task_error_patterns: классификация ошибок ───────────────────
    op.create_table(
        "task_error_patterns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("task_attempt_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "pattern",
            sa.Enum(
                "calculation", "theory", "model", "method", "reading", "time", "careless", "unknown",
                name="error_pattern", create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("assigned_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("source", sa.String(32), nullable=False, server_default="manual"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("task_attempt_id", "pattern", name="uq_error_pattern_once"),
        sa.ForeignKeyConstraint(["task_attempt_id"], ["task_attempts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assigned_by_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_error_patterns_attempt", "task_error_patterns", ["task_attempt_id"])

    # ── training_sessions: сессии тренировок ────────────────────────
    op.create_table(
        "training_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "mode",
            sa.Enum(
                "practice", "topic_training", "mixed_training", "diagnostic", "exam", "exam_simulation",
                name="training_mode", create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("planned_task_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_task_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("target_skill_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_skill_id"], ["skills.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_training_sessions_student", "training_sessions", ["student_id", "started_at"])
    op.create_index("ix_training_sessions_target", "training_sessions", ["target_skill_id"])

    # ── recommendations: заготовка под рекомендации ─────────────────
    op.create_table(
        "recommendations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("skill_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("recommended_task_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_recommendations_student", "recommendations", ["student_id", "created_at"])
    op.create_index("ix_recommendations_skill", "recommendations", ["skill_id"])

    # ── расширяем task_attempts (добавляем колонки, не трогая данные) ──
    op.add_column("task_attempts", sa.Column("time_spent", sa.Integer(), nullable=True))
    op.add_column("task_attempts", sa.Column("difficulty", sa.Integer(), nullable=True))
    op.add_column(
        "task_attempts",
        sa.Column(
            "mode",
            sa.Enum(
                "practice", "topic_training", "mixed_training", "diagnostic", "exam", "exam_simulation",
                name="training_mode", create_type=False,
            ),
            nullable=True,
        ),
    )
    op.add_column("task_attempts", sa.Column("hint_used", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("task_attempts", sa.Column("solution_viewed", sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("task_attempts", "solution_viewed")
    op.drop_column("task_attempts", "hint_used")
    op.drop_column("task_attempts", "mode")
    op.drop_column("task_attempts", "difficulty")
    op.drop_column("task_attempts", "time_spent")

    op.drop_table("recommendations")
    op.drop_table("training_sessions")
    op.drop_table("task_error_patterns")
    op.drop_table("student_skills")
    op.drop_table("task_skills")
    op.drop_table("skills")
    op.drop_table("subtopics")
    op.execute("DROP TYPE IF EXISTS error_pattern")
    op.execute("DROP TYPE IF EXISTS training_mode")
