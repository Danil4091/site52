"""Критерии ФИПИ и чертежи у задач.

Revision ID: 0002_criteria_image
Revises: 0001_initial
Create Date: 2026-02-11

Добавляет:
  tasks.criteria   — критерии оценивания (часть 2, разбалловка ФИПИ)
  tasks.image_url  — чертёж/график к условию (URL или data-URL)

Идемпотентна: колонки добавляются только если их ещё нет.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_criteria_image"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS criteria TEXT")
    op.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS image_url VARCHAR(2000)")


def downgrade() -> None:
    op.execute("ALTER TABLE tasks DROP COLUMN IF EXISTS criteria")
    op.execute("ALTER TABLE tasks DROP COLUMN IF EXISTS image_url")
