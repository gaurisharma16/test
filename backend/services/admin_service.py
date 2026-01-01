import asyncio
import logging
from datetime import datetime
from typing import List, Optional, Tuple

from bson import ObjectId

from models.admin import (
    AdminLogCreate,
    AdminLogRecord,
    AppSettings,
    AppSettingsUpdate,
    SystemMetrics,
    UserSettings,
    UserSettingsUpdate,
)
from models.user import PyObjectId, UserPublic
from services.database import (
    admin_logs_collection,
    application_settings_collection,
    user_settings_collection,
    users_collection,
)

try:
    import psutil  # type: ignore
except ImportError:  # pragma: no cover - optional metrics provider
    psutil = None

logger = logging.getLogger("admin.service")


def _ensure_object_id(value: PyObjectId | ObjectId | str) -> ObjectId:
    if isinstance(value, ObjectId):
        return value
    if isinstance(value, PyObjectId):
        return ObjectId(value)
    return ObjectId(str(value))


class AdminService:
    @staticmethod
    async def get_system_metrics() -> SystemMetrics:
        def _gather_counts():
            active_users = users_collection.count_documents({"is_active": True})
            total_requests = admin_logs_collection.count_documents({})
            return active_users, total_requests

        active_users, total_requests = await asyncio.to_thread(_gather_counts)

        uptime_hours = 0.0
        memory_usage_percent = 0.0
        cpu_usage_percent = 0.0
        disk_usage_percent = 0.0

        if psutil:
            try:
                boot_time = datetime.fromtimestamp(psutil.boot_time())
                uptime_hours = (datetime.utcnow() - boot_time).total_seconds() / 3600
                memory_usage_percent = psutil.virtual_memory().percent
                cpu_usage_percent = psutil.cpu_percent(interval=None)
                disk_usage_percent = psutil.disk_usage("/").percent
            except Exception as exc:  # pragma: no cover - metrics failure fallback
                logger.debug("Failed to gather system metrics", exc_info=exc)

        return SystemMetrics(
            uptime_hours=uptime_hours,
            memory_usage_percent=memory_usage_percent,
            cpu_usage_percent=cpu_usage_percent,
            disk_usage_percent=disk_usage_percent,
            active_users=active_users,
            total_requests=total_requests,
        )

    @staticmethod
    async def get_application_settings() -> AppSettings:
        def _fetch():
            document = application_settings_collection.find_one({"_id": "default"})
            if document:
                return document
            settings = AppSettings()
            application_settings_collection.update_one(
                {"_id": "default"},
                {"$set": settings.model_dump(by_alias=True)},
                upsert=True,
            )
            return application_settings_collection.find_one({"_id": "default"})

        doc = await asyncio.to_thread(_fetch)
        if not doc:
            raise RuntimeError("Application settings not found after initialization")
        return AppSettings(**doc)

    @staticmethod
    async def update_application_settings(payload: AppSettingsUpdate) -> AppSettings:
        updates = payload.model_dump(exclude_unset=True)
        if not updates:
            return await AdminService.get_application_settings()

        updates["updated_at"] = datetime.utcnow()

        def _update():
            application_settings_collection.update_one(
                {"_id": "default"},
                {
                    "$set": updates,
                    "$setOnInsert": AppSettings().model_dump(by_alias=True),
                },
                upsert=True,
            )
            return application_settings_collection.find_one({"_id": "default"})

        doc = await asyncio.to_thread(_update)
        if not doc:
            raise RuntimeError("Failed to load application settings after update")
        return AppSettings(**doc)

    @staticmethod
    async def list_users(
        limit: int = 10, offset: int = 0
    ) -> Tuple[int, List[UserPublic]]:
        def _fetch():
            total = users_collection.count_documents({})
            cursor = (
                users_collection.find().sort("created_at", -1).skip(offset).limit(limit)
            )
            return total, list(cursor)

        total, docs = await asyncio.to_thread(_fetch)
        return total, [UserPublic.model_validate(doc) for doc in docs]

    @staticmethod
    async def log_event(event: AdminLogCreate) -> AdminLogRecord:
        document = event.model_dump()
        document["created_at"] = datetime.utcnow()

        result = await asyncio.to_thread(admin_logs_collection.insert_one, document)
        document["_id"] = result.inserted_id
        return AdminLogRecord(**document)

    @staticmethod
    async def list_logs(
        limit: int = 100, level: Optional[str] = None
    ) -> List[AdminLogRecord]:
        query = {}
        if level:
            query["level"] = level.upper()

        def _fetch():
            cursor = (
                admin_logs_collection.find(query).sort("created_at", -1).limit(limit)
            )
            return list(cursor)

        docs = await asyncio.to_thread(_fetch)
        return [AdminLogRecord(**doc) for doc in docs]

    @staticmethod
    async def get_user_settings(user_id: ObjectId) -> UserSettings:
        def _fetch():
            return user_settings_collection.find_one({"user_id": user_id})

        doc = await asyncio.to_thread(_fetch)
        if doc:
            return UserSettings(**doc)

        settings = UserSettings(user_id=PyObjectId(str(user_id)))
        await asyncio.to_thread(
            user_settings_collection.update_one,
            {"user_id": user_id},
            {
                "$setOnInsert": settings.model_dump(by_alias=True),
            },
            upsert=True,
        )
        stored = await asyncio.to_thread(
            user_settings_collection.find_one, {"user_id": user_id}
        )
        if not stored:
            raise RuntimeError("User settings not found after initialization")
        return UserSettings(**stored)

    @staticmethod
    async def update_user_settings(
        user_id: ObjectId, update: UserSettingsUpdate
    ) -> UserSettings:
        updates = update.model_dump(exclude_unset=True)
        if not updates:
            return await AdminService.get_user_settings(user_id)

        updates["updated_at"] = datetime.utcnow()

        await asyncio.to_thread(
            user_settings_collection.update_one,
            {"user_id": user_id},
            {
                "$set": updates,
                "$setOnInsert": UserSettings(
                    user_id=PyObjectId(str(user_id))
                ).model_dump(by_alias=True),
            },
            upsert=True,
        )

        stored = await asyncio.to_thread(
            user_settings_collection.find_one, {"user_id": user_id}
        )
        if not stored:
            raise RuntimeError("User settings not found after update")
        return UserSettings(**stored)


__all__ = ["AdminService"]
