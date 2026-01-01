import asyncio
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from services.content_service import (
    list_articles,
    list_market_filings,
    list_report_analysis,
)

router = APIRouter(prefix="/editorial", tags=["editorial"])


class EditorialSuggestionRequest(BaseModel):
    text: str
    content_type: Optional[str] = "article"  # article, headline, summary
    tone: Optional[str] = Field(
        default=None, description="Optional tone hint to tailor suggestion wording."
    )


class EditorialSuggestionResponse(BaseModel):
    original_text: str
    suggestions: list[str]
    content_type: str
    status: str


class StyleGuideResponse(BaseModel):
    guidelines: dict
    status: str


class EditorialContextArticle(BaseModel):
    id: str
    title: str
    summary: str
    source: Optional[str] = None
    link: Optional[str] = None
    publish_date: Optional[str] = None
    tags: list[str] = Field(default_factory=list)


class EditorialContextReport(BaseModel):
    id: str
    created_at: str
    summary: str
    parameter_highlights: list[str] = Field(default_factory=list)


class EditorialContextFiling(BaseModel):
    id: str
    title: str
    source: Optional[str] = None
    link: Optional[str] = None
    filed_at: Optional[str] = None
    notes: Optional[str] = None


class EditorialContextTotals(BaseModel):
    articles: int = 0
    reports: int = 0
    filings: int = 0


class EditorialContextResponse(BaseModel):
    status: str
    market_brief: Optional[str] = None
    articles: list[EditorialContextArticle] = Field(default_factory=list)
    reports: list[EditorialContextReport] = Field(default_factory=list)
    filings: list[EditorialContextFiling] = Field(default_factory=list)
    totals: EditorialContextTotals = Field(default_factory=EditorialContextTotals)


@router.post("/suggestions")
def get_editorial_suggestions(
    request: EditorialSuggestionRequest,
) -> EditorialSuggestionResponse:
    """
    Get editorial suggestions for improving content.

    Args:
        request: Contains text to analyze and content type

    Returns:
        EditorialSuggestionResponse with suggested improvements
    """
    try:
        # Placeholder for AI-based editorial suggestions
        # In production, integrate with LLM for content improvement suggestions
        suggestions = [
            "Improve clarity in opening sentence",
            "Add more supporting evidence",
            "Strengthen conclusion",
        ]

        if request.tone:
            tone_hint = request.tone.strip()
            if tone_hint:
                suggestions.append(f"Apply a {tone_hint.lower()} tone throughout.")

        return EditorialSuggestionResponse(
            original_text=request.text,
            suggestions=suggestions,
            content_type=request.content_type or "article",
            status="success",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/style-guide")
def get_style_guide() -> StyleGuideResponse:
    """
    Get the editorial style guide for the publication.

    Returns:
        StyleGuideResponse with style guidelines
    """
    try:
        guidelines = {
            "tone": "Professional and informative",
            "target_audience": "Financial professionals and retail investors",
            "headline_length": "50-70 characters",
            "content_structure": [
                "Hook/Opening",
                "Background",
                "Analysis",
                "Key takeaways",
                "Conclusion",
            ],
            "citations": "Required for all claims and data points",
            "length_guidelines": {
                "short_form": "300-500 words",
                "long_form": "1000-2000 words",
                "analysis": "1500-3000 words",
            },
        }

        return StyleGuideResponse(
            guidelines=guidelines,
            status="success",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics")
def get_editorial_analytics() -> dict:
    """
    Get analytics on published content performance.

    Returns:
        Dictionary with content analytics
    """
    try:
        analytics = {
            "total_articles": 0,
            "average_engagement": 0,
            "top_topics": [],
            "readability_score": 0,
            "performance_trends": [],
        }

        return {
            "analytics": analytics,
            "status": "success",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _build_excerpt(text: Optional[str], *, max_length: int = 220) -> str:
    if not text:
        return "No summary available."
    stripped = " ".join(text.split())
    if len(stripped) <= max_length:
        return stripped
    return f"{stripped[: max_length - 3]}..."


def _format_datetime(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    return value.isoformat()


@router.get("/context", response_model=EditorialContextResponse)
async def get_editorial_context(
    article_limit: int = Query(10, ge=1, le=50),
    report_limit: int = Query(8, ge=1, le=25),
    filing_limit: int = Query(8, ge=1, le=25),
) -> EditorialContextResponse:
    try:
        articles_task = list_articles(limit=article_limit, skip=0)
        reports_task = list_report_analysis(limit=report_limit)
        filings_task = list_market_filings(limit=filing_limit)
    except Exception as exc:  # pragma: no cover - defensive fallback
        raise HTTPException(status_code=500, detail=str(exc))

    articles, reports, filings = await asyncio.gather(
        articles_task, reports_task, filings_task
    )

    article_payload: List[EditorialContextArticle] = []
    for article in articles:
        raw_id = getattr(article, "id", None) or getattr(article, "_id", None)
        if not raw_id:
            raw_id = article.link
        article_payload.append(
            EditorialContextArticle(
                id=str(raw_id),
                title=article.title,
                summary=_build_excerpt(getattr(article, "text", None)),
                source=article.source,
                link=article.link,
                publish_date=getattr(article, "publish_date", None),
                tags=list(getattr(article, "tags", []) or []),
            )
        )

    report_payload: List[EditorialContextReport] = []
    for idx, report in enumerate(reports, start=1):
        parameters = report.parameters
        highlights: list[str] = []
        if isinstance(parameters, list):
            for param in parameters[:5]:
                if isinstance(param, dict):
                    name = param.get("parameter_name") or param.get("name")
                    interpretation = param.get("interpretation") or param.get(
                        "definition"
                    )
                    snippet = (
                        f"{name}: {interpretation}" if name and interpretation else None
                    )
                    if snippet:
                        highlights.append(snippet)
        summary_text = report.summary or _build_excerpt(report.report)
        raw_id = getattr(report, "id", None) or getattr(report, "_id", None) or idx
        report_payload.append(
            EditorialContextReport(
                id=str(raw_id),
                created_at=_format_datetime(getattr(report, "created_at", None)) or "",
                summary=_build_excerpt(summary_text),
                parameter_highlights=highlights,
            )
        )

    filing_payload: List[EditorialContextFiling] = []
    for filing in filings:
        raw_id = (
            getattr(filing, "id", None) or getattr(filing, "_id", None) or filing.link
        )
        meta = getattr(filing, "meta", {}) or {}
        notes_candidates = [
            meta.get("description"),
            meta.get("type"),
            meta.get("category"),
        ]
        notes = next((item for item in notes_candidates if item), None)
        filing_payload.append(
            EditorialContextFiling(
                id=str(raw_id),
                title=filing.title,
                source=filing.source,
                link=filing.link,
                filed_at=_format_datetime(getattr(filing, "created_at", None)),
                notes=notes,
            )
        )

    headline = article_payload[0].title if article_payload else None
    source = article_payload[0].source if article_payload else None
    filings_tagline = filing_payload[0].title if filing_payload else None

    market_brief_parts = []
    if headline:
        market_brief_parts.append(
            f"Lead story: {headline}{f' ({source})' if source else ''}."
        )
    if filings_tagline:
        market_brief_parts.append(f"Notable filing: {filings_tagline}.")
    if report_payload:
        market_brief_parts.append("Analyst coverage updated across saved reports.")

    market_brief = " ".join(market_brief_parts) if market_brief_parts else None

    totals = EditorialContextTotals(
        articles=len(article_payload),
        reports=len(report_payload),
        filings=len(filing_payload),
    )

    return EditorialContextResponse(
        status="success",
        market_brief=market_brief,
        articles=article_payload,
        reports=report_payload,
        filings=filing_payload,
        totals=totals,
    )
