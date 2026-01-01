steps

step 1 - mac/linux only (if windows google how to install uv)

```
brew install uv
```

step 2

```
cd backend
```

step 3

```
uv sync
```

step 4

```
cd broker-scrapper
```

step 5

```
uv run webscrapper.py
```

output will be save in a file called

`articles.json`

the website links are stored in a list
here ->

```
def main():
    import os

    # Scrape articles from websites
    websites = [
        "http://finance.yahoo.com/",
        "https://www.bloomberg.com/asia",
        "https://www.marketwatch.com/,",
        "https://www.reuters.com/business/finance/",
    ]

```

## Authentication API

The backend includes a complete authentication system with JWT tokens, MongoDB storage, and email services.

### Endpoints

#### Register User
- **POST** `/auth/register`
- Body: `{"email": "user@example.com", "username": "username", "password": "password"}`
- Sends verification email

#### Login
- **POST** `/auth/login`
- Body: `{"username": "email", "password": "password"}` (OAuth2 form)
- Returns: `{"access_token": "jwt_token", "token_type": "bearer"}`

#### Forgot Password
- **POST** `/auth/forgot-password`
- Body: `{"email": "user@example.com"}`
- Sends reset email

#### Reset Password
- **POST** `/auth/reset-password`
- Body: `{"token": "reset_token", "new_password": "newpassword"}`

#### Verify Email
- **GET** `/auth/verify-email?token=verification_token`

#### Get Current User
- **GET** `/auth/me`
- Requires: Bearer token

#### Change Password
- **POST** `/auth/change-password`
- Body: `{"old_password": "oldpass", "new_password": "newpass"}`
- Requires: Bearer token

#### Resend Verification
- **POST** `/auth/resend-verification`
- Body: `{"email": "user@example.com"}`

### Environment Variables

Copy `.env.example` to `.env` and configure:

- `MONGODB_URL`: MongoDB connection URL
- `DATABASE_NAME`: Database name
- `SECRET_KEY`: JWT secret key
- Email settings (EMAIL_HOST, EMAIL_PORT, etc.)

### Dependencies

Install with: `pip install -e .` or `uv sync`
