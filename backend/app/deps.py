"""FastAPI-зависимости авторизации и разграничения ролей.

Все функции определены в одном модуле ДО любого использования в маршрутах,
что исключает NameError при импорте ``app.main``. Импортируют только
``database``, ``security`` и ``models`` — циклического импорта нет.

Каждая роль-зависимость проверяет поле роли пользователя из БД и выбрасывает
HTTPException(403), если роль не совпадает.
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db
from .models import User, UserRole
from .security import decode_token


async def _current_user_or_401(
    authorization: Optional[str], db: AsyncSession
) -> User:
    """Общая логика: разобрать Bearer-токен и загрузить пользователя."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Требуется авторизация (Bearer-токен)")
    payload = decode_token(authorization.split(" ", 1)[1].strip())
    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(401, "Некорректный токен")
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(401, "Пользователь не найден")
    return user


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Любой авторизованный пользователь (ученик или преподаватель)."""
    return await _current_user_or_401(authorization, db)


async def get_current_student(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Только ученик. Иначе 403."""
    user = await _current_user_or_401(authorization, db)
    if user.role != UserRole.STUDENT:
        raise HTTPException(403, "Доступно только ученикам")
    return user


async def get_current_teacher(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Только преподаватель (или админ). Иначе 403."""
    user = await _current_user_or_401(authorization, db)
    if user.role not in (UserRole.TEACHER, UserRole.ADMIN):
        raise HTTPException(403, "Доступно только преподавателям")
    return user


async def get_current_admin(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Только администратор. Иначе 403."""
    user = await _current_user_or_401(authorization, db)
    if user.role != UserRole.ADMIN:
        raise HTTPException(403, "Доступно только администраторам")
    return user
