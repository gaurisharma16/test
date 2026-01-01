import asyncio
from typing import List, Optional

from fastapi import APIRouter, Query

from models.content import ArticleCreate, ArticleInDB
from services.broker_scrapper.webscrapper import scrape_articles
from services.content_service import list_articles, save_articles

router = APIRouter(prefix="/articles", tags=["articles"])


def _to_article_models(raw_articles: List[dict]) -> List[ArticleCreate]:
    articles: List[ArticleCreate] = []
    for raw in raw_articles:
        authors = raw.get("author") or raw.get("authors") or []
        if isinstance(authors, str):
            authors = [authors]
        tags = raw.get("tags") or []
        keywords = raw.get("keywords") or []
        link = raw.get("link") or ""
        if not link:
            continue
        article = ArticleCreate(
            title=raw.get("title", "Untitled"),
            link=link,
            text=raw.get("text"),
            authors=list(authors),
            publish_date=raw.get("publish_date"),
            keywords=list(keywords),
            tags=list(tags),
            thumbnail=raw.get("thumbnail"),
            source=raw.get("source"),
        )
        articles.append(article)
    return articles


@router.get("/scrape")
async def scrape_broker_articles(
    count: int = Query(
        default=5, description="Number of articles to scrape per website"
    ),
    max_articles: int = Query(
        default=1500, description="Maximum total articles to return"
    ),
    websites: Optional[str] = Query(
        default=None, description="Comma-separated list of website URLs"
    ),
) -> dict:
    """
    Scrape articles from financial news websites.

    Args:
        count: Number of articles to fetch per website
        max_articles: Maximum number of articles to return after filtering
        websites: Optional comma-separated list of website URLs to scrape

    Returns:
        Dictionary containing scraped articles and metadata
    """
    website_list = None
    if websites:
        website_list = [url.strip() for url in websites.split(",")]

    result = await asyncio.to_thread(
        scrape_articles, websites=website_list, count=count, max_articles=max_articles
    )

    if result.get("status") == "success" and result.get("articles"):
        articles = _to_article_models(result.get("articles", []))
        await save_articles(articles)

    return result


@router.get("/saved", response_model=List[ArticleInDB])
async def get_saved_articles(
    limit: int = Query(50, ge=1, le=200), skip: int = Query(0, ge=0)
):
    articles = await list_articles(limit=limit, skip=skip)
    return articles
