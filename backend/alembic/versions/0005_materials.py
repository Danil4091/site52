"""materials — методички для бесплатного скачивания

Метаданные в БД, сам файл — на диске (materials/file_name).

Revision ID: 0005_materials
Revises: 0004_progress_attempts
Create Date: 2026-02-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_materials"
down_revision: Union[str, None] = "0004_progress_attempts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "materials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("tag", sa.String(60), nullable=False, server_default="Методичка"),
        sa.Column("topic", sa.String(120), nullable=False, server_default="Общее"),
        sa.Column("part", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("pages", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("downloads", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("file_name", sa.String(255), nullable=True),
        sa.Column("file_size_kb", sa.Integer(), nullable=True),
        sa.Column("file_url", sa.String(2000), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("materials")
