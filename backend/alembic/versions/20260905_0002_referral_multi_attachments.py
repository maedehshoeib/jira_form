"""Allow multiple attachments on referral actions.

Revision ID: 20260905_0002
Revises: 20260829_0001
"""

import sqlalchemy as sa
from alembic import op

revision = "20260905_0002"
down_revision = "20260829_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {
        column["name"]
        for column in sa.inspect(op.get_bind()).get_columns("submission_referrals")
    }
    if "attachment_paths" not in columns:
        op.add_column(
            "submission_referrals",
            sa.Column("attachment_paths", sa.Text(), nullable=True),
        )
    if "attachment_names" not in columns:
        op.add_column(
            "submission_referrals",
            sa.Column("attachment_names", sa.Text(), nullable=True),
        )


def downgrade() -> None:
    columns = {
        column["name"]
        for column in sa.inspect(op.get_bind()).get_columns("submission_referrals")
    }
    if "attachment_names" in columns:
        op.drop_column("submission_referrals", "attachment_names")
    if "attachment_paths" in columns:
        op.drop_column("submission_referrals", "attachment_paths")
