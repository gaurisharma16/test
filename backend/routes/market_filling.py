import asyncio
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, EmailStr

# import the service modules
from services.market_filling import us as us_service
from services.market_filling import india as india_service
from services.email_service.sender import send_email, EmailSenderError
from services.content_service import list_market_filings, save_market_filings
from models.content import MarketFilingRecord


router = APIRouter(
    prefix="/market-filling",
    tags=["market_filling"],
)


class EmailRequest(BaseModel):
    """Request model for sending filing emails."""

    to: EmailStr
    cc: List[EmailStr] | None = None


@router.get("/us")
async def get_us_filings(count: int = Query(90, ge=1, le=100)) -> Dict[str, object]:
    """Return recent US filings from the SEC feed.

    Query param:
    - count: number of entries to fetch (default 10, 1-100)
    """

    try:
        results: List[Dict[str, str]] = await asyncio.to_thread(
            us_service.fetch_recent_sec_filings, count=count
        )
        await save_market_filings("us", results)
        return {
            "source": "us",
            "count": len(results),
            "results": results,
        }

    except Exception as exc:  # pragma: no cover - surface errors to client
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        )


@router.get("/india")
async def get_india_filings(count: int = Query(90, ge=1, le=100)) -> Dict[str, object]:
    """Return recent India filings/announcements from SEBI.

    Query param:
    - count: number of entries to fetch (default 10, 1-100)
    """

    try:
        results: List[Dict[str, str]] = await asyncio.to_thread(
            india_service.fetch_recent_india_filings, count=count
        )
        await save_market_filings("india", results)
        return {
            "source": "india",
            "count": len(results),
            "results": results,
        }

    except Exception as exc:  # pragma: no cover - surface errors to client
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        )


@router.post("/us/email")
async def send_us_filings_email(
    email_request: EmailRequest, count: int = Query(90, ge=1, le=100)
) -> Dict[str, object]:
    """Fetch recent US SEC filings and send them via email.

    Body:
    - to: recipient email address
    - cc: optional list of CC email addresses

    Query param:
    - count: number of entries to fetch (default 10, 1-100)
    """
    try:
        # Fetch the filings
        results: List[Dict[str, str]] = await asyncio.to_thread(
            us_service.fetch_recent_sec_filings, count=count
        )
        await save_market_filings("us", results)

        # Build email content
        subject = f"Latest US SEC Filings ({len(results)} items)"

        # Plain text body
        body_lines = ["Here are the latest US SEC filings:\n"]
        for i, filing in enumerate(results, 1):
            title = filing.get("title", "No title")
            link = filing.get("link", "No link")
            body_lines.append(f"{i}. {title}")
            body_lines.append(f"   Link: {link}\n")
        body = "\n".join(body_lines)

        # HTML body
        html_lines = ["<html><body>", "<h2>Latest US SEC Filings</h2>", "<ol>"]
        for filing in results:
            title = filing.get("title", "No title")
            link = filing.get("link", "No link")
            html_lines.append(
                f'<li><strong>{title}</strong><br><a href="{link}">{link}</a></li>'
            )
        html_lines.extend(["</ol>", "</body></html>"])
        html = "".join(html_lines)

        # Send email
        await asyncio.to_thread(
            send_email,
            email_request.to,
            subject,
            body,
            html,
            None,
            email_request.cc,
            None,
        )

        return {
            "status": "success",
            "message": f"Email sent to {email_request.to}",
            "source": "us",
            "count": len(results),
        }

    except EmailSenderError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send email: {str(exc)}",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        )


@router.post("/india/email")
async def send_india_filings_email(
    email_request: EmailRequest, count: int = Query(90, ge=1, le=100)
) -> Dict[str, object]:
    """Fetch recent India SEBI filings and send them via email.

    Body:
    - to: recipient email address
    - cc: optional list of CC email addresses

    Query param:
    - count: number of entries to fetch (default 10, 1-100)
    """
    try:
        # Fetch the filings
        results: List[Dict[str, str]] = await asyncio.to_thread(
            india_service.fetch_recent_india_filings, count=count
        )
        await save_market_filings("india", results)

        # Build email content
        subject = f"Latest India SEBI Filings ({len(results)} items)"

        # Plain text body
        body_lines = ["Here are the latest India SEBI filings:\n"]
        for i, filing in enumerate(results, 1):
            company = filing.get("company") or filing.get("title", "No title")
            link = filing.get("link", "No link")
            date = filing.get("date", "")
            body_lines.append(f"{i}. {company}")
            if date:
                body_lines.append(f"   Date: {date}")
            body_lines.append(f"   Link: {link}\n")
        body = "\n".join(body_lines)

        # HTML body
        html_lines = ["<html><body>", "<h2>Latest India SEBI Filings</h2>", "<ol>"]
        for filing in results:
            company = filing.get("company") or filing.get("title", "No title")
            link = filing.get("link", "No link")
            date = filing.get("date", "")
            date_str = f" ({date})" if date else ""
            html_lines.append(
                f'<li><strong>{company}</strong>{date_str}<br><a href="{link}">{link}</a></li>'
            )
        html_lines.extend(["</ol>", "</body></html>"])
        html = "".join(html_lines)

        # Send email
        await asyncio.to_thread(
            send_email,
            email_request.to,
            subject,
            body,
            html,
            None,
            email_request.cc,
            None,
        )

        return {
            "status": "success",
            "message": f"Email sent to {email_request.to}",
            "source": "india",
            "count": len(results),
        }

    except EmailSenderError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send email: {str(exc)}",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        )


@router.get("/history", response_model=List[MarketFilingRecord])
async def get_market_filings_history(
    source: Optional[str] = Query(None, description="Optional source filter"),
    limit: int = Query(50, ge=1, le=200),
):
    records = await list_market_filings(source=source, limit=limit)
    return records


@router.get("/watchlist")
async def get_watchlist_filings(
    symbols: str = Query(
        ..., description="Comma-separated stock symbols or company names"
    ),
    source: Optional[str] = Query(
        None, description="Optional source filter (us/india)"
    ),
    limit: int = Query(50, ge=1, le=200),
) -> Dict[str, object]:
    """Get recent filings filtered by symbols/companies from watchlist.

    Query params:
    - symbols: comma-separated list of stock symbols or company names
    - source: optional filter for 'us' or 'india' filings
    - limit: max number of filings to return (default 50, 1-200)
    """
    try:
        # Parse symbols
        symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
        if not symbol_list:
            raise HTTPException(
                status_code=400, detail="At least one symbol is required"
            )

        # Fetch recent filings from database
        records = await list_market_filings(source=source, limit=limit)

        # Filter filings that match any of the symbols
        filtered_filings = []
        for record in records:
            title = (record.title or "").upper()
            company = (
                record.meta.get("company", "").upper()
                if isinstance(record.meta, dict)
                else ""
            )

            # Check if any symbol matches the title or company
            if any(symbol in title or symbol in company for symbol in symbol_list):
                filtered_filings.append(
                    {
                        "id": str(record.id),
                        "source": record.source,
                        "title": record.title,
                        "company": (
                            record.meta.get("company")
                            if isinstance(record.meta, dict)
                            else None
                        ),
                        "link": record.link,
                        "date": (
                            record.meta.get("date")
                            if isinstance(record.meta, dict)
                            else None
                        ),
                        "created_at": (
                            record.created_at.isoformat() if record.created_at else None
                        ),
                    }
                )

        return {
            "symbols": symbol_list,
            "count": len(filtered_filings),
            "filings": filtered_filings,
            "status": "success",
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
