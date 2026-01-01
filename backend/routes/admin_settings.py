import logging
from typing import Any, Dict, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from models.admin import AdminLogCreate, AppSettingsUpdate, UserSettingsUpdate
from models.user import UserInDB
from routes.auth import get_current_active_user
from services.admin_service import AdminService

router = APIRouter(prefix="/admin", tags=["admin"])


logger = logging.getLogger("stock_broker_admin")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    )
    logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False


def _user_id_str(user: UserInDB) -> Optional[str]:
    identifier = getattr(user, "id", None)
    return str(identifier) if identifier is not None else None


async def _resolve_user_id(
    provided_id: Optional[str], current_user: UserInDB
) -> ObjectId:
    target_id = provided_id or _user_id_str(current_user)
    if not target_id:
        raise HTTPException(status_code=400, detail="User ID is required")
    if not ObjectId.is_valid(target_id):
        raise HTTPException(status_code=400, detail="Invalid user_id")
    return ObjectId(target_id)


@router.get("/metrics")
async def get_system_metrics(
    current_user: UserInDB = Depends(get_current_active_user),
) -> Dict[str, Any]:
    try:
        metrics = await AdminService.get_system_metrics()
        await AdminService.log_event(
            AdminLogCreate(
                level="INFO",
                message="Fetched system metrics",
                source="routes.admin_settings.get_system_metrics",
                metadata={"requested_by": _user_id_str(current_user)},
            )
        )
        logger.info(
            "Fetched system metrics",
            extra={"requested_by": _user_id_str(current_user)},
        )
        return {
            "metrics": metrics.model_dump(),
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to fetch system metrics")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/settings")
async def get_application_settings(
    current_user: UserInDB = Depends(get_current_active_user),
) -> Dict[str, Any]:
    try:
        settings = await AdminService.get_application_settings()
        await AdminService.log_event(
            AdminLogCreate(
                level="INFO",
                message="Fetched application settings",
                source="routes.admin_settings.get_application_settings",
                metadata={"requested_by": _user_id_str(current_user)},
            )
        )
        logger.info(
            "Fetched application settings",
            extra={"requested_by": _user_id_str(current_user)},
        )
        return {
            "settings": settings.model_dump(by_alias=True, mode="json"),
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to fetch application settings")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/settings")
async def update_application_settings(
    payload: AppSettingsUpdate,
    current_user: UserInDB = Depends(get_current_active_user),
) -> Dict[str, Any]:
    try:
        updated = await AdminService.update_application_settings(payload)
        changes = payload.model_dump(exclude_unset=True)
        await AdminService.log_event(
            AdminLogCreate(
                level="INFO",
                message="Updated application settings",
                source="routes.admin_settings.update_application_settings",
                metadata={
                    "requested_by": _user_id_str(current_user),
                    "updated_fields": list(changes.keys()),
                },
            )
        )
        logger.info(
            "Updated application settings",
            extra={
                "requested_by": _user_id_str(current_user),
                "fields": list(changes.keys()),
            },
        )
        return {
            "settings": updated.model_dump(by_alias=True, mode="json"),
            "status": "success",
            "message": "Settings updated successfully",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to update application settings")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/users")
async def list_users(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: UserInDB = Depends(get_current_active_user),
) -> Dict[str, Any]:
    try:
        total, users = await AdminService.list_users(limit=limit, offset=offset)
        payload = [user.model_dump(by_alias=True) for user in users]
        await AdminService.log_event(
            AdminLogCreate(
                level="INFO",
                message="Listed users",
                source="routes.admin_settings.list_users",
                metadata={
                    "requested_by": _user_id_str(current_user),
                    "limit": limit,
                    "offset": offset,
                },
            )
        )
        logger.info(
            "Listed users",
            extra={
                "requested_by": _user_id_str(current_user),
                "count": len(payload),
            },
        )
        return {
            "users": payload,
            "total": total,
            "limit": limit,
            "offset": offset,
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to list users")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/logs")
async def get_application_logs(
    limit: int = Query(100, ge=1, le=500),
    level: Optional[str] = Query(None, description="Optional log level filter"),
    current_user: UserInDB = Depends(get_current_active_user),
) -> Dict[str, Any]:
    try:
        logs = await AdminService.list_logs(limit=limit, level=level)
        payload = [log.model_dump(by_alias=True) for log in logs]
        await AdminService.log_event(
            AdminLogCreate(
                level="INFO",
                message="Viewed application logs",
                source="routes.admin_settings.get_application_logs",
                metadata={
                    "requested_by": _user_id_str(current_user),
                    "limit": limit,
                    "level": level.upper() if level else None,
                },
            )
        )
        logger.info(
            "Fetched application logs",
            extra={
                "requested_by": _user_id_str(current_user),
                "count": len(payload),
            },
        )
        return {
            "logs": payload,
            "total": len(payload),
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to fetch application logs")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/settings/user")
async def get_user_settings(
    user_id: Optional[str] = Query(None),
    current_user: UserInDB = Depends(get_current_active_user),
) -> Dict[str, Any]:
    try:
        target_id = await _resolve_user_id(user_id, current_user)
        settings = await AdminService.get_user_settings(target_id)
        await AdminService.log_event(
            AdminLogCreate(
                level="INFO",
                message="Fetched user settings",
                source="routes.admin_settings.get_user_settings",
                metadata={
                    "requested_by": _user_id_str(current_user),
                    "target_user_id": str(target_id),
                },
            )
        )
        logger.info(
            "Fetched user settings",
            extra={
                "requested_by": _user_id_str(current_user),
                "target_user_id": str(target_id),
            },
        )
        return {
            "settings": settings.model_dump(by_alias=True, mode="json"),
            "status": "success",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to fetch user settings")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/settings/user")
async def update_user_settings(
    payload: UserSettingsUpdate,
    user_id: Optional[str] = Query(None),
    current_user: UserInDB = Depends(get_current_active_user),
) -> Dict[str, Any]:
    try:
        changes = payload.model_dump(exclude_unset=True)
        if not changes:
            raise HTTPException(status_code=400, detail="No settings provided")

        target_id = await _resolve_user_id(user_id, current_user)
        updated = await AdminService.update_user_settings(target_id, payload)
        await AdminService.log_event(
            AdminLogCreate(
                level="INFO",
                message="Updated user settings",
                source="routes.admin_settings.update_user_settings",
                metadata={
                    "requested_by": _user_id_str(current_user),
                    "target_user_id": str(target_id),
                    "updated_fields": list(changes.keys()),
                },
            )
        )
        logger.info(
            "Updated user settings",
            extra={
                "requested_by": _user_id_str(current_user),
                "target_user_id": str(target_id),
                "fields": list(changes.keys()),
            },
        )
        return {
            "settings": updated.model_dump(by_alias=True, mode="json"),
            "status": "success",
            "message": "Settings updated successfully",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to update user settings")
        raise HTTPException(status_code=500, detail=str(exc))
