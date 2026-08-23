"""Наполнение базы: мастер-аккаунт, демо-ученики, банк задач, демо-вариант.

Запуск:  docker compose exec api python -m app.seed
      (или локально:  python -m app.seed)

Скрипт идемпотентен: повторный запуск не создаёт дубликатов.
Мастер-аккаунт преподавателя создаётся автоматически при старте API
(app.main:ensure_admin), здесь — только банк задач и демо-данные.
"""
from __future__ import annotations

import asyncio
import json
import os
import secrets as _secrets
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models import Base, ExamType, Task, User, UserRole, Variant, VariantTask
from app.security import hash_password

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://komi:komi_secret@localhost:5432/repetytor"
)

JSON_PATH = Path(__file__).parent / "taskbank.json"

engine = create_async_engine(DATABASE_URL, echo=False)
Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def seed() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with Session() as db:
        # ── мастер-аккаунт преподавателя (страховка, если API ещё не стартовал) ──
        admin_nick = os.getenv("ADMIN_USERNAME", "daniil")
        admin = (await db.execute(select(User).where(User.nickname == admin_nick))).scalar_one_or_none()
        if admin is None:
            db.add(User(
                id=uuid.uuid4(),
                email=f"{admin_nick}@repetitor.local",
                password_hash=hash_password(os.getenv("ADMIN_PASSWORD", "Pudov-Ege-2026")),
                full_name=os.getenv("ADMIN_FULL_NAME", "Даниил Андреевич Пудов"),
                nickname=admin_nick,
                role=UserRole.TEACHER,
                teacher_code=os.getenv("ADMIN_TEACHER_CODE", "SYSOLA-PRO"),
            ))
            await db.commit()
            print(f"[seed] создан преподаватель '{admin_nick}'.")

        # ── банк задач из taskbank.json ──
        added = skipped = 0
        if JSON_PATH.exists():
            data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
            for row in data["tasks"]:
                exam_type = ExamType(row["exam_type"])
                dup = (await db.execute(
                    select(Task).where(
                        Task.exam_type == exam_type,
                        Task.task_number == row["task_number"],
                        Task.condition_text == row["condition_text"],
                    )
                )).scalar_one_or_none()
                if dup is not None:
                    skipped += 1
                    continue
                db.add(Task(
                    id=uuid.uuid4(),
                    exam_type=exam_type,
                    task_number=row["task_number"],
                    topic=row["topic"],
                    condition_text=row["condition_text"],
                    solution_text=row.get("solution_text"),
                    correct_answer=row.get("correct_answer"),
                    is_second_part=row.get("is_second_part", False),
                    difficulty=row.get("difficulty", 1),
                    source=row.get("source"),
                    criteria=row.get("criteria"),
                    image_url=row.get("image_url"),
                    is_published=True,
                ))
                added += 1
            await db.commit()
        print(f"[seed] банк задач: добавлено {added}, пропущено (уже были) {skipped}.")

        # ── демо-вариант «Основной период 2023» из банка (по задаче на номер) ──
        variant = (await db.execute(
            select(Variant).where(Variant.title == "Основной период 2023 · реальные задания")
        )).scalar_one_or_none()
        if variant is None:
            tasks = (await db.execute(
                select(Task).where(Task.exam_type == ExamType.EGE_PROFILE, Task.is_published.is_(True))
            )).scalars().all()
            by_number: dict[int, Task] = {}
            for t in tasks:
                by_number.setdefault(t.task_number, t)
            if by_number:
                alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
                short = "VAR-" + "".join(_secrets.choice(alphabet) for _ in range(6))
                # первичные баллы части 2 по номерам (спецификация ФИПИ)
                part2_points = {13: 2, 14: 2, 15: 2, 16: 2, 17: 3, 18: 4, 19: 4}
                variant = Variant(
                    id=uuid.uuid4(),
                    short_code=short,
                    title="Основной период 2023 · реальные задания",
                    subject="math_profile",
                    time_limit_minutes=235,
                    # задачи копируются в JSONB — вариант самодостаточен
                    tasks_json=[
                        {
                            "id": f"t{t.task_number}",
                            "number": t.task_number,
                            "topic": t.topic,
                            "latex_statement": t.condition_text,
                            "answer": t.correct_answer,
                            "solution_latex": t.solution_text or "",
                            "points": 1 if not t.is_second_part else part2_points.get(t.task_number, 2),
                            "type": "detailed_answer" if t.is_second_part else "short_answer",
                        }
                        for _, t in sorted(by_number.items())
                    ],
                )
                db.add(variant)
                await db.flush()
                db.add_all(
                    VariantTask(variant_id=variant.id, task_id=t.id, position=n)
                    for n, t in sorted(by_number.items())
                )
                await db.commit()
                print(f"[seed] создан демо-вариант: «{variant.title}» ({len(by_number)} заданий, ссылка ?variant={short}).")
            else:
                print("[seed] банк пуст — демо-вариант не создан.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
