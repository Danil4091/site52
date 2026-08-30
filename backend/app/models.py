"""Доменная модель «Репетитор из Коми» (PostgreSQL + SQLAlchemy 2.0).

Поля задач — ровно по ТЗ:
  id, exam_type (ege/oge), task_number (ЕГЭ-2027: ч.1 №1–13, ч.2 №14–20; всего 20), condition_text,
  solution_text, correct_answer, is_second_part, difficulty_level.
Плюс telegram_id у пользователей — задел под Telegram-бота
(напоминания о стриках, мини-тесты).

Фундамент адаптивной системы (этап 3):
  ExamTaskLine (20 линий ЕГЭ) → Subtopic → Skill → TaskSkill → Task.
  StudentSkill — срез освоения навыка учеником (пока только структура,
  расчёт Mastery — позже).
  TaskAttempt — расширен: time_spent, difficulty, mode, hint_used,
  solution_viewed — качественные данные для будущей аналитики.
  ErrorPattern — классификация ошибок (пока назначается вручную,
  автоопределение — позже).
  TrainingSession — сессия тренировки (режим, план/факт, целевой навык).
  Recommendation — заготовка под персональные рекомендации (модель, не алгоритм).
"""
from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import (
    Boolean, BigInteger, CheckConstraint, DateTime, Enum as PyEnum,
    Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
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


class TrainingMode(str, Enum):
    """Режим, в котором решалась задача / проходила сессия."""
    PRACTICE = "practice"                       # обычная тренировка
    TOPIC_TRAINING = "topic_training"           # тренировка по теме
    MIXED_TRAINING = "mixed_training"           # смешанная тренировка
    DIAGNOSTIC = "diagnostic"                   # диагностический тест
    EXAM = "exam"                               # полный вариант ЕГЭ
    EXAM_SIMULATION = "exam_simulation"         # экзаменационная симуляция


class ErrorPattern(str, Enum):
    """Категории ошибок (пока назначаются вручную, автоопределение — позже)."""
    CALCULATION = "calculation"   # вычислительная ошибка
    THEORY = "theory"             # незнание теории
    MODEL = "model"               # ошибка построения модели
    METHOD = "method"             # неверный метод решения
    READING = "reading"           # неверное прочтение условия
    TIME = "time"                 # не хватило времени
    CARELESS = "careless"         # невнимательность
    UNKNOWN = "unknown"


def _now():
    return func.now()


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(160))
    nickname: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    # Хеш резервного кода для восстановления пароля без почты (bcrypt).
    recovery_code_hash: Mapped[Optional[str]] = mapped_column(String(128))
    role: Mapped[UserRole] = mapped_column(PyEnum(UserRole, name="user_role"), default=UserRole.STUDENT, nullable=False)

    # Код, по которому ученики привязываются к этому преподавателю (только для teacher).
    teacher_code: Mapped[Optional[str]] = mapped_column(String(24), unique=True)
    # Преподаватель, к которому привязан ученик (только для student).
    teacher_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

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
    task_number: Mapped[int] = mapped_column(Integer, nullable=False)          # 1–20 (ЕГЭ-2027: ч.1 №1–13, ч.2 №14–20); до 25 (ОГЭ)
    topic: Mapped[str] = mapped_column(String(120), nullable=False)
    condition_text: Mapped[str] = mapped_column(Text, nullable=False)          # LaTeX: $…$ / $$…$$
    solution_text: Mapped[Optional[str]] = mapped_column(Text)
    correct_answer: Mapped[Optional[str]] = mapped_column(String(100))         # NULL для части 2
    is_second_part: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    difficulty_level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    # Критерии оценивания ФИПИ (для части 2): разбалловка на 1/2/3 балла.
    criteria: Mapped[Optional[str]] = mapped_column(Text)
    # Чертёж/график к условию: URL (https://…) или data-URL (image/…).
    image_url: Mapped[Optional[str]] = mapped_column(String(2000))
    source: Mapped[Optional[str]] = mapped_column(String(255))
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Variant(Base):
    """Вариант, загруженный преподавателем.

    Задачи хранятся целиком в JSONB-массиве (tasks_json) — это снимает
    необходимость связки с таблицей tasks и позволяет хранить произвольный
    авторский КИМ. ``short_code`` — короткий уникальный хэш для публичной ссылки.
    """

    __tablename__ = "variants"
    __table_args__ = (Index("ix_variants_teacher", "created_by_teacher_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Короткий уникальный хэш для публичной ссылки (без путающих 0/O/1/I).
    short_code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # math_profile / math_base
    subject: Mapped[str] = mapped_column(String(32), nullable=False, default="math_profile")
    time_limit_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=235)
    # Массив объектов задач: [{ id, number, topic, latex_statement, answer,
    #                          solution_latex, points, type }, ...]
    tasks_json: Mapped[list] = mapped_column(JSONB, nullable=False)
    # Преподаватель-составитель; NULL, если вариант системный/анонимный.
    created_by_teacher_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


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
        CheckConstraint("primary_score BETWEEN 0 AND 33", name="ck_attempts_primary"),
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
    # ── Фундамент адаптивной системы (этап 3) ──
    time_spent: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)        # секунды
    difficulty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)        # 1–3
    mode: Mapped[Optional[TrainingMode]] = mapped_column(
        PyEnum(TrainingMode, name="training_mode"), nullable=True
    )
    hint_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    solution_viewed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    error_patterns: Mapped[List["TaskErrorPattern"]] = relationship(back_populates="task_attempt")


class TaskProgress(Base):
    """Прогресс тренажёра по связи (user_id, task_id).

    - attempt_count — сколько раз пользователь ПРОБОВАЛ задачу (верно или нет).
    - solved        — решена ли она ВЕРНО хотя бы раз.
    - solved_at     — момент первого верного решения (NULL, если ещё не решена).

    Лента исключает только solved=True. Разбор выдаётся при attempt_count>=1
    (то есть достаточно одной попытки, даже неверной).
    """
    __tablename__ = "task_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "task_id", name="uq_progress_user_task"),
        Index("ix_progress_user_topic", "user_id"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    solved: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    solved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class Material(Base):
    """Методичка (теория) для бесплатного скачивания учениками.

    Метаданные — в БД; сам файл лежит на диске в папке materials/
    (рядом с uploads/), на него указывает ``file_name``. Файлы в БД
    не кладут — только имя на диске. Скачивание: /api/materials/{id}/download.
    """

    __tablename__ = "materials"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    tag: Mapped[str] = mapped_column(String(60), nullable=False, default="Методичка")
    topic: Mapped[str] = mapped_column(String(120), nullable=False, default="Общее")
    part: Mapped[int] = mapped_column(Integer, nullable=False, default=0)   # 0=обе, 1, 2
    pages: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    downloads: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Имя файла на диске (в папке materials/). NULL — файла нет.
    file_name: Mapped[Optional[str]] = mapped_column(String(255))
    file_size_kb: Mapped[Optional[int]] = mapped_column(Integer)
    # Если файла на диске нет, может быть прямая ссылка.
    file_url: Mapped[Optional[str]] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# ══════════════════════════════════════════════════════════════════════
# Фундамент адаптивной системы (этап 3)
# Иерархия знаний:  ExamTaskLine(20 линий) → Subtopic → Skill → TaskSkill → Task
# Пока создаётся только структура данных; расчёт Mastery и Exam Readiness — позже.
# ══════════════════════════════════════════════════════════════════════

class Subtopic(Base):
    """Подтема внутри линии ЕГЭ (например, «Производная» в линии №9)."""
    __tablename__ = "subtopics"
    __table_args__ = (
        Index("ix_subtopics_line", "line_number"),
        UniqueConstraint("line_number", "title", name="uq_subtopic_line_title"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)   # 1–20
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    skills: Mapped[List["Skill"]] = relationship(back_populates="subtopic")


class Skill(Base):
    """Атомарный навык (например, «Касательная к графику функции»).

    Ссылается на линию (line_number) и подтему (subtopic_id).
    prerequisites — JSONB-массив UUID навыков-пред prerequisites,
    позволяет строить граф зависимостей (Производная → Геом. смысл → Касательная).
    """
    __tablename__ = "skills"
    __table_args__ = (
        Index("ix_skills_line", "line_number"),
        Index("ix_skills_subtopic", "subtopic_id"),
        CheckConstraint("difficulty BETWEEN 1 AND 3", name="ck_skills_difficulty"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)   # 1–20
    subtopic_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("subtopics.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # JSONB-массив UUID (строками) навыков, которые должны быть освоены раньше.
    prerequisites: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    subtopic: Mapped[Optional["Subtopic"]] = relationship(back_populates="skills")
    task_links: Mapped[List["TaskSkill"]] = relationship(back_populates="skill")
    student_skills: Mapped[List["StudentSkill"]] = relationship(back_populates="skill")


class TaskSkill(Base):
    """Связь Task → Skill (M:N).

    Одно задание может проверять один основной и несколько дополнительных
    навыков; weight показывает, насколько навык важен для задачи (0.0–1.0).
    """
    __tablename__ = "task_skills"
    __table_args__ = (
        UniqueConstraint("task_id", "skill_id", name="uq_task_skill"),
        Index("ix_task_skills_task", "task_id"),
        Index("ix_task_skills_skill", "skill_id"),
        CheckConstraint("weight BETWEEN 0 AND 1", name="ck_task_skill_weight"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)


class StudentSkill(Base):
    """Срез освоения навыка учеником.

    Пока это только структура (значения по умолчанию 0/NULL);
    расчёт mastery/confidence/stability будет добавлен позже.
    """
    __tablename__ = "student_skills"
    __table_args__ = (
        UniqueConstraint("student_id", "skill_id", name="uq_student_skill"),
        Index("ix_student_skills_student", "student_id"),
        Index("ix_student_skills_skill", "skill_id"),
        CheckConstraint("mastery BETWEEN 0 AND 100", name="ck_student_skill_mastery"),
        CheckConstraint("confidence BETWEEN 0 AND 100", name="ck_student_skill_confidence"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    mastery: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)        # 0–100
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)     # 0–100
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    correct_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    average_time: Mapped[Optional[float]] = mapped_column(Float, nullable=True)      # секунды
    last_practiced: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    easy_accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)     # 0–100
    medium_accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)   # 0–100
    hard_accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)     # 0–100
    stability: Mapped[Optional[float]] = mapped_column(Float, nullable=True)         # 0–100
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    skill: Mapped["Skill"] = relationship(back_populates="student_skills")


class TaskErrorPattern(Base):
    """Классификация ошибки в попытке.

    Назначается преподавателем или вручную; автоопределение (AI) — позже.
    Одна попытка может иметь несколько категорий ошибок.
    """
    __tablename__ = "task_error_patterns"
    __table_args__ = (
        Index("ix_error_patterns_attempt", "task_attempt_id"),
        UniqueConstraint("task_attempt_id", "pattern", name="uq_error_pattern_once"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("task_attempts.id", ondelete="CASCADE"), nullable=False
    )
    pattern: Mapped[ErrorPattern] = mapped_column(PyEnum(ErrorPattern, name="error_pattern"), nullable=False)
    # Кто назначил категорию: пользователь (преподаватель/ученик) или "auto".
    assigned_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="manual")  # manual/teacher/auto
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    task_attempt: Mapped["TaskAttempt"] = relationship(back_populates="error_patterns")


class TrainingSession(Base):
    """Сессия тренировки (обычная, по теме, смешанная, диагностика, экзамен...).

    Позволит позже сравнивать обычную тренировку и экзаменационную.
    """
    __tablename__ = "training_sessions"
    __table_args__ = (
        Index("ix_training_sessions_student", "student_id", "started_at"),
        Index("ix_training_sessions_target", "target_skill_id"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    mode: Mapped[TrainingMode] = mapped_column(PyEnum(TrainingMode, name="training_mode"), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    planned_task_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_task_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Целевой навык сессии (для тренировки по теме); NULL для смешанных/экзамена.
    target_skill_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("skills.id", ondelete="SET NULL"), nullable=True
    )


class Recommendation(Base):
    """Заготовка под персональные рекомендации (модель, не алгоритм).

    Алгоритм формирования появится позже; пока это структура для хранения.
    """
    __tablename__ = "recommendations"
    __table_args__ = (
        Index("ix_recommendations_student", "student_id", "created_at"),
        Index("ix_recommendations_skill", "skill_id"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    recommended_task_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")  # pending/accepted/completed/dismissed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class StudentExamLine(Base):
    """Готовность ученика к конкретной линии КИМ (Этап 5).

    Mastery — освоение навыка в любых условиях.
    Exam Readiness — способность применить навыки линии в условиях стресса
    и ограничения по времени (режимы exam / diagnostic / exam_simulation).
    Ученик может иметь Mastery 90%, но Readiness 40%, если решает медленно
    или ошибается на пробниках. Это РАЗНЫЕ показатели.
    """
    __tablename__ = "student_exam_lines"
    __table_args__ = (
        UniqueConstraint("student_id", "line_number", name="uq_student_exam_line"),
        Index("ix_student_exam_lines_student", "student_id"),
        Index("ix_student_exam_lines_line", "line_number"),
        CheckConstraint("readiness BETWEEN 0 AND 100", name="ck_exam_line_readiness"),
        CheckConstraint("confidence BETWEEN 0 AND 100", name="ck_exam_line_confidence"),
        CheckConstraint("line_number BETWEEN 1 AND 20", name="ck_exam_line_number"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)          # 1–20
    readiness: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)       # 0–100
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)      # 0–100
    total_exam_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    correct_exam_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    average_exam_time: Mapped[Optional[float]] = mapped_column(Float, nullable=True)   # секунды
    last_exam_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
