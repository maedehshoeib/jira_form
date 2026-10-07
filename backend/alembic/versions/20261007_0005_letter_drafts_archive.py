"""Add letter drafts and per-user archive flag on submission views.

Revision ID: 20261007_0005
Revises: 20261003_0004
"""

import sqlalchemy as sa
from alembic import op

revision = "20261007_0005"
down_revision = "20261003_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    view_columns = {col["name"] for col in inspector.get_columns("submission_views")}
    if "is_archived" not in view_columns:
        op.add_column(
            "submission_views",
            sa.Column(
                "is_archived",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )
        op.create_index(
            "ix_submission_views_is_archived",
            "submission_views",
            ["is_archived"],
        )

    if "letter_drafts" in inspector.get_table_names():
        return
    op.create_table(
        "letter_drafts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("letter_type", sa.String(length=16), nullable=False, server_default="external"),
        sa.Column("subject", sa.String(length=512), nullable=False, server_default=""),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("payload", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("attachments", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_letter_drafts_user_id", "letter_drafts", ["user_id"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "letter_drafts" in inspector.get_table_names():
        op.drop_index("ix_letter_drafts_user_id", table_name="letter_drafts")
        op.drop_table("letter_drafts")
    view_columns = {col["name"] for col in inspector.get_columns("submission_views")}
    if "is_archived" in view_columns:
        op.drop_index("ix_submission_views_is_archived", table_name="submission_views")
        op.drop_column("submission_views", "is_archived")
