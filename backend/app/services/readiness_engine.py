"""Движок готовности к экзамену (Exam Readiness Engine, Этап 5).

Главный принцип:
  * Mastery      — освоение навыка (Skill) в ЛЮБЫХ условиях.
  * Exam Readiness — способность применить навыки конкретной линии КИМ
                     в условиях стресса и ограничения по времени.

Ученик может иметь Mastery 90% по тригонометрии, но Readiness 40% для
задачи №13, если решает её слишком долго или ошибается на пробниках.
Это РАЗНЫЕ показатели. Здесь считается только Readiness по линиям 1–20.

ВАЖНО (Этап 5): мы НЕ прогнозируем общий тестовый балл за весь ЕГЭ (0–100).
Считаем только готовность к конкретным номерам заданий (линиям).

Вся математика живёт ЗДЕСЬ. Эндпоинты только вызывают функции.
Функции чистые и тестируемые.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Iterable, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AttemptStatus,
    ExamMode,
    Skill,
    StudentExamLine,
    StudentSkill,
    Task,
    TaskAttempt,
    TrainingMode,
    VariantAttempt,
)

# ═══════════════════════════════════════════════════════════════════════
# НАСТРАИВАЕМЫЕ ВЕСА И НОРМАТИВЫ  (корректируйте здесь, не трогая логику)
# ═══════════════════════════════════════════════════════════════════════

# Режимы попытки, которые считаются «экзаменационными».
# Readiness пересчитывается ТОЛЬКО по попыткам в этих режимах.
EXAM_MODES = {ExamMode.EXAM}

# Базовые нормативы времени (секунды) на задачу по номеру линии.
#   Часть 1 (№1–13):  3–5 мин  -> 240 c (4 мин).
#   Часть 2 (№14–20): 15–25 мин -> 1200 c (20 мин).
# При желании задайте точные нормативы для каждой линии в этом словаре.
TIME_NORM_SECONDS: dict[int, int] = {
    **{n: 240 for n in range(1, 14)},    # №1–13  -> 4 мин
    **{n: 1200 for n in range(14, 21)},  # №14–20 -> 20 мин
}

# Штраф за время (Time Penalty). В отличие от Mastery, здесь время КРИТИЧНО.
# Если time_spent превышает норматив более чем на 50%, кредит попытки
# снижается ДАЖЕ при правильном ответе.
TIME_OVERRUN_THRESHOLD = 1.5   # порог: превышение норматива на 50%
TIME_PENALTY_RATE = 0.4        # на сколько снижается кредит за каждую «единицу» перевеса
TIME_FACTOR_FLOOR = 0.4        # минимальный кредит даже при очень медленном решении

# Перенос (Transfer Penalty). Когда экзаменационных попыток мало,
# Readiness плавно подтягивается к усреднённому Mastery навыков линии,
# но со штрафом TRANSFER_PENALTY (навык ещё не проверен боем).
TRANSFER_N0 = 3.0              # «насыщение»: сколько exam-попыток нужно, чтобы доверять боевым данным
TRANSFER_PENALTY = 0.8         # штраф за «непроверенный боем» навык

# Свежесть и уверенность (по смыслу совпадают с mastery engine).
RECENCY_HALF_LIFE_DAYS = 45.0          # полураспад веса попытки
CONFIDENCE_HALF_LIFE_DAYS = 30.0       # полураспад уверенности от давности
CONFIDENCE_N0 = 4.0                    # насыщение объёма для уверенности


# ═══════════════════════════════════════════════════════════════════════
# Структура одной экзаменационной попытки
# ═══════════════════════════════════════════════════════════════════════

class ExamLineAttempt:
    """Одна экзаменационная попытка ученика по линии (для расчёта).

    :param is_correct: True/False. None = пропуск (не несёт сигнала).
    :param time_spent: секунды. None = время неизвестно (штраф не applies).
    :param days_ago: сколько дней назад была попытка (для свежести).
    """

    def __init__(self, is_correct: Optional[bool], time_spent: Optional[float] = None, days_ago: float = 0.0):
        self.is_correct = is_correct
        self.time_spent = time_spent
        self.days_ago = days_ago


def _recency_weight(days_ago: float) -> float:
    """Экспоненциальное затухание: свежие попытки весят больше."""
    return math.exp(-math.log(2) * max(0.0, days_ago) / RECENCY_HALF_LIFE_DAYS)


def _time_factor(time_spent: Optional[float], norm: int) -> float:
    """Мультипликатор за время.

    В пределах 150% норматива — без штрафа (1.0).
    Свыше — кредит снижается пропорционально перевесу, но не ниже пола.
    При неизвестном времени штрафа нет.
    """
    if time_spent is None or norm <= 0:
        return 1.0
    ratio = time_spent / norm
    if ratio <= TIME_OVERRUN_THRESHOLD:
        return 1.0
    overrun = ratio - TIME_OVERRUN_THRESHOLD
    return max(TIME_FACTOR_FLOOR, 1.0 - TIME_PENALTY_RATE * overrun)


def _exam_attempt_credit(a: ExamLineAttempt, norm: int) -> float:
    """Кредит экзаменационной попытки: верность × штраф за время.

    Ключевое отличие от Mastery: правильный, но слишком медленный ответ
    даёт меньше кредита (Time Penalty).
    """
    if a.is_correct is None:
        return 0.0  # пропуск не даёт кредита
    base = 1.0 if a.is_correct else 0.0
    return base * _time_factor(a.time_spent, norm)


# ═══════════════════════════════════════════════════════════════════════
# READINESS
# ═══════════════════════════════════════════════════════════════════════

def compute_readiness(
    exam_attempts: Iterable[ExamLineAttempt],
    line_number: int,
    mastery_value: Optional[float] = None,
) -> float:
    """Готовность к линии, 0–100.

    readiness = transfer_weight · exam_success_rate
              + (1 − transfer_weight) · mastery_value · TRANSFER_PENALTY

    * exam_success_rate — взвешенный (по свежести и времени) процент
      правильных решений именно в экзаменационных режимах.
    * transfer_weight растёт с числом exam-попыток: мало попыток →
      опираемся на Mastery со штрафом TRANSFER_PENALTY; много → на бо́й.

    :param mastery_value: усреднённый Mastery навыков линии (0–1) либо None.
    """
    answered = [a for a in exam_attempts if a.is_correct is not None]
    n_exam = len(answered)
    norm = TIME_NORM_SECONDS.get(line_number, 240)

    # Взвешенный exam success rate.
    sum_w = 0.0
    sum_credit_w = 0.0
    for a in answered:
        w = _recency_weight(a.days_ago)
        sum_w += w
        sum_credit_w += _exam_attempt_credit(a, norm) * w
    exam_rate = (sum_credit_w / sum_w) if sum_w > 0 else 0.0

    # Насколько доверяем боевым данным (растёт с числом exam-попыток).
    transfer_weight = 1.0 - math.exp(-n_exam / TRANSFER_N0) if n_exam > 0 else 0.0

    if mastery_value is None:
        # Нет данных об освоении — опираемся только на боевые результаты
        # (или на нейтральные 50%, если и их нет).
        readiness_raw = exam_rate if n_exam > 0 else 0.5
    else:
        readiness_raw = (
            transfer_weight * exam_rate
            + (1.0 - transfer_weight) * mastery_value * TRANSFER_PENALTY
        )

    return round(max(0.0, min(100.0, 100.0 * readiness_raw)), 1)


def compute_exam_confidence(exam_attempts: Iterable[ExamLineAttempt]) -> float:
    """Уверенность в оценке Readiness, 0–100.

    Произведение: объём (число exam-попыток) × свежесть × стабильность.
    """
    answered = [a for a in exam_attempts if a.is_correct is not None]
    n = len(answered)

    volume = 1.0 - math.exp(-n / CONFIDENCE_N0)

    last_days = min((a.days_ago for a in answered), default=0.0) if n else 0.0
    freshness = math.exp(-math.log(2) * last_days / CONFIDENCE_HALF_LIFE_DAYS)

    # Стабильность: разброс кредитов (верно/неверно с учётом времени).
    if n >= 2:
        norm = 240  # для стабильности используем нейтральный норматив
        xs = [_exam_attempt_credit(a, norm) for a in answered]
        mean = sum(xs) / n
        var = sum((x - mean) ** 2 for x in xs) / n
        stability = 1.0 - min(1.0, var / 0.25)
    else:
        stability = 0.5  # недостаточно данных — нейтрально

    conf = 100.0 * volume * freshness * stability
    return round(max(0.0, min(100.0, conf)), 1)


def compute_average_exam_time(exam_attempts: Iterable[ExamLineAttempt]) -> Optional[float]:
    """Среднее время (секунды) по экзаменационным попыткам с известным временем."""
    times = [a.time_spent for a in exam_attempts if a.time_spent is not None]
    return round(sum(times) / len(times), 1) if times else None


# ═══════════════════════════════════════════════════════════════════════
# Пересчёт StudentExamLine по данным БД
# ═══════════════════════════════════════════════════════════════════════

async def _aggregated_mastery_for_line(db: AsyncSession, student_id, line_number: int) -> Optional[float]:
    """Усреднённый Mastery (0–1) по всем навыкам линии из StudentSkill.

    Возвращает None, если данных об освоении линии пока нет.
    """
    rows = (
        await db.execute(
            select(StudentSkill.mastery)
            .join(Skill, StudentSkill.skill_id == Skill.id)
            .where(StudentSkill.student_id == student_id)
            .where(Skill.line_number == line_number)
        )
    ).scalars().all()
    if not rows:
        return None
    return sum(rows) / len(rows) / 100.0


async def recalculate_line(db: AsyncSession, student_id, line_number: int) -> StudentExamLine:
    """Полностью пересчитывает StudentExamLine(student_id, line_number).

    Берёт ВСЕ экзаменационные попытки ученика по этой линии (не только новые).
    """
    # 1) Экзаменационные попытки по линии (VariantAttempt.mode == ExamMode.EXAM).
    rows = (
        await db.execute(
            select(TaskAttempt, VariantAttempt.started_at)
            .join(VariantAttempt, TaskAttempt.attempt_id == VariantAttempt.id)
            .join(Task, TaskAttempt.task_id == Task.id)
            .where(VariantAttempt.student_id == student_id)
            .where(Task.task_number == line_number)
            .where(VariantAttempt.mode == ExamMode.EXAM)
        )
    ).all()

    exam_attempts: List[ExamLineAttempt] = []
    last_exam_at = None
    for ta, started_at in rows:
        if ta.status == AttemptStatus.CORRECT:
            is_correct: Optional[bool] = True
        elif ta.status == AttemptStatus.SKIPPED:
            is_correct = None  # пропуск не несёт сигнала
        else:
            is_correct = False  # INCORRECT / CALC_ERROR

        days_ago = 0.0
        if started_at is not None:
            started = started_at if started_at.tzinfo else started_at.replace(tzinfo=timezone.utc)
            days_ago = max(0.0, (datetime.now(timezone.utc) - started).total_seconds() / 86400.0)
            if last_exam_at is None or started > last_exam_at:
                last_exam_at = started

        exam_attempts.append(ExamLineAttempt(
            is_correct=is_correct,
            time_spent=float(ta.time_spent) if ta.time_spent is not None else None,
            days_ago=days_ago,
        ))

    # 2) Усреднённый Mastery навыков линии (для Transfer Penalty).
    mastery_value = await _aggregated_mastery_for_line(db, student_id, line_number)

    # 3) Расчёт.
    readiness = compute_readiness(exam_attempts, line_number, mastery_value)
    confidence = compute_exam_confidence(exam_attempts)
    avg_time = compute_average_exam_time(exam_attempts)
    answered = [a for a in exam_attempts if a.is_correct is not None]
    total_exam = len(exam_attempts)
    correct_exam = sum(1 for a in answered if a.is_correct)

    # 4) Upsert StudentExamLine.
    sel = (
        await db.execute(
            select(StudentExamLine).where(
                StudentExamLine.student_id == student_id,
                StudentExamLine.line_number == line_number,
            )
        )
    ).scalar_one_or_none()
    if sel is None:
        sel = StudentExamLine(student_id=student_id, line_number=line_number)
        db.add(sel)

    sel.readiness = readiness
    sel.confidence = confidence
    sel.total_exam_attempts = total_exam
    sel.correct_exam_attempts = correct_exam
    sel.average_exam_time = avg_time
    sel.last_exam_at = last_exam_at

    await db.commit()
    await db.refresh(sel)
    return sel


async def recalculate_readiness_for_task_attempts(db: AsyncSession, student_id, task_attempt_ids) -> List[StudentExamLine]:
    """Пересчитывает Readiness для всех линий, затронутых попытками.

    Использует переданную сессию. Для фонового вызова — ``background_recalculate_readiness``.
    """
    attempts = (
        await db.execute(
            select(TaskAttempt, Task.task_number)
            .join(Task, TaskAttempt.task_id == Task.id)
            .where(TaskAttempt.id.in_(list(task_attempt_ids)))
        )
    ).all()
    line_numbers = {task_number for _, task_number in attempts}
    if not line_numbers:
        return []

    updated: List[StudentExamLine] = []
    for line_number in line_numbers:
        updated.append(await recalculate_line(db, student_id, line_number))
    return updated


async def background_recalculate_readiness(student_id, task_attempt_ids) -> None:
    """Точка входа для FastAPI BackgroundTasks.

    Открывает СОБСТВЕННУЮ сессию: фоновая задача выполняется после того,
    как сессия исходного запроса уже закрыта.
    """
    from app.database import async_session_factory

    async with async_session_factory() as db:
        await recalculate_readiness_for_task_attempts(db, student_id, task_attempt_ids)
