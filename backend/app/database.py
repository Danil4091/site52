"""Подключение к PostgreSQL (async, драйвер asyncpg).

Вынесено в отдельный модуль, чтобы ``deps.py`` и ``main.py`` могли
импортировать сессию и ``get_db`` без циклического импорта.
"""
from __future__ import annotations

import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Все параметры соединения — только из переменных окружения (см. .env.example).
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://komi:komi_secret@localhost:5432/repetytor"
)

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI-зависимость: сессия БД на время запроса."""
    async with Session() as s:
        yield s
