"""Восстановление пароля без почты.

Revision ID: 0003_recovery_code
Revises: 0002_criteria_image
Create Date: 2026-02-11

Добавляет:
  users.recovery_code_hash — bcrypt-хеш резервного кода (восстановление без e-mail)

Ослабляет:
  users.email     — теперь опционален (почта не используется для восстановления)
  users.full_name — теперь опционален

Идемпотентна: колонка добавляется только если её ещё нет.
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0003_recovery_code"
down_revision: Union[str, None] = "0002_criteria_image"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_code_hash VARCHAR(128)")
    op.execute("ALTER TABLE users ALTER COLUMN email DROP NOT NULL")
    op.execute("ALTER TABLE users ALTER COLUMN full_name DROP NOT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS recovery_code_hash")
    op.execute("ALTER TABLE users ALTER COLUMN email SET NOT NULL")
    op.execute("ALTER TABLE users ALTER COLUMN full_name SET NOT NULL")
