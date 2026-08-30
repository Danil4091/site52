"""Движок освоения навыков (Mastery Engine V1).

Прозрачный алгоритм пересчёта ``mastery`` (уровень освоения) и
``confidence`` (уверенность системы в оценке) для StudentSkill.

Дизайн-принципы (Этап 4):
  * Вся математика живёт ЗДЕСЬ. Эндпоинты только вызывают функции.
  * Функции чистые и тестируемые: принимают список попыток, возвращают число.
  * ``time_spent`` НЕ штрафуется — оно зарезервировано для отдельной
    метрики (скорость), а не снижает mastery.
  * Каждый вес — именованная константа с комментарием, чтобы её было
    легко корректировать без переписывания логики.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    AttemptStatus,
    ErrorPattern,
    Skill,
    StudentSkill,
    TaskAttempt,
    TaskSkill,
    VariantAttempt,
)

# ═══════════════════════════════════════════════════════════════════════
# НАСТРАИВАЕМЫЕ ВЕСА  (корректируйте здесь, не трогая логику ниже)
# ═══════════════════════════════════════════════════════════════════════

# Мультипликатор за сложность при ВЕРНОМ решении.
# Верное решение сложной задачи даёт больший прирост, чем базовой.
DIFFICULTY_GAIN = {1: 1.0, 2: 1.15, 3: 1.3}

# Максимальный возможный «кредит» за попытку (нужен для нормировки
# стабильности). Равен максимальному мультипликатору сложности.
MAX_GAIN = max(DIFFICULTY_GAIN.values())

# Насколько НЕверное решение сохраняет «кредита» (1 − тяжесть ошибки).
# CARELESS (невнимательность) сохраняет 0.75 — почти не снижает mastery,
# тогда как METHOD/THEORY (метод/теория) сохраняют 0 — снижают полностью.
ERROR_SEVERITY = {
    ErrorPattern.CARELESS: 0.25,      # невнимательность      -> сохраняет 0.75
    ErrorPattern.TIME: 0.35,          # не хватило времени     -> сохраняет 0.65
    ErrorPattern.READING: 0.40,       # неверно прочитал условие-> сохраняет 0.60
    ErrorPattern.CALCULATION: 0.50,   # вычислительная        -> сохраняет 0.50
    ErrorPattern.MODEL: 0.85,         # ошибка модели          -> сохраняет 0.15
    ErrorPattern.UNKNOWN: 0.80,       # неизвестно             -> сохраняет 0.20
    ErrorPattern.METHOD: 1.00,        # неверный метод         -> сохраняет 0.00
    ErrorPattern.THEORY: 1.00,        # незнание теории        -> сохраняет 0.00
}

# Если у ошибки нет категории (ещё не классифицирована) — умеренный штраф.
DEFAULT_SEVERITY = 0.70  # сохраняет 0.30

# Полураспад свежести (дни): через 45 дней вес попытки падает вдвое.
RECENCY_HALF_LIFE_DAYS = 45.0

# Полураспад свежести для confidence (дни): через 30 дней уверенность
# в актуальности оценки падает вдвое.
FRESHNESS_HALF_LIFE_DAYS = 30.0

# Регуляризация mastery: при малом числе попыток оценка тянется к PRIOR_MU.
PRIOR_MU = 0.5     # априорный уровень (50 %)
PRIOR_ALPHA = 2.0  # сила регуляризации (эквивалент 2 «априорных» попыток)

# Насыщение объёма для confidence: при ~6 попытках объёмный фактор ≈ 0.63,
# при 12 — ≈ 0.86.  (1 − e^(−attempts / VOLUME_N0))
VOLUME_N0 = 6.0


# ═══════════════════════════════════════════════════════════════════════
# Структура одной попытки для расчёта
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class AttemptOutcome:
    """Одна попытка ученика, влияющая на навык.

    :param is_correct: True/False. ``None`` = пропуск (в расчёте не участвует).
    :param difficulty: сложность 1–3 (влияет только на прирост при верном).
    :param skill_weight: вес навыка из TaskSkill (0..1). Косвенный навык
                         (низкий вес) почти не меняет mastery.
    :param days_ago: сколько дней назад была попытка (для свежести).
    :param error_pattern: категория ошибки (только при is_correct=False).
    :param time_spent: секунды. НЕ используется в формуле (зарезервировано).
    """
    is_correct: Optional[bool]
    difficulty: int = 1
    skill_weight: float = 1.0
    days_ago: float = 0.0
    error_pattern: Optional[ErrorPattern] = None
    time_spent: Optional[float] = None


def _recency_weight(days_ago: float) -> float:
    """Экспоненциальное затухание: свежие попытки весят больше."""
    return math.exp(-math.log(2) * max(0.0, days_ago) / RECENCY_HALF_LIFE_DAYS)


def _attempt_credit(o: AttemptOutcome) -> float:
    """«Кредит» попытки: вклад в числитель mastery.

    Верно  -> 1.0 × мультипликатор сложности (сложнее = больше прирост).
    Неверно -> (1 − тяжесть_ошибки): CARELESS почти не штрафует,
               METHOD/THEORY — полный штраф.
    """
    if o.is_correct:
        return DIFFICULTY_GAIN.get(o.difficulty, 1.0)
    severity = ERROR_SEVERITY.get(o.error_pattern, DEFAULT_SEVERITY)
    return 1.0 - severity


def _attempt_weight(o: AttemptOutcome) -> float:
    """Полный вес попытки = вес навыка × свежесть."""
    return max(0.0, min(1.0, o.skill_weight)) * _recency_weight(o.days_ago)


# ═══════════════════════════════════════════════════════════════════════
# MASTERY
# ═══════════════════════════════════════════════════════════════════════

def compute_mastery(outcomes: Iterable[AttemptOutcome]) -> float:
    """Уровень освоения навыка, 0–100.

    Взвешенное среднее «кредитов» попыток с регуляризацией к PRIOR_MU:

        mastery = 100 × ( Σ creditᵢ·wᵢ + PRIOR_MU·PRIOR_ALPHA )
                        / ( Σ wᵢ + PRIOR_ALPHA )

    Пропуски (is_correct=None) игнорируются. При малом числе попыток
    оценка близка к 50 %; с накоплением данных сходится к реальной
    точности с учётом сложности и типов ошибок.
    """
    answered = [o for o in outcomes if o.is_correct is not None]
    sum_w = 0.0
    sum_credit_w = 0.0
    for o in answered:
        w = _attempt_weight(o)
        sum_w += w
        sum_credit_w += _attempt_credit(o) * w

    raw = (sum_credit_w + PRIOR_MU * PRIOR_ALPHA) / (sum_w + PRIOR_ALPHA)
    # Нормируем на максимальный кредит (сложные верные дают >1) и в диапазон.
    raw = raw / MAX_GAIN
    return round(max(0.0, min(100.0, 100.0 * raw)), 1)


# ═══════════════════════════════════════════════════════════════════════
# CONFIDENCE
# ═══════════════════════════════════════════════════════════════════════

def compute_stability(outcomes: Iterable[AttemptOutcome]) -> float:
    """Стабильность, 0–100.

    100 − нормированная дисперсия кредитов. Если ученик чередует верные
    и неверные ответы, дисперсия высока -> стабильность низка.
    Стабильный результат (всё верно или всё неверно) -> ~100.
    """
    answered = [o for o in outcomes if o.is_correct is not None]
    if len(answered) < 2:
        # Недостаточно данных для оценки разброса — считаем нейтрально.
        return 50.0
    xs = [_attempt_credit(o) / MAX_GAIN for o in answered]
    mean = sum(xs) / len(xs)
    var = sum((x - mean) ** 2 for x in xs) / len(xs)
    max_var = 0.25  # макс. дисперсия для величин в [0,1]
    stability = 1.0 - min(1.0, var / max_var)
    return round(max(0.0, min(1.0, stability)) * 100.0, 1)


def compute_confidence(outcomes: Iterable[AttemptOutcome]) -> float:
    """Уверенность системы в оценке mastery, 0–100.

    Произведение трёх факторов:
      * объём      — накоплено ли достаточно попыток (насыщается у ~6–12);
      * свежесть   — штраф за давность последней практики;
      * стабильность — разброс результатов.
    """
    answered = [o for o in outcomes if o.is_correct is not None]
    n = len(answered)

    volume = 1.0 - math.exp(-n / VOLUME_N0)

    last_days = min((o.days_ago for o in answered), default=0.0) if n else 0.0
    freshness = math.exp(-math.log(2) * last_days / FRESHNESS_HALF_LIFE_DAYS)

    stability = compute_stability(outcomes) / 100.0

    conf = 100.0 * volume * freshness * stability
    return round(max(0.0, min(100.0, conf)), 1)


# ═══════════════════════════════════════════════════════════════════════
# Вспомогательные статистики
# ═══════════════════════════════════════════════════════════════════════

def _accuracy_by_difficulty(outcomes: Iterable[AttemptOutcome]) -> dict[int, Optional[float]]:
    """Точность (0–100) отдельно по уровням сложности; None, если нет данных."""
    buckets: dict[int, list[bool]] = {1: [], 2: [], 3: []}
    for o in outcomes:
        if o.is_correct is None:
            continue
        d = o.difficulty if o.difficulty in buckets else 1
        buckets[d].append(o.is_correct)
    return {
        d: (round(100.0 * sum(vals) / len(vals), 1) if vals else None)
        for d, vals in buckets.items()
    }


# ═══════════════════════════════════════════════════════════════════════
# Пересчёт StudentSkill по данным БД
# ═══════════════════════════════════════════════════════════════════════

async def recalculate_skill(db: AsyncSession, student_id, skill_id) -> StudentSkill:
    """Полностью пересчитывает StudentSkill(student_id, skill_id) по всем
    попыткам ученика, затрагивающим этот навык.

    Вызывается из фонового задания после каждой новой попытки.
    """
    # 1) Навык и его связь с задачами (веса).
    skill = (await db.execute(select(Skill).where(Skill.id == skill_id))).scalar_one()
    links = (
        await db.execute(select(TaskSkill).where(TaskSkill.skill_id == skill_id))
    ).scalars().all()
    task_weights = {link.task_id: link.weight for link in links}
    if not task_weights:
        task_weights = {}  # навыков без задач не пересчитываем

    # 2) Все попытки ученика по этим задачам.
    #    TaskAttempt связан с VariantAttempt через attempt_id; выбираем обе
    #    сущности (вариант нужен для даты), категории ошибок — selectinload.
    rows = (
        await db.execute(
            select(TaskAttempt, VariantAttempt)
            .join(VariantAttempt, TaskAttempt.attempt_id == VariantAttempt.id)
            .where(VariantAttempt.student_id == student_id)
            .where(TaskAttempt.task_id.in_(list(task_weights.keys())))
            .options(selectinload(TaskAttempt.error_patterns))
        )
    ).all()

    now_ts = None
    outcomes: list[AttemptOutcome] = []
    times: list[float] = []
    for row, variant_attempt in rows:
        if row.status == AttemptStatus.CORRECT:
            is_correct: Optional[bool] = True
        elif row.status == AttemptStatus.SKIPPED:
            is_correct = None  # пропуск не несёт сигнала об освоении
        else:  # INCORRECT и CALC_ERROR считаем неверным (calc_error — штраф мягче через pattern)
            is_correct = False

        days_ago = 0.0
        started = variant_attempt.started_at if variant_attempt else None
        if started is not None:
            from datetime import datetime as _dt, timezone as _tz
            now = _dt.now(_tz.utc)
            if started.tzinfo is None:
                started = started.replace(tzinfo=_tz.utc)
            days_ago = max(0.0, (now - started).total_seconds() / 86400.0)
            if now_ts is None or started > now_ts:
                now_ts = started

        # Категория ошибки: берём первую назначенную (если есть).
        pattern = row.error_patterns[0].pattern if row.error_patterns else None
        if is_correct is False and pattern is None:
            pattern = ErrorPattern.UNKNOWN  # неклассифицированная ошибка

        if row.time_spent is not None:
            times.append(float(row.time_spent))
        outcomes.append(AttemptOutcome(
            is_correct=is_correct,
            difficulty=row.difficulty or skill.difficulty or 1,
            skill_weight=task_weights.get(row.task_id, 1.0),
            days_ago=days_ago,
            error_pattern=pattern,
            time_spent=float(row.time_spent) if row.time_spent is not None else None,
        ))

    acc = _accuracy_by_difficulty(outcomes)

    # 3) Upsert StudentSkill.
    ss = (
        await db.execute(
            select(StudentSkill).where(
                StudentSkill.student_id == student_id,
                StudentSkill.skill_id == skill_id,
            )
        )
    ).scalar_one_or_none()
    if ss is None:
        ss = StudentSkill(student_id=student_id, skill_id=skill_id)
        db.add(ss)

    answered = [o for o in outcomes if o.is_correct is not None]
    ss.attempts = len(outcomes)
    ss.correct_attempts = sum(1 for o in answered if o.is_correct)
    ss.mastery = compute_mastery(outcomes)
    ss.confidence = compute_confidence(outcomes)
    ss.stability = compute_stability(outcomes)
    ss.average_time = round(sum(times) / len(times), 1) if times else None
    ss.last_practiced = now_ts
    ss.easy_accuracy = acc[1]
    ss.medium_accuracy = acc[2]
    ss.hard_accuracy = acc[3]

    await db.commit()
    await db.refresh(ss)
    return ss


async def recalculate_for_task_attempts(db: AsyncSession, student_id, task_attempt_ids) -> list[StudentSkill]:
    """Пересчитывает StudentSkill для всех навыков, затронутых попытками.

    Использует переданную сессию (для синхронного вызова в тестах/внутри
    запроса). Для фонового вызова используйте ``background_recalculate``.
    """
    attempts = (
        await db.execute(select(TaskAttempt).where(TaskAttempt.id.in_(list(task_attempt_ids))))
    ).scalars().all()
    task_ids = {a.task_id for a in attempts}
    if not task_ids:
        return []
    links = (
        await db.execute(select(TaskSkill).where(TaskSkill.task_id.in_(list(task_ids))))
    ).scalars().all()
    skill_ids = {link.skill_id for link in links}

    updated: list[StudentSkill] = []
    for skill_id in skill_ids:
        updated.append(await recalculate_skill(db, student_id, skill_id))
    return updated


async def background_recalculate(student_id, task_attempt_ids) -> None:
    """Точка входа для FastAPI BackgroundTasks.

    Открывает СОБСТВЕННУЮ сессию, потому что фоновая задача выполняется
    уже после того, как сессия исходного запроса закрыта.
    """
    from app.database import async_session_factory

    async with async_session_factory() as db:
        await recalculate_for_task_attempts(db, student_id, task_attempt_ids)
