from typing import List

from fastapi import APIRouter, Depends, HTTPException

from models.content import (
    ArticleInDB,
    FavoriteArticleRequest,
    FavoriteArticlesResponse,
    WatchlistResponse,
    WatchlistUpdateRequest,
)
from models.user import PyObjectId, UserInDB
from routes.auth import get_current_active_user
from services.content_service import (
    add_favorite_article,
    get_watchlist,
    list_favorite_articles,
    remove_favorite_article,
    update_watchlist,
)

router = APIRouter(prefix="/user", tags=["user-content"])


def _ensure_user_id(user: UserInDB) -> PyObjectId:
    if user.id is None:
        raise HTTPException(status_code=400, detail="User identifier missing")
    return user.id


@router.get("/watchlist", response_model=WatchlistResponse)
async def get_watchlist_endpoint(
    current_user: UserInDB = Depends(get_current_active_user),
) -> WatchlistResponse:
    user_id = _ensure_user_id(current_user)
    record = await get_watchlist(user_id)
    return WatchlistResponse(symbols=record.symbols, updated_at=record.updated_at)


@router.put("/watchlist", response_model=WatchlistResponse)
async def update_watchlist_endpoint(
    payload: WatchlistUpdateRequest,
    current_user: UserInDB = Depends(get_current_active_user),
) -> WatchlistResponse:
    user_id = _ensure_user_id(current_user)
    record = await update_watchlist(user_id, payload.symbols)
    return WatchlistResponse(symbols=record.symbols, updated_at=record.updated_at)


@router.get("/favorites", response_model=FavoriteArticlesResponse)
async def list_favorite_articles_endpoint(
    current_user: UserInDB = Depends(get_current_active_user),
) -> FavoriteArticlesResponse:
    user_id = _ensure_user_id(current_user)
    favorites = await list_favorite_articles(user_id)
    return FavoriteArticlesResponse(favorites=favorites)


@router.post("/favorites", response_model=FavoriteArticlesResponse)
async def add_favorite_article_endpoint(
    payload: FavoriteArticleRequest,
    current_user: UserInDB = Depends(get_current_active_user),
) -> FavoriteArticlesResponse:
    user_id = _ensure_user_id(current_user)
    try:
        await add_favorite_article(user_id, payload.article_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    favorites = await list_favorite_articles(user_id)
    return FavoriteArticlesResponse(favorites=favorites)


@router.delete("/favorites/{article_id}")
async def remove_favorite_article_endpoint(
    article_id: str,
    current_user: UserInDB = Depends(get_current_active_user),
) -> dict:
    user_id = _ensure_user_id(current_user)
    try:
        await remove_favorite_article(user_id, article_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {"status": "success"}
