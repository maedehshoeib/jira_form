"""Add personal recipient groups for one-click targeting.

Revision ID: 20261024_0008
Revises: 20261024_0007
"""

import sqlalchemy as sa
from alembic import op

revision = "20261024_0008"
down_revision = "20261024_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())

    if "recipient_groups" not in tables:
        op.create_table(
            "recipient_groups",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("owner_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=80), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("owner_id", "name", name="uq_recipient_groups_owner_name"),
        )
        op.create_index("ix_recipient_groups_owner_id", "recipient_groups", ["owner_id"])

    if "recipient_group_members" not in tables:
        op.create_table(
            "recipient_group_members",
            sa.Column("group_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(
                ["group_id"], ["recipient_groups.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("group_id", "user_id"),
        )
        op.create_index(
            "ix_recipient_group_members_user_id",
            "recipient_group_members",
            ["user_id"],
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "recipient_group_members" in tables:
        op.drop_index(
            "ix_recipient_group_members_user_id",
            table_name="recipient_group_members",
        )
        op.drop_table("recipient_group_members")
    if "recipient_groups" in tables:
        op.drop_index("ix_recipient_groups_owner_id", table_name="recipient_groups")
        op.drop_table("recipient_groups")
