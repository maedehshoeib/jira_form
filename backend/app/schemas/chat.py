from pydantic import BaseModel, Field, model_validator


class ChatUserResponse(BaseModel):
    id: int
    username: str
    display_name: str
    department: str
    job_title: str
    extension: str


class ConversationCreate(BaseModel):
    participant_ids: list[int] = Field(min_length=1, max_length=100)
    title: str = Field(default="", max_length=256)
    kind: str = Field(default="direct", pattern="^(direct|group)$")

    @model_validator(mode="after")
    def validate_group(self):
        if self.kind == "group" and not self.title.strip():
            raise ValueError("نام گروه الزامی است")
        return self


class ConversationUpdate(BaseModel):
    is_muted: bool | None = None
    is_pinned: bool | None = None
    is_archived: bool | None = None


class GroupUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=256)


class ParticipantAdd(BaseModel):
    user_ids: list[int] = Field(min_length=1, max_length=100)


class MessageEdit(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class ForwardRequest(BaseModel):
    conversation_ids: list[int] = Field(min_length=1, max_length=20)


class ReactionRequest(BaseModel):
    emoji: str = Field(min_length=1, max_length=16)
