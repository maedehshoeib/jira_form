from datetime import datetime, timedelta
from pathlib import Path
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_authenticated_user
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.admin_session import AdminSession
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    ProfileUpdateRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter()

AVATAR_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_AVATAR_SIZE = 5 * 1024 * 1024


def _normalize_username(username: str) -> str:
    value = username.strip()
    if "\\" in value:
        value = value.rsplit("\\", 1)[-1]
    if "@" in value:
        value = value.split("@", 1)[0]
    return value.lower()


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    username = _normalize_username(body.username)
    user = db.query(User).filter(User.username == username).first()

    if (
        user is None
        or not user.is_active
        or not verify_password(body.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="نام کاربری یا رمز عبور اشتباه است",
        )

    token_data = {"sub": str(user.id), "username": user.username}
    if user.is_admin:
        expired_before = datetime.utcnow() - timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        expired_sessions = (
            db.query(AdminSession)
            .filter(
                AdminSession.user_id == user.id,
                AdminSession.is_active.is_(True),
                AdminSession.logged_in_at < expired_before,
            )
            .all()
        )
        for expired_session in expired_sessions:
            expired_session.is_active = False
            expired_session.logged_out_at = datetime.utcnow()

        device_id = body.device_id.strip() or uuid.uuid4().hex
        active_for_device = (
            db.query(AdminSession)
            .filter(
                AdminSession.user_id == user.id,
                AdminSession.device_id == device_id,
                AdminSession.is_active.is_(True),
            )
            .all()
        )
        if not active_for_device:
            active_devices = (
                db.query(AdminSession.device_id)
                .filter(
                    AdminSession.user_id == user.id,
                    AdminSession.is_active.is_(True),
                )
                .distinct()
                .count()
            )
            if active_devices >= settings.ADMIN_MAX_DEVICES:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="حداکثر ۴ دستگاه می‌توانند هم‌زمان وارد حساب مدیر باشند.",
                )
        for old_session in active_for_device:
            old_session.is_active = False
            old_session.logged_out_at = datetime.utcnow()

        session_key = uuid.uuid4().hex
        forwarded_for = request.headers.get("x-forwarded-for", "")
        ip_address = (
            forwarded_for.split(",", 1)[0].strip()
            if forwarded_for
            else (request.client.host if request.client else "")
        )
        db.add(
            AdminSession(
                user_id=user.id,
                session_key=session_key,
                device_id=device_id,
                device_name=body.device_name.strip() or "دستگاه ناشناس",
                user_agent=request.headers.get("user-agent", "")[:1024],
                ip_address=ip_address[:64],
            )
        )
        token_data["sid"] = session_key

    user.last_login = datetime.utcnow()
    db.commit()
    db.refresh(user)

    token = create_access_token(token_data)
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/logout")
def logout(
    request: Request,
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
):
    if current_user.is_admin:
        from app.core.security import decode_access_token

        token = request.headers.get("authorization", "").removeprefix("Bearer ").strip()
        payload = decode_access_token(token) or {}
        session_key = payload.get("sid")
        if session_key:
            session = (
                db.query(AdminSession)
                .filter(
                    AdminSession.session_key == session_key,
                    AdminSession.user_id == current_user.id,
                )
                .first()
            )
            if session and session.is_active:
                session.is_active = False
                session.logged_out_at = datetime.utcnow()
                db.commit()
    return {"message": "logged_out"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_authenticated_user)):
    return UserResponse.model_validate(current_user)


@router.put("/profile", response_model=UserResponse)
def update_profile(
    body: ProfileUpdateRequest,
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
):
    current_user.display_name = body.display_name.strip()
    current_user.email = str(body.email).strip().lower()
    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.post("/profile/avatar", response_model=UserResponse)
async def upload_avatar(
    avatar: UploadFile = File(...),
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
):
    extension = AVATAR_CONTENT_TYPES.get(avatar.content_type or "")
    if not extension:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are allowed.")
    content = await avatar.read(MAX_AVATAR_SIZE + 1)
    if not content or len(content) > MAX_AVATAR_SIZE:
        raise HTTPException(status_code=400, detail="Profile image must be smaller than 5 MB.")
    signatures_valid = {
        ".jpg": content.startswith(b"\xff\xd8\xff"),
        ".png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        ".webp": content.startswith(b"RIFF") and content[8:12] == b"WEBP",
    }
    if not signatures_valid[extension]:
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid image.")

    avatar_dir = (Path(settings.UPLOAD_DIR) / "avatars").resolve()
    avatar_dir.mkdir(parents=True, exist_ok=True)
    filename = f"user-{current_user.id}-{uuid.uuid4().hex}{extension}"
    destination = avatar_dir / filename
    destination.write_bytes(content)

    old_url = current_user.avatar_url
    current_user.avatar_url = f"/api/v1/avatars/{filename}"
    db.commit()
    db.refresh(current_user)
    if old_url.startswith(("/avatars/", "/api/v1/avatars/")):
        old_path = avatar_dir / Path(old_url).name
        if old_path != destination:
            old_path.unlink(missing_ok=True)
    return UserResponse.model_validate(current_user)


@router.post("/change-password", response_model=UserResponse)
def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="رمز عبور فعلی صحیح نیست",
        )

    current_user.password_hash = hash_password(body.new_password)
    current_user.must_change_password = False
    current_user.password_changed_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)
