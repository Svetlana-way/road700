from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app.core.config import settings


def is_email_delivery_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_from_email)


def send_password_reset_email(*, recipient_email: str, reset_link: str) -> tuple[bool, str | None]:
    if not is_email_delivery_configured():
        return False, "SMTP not configured"

    message = EmailMessage()
    message["Subject"] = "Восстановление пароля Road700"
    message["From"] = (
        f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
        if settings.smtp_from_name
        else str(settings.smtp_from_email)
    )
    message["To"] = recipient_email
    message.set_content(
        "\n".join(
            [
                "Запрошено восстановление пароля в системе Road700.",
                "",
                "Если это были не вы, просто проигнорируйте это письмо.",
                "",
                f"Ссылка для восстановления: {reset_link}",
            ]
        )
    )

    try:
        if settings.smtp_use_ssl:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=20) as server:
                if settings.smtp_username and settings.smtp_password:
                    server.login(settings.smtp_username, settings.smtp_password)
                server.send_message(message)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
                if settings.smtp_use_tls:
                    server.starttls()
                if settings.smtp_username and settings.smtp_password:
                    server.login(settings.smtp_username, settings.smtp_password)
                server.send_message(message)
    except Exception as exc:
        return False, str(exc)

    return True, None
