from __future__ import annotations

from sqlalchemy import select

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.enums import UserRole
from app.models.user import User


def init_admin() -> None:
    normalized_full_name = (settings.initial_admin_full_name or "").strip()
    if not normalized_full_name:
        raise RuntimeError("Initial admin full name must not be empty")
    normalized_login = (settings.initial_admin_login or "").strip().lower()
    if not normalized_login:
        raise RuntimeError("Initial admin login must not be empty")
    normalized_email = (settings.initial_admin_email or "").strip().lower()
    if not normalized_email:
        raise RuntimeError("Initial admin email must not be empty")
    initial_admin_password = settings.initial_admin_password or ""
    if len(initial_admin_password) < 8:
        raise RuntimeError("Initial admin password must be at least 8 characters long")
    with SessionLocal() as db:
        existing_user = db.scalar(
            select(User).where(
                (User.login.ilike(normalized_login))
                | (User.email.ilike(normalized_email))
            )
        )

        if existing_user:
            changed = False
            if existing_user.role != UserRole.ADMIN:
                existing_user.role = UserRole.ADMIN
                changed = True
            if not existing_user.is_active:
                existing_user.is_active = True
                changed = True
            if existing_user.full_name != normalized_full_name:
                existing_user.full_name = normalized_full_name
                changed = True
            if existing_user.login != normalized_login:
                existing_user.login = normalized_login
                changed = True
            if existing_user.email != normalized_email:
                existing_user.email = normalized_email
                changed = True

            if changed:
                db.add(existing_user)
                db.commit()
                print(f"Updated admin access: {existing_user.login}")
            else:
                print(f"Admin user already exists: {existing_user.login}")
            return

        admin = User(
            full_name=normalized_full_name,
            login=normalized_login,
            email=normalized_email,
            password_hash=get_password_hash(initial_admin_password),
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print(f"Created admin user: {admin.login}")


if __name__ == "__main__":
    init_admin()
