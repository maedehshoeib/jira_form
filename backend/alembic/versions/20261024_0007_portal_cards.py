"""Add admin-managed portal cards and their document files.

Revision ID: 20261024_0007
Revises: 20261018_0006
"""

import sqlalchemy as sa
from alembic import op

revision = "20261024_0007"
down_revision = "20261018_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())

    if "portal_cards" not in tables:
        op.create_table(
            "portal_cards",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("parent_id", sa.Integer(), nullable=True),
            sa.Column("kind", sa.String(length=16), nullable=False, server_default="group"),
            sa.Column("title", sa.String(length=128), nullable=False),
            sa.Column("description", sa.String(length=512), nullable=False, server_default=""),
            sa.Column("logo_path", sa.String(length=512), nullable=False, server_default=""),
            sa.Column("logo_name", sa.String(length=256), nullable=False, server_default=""),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("form_schema", sa.Text(), nullable=False, server_default=""),
            sa.Column("content", sa.Text(), nullable=False, server_default=""),
            sa.Column("created_by_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["parent_id"], ["portal_cards.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_portal_cards_parent_id", "portal_cards", ["parent_id"])

    if "portal_card_files" not in tables:
        op.create_table(
            "portal_card_files",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("card_id", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(length=256), nullable=False, server_default=""),
            sa.Column("file_path", sa.String(length=512), nullable=False),
            sa.Column("file_name", sa.String(length=256), nullable=False, server_default=""),
            sa.Column("file_size", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["card_id"], ["portal_cards.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_portal_card_files_card_id", "portal_card_files", ["card_id"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "portal_card_files" in tables:
        op.drop_index("ix_portal_card_files_card_id", table_name="portal_card_files")
        op.drop_table("portal_card_files")
    if "portal_cards" in tables:
        op.drop_index("ix_portal_cards_parent_id", table_name="portal_cards")
        op.drop_table("portal_cards")
