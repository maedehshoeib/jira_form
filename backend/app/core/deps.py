from datetime import datetime

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.admin_session import AdminSession
from app.models.user import User

security = HTTPBearer(auto_error=False)


def get_authenticated_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="لطفاً وارد سیستم شوید",
        )

    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="نشست منقضی شده است",
        )

    user = db.query(User).filter(User.id == int(payload.get("sub"))).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="کاربر یافت نشد",
        )
    if user.is_admin:
        session_key = payload.get("sid")
        session = (
            db.query(AdminSession)
            .filter(
                AdminSession.user_id == user.id,
                AdminSession.session_key == session_key,
                AdminSession.is_active.is_(True),
            )
            .first()
        )
        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="نشست مدیر منقضی یا از راه دور خارج شده است.",
            )
        session.last_seen_at = datetime.utcnow()
        db.commit()
    return user


def get_current_user(
    user: User = Depends(get_authenticated_user),
) -> User:
    if user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="برای ادامه ابتدا رمز عبور پیش‌فرض را تغییر دهید",
        )
    return user


def get_admin_user(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="این بخش فقط برای مدیر سامانه در دسترس است.",
        )
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User | None:
    if not credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload:
        return None
    user = (
        db.query(User)
        .filter(User.id == int(payload.get("sub")), User.is_active.is_(True))
        .first()
    )
    if user and user.is_admin:
        session_key = payload.get("sid")
        session = (
            db.query(AdminSession)
            .filter(
                AdminSession.user_id == user.id,
                AdminSession.session_key == session_key,
                AdminSession.is_active.is_(True),
            )
            .first()
        )
        if not session:
            return None
        session.last_seen_at = datetime.utcnow()
        db.commit()
    if user and user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="برای ادامه ابتدا رمز عبور پیش‌فرض را تغییر دهید",
        )
    return user
