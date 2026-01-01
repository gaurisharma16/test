from datetime import datetime
from typing import Any, Dict, Optional

from bson import ObjectId
from pydantic import BaseModel, EmailStr, Field
from pydantic.functional_serializers import PlainSerializer
from pydantic_core import CoreSchema, core_schema


class PyObjectId(ObjectId):
    """Custom validator so Pydantic can handle MongoDB ObjectIds."""

    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, value):
        if not ObjectId.is_valid(value):
            raise ValueError("Invalid ObjectId")
        return ObjectId(value)

    @classmethod
    @classmethod
    def __get_pydantic_json_schema__(
        cls, core_schema: CoreSchema, handler
    ):  # type: ignore[override]
        json_schema = handler(core_schema)
        json_schema.update(type="string")
        return json_schema

    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: Any, handler
    ) -> CoreSchema:  # type: ignore[override]
        return core_schema.no_info_after_validator_function(
            cls.validate,
            core_schema.union_schema(
                [
                    core_schema.is_instance_schema(ObjectId),
                    core_schema.str_schema(),
                ]
            ),
        )


class MongoModel(BaseModel):
    """Base model with Mongo-friendly configuration."""

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
        "ser_json_timedelta": "iso8601",
    }


class UserBase(MongoModel):
    email: EmailStr
    username: str
    is_active: bool = True
    is_verified: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UserPublic(UserBase):
    id: PyObjectId = Field(alias="_id")


class UserInDB(UserBase):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    hashed_password: str
    reset_token: Optional[str] = None
    reset_token_expires: Optional[datetime] = None


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


class ForgotPassword(BaseModel):
    email: EmailStr


class ResetPassword(BaseModel):
    token: str
    new_password: str


class EmailVerification(BaseModel):
    token: str


class ChangePassword(BaseModel):
    old_password: str
    new_password: str


class ResendVerification(BaseModel):
    email: EmailStr
