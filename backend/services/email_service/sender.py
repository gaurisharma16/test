import os
from typing import List, Optional
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Cc


class EmailSenderError(Exception):
    pass


def send_email(
    to: str,
    subject: str,
    body: str,
    html: Optional[str] = None,
    cc: Optional[List[str]] = None,
):
    api_key = os.getenv("SENDGRID_API_KEY")
    from_email = os.getenv("EMAIL_FROM")

    if not api_key or not from_email:
        raise EmailSenderError("Missing SENDGRID_API_KEY or EMAIL_FROM")

    message = Mail(
        from_email=Email(from_email),
        to_emails=To(to),
        subject=subject,
        plain_text_content=body,
        html_content=html or body,
    )

    # Add CC if provided
    if cc:
        for email in cc:
            message.add_cc(Cc(email))

    try:
        sg = SendGridAPIClient(api_key)
        sg.send(message)
    except Exception as e:
        raise EmailSenderError(str(e))
