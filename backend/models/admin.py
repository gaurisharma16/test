from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from models.user import MongoModel, PyObjectId


class SystemMetrics(BaseModel):
    uptime_hours: float = 0.0
    memory_usage_percent: float = 0.0
    cpu_usage_percent: float = 0.0
    disk_usage_percent: float = 0.0
    active_users: int = 0
    total_requests: int = 0


class AppSettings(MongoModel):
    id: str = Field(default="default", alias="_id")
    app_name: str = "Stock Broker Assistant"
    version: str = "0.1.0"
    debug_mode: bool = False
    cache_enabled: bool = True
    log_level: str = "INFO"
    max_upload_size_mb: int = 50
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AppSettingsUpdate(BaseModel):
    app_name: Optional[str] = None
    version: Optional[str] = None
    debug_mode: Optional[bool] = None
    cache_enabled: Optional[bool] = None
    log_level: Optional[str] = None
    max_upload_size_mb: Optional[int] = Field(default=None, ge=1)


class AdminLogCreate(BaseModel):
    level: str
    message: str
    source: str
    metadata: Optional[Dict[str, Any]] = None


class AdminLogRecord(MongoModel):
    id: PyObjectId = Field(alias="_id")
    level: str
    message: str
    source: str
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime


class UserSettings(MongoModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    user_id: PyObjectId
    theme: str = "dark"
    notifications_enabled: bool = True
    email_digest_frequency: str = "daily"
    language: str = "en"
    timezone: str = "UTC"
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserSettingsUpdate(BaseModel):
    theme: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    email_digest_frequency: Optional[str] = None
    language: Optional[str] = None
    timezone: Optional[str] = None


__all__ = [
    "SystemMetrics",
    "AppSettings",
    "AppSettingsUpdate",
    "AdminLogCreate",
    "AdminLogRecord",
    "UserSettings",
    "UserSettingsUpdate",
]
