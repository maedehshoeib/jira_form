import asyncio
import json
import mimetypes
import uuid
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.security import decode_access_token
from app.db.session import SessionLocal, get_db
from app.models.admin_session import AdminSession
from app.models.chat import (
    ChatConversation,
    ChatMessage,
    ChatParticipant,
    ChatReaction,
)
from app.models.user import User
from app.schemas.chat import (
    ChatUserResponse,
    ConversationCreate,
    ConversationUpdate,
    ForwardRequest,
    GroupUpdate,
    MessageEdit,
    ParticipantAdd,
    ReactionRequest,
)

router = APIRouter()
MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024
ALLOWED_REACTIONS = {"👍", "❤️", "😂", "😮", "😢", "🙏"}


class ConnectionManager:
    def __init__(self):
        self.connections: dict[int, set[WebSocket]] = defaultdict(set)
        self.lock = asyncio.Lock()

    async def connect(self, user_id: int, socket: WebSocket):
        await socket.accept()
        async with self.lock:
            self.connections[user_id].add(socket)

    async def disconnect(self, user_id: int, socket: WebSocket):
        async with self.lock:
            self.connections[user_id].discard(socket)
            if not self.connections[user_id]:
                self.connections.pop(user_id, None)

    async def notify(self, user_ids: list[int], payload: dict):
        stale: list[tuple[int, WebSocket]] = []
        for user_id in set(user_ids):
            for socket in list(self.connections.get(user_id, ())):
                try:
                    await socket.send_json(payload)
                except Exception:
                    stale.append((user_id, socket))
        for user_id, socket in stale:
            await self.disconnect(user_id, socket)


manager = ConnectionManager()


def _participant(
    db: Session, conversation_id: int, user_id: int
) -> ChatParticipant:
    item = (
        db.query(ChatParticipant)
        .filter(
            ChatParticipant.conversation_id == conversation_id,
            ChatParticipant.user_id == user_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="گفتگو یافت نشد")
    return item


def _conversation_user_ids(db: Session, conversation_id: int) -> list[int]:
    return [
        row[0]
        for row in db.query(ChatParticipant.user_id)
        .filter(ChatParticipant.conversation_id == conversation_id)
        .all()
    ]


def _user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "department": user.department,
        "job_title": user.job_title,
        "extension": user.extension,
        "avatar_url": user.avatar_url,
    }


def _reaction_dicts(db: Session, message_ids: list[int]) -> dict[int, list[dict]]:
    result: dict[int, dict[str, dict]] = defaultdict(dict)
    if not message_ids:
        return {}
    rows = (
        db.query(ChatReaction, User)
        .join(User, User.id == ChatReaction.user_id)
        .filter(ChatReaction.message_id.in_(message_ids))
        .order_by(ChatReaction.id)
        .all()
    )
    for reaction, user in rows:
        bucket = result[reaction.message_id].setdefault(
            reaction.emoji, {"emoji": reaction.emoji, "user_ids": [], "users": []}
        )
        bucket["user_ids"].append(user.id)
        bucket["users"].append(user.display_name or user.username)
    return {key: list(value.values()) for key, value in result.items()}


def _message_dict(
    message: ChatMessage,
    sender: User,
    reply_message: ChatMessage | None = None,
    reply_sender: User | None = None,
    reactions: list[dict] | None = None,
) -> dict:
    deleted = message.deleted_at is not None
    reply = None
    if reply_message:
        reply = {
            "id": reply_message.id,
            "body": "پیام حذف شده" if reply_message.deleted_at else reply_message.body,
            "sender_name": (
                (reply_sender.display_name or reply_sender.username)
                if reply_sender
                else ""
            ),
            "has_attachment": bool(
                reply_message.attachment_path and not reply_message.deleted_at
            ),
        }
    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender": _user_dict(sender),
        "body": "" if deleted else message.body,
        "reply_to": reply,
        "is_forwarded": message.forwarded_from_id is not None,
        "attachment": (
            {
                "name": message.attachment_name,
                "type": message.attachment_type,
                "size": message.attachment_size,
                "url": f"/api/v1/chat/messages/{message.id}/attachment",
            }
            if message.attachment_path and not deleted
            else None
        ),
        "created_at": message.created_at.isoformat(),
        "edited_at": message.edited_at.isoformat() if message.edited_at else None,
        "deleted_at": message.deleted_at.isoformat() if message.deleted_at else None,
        "reactions": reactions or [],
    }


def _load_message_dicts(db: Session, messages: list[ChatMessage]) -> list[dict]:
    if not messages:
        return []
    user_ids = {item.sender_id for item in messages}
    reply_ids = {item.reply_to_id for item in messages if item.reply_to_id}
    replies = (
        {
            item.id: item
            for item in db.query(ChatMessage).filter(ChatMessage.id.in_(reply_ids)).all()
        }
        if reply_ids
        else {}
    )
    user_ids.update(
        reply.sender_id for reply in replies.values() if reply.sender_id is not None
    )
    users = {
        item.id: item for item in db.query(User).filter(User.id.in_(user_ids)).all()
    }
    reaction_map = _reaction_dicts(db, [item.id for item in messages])
    return [
        _message_dict(
            item,
            users[item.sender_id],
            replies.get(item.reply_to_id),
            users.get(replies[item.reply_to_id].sender_id)
            if item.reply_to_id in replies
            else None,
            reaction_map.get(item.id),
        )
        for item in messages
    ]


def _conversation_dict(
    db: Session,
    conversation: ChatConversation,
    membership: ChatParticipant,
    current_user_id: int,
) -> dict:
    members = (
        db.query(ChatParticipant, User)
        .join(User, User.id == ChatParticipant.user_id)
        .filter(ChatParticipant.conversation_id == conversation.id)
        .order_by(User.display_name, User.username)
        .all()
    )
    last = (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conversation.id)
        .order_by(ChatMessage.id.desc())
        .first()
    )
    last_payload = None
    if last:
        sender = next(
            (user for _, user in members if user.id == last.sender_id),
            None,
        )
        if sender is None:
            sender = db.get(User, last.sender_id)
        last_payload = _message_dict(last, sender)
    last_read = membership.last_read_message_id or 0
    unread = (
        db.query(func.count(ChatMessage.id))
        .filter(
            ChatMessage.conversation_id == conversation.id,
            ChatMessage.id > last_read,
            ChatMessage.sender_id != current_user_id,
        )
        .scalar()
        or 0
    )
    member_payload = [
        {
            **_user_dict(user),
            "role": participant.role,
            "last_read_message_id": participant.last_read_message_id,
        }
        for participant, user in members
    ]
    other = next((user for _, user in members if user.id != current_user_id), None)
    title = (
        conversation.title
        if conversation.kind == "group"
        else (other.display_name or other.username if other else "گفتگوی شخصی")
    )
    return {
        "id": conversation.id,
        "kind": conversation.kind,
        "title": title,
        "members": member_payload,
        "last_message": last_payload,
        "unread_count": unread,
        "is_muted": membership.is_muted,
        "is_pinned": membership.is_pinned,
        "is_archived": membership.is_archived,
        "role": membership.role,
        "created_at": conversation.created_at.isoformat(),
        "updated_at": conversation.updated_at.isoformat(),
    }


@router.get("/users", response_model=list[ChatUserResponse])
def list_chat_users(
    search: str = Query(default="", max_length=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(User).filter(
        User.is_active.is_(True), User.id != current_user.id
    )
    term = search.strip()
    if term:
        pattern = f"%{term}%"
        query = query.filter(
            or_(
                User.display_name.ilike(pattern),
                User.username.ilike(pattern),
                User.department.ilike(pattern),
                User.job_title.ilike(pattern),
            )
        )
    users = query.order_by(User.display_name, User.username).limit(200).all()
    return [ChatUserResponse.model_validate(_user_dict(item)) for item in users]


@router.get("/conversations")
def list_conversations(
    archived: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(ChatConversation, ChatParticipant)
        .join(
            ChatParticipant,
            ChatParticipant.conversation_id == ChatConversation.id,
        )
        .filter(
            ChatParticipant.user_id == current_user.id,
            ChatParticipant.is_archived.is_(archived),
        )
        .order_by(
            ChatParticipant.is_pinned.desc(), ChatConversation.updated_at.desc()
        )
        .all()
    )
    return [
        _conversation_dict(db, conversation, membership, current_user.id)
        for conversation, membership in rows
    ]


@router.post("/conversations", status_code=status.HTTP_201_CREATED)
async def create_conversation(
    body: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    participant_ids = list(dict.fromkeys(body.participant_ids))
    participant_ids = [item for item in participant_ids if item != current_user.id]
    if not participant_ids:
        raise HTTPException(status_code=400, detail="حداقل یک همکار را انتخاب کنید")
    users = (
        db.query(User)
        .filter(User.id.in_(participant_ids), User.is_active.is_(True))
        .all()
    )
    if len(users) != len(participant_ids):
        raise HTTPException(status_code=400, detail="یک یا چند کاربر معتبر نیستند")
    kind = "group" if body.kind == "group" or len(participant_ids) > 1 else "direct"
    if kind == "group" and not body.title.strip():
        raise HTTPException(status_code=400, detail="نام گروه الزامی است")
    direct_key = None
    if kind == "direct":
        direct_key = ":".join(
            str(value) for value in sorted([current_user.id, participant_ids[0]])
        )
        existing = (
            db.query(ChatConversation)
            .filter(ChatConversation.direct_key == direct_key)
            .first()
        )
        if existing:
            membership = _participant(db, existing.id, current_user.id)
            membership.is_archived = False
            db.commit()
            return _conversation_dict(db, existing, membership, current_user.id)
    conversation = ChatConversation(
        kind=kind,
        title=body.title.strip() if kind == "group" else "",
        direct_key=direct_key,
        created_by_id=current_user.id,
    )
    db.add(conversation)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        if direct_key:
            existing = (
                db.query(ChatConversation)
                .filter(ChatConversation.direct_key == direct_key)
                .first()
            )
            if existing:
                membership = _participant(db, existing.id, current_user.id)
                return _conversation_dict(
                    db, existing, membership, current_user.id
                )
        raise
    db.add(
        ChatParticipant(
            conversation_id=conversation.id,
            user_id=current_user.id,
            role="owner" if kind == "group" else "member",
        )
    )
    for user_id in participant_ids:
        db.add(
            ChatParticipant(
                conversation_id=conversation.id,
                user_id=user_id,
                role="member",
            )
        )
    db.commit()
    db.refresh(conversation)
    membership = _participant(db, conversation.id, current_user.id)
    await manager.notify(
        participant_ids,
        {"type": "conversation.created", "conversation_id": conversation.id},
    )
    return _conversation_dict(db, conversation, membership, current_user.id)


@router.patch("/conversations/{conversation_id}")
def update_conversation_settings(
    conversation_id: int,
    body: ConversationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = _participant(db, conversation_id, current_user.id)
    for field in ("is_muted", "is_pinned", "is_archived"):
        value = getattr(body, field)
        if value is not None:
            setattr(membership, field, value)
    db.commit()
    conversation = db.get(ChatConversation, conversation_id)
    return _conversation_dict(db, conversation, membership, current_user.id)


@router.patch("/conversations/{conversation_id}/group")
async def update_group(
    conversation_id: int,
    body: GroupUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = _participant(db, conversation_id, current_user.id)
    conversation = db.get(ChatConversation, conversation_id)
    if conversation.kind != "group" or membership.role != "owner":
        raise HTTPException(status_code=403, detail="فقط سازنده گروه اجازه ویرایش دارد")
    conversation.title = body.title.strip()
    conversation.updated_at = datetime.utcnow()
    db.commit()
    await manager.notify(
        _conversation_user_ids(db, conversation_id),
        {"type": "conversation.updated", "conversation_id": conversation_id},
    )
    return {"message": "updated"}


@router.post("/conversations/{conversation_id}/participants")
async def add_participants(
    conversation_id: int,
    body: ParticipantAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = _participant(db, conversation_id, current_user.id)
    conversation = db.get(ChatConversation, conversation_id)
    if conversation.kind != "group" or membership.role != "owner":
        raise HTTPException(status_code=403, detail="فقط سازنده گروه اجازه افزودن عضو دارد")
    ids = list(dict.fromkeys(body.user_ids))
    users = db.query(User).filter(User.id.in_(ids), User.is_active.is_(True)).all()
    if len(users) != len(ids):
        raise HTTPException(status_code=400, detail="یک یا چند کاربر معتبر نیستند")
    existing_ids = set(_conversation_user_ids(db, conversation_id))
    for user_id in ids:
        if user_id not in existing_ids:
            db.add(ChatParticipant(conversation_id=conversation_id, user_id=user_id))
    conversation.updated_at = datetime.utcnow()
    db.commit()
    await manager.notify(
        list(existing_ids | set(ids)),
        {"type": "conversation.updated", "conversation_id": conversation_id},
    )
    return {"message": "participants_added"}


@router.delete("/conversations/{conversation_id}/participants/{user_id}")
async def remove_participant(
    conversation_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = _participant(db, conversation_id, current_user.id)
    conversation = db.get(ChatConversation, conversation_id)
    if conversation.kind != "group":
        raise HTTPException(status_code=400, detail="این عملیات فقط برای گروه است")
    if user_id != current_user.id and membership.role != "owner":
        raise HTTPException(status_code=403, detail="اجازه حذف عضو را ندارید")
    target = _participant(db, conversation_id, user_id)
    if target.role == "owner":
        raise HTTPException(status_code=400, detail="سازنده گروه نمی‌تواند خارج شود")
    recipients = _conversation_user_ids(db, conversation_id)
    db.delete(target)
    conversation.updated_at = datetime.utcnow()
    db.commit()
    await manager.notify(
        recipients,
        {"type": "conversation.updated", "conversation_id": conversation_id},
    )
    return {"message": "participant_removed"}


@router.get("/conversations/{conversation_id}/messages")
def list_messages(
    conversation_id: int,
    before_id: int | None = None,
    search: str = Query(default="", max_length=200),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _participant(db, conversation_id, current_user.id)
    query = db.query(ChatMessage).filter(
        ChatMessage.conversation_id == conversation_id
    )
    if before_id:
        query = query.filter(ChatMessage.id < before_id)
    if search.strip():
        query = query.filter(
            ChatMessage.deleted_at.is_(None),
            ChatMessage.body.ilike(f"%{search.strip()}%"),
        )
    messages = query.order_by(ChatMessage.id.desc()).limit(limit + 1).all()
    has_more = len(messages) > limit
    messages = list(reversed(messages[:limit]))
    return {
        "items": _load_message_dicts(db, messages),
        "has_more": has_more,
        "next_before_id": messages[0].id if has_more and messages else None,
    }


@router.post("/conversations/{conversation_id}/messages", status_code=201)
async def send_message(
    conversation_id: int,
    body: str = Form(default=""),
    reply_to_id: int | None = Form(default=None),
    attachment: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = _participant(db, conversation_id, current_user.id)
    text = body.strip()
    if len(text) > 5000:
        raise HTTPException(status_code=400, detail="متن پیام بیش از حد طولانی است")
    if not text and not (attachment and attachment.filename):
        raise HTTPException(status_code=400, detail="پیام خالی قابل ارسال نیست")
    reply = None
    if reply_to_id:
        reply = db.get(ChatMessage, reply_to_id)
        if not reply or reply.conversation_id != conversation_id:
            raise HTTPException(status_code=400, detail="پیام پاسخ معتبر نیست")

    attachment_path = attachment_name = attachment_type = None
    attachment_size = None
    if attachment and attachment.filename:
        safe_name = Path(attachment.filename).name[:256]
        content = await attachment.read(MAX_ATTACHMENT_SIZE + 1)
        if len(content) > MAX_ATTACHMENT_SIZE:
            raise HTTPException(status_code=413, detail="حداکثر حجم فایل ۱۵ مگابایت است")
        extension = Path(safe_name).suffix.lower()[:16]
        upload_dir = (Path(settings.UPLOAD_DIR) / "chat").resolve()
        upload_dir.mkdir(parents=True, exist_ok=True)
        target = upload_dir / f"{uuid.uuid4().hex}{extension}"
        target.write_bytes(content)
        attachment_path = str(target)
        attachment_name = safe_name
        attachment_type = (
            attachment.content_type
            or mimetypes.guess_type(safe_name)[0]
            or "application/octet-stream"
        )[:128]
        attachment_size = len(content)

    message = ChatMessage(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        body=text,
        reply_to_id=reply_to_id,
        attachment_path=attachment_path,
        attachment_name=attachment_name,
        attachment_type=attachment_type,
        attachment_size=attachment_size,
    )
    db.add(message)
    db.flush()
    membership.last_read_message_id = message.id
    membership.is_archived = False
    conversation = db.get(ChatConversation, conversation_id)
    conversation.updated_at = datetime.utcnow()
    for item in (
        db.query(ChatParticipant)
        .filter(ChatParticipant.conversation_id == conversation_id)
        .all()
    ):
        item.is_archived = False
    db.commit()
    db.refresh(message)
    payload = _load_message_dicts(db, [message])[0]
    await manager.notify(
        _conversation_user_ids(db, conversation_id),
        {"type": "message.created", "conversation_id": conversation_id, "message": payload},
    )
    return payload


@router.patch("/messages/{message_id}")
async def edit_message(
    message_id: int,
    body: MessageEdit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = db.get(ChatMessage, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="پیام یافت نشد")
    _participant(db, message.conversation_id, current_user.id)
    if message.sender_id != current_user.id or message.deleted_at:
        raise HTTPException(status_code=403, detail="اجازه ویرایش این پیام را ندارید")
    message.body = body.body.strip()
    message.edited_at = datetime.utcnow()
    db.commit()
    await manager.notify(
        _conversation_user_ids(db, message.conversation_id),
        {"type": "message.updated", "conversation_id": message.conversation_id, "message_id": message.id},
    )
    return _load_message_dicts(db, [message])[0]


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = db.get(ChatMessage, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="پیام یافت نشد")
    _participant(db, message.conversation_id, current_user.id)
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="اجازه حذف این پیام را ندارید")
    if not message.deleted_at:
        message.body = ""
        message.deleted_at = datetime.utcnow()
        db.query(ChatReaction).filter(ChatReaction.message_id == message.id).delete()
        db.commit()
    await manager.notify(
        _conversation_user_ids(db, message.conversation_id),
        {"type": "message.deleted", "conversation_id": message.conversation_id, "message_id": message.id},
    )
    return {"message": "deleted"}


@router.post("/messages/{message_id}/forward", status_code=201)
async def forward_message(
    message_id: int,
    body: ForwardRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    source = db.get(ChatMessage, message_id)
    if not source or source.deleted_at:
        raise HTTPException(status_code=404, detail="پیام یافت نشد")
    _participant(db, source.conversation_id, current_user.id)
    target_ids = list(dict.fromkeys(body.conversation_ids))
    for conversation_id in target_ids:
        _participant(db, conversation_id, current_user.id)
    created = []
    for conversation_id in target_ids:
        item = ChatMessage(
            conversation_id=conversation_id,
            sender_id=current_user.id,
            body=source.body,
            forwarded_from_id=source.id,
            attachment_path=source.attachment_path,
            attachment_name=source.attachment_name,
            attachment_type=source.attachment_type,
            attachment_size=source.attachment_size,
        )
        db.add(item)
        db.flush()
        membership = _participant(db, conversation_id, current_user.id)
        membership.last_read_message_id = item.id
        for participant in (
            db.query(ChatParticipant)
            .filter(ChatParticipant.conversation_id == conversation_id)
            .all()
        ):
            participant.is_archived = False
        conversation = db.get(ChatConversation, conversation_id)
        conversation.updated_at = datetime.utcnow()
        created.append(item)
    db.commit()
    for item in created:
        await manager.notify(
            _conversation_user_ids(db, item.conversation_id),
            {"type": "message.created", "conversation_id": item.conversation_id},
        )
    return {"message": "forwarded", "count": len(created)}


@router.post("/messages/{message_id}/reactions")
async def toggle_reaction(
    message_id: int,
    body: ReactionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.emoji not in ALLOWED_REACTIONS:
        raise HTTPException(status_code=400, detail="واکنش معتبر نیست")
    message = db.get(ChatMessage, message_id)
    if not message or message.deleted_at:
        raise HTTPException(status_code=404, detail="پیام یافت نشد")
    _participant(db, message.conversation_id, current_user.id)
    existing = (
        db.query(ChatReaction)
        .filter(
            ChatReaction.message_id == message_id,
            ChatReaction.user_id == current_user.id,
            ChatReaction.emoji == body.emoji,
        )
        .first()
    )
    if existing:
        db.delete(existing)
    else:
        db.add(
            ChatReaction(
                message_id=message_id, user_id=current_user.id, emoji=body.emoji
            )
        )
    db.commit()
    await manager.notify(
        _conversation_user_ids(db, message.conversation_id),
        {"type": "message.updated", "conversation_id": message.conversation_id, "message_id": message.id},
    )
    return {"reactions": _reaction_dicts(db, [message_id]).get(message_id, [])}


@router.post("/conversations/{conversation_id}/read")
async def mark_read(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = _participant(db, conversation_id, current_user.id)
    latest = (
        db.query(func.max(ChatMessage.id))
        .filter(ChatMessage.conversation_id == conversation_id)
        .scalar()
    )
    changed = membership.last_read_message_id != latest
    membership.last_read_message_id = latest
    db.commit()
    if changed:
        await manager.notify(
            _conversation_user_ids(db, conversation_id),
            {"type": "conversation.read", "conversation_id": conversation_id, "user_id": current_user.id},
        )
    return {"last_read_message_id": latest}


@router.get("/messages/{message_id}/attachment")
def download_attachment(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = db.get(ChatMessage, message_id)
    if not message or not message.attachment_path or message.deleted_at:
        raise HTTPException(status_code=404, detail="فایل یافت نشد")
    _participant(db, message.conversation_id, current_user.id)
    path = Path(message.attachment_path).resolve()
    allowed_root = (Path(settings.UPLOAD_DIR) / "chat").resolve()
    if allowed_root not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="فایل یافت نشد")
    return FileResponse(
        path,
        filename=message.attachment_name or path.name,
        media_type=message.attachment_type or "application/octet-stream",
    )


@router.websocket("/ws")
async def chat_socket(websocket: WebSocket, token: str = Query(default="")):
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        await websocket.close(code=4401)
        return
    db = SessionLocal()
    try:
        try:
            user_id_from_token = int(payload["sub"])
        except (TypeError, ValueError):
            await websocket.close(code=4401)
            return
        user = (
            db.query(User)
            .filter(
                User.id == user_id_from_token,
                User.is_active.is_(True),
                User.must_change_password.is_(False),
            )
            .first()
        )
        if not user:
            await websocket.close(code=4401)
            return
        if user.is_admin:
            session_key = payload.get("sid")
            valid_session = (
                db.query(AdminSession)
                .filter(
                    AdminSession.user_id == user.id,
                    AdminSession.session_key == session_key,
                    AdminSession.is_active.is_(True),
                )
                .first()
            )
            if not valid_session:
                await websocket.close(code=4401)
                return
        user_id = user.id
    finally:
        db.close()
    await manager.connect(user_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            if raw == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue
            try:
                event = json.loads(raw)
                conversation_id = int(event.get("conversation_id", 0))
            except (json.JSONDecodeError, TypeError, ValueError):
                continue
            if event.get("type") != "typing" or not conversation_id:
                continue
            db = SessionLocal()
            try:
                is_member = (
                    db.query(ChatParticipant.id)
                    .filter(
                        ChatParticipant.conversation_id == conversation_id,
                        ChatParticipant.user_id == user_id,
                    )
                    .first()
                )
                if is_member:
                    await manager.notify(
                        _conversation_user_ids(db, conversation_id),
                        {
                            "type": "typing",
                            "conversation_id": conversation_id,
                            "user_id": user_id,
                            "user_name": user.display_name or user.username,
                        },
                    )
            finally:
                db.close()
    except WebSocketDisconnect:
        await manager.disconnect(user_id, websocket)
    except Exception:
        await manager.disconnect(user_id, websocket)
