"""Baseline the current portal and contracts schemas.

Revision ID: 20260829_0001
Revises: None
"""

from alembic import op

from app.db.base import Base
from app.db.contracts_base import ContractsBase
from app.models import (  # noqa: F401
    admin_session,
    calendar_event,
    chat,
    contract,
    department,
    form_template,
    pdf_form,
    report,
    site_banner,
    site_news,
    submission,
    timesheet,
    user,
)

revision = "20260829_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)
    ContractsBase.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    ContractsBase.metadata.drop_all(bind=bind)
    Base.metadata.drop_all(bind=bind)
