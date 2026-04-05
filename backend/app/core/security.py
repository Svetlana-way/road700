import secrets
import uuid
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path
from typing import Any, Optional

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.core.paths import get_storage_root


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
AUTH_SESSION_EPOCH_CLAIM = "ase"
AUTH_SESSION_EPOCH_FILENAME = ".auth_session_epoch"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def build_access_token_password_fingerprint(password_hash: str) -> str:
    return sha256(f"{password_hash}:{settings.jwt_secret_key}".encode("utf-8")).hexdigest()


def auth_session_epoch_path() -> Path:
    return get_storage_root() / "backups" / AUTH_SESSION_EPOCH_FILENAME


def read_auth_session_epoch() -> str:
    path = auth_session_epoch_path()
    if not path.exists():
        return "0"
    value = path.read_text(encoding="utf-8").strip()
    return value or "0"


def write_auth_session_epoch(value: str) -> str:
    path = auth_session_epoch_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value, encoding="utf-8")
    return value


def rotate_auth_session_epoch() -> str:
    return write_auth_session_epoch(uuid.uuid4().hex)


def create_access_token(
    subject: str,
    expires_delta: Optional[timedelta] = None,
    *,
    password_fingerprint: str | None = None,
    auth_session_epoch: str | None = None,
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode: dict[str, Any] = {"sub": subject, "exp": expire}
    if password_fingerprint is not None:
        to_encode["pwd"] = password_fingerprint
    if auth_session_epoch is not None:
        to_encode[AUTH_SESSION_EPOCH_CLAIM] = auth_session_epoch
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


def generate_secure_token(length: int = 32) -> str:
    return secrets.token_urlsafe(length)


def hash_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()
