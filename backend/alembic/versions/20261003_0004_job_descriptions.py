"""Add job_descriptions table for شرح وظایف.

Revision ID: 20261003_0004
Revises: 20260906_0003
"""

import sqlalchemy as sa
from alembic import op

revision = "20261003_0004"
down_revision = "20260906_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "job_descriptions" in inspector.get_table_names():
        return
    op.create_table(
        "job_descriptions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("organizational_position", sa.String(length=256), nullable=False),
        sa.Column("organizational_unit", sa.String(length=256), nullable=False),
        sa.Column("unit_responsibility", sa.Text(), nullable=False),
        sa.Column("qualification_requirements", sa.Text(), nullable=False),
        sa.Column("photo_path", sa.String(length=512), nullable=False, server_default=""),
        sa.Column("photo_name", sa.String(length=256), nullable=False, server_default=""),
        sa.Column(
            "attachment_path", sa.String(length=512), nullable=False, server_default=""
        ),
        sa.Column(
            "attachment_name", sa.String(length=256), nullable=False, server_default=""
        ),
        sa.Column("attachment_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("uploaded_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["uploaded_by_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_job_descriptions_organizational_unit",
        "job_descriptions",
        ["organizational_unit"],
    )
    op.create_index(
        "ix_job_descriptions_uploaded_by_id",
        "job_descriptions",
        ["uploaded_by_id"],
    )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "job_descriptions" not in inspector.get_table_names():
        return
    op.drop_index("ix_job_descriptions_uploaded_by_id", table_name="job_descriptions")
    op.drop_index(
        "ix_job_descriptions_organizational_unit", table_name="job_descriptions"
    )
    op.drop_table("job_descriptions")
