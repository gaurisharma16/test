from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.market_data import (
    get_index_metrics,
    get_market_movers,
    get_market_news,
    get_sector_performance as fetch_sector_performance,
    get_watchlist_snapshot,
)

router = APIRouter(prefix="/market-summary", tags=["market-summary"])


class MarketMetric(BaseModel):
    name: str
    value: float
    change: float
    change_percent: float
    trend: str  # "up", "down", "neutral"


class MarketSummaryResponse(BaseModel):
    date: date
    indices: list[MarketMetric]
    top_gainers: list[dict]
    top_losers: list[dict]
    market_news: list[dict]
    status: str


@router.get("/daily")
def get_daily_market_summary(
    date_str: Optional[str] = Query(None, description="Date in YYYY-MM-DD format")
) -> MarketSummaryResponse:
    """
    Get daily market summary including indices, gainers, losers, and top news.

    Args:
        date_str: Optional date to fetch summary for (defaults to today)

    Returns:
        MarketSummaryResponse with market data for the day
    """
    try:
        # Parse date or use today
        if date_str:
            summary_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        else:
            summary_date = date.today()

        indices_raw = get_index_metrics(summary_date if date_str else None)
        if not indices_raw:
            raise HTTPException(
                status_code=502,
                detail="Unable to fetch market indices from public data source.",
            )

        top_gainers, top_losers = get_market_movers(
            count=6, target=summary_date if date_str else None
        )
        market_news = get_market_news(count=6)

        return MarketSummaryResponse(
            date=summary_date,
            indices=[MarketMetric(**metric) for metric in indices_raw],
            top_gainers=top_gainers,
            top_losers=top_losers,
            market_news=market_news,
            status="success",
        )

    except ValueError as e:
        raise HTTPException(
            status_code=400, detail="Invalid date format. Use YYYY-MM-DD."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sectors")
def get_sector_performance(date_str: Optional[str] = Query(None)) -> dict:
    """
    Get performance metrics for all market sectors.

    Args:
        date_str: Optional date in YYYY-MM-DD format

    Returns:
        Dictionary with sector performance data
    """
    try:
        if date_str:
            try:
                target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(
                    status_code=400, detail="Invalid date format. Use YYYY-MM-DD."
                )
        else:
            target_date = None
        sectors = fetch_sector_performance(target_date)
        if not sectors:
            raise HTTPException(
                status_code=502,
                detail="Unable to fetch sector performance from public data source.",
            )

        return {
            "sectors": sectors,
            "status": "success",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/watchlist")
def get_watchlist_performance(
    symbols: str = Query(..., description="Comma-separated stock symbols")
) -> dict:
    """
    Get performance data for a custom watchlist.

    Args:
        symbols: Comma-separated list of stock symbols

    Returns:
        Dictionary with watchlist performance data
    """
    try:
        symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]
        if not symbol_list:
            raise HTTPException(
                status_code=400, detail="At least one symbol is required."
            )

        watchlist_data = get_watchlist_snapshot(symbol_list)

        return {
            "watchlist": watchlist_data,
            "status": "success",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
