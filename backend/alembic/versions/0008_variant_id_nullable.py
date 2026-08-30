"""Разрешить variant_id = NULL в variant_attempts.

Тренировочные сессии (одиночные задачи из тренажёра) записываются как
VariantAttempt без варианта (variant_id = NULL), чтобы движок Mastery
мог пересчитывать уровень навыка и для тренировок, а не только для
полных вариантов.

Revision ID: 0008_variant_id_nullable
Revises: 0007_student_exam_lines
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_variant_id_nullable"
down_revision: Union[str, None] = "0007_student_exam_lines"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("variant_attempts", "variant_id", existing_type=sa.UUID(), nullable=True)


def downgrade() -> None:
    op.alter_column("variant_attempts", "variant_id", existing_type=sa.UUID(), nullable=False)
