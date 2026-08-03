from datetime import datetime

from pydantic import BaseModel


class PdfFormResponse(BaseModel):
    id: int
    category: str
    title: str
    description: str
    file_name: str
    file_size: int
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
