"""Store task progress separately for each assignee.

Revision ID: 20260906_0003
Revises: 20260905_0002
"""

import sqlalchemy as sa
from alembic import op

revision = "20260906_0003"
down_revision = "20260905_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "submission_assignee_progress" in inspector.get_table_names():
        return
    op.create_table(
        "submission_assignee_progress",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("submission_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("progress_percent", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "submission_id",
            "user_id",
            name="uq_submission_assignee_progress_user",
        ),
    )
    op.create_index(
        "ix_submission_assignee_progress_submission_id",
        "submission_assignee_progress",
        ["submission_id"],
    )
    op.create_index(
        "ix_submission_assignee_progress_user_id",
        "submission_assignee_progress",
        ["user_id"],
    )

    bind = op.get_bind()
    histories = bind.execute(
        sa.text(
            "SELECT submission_id, changed_by_id, to_progress_percent, created_at "
            "FROM submission_status_history WHERE to_status = 'in_progress' "
            "ORDER BY created_at, id"
        )
    ).mappings()
    latest = {
        (row["submission_id"], row["changed_by_id"]): row
        for row in histories
    }
    if latest:
        table = sa.table(
            "submission_assignee_progress",
            sa.column("submission_id", sa.Integer()),
            sa.column("user_id", sa.Integer()),
            sa.column("progress_percent", sa.Integer()),
            sa.column("updated_at", sa.DateTime()),
        )
        op.bulk_insert(
            table,
            [
                {
                    "submission_id": row["submission_id"],
                    "user_id": row["changed_by_id"],
                    "progress_percent": row["to_progress_percent"],
                    "updated_at": row["created_at"],
                }
                for row in latest.values()
            ],
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "submission_assignee_progress" not in inspector.get_table_names():
        return
    op.drop_index(
        "ix_submission_assignee_progress_user_id",
        table_name="submission_assignee_progress",
    )
    op.drop_index(
        "ix_submission_assignee_progress_submission_id",
        table_name="submission_assignee_progress",
    )
    op.drop_table("submission_assignee_progress")
