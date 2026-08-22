"""Хеширование паролей (bcrypt).

Пароли никогда не хранятся открытым текстом. Для старых демо-аккаунтов,
созданных до внедрения bcrypt, предусмотрена бесшовная миграция:
при успешном входе plaintext-пароль автоматически заменяется хешем.
"""
from __future__ import annotations

import bcrypt

_PREFIXES = ("$2a$", "$2b$", "$2y$")


def hash_password(password: str) -> str:
    """bcrypt, 12 раундов (~250 мс — устойчиво к перебору, незаметно пользователю)."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def is_hashed(stored: str) -> bool:
    return stored.startswith(_PREFIXES)


def verify_password(password: str, stored: str) -> bool:
    """Проверяет пароль против сохранённого значения.

    Если значение — legacy plaintext (демо-аккаунты), сравнивает напрямую.
    Вызывающий код после успешной проверки таких значений должен
    пересохранить hash_password(password) — см. ``needs_rehash``.
    """
    if is_hashed(stored):
        try:
            return bcrypt.checkpw(password.encode("utf-8"), stored.encode("utf-8"))
        except ValueError:
            return False
    return password == stored


def needs_rehash(stored: str) -> bool:
    """True, если сохранённое значение ещё не хеш (нужна миграция)."""
    return not is_hashed(stored)


_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # без 0/O/1/I


def generate_recovery_code() -> str:
    """Человекочитаемый резервный код вида KX7Q-AB3D (для восстановления без почты)."""
    import secrets as _s

    body = "".join(_s.choice(_CODE_ALPHABET) for _ in range(8))
    return f"{body[:4]}-{body[4:]}"


def normalize_recovery_code(code: str) -> str:
    return code.strip().upper().replace(" ", "")
