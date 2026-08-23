"""Хеширование паролей (bcrypt).

Пароли никогда не хранятся открытым текстом. Для старых демо-аккаунтов,
созданных до внедрения bcrypt, предусмотрена бесшовная миграция:
при успешном входе plaintext-пароль автоматически заменяется хешем.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time

import bcrypt
from fastapi import HTTPException

_PREFIXES = ("$2a$", "$2b$", "$2y$")

# HMAC_SECRET — основной; SECRET_KEY оставлен как обратной-совместимый alias.
HMAC_SECRET = os.getenv("HMAC_SECRET") or os.getenv("SECRET_KEY") or "dev-secret-change-me"


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


# ─────────────────────────── HMAC-токены ───────────────────────────

def _sign(body: str) -> str:
    return hmac.new(HMAC_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()


def create_token(user_id: str, role: str, ttl: int = 7 * 24 * 3600) -> str:
    payload = json.dumps(
        {"sub": user_id, "role": role, "exp": int(time.time()) + ttl}, separators=(",", ":")
    )
    body = base64.urlsafe_b64encode(payload.encode()).decode()
    return f"{body}.{_sign(body)}"


def decode_token(token: str) -> dict:
    try:
        body, sig = token.split(".", 1)
    except ValueError:
        raise HTTPException(401, "Некорректный токен")
    if not hmac.compare_digest(sig, _sign(body)):
        raise HTTPException(401, "Недействительная подпись токена")
    try:
        payload = json.loads(base64.urlsafe_b64decode(body.encode()))
    except Exception:
        raise HTTPException(401, "Некорректный токен")
    if payload.get("exp", 0) < time.time():
        raise HTTPException(401, "Токен истёк")
    return payload
