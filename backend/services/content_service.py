import asyncio
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Iterable, List, Optional, Union
from urllib.parse import urlparse

from bson import ObjectId

from models.content import (
    ArticleCreate,
    ArticleInDB,
    FavoriteArticleRecord,
    FinancialAnalysisRecord,
    MarketFilingRecord,
    ReportAnalysisRecord,
    WatchlistRecord,
)
from models.user import PyObjectId
from services.database import (
    articles_collection,
    favorite_articles_collection,
    financial_analysis_collection,
    market_filings_collection,
    report_analysis_collection,
    watchlists_collection,
)


def _domain_from_link(link: Optional[str]) -> Optional[str]:
    if not link:
        return None
    try:
        parsed = urlparse(link)
        return parsed.netloc or None
    except ValueError:
        return None


async def save_articles(articles: Iterable[ArticleCreate]) -> int:
    now = datetime.utcnow()
    operations = []
    for article in articles:
        source = article.source or _domain_from_link(article.link)
        set_fields = {
            "title": article.title,
            "link": article.link,
            "text": article.text,
            "authors": article.authors,
            "publish_date": article.publish_date,
            "keywords": article.keywords,
            "tags": article.tags,
            "thumbnail": article.thumbnail,
            "source": source,
            "updated_at": now,
        }
        operations.append(
            asyncio.to_thread(
                articles_collection.update_one,
                {"link": article.link},
                {"$set": set_fields, "$setOnInsert": {"created_at": now}},
                upsert=True,
            )
        )
    if not operations:
        return 0
    await asyncio.gather(*operations)
    return len(operations)


async def list_articles(limit: int = 50, skip: int = 0) -> List[ArticleInDB]:
    def _fetch():
        cursor = (
            articles_collection.find().sort("created_at", -1).skip(skip).limit(limit)
        )
        return list(cursor)

    docs = await asyncio.to_thread(_fetch)
    return [ArticleInDB(**doc) for doc in docs]


async def save_market_filings(source: str, filings: List[dict]) -> None:
    now = datetime.utcnow()

    async def _upsert(filing: dict):
        link = (filing.get("link") or "").strip()
        if not link:
            return

        meta = {k: v for k, v in filing.items() if k not in {"title", "link"}}
        await asyncio.to_thread(
            market_filings_collection.update_one,
            {"source": source, "link": link},
            {
                "$set": {
                    "source": source,
                    "title": filing.get("title") or filing.get("company") or "",
                    "link": link,
                    "meta": meta,
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )

    tasks = [_upsert(filing) for filing in filings if filing]
    if tasks:
        await asyncio.gather(*tasks)


async def list_market_filings(
    source: Optional[str] = None, limit: int = 50
) -> List[MarketFilingRecord]:
    query = {"source": source} if source else {}

    def _fetch():
        cursor = (
            market_filings_collection.find(query).sort("created_at", -1).limit(limit)
        )
        return list(cursor)

    docs = await asyncio.to_thread(_fetch)
    return [MarketFilingRecord(**doc) for doc in docs]


async def save_report_analysis(
    report: str,
    parameters: Any,
    evaluation: Optional[Any],
    summary: Optional[str],
) -> ReportAnalysisRecord:
    now = datetime.utcnow()
    document = {
        "report": report,
        "parameters": (
            _normalize_parameters(parameters) if parameters is not None else None
        ),
        "evaluation": (
            _normalize_parameters(evaluation) if evaluation is not None else None
        ),
        "summary": summary,
        "created_at": now,
    }
    result = await asyncio.to_thread(report_analysis_collection.insert_one, document)
    document["_id"] = result.inserted_id
    return ReportAnalysisRecord(**document)


async def list_report_analysis(limit: int = 20) -> List[ReportAnalysisRecord]:
    def _fetch():
        cursor = report_analysis_collection.find().sort("created_at", -1).limit(limit)
        return list(cursor)

    docs = await asyncio.to_thread(_fetch)
    normalized = []
    for doc in docs:
        if "parameters" in doc and doc["parameters"] is not None:
            doc["parameters"] = _normalize_parameters(doc["parameters"])
        if "evaluation" in doc and doc["evaluation"] is not None:
            doc["evaluation"] = _normalize_parameters(doc["evaluation"])
        normalized.append(ReportAnalysisRecord(**doc))
    return normalized


async def get_financial_analysis_by_file_id(
    file_id: str,
) -> Optional[FinancialAnalysisRecord]:
    def _fetch():
        return financial_analysis_collection.find_one({"file_id": file_id})

    doc = await asyncio.to_thread(_fetch)
    if not doc:
        return None
    if "parameters" in doc and doc["parameters"] is not None:
        doc["parameters"] = _normalize_parameters(doc["parameters"])
    if "evaluation" in doc and doc["evaluation"] is not None:
        doc["evaluation"] = _normalize_parameters(doc["evaluation"])
    return FinancialAnalysisRecord(**doc)


ParameterPayload = Optional[Union[Dict[str, Any], List[Dict[str, Any]]]]


def _normalize_parameters(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, dict):
        return {k: _normalize_parameters(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_normalize_parameters(item) for item in value]
    return value


async def save_financial_analysis(
    file_id: str,
    filename: str,
    parameters: ParameterPayload,
    summary: Optional[str],
    status: str,
) -> FinancialAnalysisRecord:
    now = datetime.utcnow()
    document = {
        "file_id": file_id,
        "filename": filename,
        "parameters": (
            _normalize_parameters(parameters) if parameters is not None else None
        ),
        "summary": summary,
        "status": status,
        "updated_at": now,
    }
    await asyncio.to_thread(
        financial_analysis_collection.update_one,
        {"file_id": file_id},
        {"$set": document, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    stored = await asyncio.to_thread(
        financial_analysis_collection.find_one, {"file_id": file_id}
    )
    if not stored:
        raise RuntimeError("Financial analysis record missing after upsert")
    return FinancialAnalysisRecord(**stored)


async def list_financial_analysis(limit: int = 20) -> List[FinancialAnalysisRecord]:
    def _fetch():
        cursor = (
            financial_analysis_collection.find().sort("created_at", -1).limit(limit)
        )
        return list(cursor)

    docs = await asyncio.to_thread(_fetch)
    normalized = []
    for doc in docs:
        if "parameters" in doc and doc["parameters"] is not None:
            doc["parameters"] = _normalize_parameters(doc["parameters"])
        normalized.append(FinancialAnalysisRecord(**doc))
    return normalized


async def get_watchlist(user_id: PyObjectId) -> WatchlistRecord:
    def _fetch():
        return watchlists_collection.find_one({"user_id": ObjectId(user_id)})

    doc = await asyncio.to_thread(_fetch)
    if doc:
        return WatchlistRecord(**doc)

    record = WatchlistRecord(user_id=user_id, symbols=[], updated_at=datetime.utcnow())
    await asyncio.to_thread(
        watchlists_collection.update_one,
        {"user_id": ObjectId(user_id)},
        {
            "$setOnInsert": {
                "user_id": ObjectId(user_id),
                "symbols": [],
                "updated_at": datetime.utcnow(),
            }
        },
        upsert=True,
    )
    return record


async def update_watchlist(user_id: PyObjectId, symbols: List[str]) -> WatchlistRecord:
    cleaned = sorted(set(symbol.upper() for symbol in symbols if symbol))
    now = datetime.utcnow()
    await asyncio.to_thread(
        watchlists_collection.update_one,
        {"user_id": ObjectId(user_id)},
        {
            "$set": {
                "symbols": cleaned,
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    doc = await asyncio.to_thread(
        watchlists_collection.find_one, {"user_id": ObjectId(user_id)}
    )
    if not doc:
        return WatchlistRecord(user_id=user_id, symbols=cleaned, updated_at=now)
    return WatchlistRecord(**doc)


async def add_favorite_article(
    user_id: PyObjectId, article_id: str
) -> FavoriteArticleRecord:
    try:
        article_oid = ObjectId(article_id)
    except Exception as exc:  # pragma: no cover - invalid id
        raise ValueError("Invalid article id") from exc

    existing_article = await asyncio.to_thread(
        articles_collection.find_one, {"_id": article_oid}
    )
    if not existing_article:
        raise ValueError("Article not found")

    now = datetime.utcnow()
    await asyncio.to_thread(
        favorite_articles_collection.update_one,
        {"user_id": ObjectId(user_id), "article_id": article_oid},
        {
            "$set": {
                "user_id": ObjectId(user_id),
                "article_id": article_oid,
                "created_at": now,
            }
        },
        upsert=True,
    )
    doc = await asyncio.to_thread(
        favorite_articles_collection.find_one,
        {"user_id": ObjectId(user_id), "article_id": article_oid},
    )
    if not doc:
        raise RuntimeError("Failed to load favorite record")
    return FavoriteArticleRecord(**doc)


async def remove_favorite_article(user_id: PyObjectId, article_id: str) -> None:
    try:
        article_oid = ObjectId(article_id)
    except Exception as exc:  # pragma: no cover
        raise ValueError("Invalid article id") from exc

    await asyncio.to_thread(
        favorite_articles_collection.delete_one,
        {"user_id": ObjectId(user_id), "article_id": article_oid},
    )


async def list_favorite_articles(user_id: PyObjectId) -> List[ArticleInDB]:
    def _favorite_ids():
        cursor = favorite_articles_collection.find({"user_id": ObjectId(user_id)})
        return [doc["article_id"] for doc in cursor]

    article_ids = await asyncio.to_thread(_favorite_ids)
    if not article_ids:
        return []

    def _fetch_articles():
        cursor = articles_collection.find({"_id": {"$in": article_ids}})
        return list(cursor)

    docs = await asyncio.to_thread(_fetch_articles)
    docs.sort(key=lambda doc: doc.get("created_at"), reverse=True)
    return [ArticleInDB(**doc) for doc in docs]
