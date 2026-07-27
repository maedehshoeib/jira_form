from datetime import datetime

from pydantic import BaseModel


class PdfFormResponse(BaseModel):
    id: int
    title: str
    description: str
    file_name: str
    file_size: int
    created_at: datetime

    class Config:
        from_attributes = True
