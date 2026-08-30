"""Юнит-тесты создания связей TaskSkill при импорте задач.

Доказывают, что при импорте задачи:
  1) для каждого навыка создаётся связь TaskSkill с указанным весом;
  2) создаются подтема (Subtopic) и навык (Skill), если их нет;
  3) не создаются дубликаты связей, если связь уже существует.

Используется мок AsyncSession: реальные объекты Task/Subtopic/Skill/TaskSkill
создаются настоящей логикой, а db.execute/db.add/db.flush — заглушки.
"""
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.main import TaskIn, create_task_with_skills
from app.models import Skill, Subtopic, Task, TaskSkill


def _make_task_in() -> TaskIn:
    """Задача части 1 с двумя навыками (основной вес 1.0 и косвенный 0.5)."""
    return TaskIn(
        exam_type="ege",
        task_number=5,
        line_number=5,
        topic="Вероятность — продвинутая",
        condition_text="Вероятность попадания ... Найдите вероятность того, что попадут оба.",
        correct_answer="0.56",
        is_second_part=False,
        difficulty_level=2,
        skills=[
            {"title": "Умножение вероятностей независимых событий",
             "subtopic_title": "Умножение вероятностей", "weight": 1.0},
            {"title": "Понятие независимых событий",
             "subtopic_title": "Умножение вероятностей", "weight": 0.5},
        ],
    )


def _table_name(stmt) -> str:
    """Имя таблицы, к которой обращается select-выражение (для различения запросов)."""
    try:
        return list(stmt.froms)[0].name
    except Exception:
        return ""


def _make_db(existing_task_skill: bool = False):
    """Мок AsyncSession.

    db.execute(...).scalar_one_or_none() возвращает None (всё создаётся),
    кроме запроса к task_skills, если existing_task_skill=True.
    Все добавленные объекты собираются в added.
    """
    added = []

    def execute_side_effect(stmt):
        result = MagicMock()
        table = _table_name(stmt)
        if table == "task_skills" and existing_task_skill:
            result.scalar_one_or_none.return_value = MagicMock(spec=TaskSkill)
        else:
            result.scalar_one_or_none.return_value = None
        return result

    db = MagicMock()
    db.execute = AsyncMock(side_effect=execute_side_effect)
    db.flush = AsyncMock()
    db.add = MagicMock(side_effect=lambda obj: added.append(obj))
    return db, added


@pytest.mark.asyncio
async def test_creates_taskskill_links_with_weights():
    """Для двух навыков создаются две связи TaskSkill с весами 1.0 и 0.5."""
    db, added = _make_db()
    t = _make_task_in()

    task = await create_task_with_skills(db, t)

    links = [o for o in added if isinstance(o, TaskSkill)]
    assert len(links) == 2, f"ожидалось 2 связи TaskSkill, создано {len(links)}"

    weights = sorted(link.weight for link in links)
    assert weights == [0.5, 1.0], f"веса связей {weights}, ожидалось [0.5, 1.0]"

    # Каждая связь ссылается на созданную задачу.
    for link in links:
        assert link.task_id is task.id


@pytest.mark.asyncio
async def test_creates_subtopic_and_skill():
    """Если подтемы и навыка нет — они создаются вместе со связью."""
    db, added = _make_db()
    t = _make_task_in()

    await create_task_with_skills(db, t)

    subtopics = [o for o in added if isinstance(o, Subtopic)]
    skills = [o for o in added if isinstance(o, Skill)]

    assert len(subtopics) == 1, "подтема создаётся один раз (обе задачи в одной подтеме)"
    assert subtopics[0].title == "Умножение вероятностей"
    assert subtopics[0].line_number == 5

    assert len(skills) == 2, "создаётся по навыку на каждый переданный навык"
    skill_titles = {s.title for s in skills}
    assert skill_titles == {
        "Умножение вероятностей независимых событий",
        "Понятие независимых событий",
    }
    for s in skills:
        assert s.line_number == 5
        assert s.difficulty == 2  # наследуется от difficulty_level задачи


@pytest.mark.asyncio
async def test_no_duplicate_taskskill_when_link_exists():
    """Если связь TaskSkill уже есть — дубль не создаётся."""
    db, added = _make_db(existing_task_skill=True)
    t = _make_task_in()

    await create_task_with_skills(db, t)

    links = [o for o in added if isinstance(o, TaskSkill)]
    assert len(links) == 0, "дубликаты связей TaskSkill создаваться не должны"


@pytest.mark.asyncio
async def test_line_number_falls_back_to_task_number():
    """Если line_number не задан, используется task_number."""
    db, added = _make_db()
    t = _make_task_in()
    t.line_number = None  # явная линия не задана

    await create_task_with_skills(db, t)

    subtopics = [o for o in added if isinstance(o, Subtopic)]
    assert subtopics[0].line_number == 5  # == task_number
