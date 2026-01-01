from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, EmailStr, Field

from .user import MongoModel, PyObjectId


class ArticleBase(MongoModel):
    title: str
    link: str
    text: Optional[str] = None
    authors: List[str] = Field(default_factory=list)
    publish_date: Optional[str] = None
    keywords: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    thumbnail: Optional[str] = None
    source: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ArticleInDB(ArticleBase):
    id: PyObjectId = Field(alias="_id")


class ArticleCreate(BaseModel):
    title: str
    link: str
    text: Optional[str] = None
    authors: List[str] = Field(default_factory=list)
    publish_date: Optional[str] = None
    keywords: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    thumbnail: Optional[str] = None
    source: Optional[str] = None


class MarketFilingRecord(MongoModel):
    id: PyObjectId = Field(alias="_id")
    source: str
    title: str
    link: str
    meta: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ReportAnalysisRecord(MongoModel):
    id: PyObjectId = Field(alias="_id")
    report: str
    parameters: Union[Dict[str, Any], List[Dict[str, Any]]]
    evaluation: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = None
    summary: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class FinancialAnalysisRecord(MongoModel):
    id: PyObjectId = Field(alias="_id")
    file_id: str
    filename: str
    parameters: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = None
    summary: Optional[str] = None
    status: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class WatchlistRecord(MongoModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    user_id: PyObjectId
    symbols: List[str] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class WatchlistUpdateRequest(BaseModel):
    symbols: List[str] = Field(default_factory=list)


class WatchlistResponse(BaseModel):
    symbols: List[str] = Field(default_factory=list)
    updated_at: datetime


class FavoriteArticleRecord(MongoModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    user_id: PyObjectId
    article_id: PyObjectId
    created_at: datetime = Field(default_factory=datetime.utcnow)


class FavoriteArticleRequest(BaseModel):
    article_id: str


class FavoriteArticlesResponse(BaseModel):
    favorites: List[ArticleInDB]


class NewsletterSubscriber(MongoModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    email: EmailStr
    created_at: datetime = Field(default_factory=datetime.utcnow)
