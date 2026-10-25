"""Share recipient groups created by admins with every user.

Revision ID: 20261025_0009
Revises: 20261024_0008
"""

import sqlalchemy as sa
from alembic import op

revision = "20261025_0009"
down_revision = "20261024_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "recipient_groups" not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns("recipient_groups")}
    indexes = {idx["name"] for idx in inspector.get_indexes("recipient_groups")}
    if "is_shared" not in columns:
        op.add_column(
            "recipient_groups",
            sa.Column(
                "is_shared",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )
        op.create_index(
            "ix_recipient_groups_is_shared",
            "recipient_groups",
            ["is_shared"],
        )
    if "uq_recipient_groups_shared_name" not in indexes:
        op.create_index(
            "uq_recipient_groups_shared_name",
            "recipient_groups",
            ["name"],
            unique=True,
            postgresql_where=sa.text("is_shared"),
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "recipient_groups" not in inspector.get_table_names():
        return
    indexes = {idx["name"] for idx in inspector.get_indexes("recipient_groups")}
    columns = {col["name"] for col in inspector.get_columns("recipient_groups")}
    if "uq_recipient_groups_shared_name" in indexes:
        op.drop_index(
            "uq_recipient_groups_shared_name",
            table_name="recipient_groups",
        )
    if "is_shared" in columns:
        op.drop_index("ix_recipient_groups_is_shared", table_name="recipient_groups")
        op.drop_column("recipient_groups", "is_shared")
