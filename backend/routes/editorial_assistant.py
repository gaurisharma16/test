from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List

from services.editorial_assistant import generate_editorial_article

router = APIRouter(prefix="/editorial-assistant", tags=["editorial"])


class EditorialAssistantRequest(BaseModel):
    market_summary: str = Field(
        default="",
        description="Narrative overview of current market conditions.",
    )
    reports: List[str] = Field(
        default_factory=list, description="Key research report highlights."
    )
    market_filings: List[str] = Field(
        default_factory=list, description="Notable regulatory filings to reference."
    )
    articles: List[str] = Field(
        default_factory=list, description="Highlights pulled from recent articles."
    )
    additional_context: List[str] = Field(
        default_factory=list,
        description="Any custom bullet points or notes to include in the draft.",
    )
    tone: str = Field(
        default="Professional and informative", description="Desired editorial tone."
    )


class EditorialAssistantResponse(BaseModel):
    headline: str
    subheadline: str
    article: str
    key_points: List[str] = Field(default_factory=list)
    next_steps: List[str] = Field(default_factory=list)
    data_callouts: List[str] = Field(default_factory=list)
    risk_disclaimer: str
    context_digest: List[str] = Field(default_factory=list)


@router.post("/generate", response_model=EditorialAssistantResponse)
def create_editorial_article(
    request: EditorialAssistantRequest,
) -> EditorialAssistantResponse:
    try:
        cleaned_articles = [item.strip() for item in request.articles if item.strip()]
        cleaned_reports = [item.strip() for item in request.reports if item.strip()]
        cleaned_filings = [
            item.strip() for item in request.market_filings if item.strip()
        ]
        cleaned_additional = [
            item.strip() for item in request.additional_context if item.strip()
        ]

        market_summary = (
            request.market_summary.strip()
            or "No formal market summary provided; rely on contextual bullets."
        )

        payload = generate_editorial_article(
            market_summary=market_summary,
            reports=cleaned_reports,
            market_filings=cleaned_filings,
            tone=request.tone,
            articles=cleaned_articles,
            additional_context=cleaned_additional,
        )
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    digest: List[str] = []
    if request.market_summary.strip():
        digest.append("Primary market summary provided by user.")
    if cleaned_articles:
        digest.append(f"Article insights referenced: {len(cleaned_articles)}")
    if cleaned_reports:
        digest.append(f"Report highlights included: {len(cleaned_reports)}")
    if cleaned_filings:
        digest.append(f"Regulatory filings cited: {len(cleaned_filings)}")
    if cleaned_additional:
        digest.append("Custom context points applied.")

    response_payload = {
        **payload,
        "context_digest": digest,
    }

    return EditorialAssistantResponse.model_validate(response_payload)
