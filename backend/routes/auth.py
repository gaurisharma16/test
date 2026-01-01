import os
import secrets
from datetime import timedelta

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt

from models.user import (
    UserPublic,
    UserInDB,
    UserCreate,
    Token,
    TokenData,
    ForgotPassword,
    ResetPassword,
    ChangePassword,
    ResendVerification,
)
from services.auth_service import AuthService
from services.email_service.sender import EmailSenderError, send_email

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

router = APIRouter(prefix="/auth", tags=["authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserInDB:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception

    if token_data.email is None:
        raise credentials_exception

    user = await AuthService.get_user_by_email(token_data.email)
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(
    current_user: UserInDB = Depends(get_current_user),
) -> UserInDB:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


@router.post("/register", response_model=UserPublic)
async def register(user: UserCreate):
    try:
        db_user = await AuthService.create_user(user)
        # Send verification email
        try:
            verification_token = AuthService.create_access_token(
                data={"sub": user.email, "type": "verification"},
                expires_delta=timedelta(hours=24),
            )
            verification_url = (
                f"http://localhost:8000/auth/verify-email?token={verification_token}"
            )

            send_email(
                to=user.email,
                subject="Verify your email - Stock Broker Assistant",
                body=f"Please verify your email by clicking this link: {verification_url}",
                html=f"""
                <p>Please verify your email by clicking the link below:</p>
                <a href="{verification_url}">Verify Email</a>
                <p>This link will expire in 24 hours.</p>
                """,
            )
        except EmailSenderError:
            # Do not block signup if email delivery fails
            pass

        return UserPublic.model_validate(db_user.model_dump(by_alias=True))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await AuthService.authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified",
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = AuthService.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/forgot-password")
async def forgot_password(request: ForgotPassword):
    try:
        reset_token = await AuthService.create_reset_token(request.email)
        reset_url = f"http://localhost:8000/auth/reset-password?token={reset_token}"

        send_email(
            to=request.email,
            subject="Reset your password - Stock Broker Assistant",
            body=f"Click this link to reset your password: {reset_url}",
            html=f"""
            <p>You requested a password reset. Click the link below to reset your password:</p>
            <a href="{reset_url}">Reset Password</a>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
            """,
        )
        return {"message": "Password reset email sent"}
    except ValueError:
        # Don't reveal if email exists or not
        return {"message": "If the email exists, a reset link has been sent"}
    except EmailSenderError as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


@router.post("/reset-password")
async def reset_password(request: ResetPassword):
    success = await AuthService.reset_password(request.token, request.new_password)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    return {"message": "Password reset successfully"}


@router.get("/verify-email")
async def verify_email(token: str):
    user = await AuthService.verify_email_token(token)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    return {"message": "Email verified successfully"}


@router.get("/me", response_model=UserPublic)
async def read_users_me(current_user: UserInDB = Depends(get_current_active_user)):
    return UserPublic.model_validate(current_user.model_dump(by_alias=True))


@router.post("/resend-verification")
async def resend_verification_email(payload: ResendVerification):
    user = await AuthService.get_user_by_email(payload.email)
    if not user:
        return {"message": "If the email exists, a verification link has been sent"}

    if user.is_verified:
        return {"message": "Email already verified"}

    try:
        verification_token = AuthService.create_access_token(
            data={"sub": payload.email, "type": "verification"},
            expires_delta=timedelta(hours=24),
        )
        verification_url = (
            f"http://localhost:8000/auth/verify-email?token={verification_token}"
        )

        send_email(
            to=payload.email,
            subject="Verify your email - Stock Broker Assistant",
            body=f"Please verify your email by clicking this link: {verification_url}",
            html=f"""
            <p>Please verify your email by clicking the link below:</p>
            <a href="{verification_url}">Verify Email</a>
            <p>This link will expire in 24 hours.</p>
            """,
        )
        return {"message": "Verification email sent"}
    except EmailSenderError as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


@router.post("/change-password")
async def change_password(
    payload: ChangePassword, current_user: UserInDB = Depends(get_current_active_user)
):
    if not AuthService.verify_password(
        payload.old_password, current_user.hashed_password
    ):
        raise HTTPException(status_code=400, detail="Incorrect old password")

    hashed_new_password = AuthService.get_password_hash(payload.new_password)
    await AuthService.update_password(current_user.id, hashed_new_password)
    return {"message": "Password changed successfully"}
