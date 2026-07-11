from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.services.jira_service import jira_service
from app.services.ldap_service import ldap_service, normalize_username

router = APIRouter()


def _get_or_create_user(db: Session, ldap_info) -> User:
    user = db.query(User).filter(User.username == ldap_info.username).first()
    now = datetime.utcnow()

    if user:
        user.display_name = ldap_info.display_name or user.display_name
        user.email = ldap_info.email or user.email
        user.department = ldap_info.department or user.department
        user.last_login = now
    else:
        user = User(
            username=ldap_info.username,
            display_name=ldap_info.display_name,
            email=ldap_info.email,
            department=ldap_info.department,
            last_login=now,
        )
        db.add(user)

    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: Session = Depends(get_db)):
    username = normalize_username(body.username)
    password = body.password

    user_info = ldap_service.authenticate(username, password)
    if not user_info:
        user_info = await jira_service.authenticate(username, password)

    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="نام کاربری یا رمز عبور اشتباه است",
        )

    user = _get_or_create_user(db, user_info)

    jira_me = await jira_service.get_me(username, password)
    if jira_me.get("displayName") and jira_me["displayName"] != username:
        user.display_name = jira_me["displayName"]
    if jira_me.get("email"):
        user.email = jira_me["email"]
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "username": user.username})

    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)
