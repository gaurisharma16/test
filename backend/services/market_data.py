"""Market data utilities using public Yahoo Finance endpoints.

All functions avoid authenticated APIs so we can support the UI with
freely available data. Each helper tolerates missing symbols so the
routes can still respond even when a specific fetch fails.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Iterable, Optional, Sequence, Tuple

import pandas as pd
import requests
import yfinance as yf

logger = logging.getLogger(__name__)

INDEX_TICKERS: dict[str, str] = {
    "S&P 500": "^GSPC",
    "Dow Jones": "^DJI",
    "NASDAQ": "^IXIC",
    "Russell 2000": "^RUT",
    "Nifty 50": "^NSEI",
    "Sensex": "^BSESN",
}

SECTOR_ETFS: dict[str, dict[str, Iterable[str] | str]] = {
    "Technology": {"symbol": "XLK", "leaders": ("AAPL", "MSFT", "NVDA")},
    "Financials": {"symbol": "XLF", "leaders": ("JPM", "BAC", "MS")},
    "Healthcare": {"symbol": "XLV", "leaders": ("UNH", "JNJ", "LLY")},
    "Energy": {"symbol": "XLE", "leaders": ("XOM", "CVX", "SLB")},
    "Consumer Discretionary": {"symbol": "XLY", "leaders": ("AMZN", "TSLA", "HD")},
    "Industrials": {"symbol": "XLI", "leaders": ("CAT", "GE", "RTX")},
    "Real Estate": {"symbol": "XLRE", "leaders": ("PLD", "AMT", "EQIX")},
    "Materials": {"symbol": "XLB", "leaders": ("LIN", "SHW", "APD")},
}

US_LIQUID_TICKERS: dict[str, dict[str, str]] = {
    "AAPL": {"name": "Apple Inc.", "region": "US"},
    "MSFT": {"name": "Microsoft Corp.", "region": "US"},
    "NVDA": {"name": "NVIDIA Corp.", "region": "US"},
    "GOOGL": {"name": "Alphabet Inc.", "region": "US"},
    "AMZN": {"name": "Amazon.com Inc.", "region": "US"},
    "META": {"name": "Meta Platforms Inc.", "region": "US"},
    "TSLA": {"name": "Tesla Inc.", "region": "US"},
    "NFLX": {"name": "Netflix Inc.", "region": "US"},
    "AVGO": {"name": "Broadcom Inc.", "region": "US"},
    "AMD": {"name": "Advanced Micro Devices", "region": "US"},
    "JPM": {"name": "JPMorgan Chase", "region": "US"},
    "WMT": {"name": "Walmart Inc.", "region": "US"},
}

INDIA_LIQUID_TICKERS: dict[str, dict[str, str]] = {
    "RELIANCE.NS": {"name": "Reliance Industries", "region": "IN"},
    "TCS.NS": {"name": "Tata Consultancy Services", "region": "IN"},
    "HDFCBANK.NS": {"name": "HDFC Bank", "region": "IN"},
    "ICICIBANK.NS": {"name": "ICICI Bank", "region": "IN"},
    "INFY.NS": {"name": "Infosys Ltd.", "region": "IN"},
    "SBIN.NS": {"name": "State Bank of India", "region": "IN"},
    "LT.NS": {"name": "Larsen & Toubro", "region": "IN"},
    "HINDUNILVR.NS": {"name": "Hindustan Unilever", "region": "IN"},
    "ITC.NS": {"name": "ITC Ltd.", "region": "IN"},
    "BHARTIARTL.NS": {"name": "Bharti Airtel", "region": "IN"},
    "KOTAKBANK.NS": {"name": "Kotak Mahindra Bank", "region": "IN"},
    "ASIANPAINT.NS": {"name": "Asian Paints", "region": "IN"},
}

YAHOO_SCREENER_URL = (
    "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved"
)
YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

NEWS_SYMBOLS: dict[str, str] = {
    "^GSPC": "US",
    "^IXIC": "US",
    "^DJI": "US",
    "^NSEI": "IN",
    "^BSESN": "IN",
}


def _fetch_history(symbol: str, target: Optional[date]) -> pd.DataFrame:
    ticker = yf.Ticker(symbol)
    if target:
        start = target - timedelta(days=14)
        end = target + timedelta(days=1)
        history = ticker.history(start=start, end=end, interval="1d", auto_adjust=False)
        history = history.loc[history.index.date <= target]  # type: ignore
    else:
        history = ticker.history(period="5d", interval="1d", auto_adjust=False)
    return history


def _extract_rows(history: pd.DataFrame) -> Optional[Tuple[dict, Optional[dict]]]:
    if history.empty:
        return None
    latest = history.iloc[-1].to_dict()
    previous = history.iloc[-2].to_dict() if len(history) > 1 else None
    return latest, previous


def get_index_metrics(target: Optional[date] = None) -> list[dict]:
    metrics: list[dict] = []
    for name, symbol in INDEX_TICKERS.items():
        try:
            history = _fetch_history(symbol, target)
            rows = _extract_rows(history)
            if not rows:
                continue
            latest, previous = rows
            price = float(latest.get("Close", 0.0))
            prev_close = float(previous.get("Close", price)) if previous else price
            if not price:
                continue
            change = price - prev_close
            change_percent = (change / prev_close * 100) if prev_close else 0.0
            trend = "up" if change > 0 else "down" if change < 0 else "neutral"
            metrics.append(
                {
                    "name": name,
                    "value": round(price, 2),
                    "change": round(change, 2),
                    "change_percent": round(change_percent, 2),
                    "trend": trend,
                }
            )
        except Exception as exc:  # pragma: no cover - network resiliency
            logger.debug("Unable to fetch index %s (%s): %s", name, symbol, exc)
    return metrics


def get_sector_performance(target: Optional[date] = None) -> dict[str, dict]:
    summary: dict[str, dict] = {}
    for sector, details in SECTOR_ETFS.items():
        symbol = str(details.get("symbol"))
        try:
            history = _fetch_history(symbol, target)
            rows = _extract_rows(history)
            if not rows:
                continue
            latest, previous = rows
            price = float(latest.get("Close", 0.0))
            prev_close = float(previous.get("Close", price)) if previous else price
            change = price - prev_close
            change_percent = (change / prev_close * 100) if prev_close else 0.0
            summary[sector] = {
                "symbol": symbol,
                "price": round(price, 2),
                "change": round(change, 2),
                "change_percent": round(change_percent, 2),
                "leaders": [ticker for ticker in details.get("leaders", ())],
            }
        except Exception as exc:  # pragma: no cover - network resiliency
            logger.debug("Unable to fetch sector %s (%s): %s", sector, symbol, exc)
    return summary


def _build_snapshot(
    symbol: str,
    name: str,
    region: str,
    target: Optional[date] = None,
) -> Optional[dict]:
    history = _fetch_history(symbol, target)
    rows = _extract_rows(history)
    if not rows:
        return None
    latest, previous = rows
    price = float(latest.get("Close", 0.0))
    if not price:
        return None
    prev_close = float(previous.get("Close", price)) if previous else price
    change = price - prev_close
    change_percent = (change / prev_close * 100) if prev_close else 0.0
    return {
        "symbol": symbol,
        "name": name,
        "price": round(price, 2),
        "change": round(change, 2),
        "change_percent": round(change_percent, 2),
        "region": region,
    }


def _fetch_screener(scr_id: str, region: str, count: int) -> list[dict]:
    params = {
        "scrIds": scr_id,
        "region": region,
        "lang": "en-US",
        "count": count,
    }
    try:
        response = requests.get(
            YAHOO_SCREENER_URL, params=params, headers=YAHOO_HEADERS, timeout=10
        )
        response.raise_for_status()
    except requests.RequestException as exc:  # pragma: no cover - network resiliency
        logger.debug("Yahoo screener fetch failed (%s, %s): %s", scr_id, region, exc)
        return []

    data = response.json()
    result = data.get("finance", {}).get("result", []) or []
    if not result:
        return []
    quotes = result[0].get("quotes", []) or []
    movers: list[dict] = []
    for quote in quotes:
        price = quote.get("regularMarketPrice")
        change = quote.get("regularMarketChangePercent")
        if price is None or change is None:
            continue
        movers.append(
            {
                "symbol": quote.get("symbol"),
                "name": quote.get("longName") or quote.get("shortName"),
                "price": round(float(price), 2),
                "change": round(float(quote.get("regularMarketChange", 0.0)), 2),
                "change_percent": round(float(change), 2),
                "region": region,
            }
        )
    return movers


def _dedupe(symbols: Iterable[dict]) -> list[dict]:
    seen: set[str] = set()
    unique: list[dict] = []
    for item in symbols:
        symbol = item.get("symbol")
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        unique.append(item)
    return unique


def get_market_movers(
    count: int = 6, target: Optional[date] = None
) -> tuple[list[dict], list[dict]]:
    universe = {**US_LIQUID_TICKERS, **INDIA_LIQUID_TICKERS}
    snapshots: list[dict] = []
    for symbol, meta in universe.items():
        try:
            snapshot = _build_snapshot(
                symbol=symbol,
                name=meta.get("name", symbol),
                region=meta.get("region", "US"),
                target=target,
            )
            if snapshot:
                snapshots.append(snapshot)
        except Exception as exc:  # pragma: no cover - network resiliency
            logger.debug("Unable to build mover snapshot for %s: %s", symbol, exc)

    gainers = [item for item in snapshots if item.get("change_percent", 0) > 0]
    losers = [item for item in snapshots if item.get("change_percent", 0) < 0]

    gainers.sort(key=lambda item: item.get("change_percent", 0), reverse=True)
    losers.sort(key=lambda item: item.get("change_percent", 0))

    top_gainers = gainers[:count]
    top_losers = losers[:count]

    # Fallback to Yahoo screener if curated universe does not yield enough movers
    if len(top_gainers) < count:
        fallback = _dedupe(
            _fetch_screener("day_gainers", "US", count * 2)
            + _fetch_screener("day_gainers", "IN", count * 2)
        )
        top_gainers = _dedupe(top_gainers + fallback)[:count]
    if len(top_losers) < count:
        fallback = _dedupe(
            _fetch_screener("day_losers", "US", count * 2)
            + _fetch_screener("day_losers", "IN", count * 2)
        )
        top_losers = _dedupe(top_losers + fallback)[:count]

    return top_gainers, top_losers


def get_market_news(count: int = 6) -> list[dict]:
    stories: list[dict] = []
    seen: set[str] = set()
    for symbol, region in NEWS_SYMBOLS.items():
        try:
            news_items = yf.Ticker(symbol).news or []
        except Exception as exc:  # pragma: no cover - network resiliency
            logger.debug("Ticker news fetch failed (%s): %s", symbol, exc)
            continue

        for item in news_items:
            title = item.get("title")
            link = item.get("link")
            publisher = item.get("publisher") or item.get("provider")
            if not title or not publisher or not link:
                continue
            uid = str(item.get("uuid") or f"{symbol}:{title}")
            if uid in seen:
                continue
            seen.add(uid)
            published = item.get("providerPublishTime")
            timestamp = (
                datetime.fromtimestamp(published).isoformat()
                if isinstance(published, (int, float))
                else datetime.utcnow().isoformat()
            )
            stories.append(
                {
                    "title": title,
                    "source": publisher,
                    "link": link,
                    "timestamp": timestamp,
                    "region": region,
                }
            )

    stories.sort(key=lambda story: story.get("timestamp", ""), reverse=True)
    return stories[:count]


def get_watchlist_snapshot(symbols: Sequence[str]) -> list[dict]:
    snapshot: list[dict] = []
    for raw_symbol in symbols:
        symbol = raw_symbol.strip()
        if not symbol:
            continue
        try:
            history = _fetch_history(symbol, None)
            rows = _extract_rows(history)
            if not rows:
                continue
            latest, previous = rows
            price = float(latest.get("Close", 0.0))
            prev_close = float(previous.get("Close", price)) if previous else price
            change = price - prev_close
            change_percent = (change / prev_close * 100) if prev_close else 0.0
            volume = latest.get("Volume")
            snapshot.append(
                {
                    "symbol": symbol.upper(),
                    "price": round(price, 2),
                    "change": round(change, 2),
                    "change_percent": round(change_percent, 2),
                    "volume": int(volume) if isinstance(volume, (int, float)) else None,
                }
            )
        except Exception as exc:  # pragma: no cover - network resiliency
            logger.debug("Unable to fetch watchlist ticker %s: %s", symbol, exc)
    return snapshot
