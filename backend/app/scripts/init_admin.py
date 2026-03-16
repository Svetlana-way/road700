from sqlalchemy import select

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.enums import UserRole
from app.models.user import User


def init_admin() -> None:
    with SessionLocal() as db:
        existing_user = db.scalar(
            select(User).where(
                (User.login == settings.initial_admin_login)
                | (User.email == settings.initial_admin_email)
            )
        )

        if existing_user:
            existing_user.full_name = settings.initial_admin_full_name
            existing_user.login = settings.initial_admin_login
            existing_user.email = settings.initial_admin_email
            existing_user.password_hash = get_password_hash(settings.initial_admin_password)
            existing_user.role = UserRole.ADMIN
            existing_user.is_active = True
            db.add(existing_user)
            db.commit()
            print(f"Updated admin user: {existing_user.login}")
            return

        admin = User(
            full_name=settings.initial_admin_full_name,
            login=settings.initial_admin_login,
            email=settings.initial_admin_email,
            password_hash=get_password_hash(settings.initial_admin_password),
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print(f"Created admin user: {admin.login}")


if __name__ == "__main__":
    init_admin()
