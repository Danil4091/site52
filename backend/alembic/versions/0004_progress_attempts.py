"""task_progress: разбор после любой попытки, а не только верного решения.

Добавляем:
  - attempt_count — сколько раз пользователь ПРОБОВАЛ задачу (верно или нет);
  - solved        — решена ли она верно хотя бы раз;
  - solved_at     — делаем nullable (NULL, пока задача не решена верно).

Лента тренажёра по-прежнему исключает только solved=True. Разбор
(/api/tasks/{id}/solution) открывается при attempt_count >= 1.

Revision ID: 0004_progress_attempts
Revises: 0003_recovery_code
Create Date: 2026-02-11

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_progress_attempts"
down_revision: Union[str, None] = "0003_recovery_code"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "task_progress",
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "task_progress",
        sa.Column("solved", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # solved_at теперь nullable: NULL, пока задача не решена верно.
    op.alter_column(
        "task_progress",
        "solved_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=True,
        server_default=None,
    )
    # Существующие записи (из старой схемы) означают «решена верно».
    op.execute("UPDATE task_progress SET solved = TRUE, attempt_count = 1")


def downgrade() -> None:
    op.alter_column(
        "task_progress",
        "solved_at",
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    op.drop_column("task_progress", "solved")
    op.drop_column("task_progress", "attempt_count")
