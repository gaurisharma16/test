"""market_filling package — lightweight fetchers for SEBI (India) and SEC (US).

This module re-exports the primary fetch functions so callers can do:
        from market_filling import fetch_recent_sec_filings, fetch_recent_india_filings

The implementations live in `us.py` and `india.py` and use requests + BeautifulSoup
only (no Selenium).
"""

from .india import fetch_recent_india_filings
from .us import fetch_recent_sec_filings

__all__ = ["fetch_recent_india_filings", "fetch_recent_sec_filings"]
