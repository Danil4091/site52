"""Add exam_mode to variant_attempts

Revision ID: 0009
Revises: 0008_variant_id_nullable
Create Date: 2025-01-15

"""
from alembic import op
import sqlalchemy as sa


revision = '0009'
down_revision = '0008_variant_id_nullable'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Создаём ENUM тип exam_mode
    exam_mode = sa.Enum('practice', 'exam', name='exam_mode', create_type=True)
    exam_mode.create(op.get_bind(), checkfirst=True)
    
    # Добавляем колонку mode со значением по умолчанию 'practice'
    op.add_column('variant_attempts', sa.Column('mode', exam_mode, nullable=True, server_default='practice'))
    # Добавляем колонку finished_at для отметки завершения варианта
    op.add_column('variant_attempts', sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('variant_attempts', 'finished_at')
    op.drop_column('variant_attempts', 'mode')
    
    # Удаляем ENUM тип (если поддерживается БД)
    op.execute('DROP TYPE IF EXISTS exam_mode')
