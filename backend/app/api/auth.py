from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.core.config import settings
from app.core.security import create_access_token, generate_secure_token, get_password_hash, hash_token, verify_password
from app.models.audit import AuditLog
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    ChangePasswordResponse,
    PasswordResetConfirmRequest,
    PasswordResetConfirmResponse,
    PasswordResetRequestCreate,
    PasswordResetRequestResponse,
    TokenResponse,
)
from app.schemas.user import UserRead
from app.services.email_delivery import send_password_reset_email


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> TokenResponse:
    user = db.scalar(select(User).where(User.login == form_data.username))

    if user is None or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect login or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")

    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_active_user)) -> UserRead:
    return UserRead.model_validate(current_user)


@router.post("/change-password", response_model=ChangePasswordResponse)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ChangePasswordResponse:
    current_password = payload.current_password.strip()
    new_password = payload.new_password.strip()
    if len(new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Новый пароль должен быть не короче 8 символов")
    if not verify_password(current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Текущий пароль указан неверно")
    if current_password == new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Новый пароль должен отличаться от текущего")

    current_user.password_hash = get_password_hash(new_password)
    db.add(current_user)
    db.add(
        AuditLog(
            user_id=current_user.id,
            entity_type="user",
            entity_id=str(current_user.id),
            action_type="user_password_changed",
            old_value=None,
            new_value={"self_service": True},
        )
    )
    db.commit()
    return ChangePasswordResponse(message="Пароль обновлён")


@router.post("/password-reset/request", response_model=PasswordResetRequestResponse)
def request_password_reset(
    payload: PasswordResetRequestCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> PasswordResetRequestResponse:
    email = payload.email.strip().lower()
    generic_message = "Если пользователь с такой почтой найден, инструкция по восстановлению подготовлена"
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not user.is_active:
        return PasswordResetRequestResponse(message=generic_message, delivery_method="none")

    now = datetime.now(timezone.utc)
    existing_tokens = db.scalars(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
    ).all()
    for token_row in existing_tokens:
        token_row.used_at = now
        db.add(token_row)

    raw_token = generate_secure_token()
    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_token(raw_token),
        expires_at=now + timedelta(minutes=settings.password_reset_token_ttl_minutes),
        requested_for_email=user.email,
        delivery_status="pending",
        delivery_error=None,
    )
    db.add(reset_token)
    db.flush()

    base_url = str(request.base_url).rstrip("/")
    reset_link = f"{base_url}/?reset_token={raw_token}"
    sent, delivery_error = send_password_reset_email(recipient_email=user.email, reset_link=reset_link)
    reset_token.delivery_status = "sent" if sent else "pending_manual"
    reset_token.delivery_error = delivery_error
    db.add(reset_token)
    db.add(
        AuditLog(
            user_id=user.id,
            entity_type="user",
            entity_id=str(user.id),
            action_type="user_password_recovery_requested",
            old_value=None,
            new_value={
                "delivery_status": reset_token.delivery_status,
                "delivery_error": delivery_error,
            },
        )
    )
    db.commit()
    return PasswordResetRequestResponse(
        message=generic_message if sent else f"{generic_message}. Почтовая отправка пока не настроена.",
        delivery_method="email" if sent else "manual",
    )


@router.post("/password-reset/confirm", response_model=PasswordResetConfirmResponse)
def confirm_password_reset(
    payload: PasswordResetConfirmRequest,
    db: Session = Depends(get_db),
) -> PasswordResetConfirmResponse:
    new_password = payload.new_password.strip()
    if len(new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Новый пароль должен быть не короче 8 символов")

    token_row = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(payload.token)))
    if token_row is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ссылка восстановления недействительна")
    now = datetime.now(timezone.utc)
    if token_row.used_at is not None or token_row.expires_at < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ссылка восстановления недействительна или срок её действия истёк")

    user = db.scalar(select(User).where(User.id == token_row.user_id))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Пользователь недоступен для восстановления пароля")

    user.password_hash = get_password_hash(new_password)
    token_row.used_at = now
    db.add(user)
    db.add(token_row)
    db.add(
        AuditLog(
            user_id=user.id,
            entity_type="user",
            entity_id=str(user.id),
            action_type="user_password_recovered",
            old_value=None,
            new_value={"password_recovered": True},
        )
    )
    db.commit()
    return PasswordResetConfirmResponse(message="Пароль восстановлен")
