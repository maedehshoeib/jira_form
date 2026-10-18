from typing import Literal

from pydantic import BaseModel, Field

LetterFolderScope = Literal["received", "sent"]


class LetterFolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    scope: LetterFolderScope


class LetterFolderUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class LetterFolderItemCreate(BaseModel):
    submission_id: int | None = None
    batch_id: str | None = Field(default=None, max_length=64)


class LetterFolderItemResponse(BaseModel):
    id: int
    submission_id: int | None = None
    batch_id: str | None = None


class LetterFolderResponse(BaseModel):
    id: int
    name: str
    scope: LetterFolderScope
    sort_order: int
    item_count: int
    submission_ids: list[int] = Field(default_factory=list)
    batch_ids: list[str] = Field(default_factory=list)
