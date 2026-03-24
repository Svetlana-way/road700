from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.password_reset_token import PasswordResetToken


def invalidate_password_reset_tokens(db: Session, user_id: int) -> int:
    now = datetime.now(timezone.utc)
    tokens = db.scalars(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.used_at.is_(None),
        )
    ).all()
    for token_row in tokens:
        token_row.used_at = now
        db.add(token_row)
    return len(tokens)
