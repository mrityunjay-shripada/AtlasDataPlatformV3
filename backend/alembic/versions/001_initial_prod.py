"""initial production schema

Revision ID: 001
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Tables are created by init_db/create_all for greenfield.
    # This revision documents the production baseline for Alembic history.
    pass

def downgrade() -> None:
    pass
