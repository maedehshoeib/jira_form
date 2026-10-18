"""Add personal letter folders for received and sent mail.

Revision ID: 20261018_0006
Revises: 20261007_0005
"""

import sqlalchemy as sa
from alembic import op

revision = "20261018_0006"
down_revision = "20261007_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "letter_folders" not in tables:
        op.create_table(
            "letter_folders",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=80), nullable=False, server_default=""),
            sa.Column(
                "scope", sa.String(length=16), nullable=False, server_default="received"
            ),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "user_id",
                "scope",
                "name",
                name="uq_letter_folders_user_scope_name",
            ),
        )
        op.create_index("ix_letter_folders_user_id", "letter_folders", ["user_id"])
        op.create_index("ix_letter_folders_scope", "letter_folders", ["scope"])

    if "letter_folder_items" not in tables:
        op.create_table(
            "letter_folder_items",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("folder_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("submission_id", sa.Integer(), nullable=True),
            sa.Column("batch_id", sa.String(length=64), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["folder_id"], ["letter_folders.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(
                ["submission_id"], ["submissions.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "folder_id",
                "submission_id",
                name="uq_letter_folder_items_folder_submission",
            ),
            sa.UniqueConstraint(
                "folder_id",
                "batch_id",
                name="uq_letter_folder_items_folder_batch",
            ),
        )
        op.create_index(
            "ix_letter_folder_items_folder_id", "letter_folder_items", ["folder_id"]
        )
        op.create_index(
            "ix_letter_folder_items_user_id", "letter_folder_items", ["user_id"]
        )
        op.create_index(
            "ix_letter_folder_items_submission_id",
            "letter_folder_items",
            ["submission_id"],
        )
        op.create_index(
            "ix_letter_folder_items_batch_id", "letter_folder_items", ["batch_id"]
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "letter_folder_items" in tables:
        op.drop_index(
            "ix_letter_folder_items_batch_id", table_name="letter_folder_items"
        )
        op.drop_index(
            "ix_letter_folder_items_submission_id", table_name="letter_folder_items"
        )
        op.drop_index("ix_letter_folder_items_user_id", table_name="letter_folder_items")
        op.drop_index(
            "ix_letter_folder_items_folder_id", table_name="letter_folder_items"
        )
        op.drop_table("letter_folder_items")
    if "letter_folders" in tables:
        op.drop_index("ix_letter_folders_scope", table_name="letter_folders")
        op.drop_index("ix_letter_folders_user_id", table_name="letter_folders")
        op.drop_table("letter_folders")
