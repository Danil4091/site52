"""Юнит-тесты движка готовности к экзамену (Этап 5).

Ключевой тест (по ТЗ): ученик решает задачу ПРАВИЛЬНО, но тратит 25 минут
вместо положенных ~5. Из-за Time Penalty его Readiness должен УПАСТЬ —
правильный, но слишком медленный ответ даёт меньше кредита.

Тестируются чистые функции (без БД): _time_factor, _exam_attempt_credit,
compute_readiness. Запуск:  cd backend && python -m pytest tests/ -q
"""
from app.services.readiness_engine import (
    TIME_FACTOR_FLOOR,
    TIME_NORM_SECONDS,
    TIME_OVERRUN_THRESHOLD,
    ExamLineAttempt,
    _exam_attempt_credit,
    _time_factor,
    compute_readiness,
)

# Норматив для линии части 1 (№1): 240 c (4 мин).
LINE = 1
NORM = TIME_NORM_SECONDS[LINE]


def test_time_factor_within_norm_is_full():
    """Время в пределах 150% норматива — без штрафа (фактор 1.0)."""
    assert _time_factor(NORM, NORM) == 1.0           # ровно норматив
    assert _time_factor(NORM * 1.2, NORM) == 1.0     # +20% — ещё ок
    assert _time_factor(NORM * TIME_OVERRUN_THRESHOLD, NORM) == 1.0  # ровно порог


def test_time_factor_over_norm_is_penalized():
    """Превышение норматива более чем на 50% снижает фактор (но не ниже пола)."""
    slow_factor = _time_factor(NORM * 3, NORM)  # в 3 раза медленнее
    assert slow_factor < 1.0
    assert slow_factor >= TIME_FACTOR_FLOOR


def test_correct_but_slow_credits_less_than_fast():
    """Правильный, но медленный ответ даёт МЕНЬШЕ кредита, чем быстрый правильный."""
    fast = ExamLineAttempt(is_correct=True, time_spent=NORM)          # вовремя
    slow = ExamLineAttempt(is_correct=True, time_spent=NORM * 6)      # в 6 раз медленнее
    assert _exam_attempt_credit(fast, NORM) > _exam_attempt_credit(slow, NORM)


def test_slow_correct_answer_lowers_readiness():
    """Главный тест ТЗ: решил ВЕРНО, но потратил 25 мин вместо ~5 —
    Readiness падает из-за Time Penalty."""
    fast_correct = [ExamLineAttempt(is_correct=True, time_spent=NORM)]       # вовремя
    slow_correct = [ExamLineAttempt(is_correct=True, time_spent=NORM * 6)]   # ~25 мин

    # mastery_value=None → изолируем вклад именно экзаменационных попыток.
    readiness_fast = compute_readiness(fast_correct, LINE, mastery_value=None)
    readiness_slow = compute_readiness(slow_correct, LINE, mastery_value=None)

    # Быстрый правильный ответ → полный кредит → readiness 100.
    assert readiness_fast == 100.0
    # Медленный правильный ответ → кредит урезан → readiness заметно ниже.
    assert readiness_slow < readiness_fast
    assert readiness_slow < 100.0
    # Штраф существенный: готовность упала минимум вдвое.
    assert readiness_slow <= 50.0


def test_wrong_answer_gives_low_readiness():
    """Неверный ответ (даже быстрый) даёт низкую готовность."""
    wrong_fast = [ExamLineAttempt(is_correct=False, time_spent=NORM)]
    readiness = compute_readiness(wrong_fast, LINE, mastery_value=None)
    assert readiness == 0.0


def test_no_exam_attempts_falls_back_to_mastery_with_penalty():
    """Нет exam-попыток → Readiness тянется к Mastery со штрафом TRANSFER_PENALTY."""
    # mastery 90% → readiness ≈ 90 * 0.8 = 72 (навык не проверен боем).
    readiness = compute_readiness([], LINE, mastery_value=0.9)
    assert 60.0 <= readiness <= 80.0
