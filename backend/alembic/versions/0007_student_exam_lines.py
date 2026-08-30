"""student_exam_lines — готовность ученика к каждой линии КИМ (Этап 5).

Revision ID: 0007_student_exam_lines
Revises: 0006_adaptive_foundation
Create Date: 2026-02-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007_student_exam_lines"
down_revision: Union[str, None] = "0006_adaptive_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "student_exam_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("student_id", sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("line_number", sa.Integer(), nullable=False),
        sa.Column("readiness", sa.Float(), nullable=False, server_default="0"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total_exam_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("correct_exam_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("average_exam_time", sa.Float(), nullable=True),
        sa.Column("last_exam_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("student_id", "line_number", name="uq_student_exam_line"),
        sa.CheckConstraint("readiness BETWEEN 0 AND 100", name="ck_exam_line_readiness"),
        sa.CheckConstraint("confidence BETWEEN 0 AND 100", name="ck_exam_line_confidence"),
        sa.CheckConstraint("line_number BETWEEN 1 AND 20", name="ck_exam_line_number"),
    )
    op.create_index("ix_student_exam_lines_student", "student_exam_lines", ["student_id"])
    op.create_index("ix_student_exam_lines_line", "student_exam_lines", ["line_number"])


def downgrade() -> None:
    op.drop_index("ix_student_exam_lines_line", table_name="student_exam_lines")
    op.drop_index("ix_student_exam_lines_student", table_name="student_exam_lines")
    op.drop_table("student_exam_lines")
