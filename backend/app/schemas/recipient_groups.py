from pydantic import BaseModel, Field


class RecipientGroupWrite(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    member_ids: list[int] = Field(min_length=1, max_length=100)


class RecipientGroupMemberResponse(BaseModel):
    id: int
    username: str
    display_name: str
    department: str
    job_title: str
    is_active: bool


class RecipientGroupResponse(BaseModel):
    id: int
    name: str
    is_shared: bool
    members: list[RecipientGroupMemberResponse]
