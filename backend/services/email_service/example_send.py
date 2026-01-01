"""Example usage of backend.email_service.send_email

This script will only attempt to actually send an email when the
environment variable EMAIL_SEND_TEST is set to "true". Otherwise it prints
the sample message and env hints so you can test safely.
"""

from __future__ import annotations

import os
from sender import send_email


def main() -> None:
    to = os.getenv("TEST_EMAIL_TO", "recipient@example.com")
    subject = "Test message from stock-brocker-assistant"
    body = "This is a test email from the project."
    html = "<p>This is a <strong>test</strong> email from the project.</p>"

    if os.getenv("EMAIL_SEND_TEST", "false").lower() == "true":
        print("Attempting to send test email to", to)
        send_email(to=to, subject=subject, body=body, html=html)
        print("Sent (no errors raised)")
    else:
        print("EMAIL_SEND_TEST not set to 'true' — dry run. Example payload:")
        print("To:", to)
        print("Subject:", subject)
        print("Body:", body)
        print()
        print(
            "To actually send, set environment variables in backend/.env or the environment:"
        )
        print("  EMAIL_HOST, EMAIL_PORT, optionally EMAIL_USER and EMAIL_PASSWORD")
        print("Then set EMAIL_SEND_TEST=true to enable sending.")


if __name__ == "__main__":
    main()
