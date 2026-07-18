from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.contracts_base import ContractsBase


class Contract(ContractsBase):
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    row_number: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    start_date: Mapped[str] = mapped_column(String(32), default="")
    end_date: Mapped[str] = mapped_column(String(32), default="")
    subject: Mapped[str] = mapped_column(String(512))
    contract_party: Mapped[str] = mapped_column(String(256), default="")
    contract_type: Mapped[str] = mapped_column(String(64))
    contract_number: Mapped[str] = mapped_column(String(128))
    attachment_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    attachment_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_by_id: Mapped[int] = mapped_column(Integer)
    created_by_name: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
