"""Simple SMTP email sender for the backend.

This module reads configuration from environment variables (optionally via python-dotenv)
and provides a convenient send_email function.

Environment variables (see ../.env.example):
- EMAIL_HOST: SMTP host
- EMAIL_PORT: SMTP port (int)
- EMAIL_USER: SMTP username (optional)
- EMAIL_PASSWORD: SMTP password (optional)
- EMAIL_USE_TLS: "true"/"false" - if true, use STARTTLS
- EMAIL_USE_SSL: "true"/"false" - if true, use SSL (implicit)
- EMAIL_FROM: default from address (optional)
"""

from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from typing import Iterable, Optional

from dotenv import load_dotenv

load_dotenv()

_HOST = os.getenv("EMAIL_HOST")
_PORT = int(os.getenv("EMAIL_PORT", "0")) if os.getenv("EMAIL_PORT") else None
_USER = os.getenv("EMAIL_USER")
_PASSWORD = os.getenv("EMAIL_PASSWORD")
_USE_TLS = os.getenv("EMAIL_USE_TLS", "false").lower() in ("1", "true", "yes")
_USE_SSL = os.getenv("EMAIL_USE_SSL", "false").lower() in ("1", "true", "yes")
_DEFAULT_FROM = os.getenv("EMAIL_FROM") or _USER


class EmailSenderError(Exception):
    """Raised when an email cannot be sent."""


def _attach_files(msg: EmailMessage, attachments: Optional[Iterable[str]]):
    if not attachments:
        return
    for path in attachments:
        try:
            with open(path, "rb") as f:
                data = f.read()
            maintype = "application"
            subtype = "octet-stream"
            filename = os.path.basename(path)
            msg.add_attachment(
                data, maintype=maintype, subtype=subtype, filename=filename
            )
        except FileNotFoundError:
            raise EmailSenderError(f"Attachment not found: {path}")


def send_email(
    to: Iterable[str] | str,
    subject: str,
    body: str,
    html: Optional[str] = None,
    from_addr: Optional[str] = None,
    cc: Optional[Iterable[str]] = None,
    bcc: Optional[Iterable[str]] = None,
    attachments: Optional[Iterable[str]] = None,
    timeout: float = 10.0,
):
    """Send an email using configured SMTP server.

    Args:
        to: recipient or list of recipients.
        subject: email subject.
        body: plain-text body.
        html: optional HTML body. If provided, will be added as an alternative.
        from_addr: override from address; defaults to EMAIL_FROM or EMAIL_USER.
        cc: optional CC addresses.
        bcc: optional BCC addresses.
        attachments: optional list of file paths to attach.
        timeout: socket timeout in seconds.

    Raises:
        EmailSenderError on misconfiguration or send failure.
    """
    if not _HOST or not _PORT:
        raise EmailSenderError("EMAIL_HOST and EMAIL_PORT must be set in environment")

    recipients = []
    if isinstance(to, str):
        recipients = [to]
    else:
        recipients = list(to)

    if cc:
        recipients.extend(list(cc))
    if bcc:
        recipients.extend(list(bcc))

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr or _DEFAULT_FROM or "no-reply"
    msg["To"] = ", ".join(recipients if isinstance(recipients, list) else [recipients])
    if cc:
        msg["Cc"] = ", ".join(list(cc))

    msg.set_content(body)
    if html:
        msg.add_alternative(html, subtype="html")

    _attach_files(msg, attachments)

    try:
        if _USE_SSL:
            smtp = smtplib.SMTP_SSL(_HOST, _PORT, timeout=timeout)
        else:
            smtp = smtplib.SMTP(_HOST, _PORT, timeout=timeout)
        with smtp:
            smtp.ehlo()
            if _USE_TLS and not _USE_SSL:
                smtp.starttls()
                smtp.ehlo()
            if _USER and _PASSWORD:
                smtp.login(_USER, _PASSWORD)
            smtp.send_message(msg, from_addr=msg["From"], to_addrs=recipients)
    except Exception as exc:  # keep broad to surface SMTP-related errors
        raise EmailSenderError(f"failed to send email: {exc}") from exc


__all__ = ["send_email", "EmailSenderError"]
