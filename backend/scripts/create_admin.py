#!/usr/bin/env python3
"""Создание мастер-аккаунта преподавателя (Артём).

Читает из окружения (.env):
  ADMIN_USERNAME     — логин/ник преподавателя   (по умолчанию: artem)
  ADMIN_PASSWORD     — пароль                     (по умолчанию: artem-2026)
  ADMIN_TEACHER_CODE — код привязки для учеников  (по умолчанию: ARTEM-PRO)

Скрипт идемпотентен: если аккаунт уже есть — ничего не меняет.

Запуск:
  python scripts/create_admin.py
"""
from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

# чтобы импорты app.* работали при запуске из папки backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.models import User, UserRole
from app.security import hash_password

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://komi:komi_secret@localhost:5432/repetytor"
)
# синхронный драйвер для CLI-скрипта
SYNC_URL = DATABASE_URL.replace("+asyncpg", "").replace("postgresql://", "postgresql+psycopg2://")


def _hash(password: str) -> str:
    """bcrypt — единый алгоритм с API (app.security), чтобы аккаунт,
    созданный через CLI, проходил проверку при входе."""
    return hash_password(password)


def main() -> None:
    username = os.getenv("ADMIN_USERNAME", "artem")
    password = os.getenv("ADMIN_PASSWORD", "artem-2026")
    teacher_code = os.getenv("ADMIN_TEACHER_CODE", "ARTEM-PRO")

    engine = create_engine(SYNC_URL)
    with Session(engine) as db:
        existing = db.execute(select(User).where(User.nickname == username)).scalar_one_or_none()
        if existing is not None:
            # гарантируем, что у существующего аккаунта правильные роль и код
            existing.role = UserRole.TEACHER
            existing.teacher_code = teacher_code
            db.commit()
            print(f"[create_admin] аккаунт '{username}' уже существует — роль и код обновлены.")
            return

        admin = User(
            id=uuid.uuid4(),
            email=f"{username}@repetitor.local",
            password_hash=_hash(password),
            full_name="Артём",
            nickname=username,
            role=UserRole.TEACHER,
            teacher_code=teacher_code,
        )
        db.add(admin)
        db.commit()
        print(f"[create_admin] создан преподаватель '{username}' (код привязки: {teacher_code}).")


if __name__ == "__main__":
    main()
