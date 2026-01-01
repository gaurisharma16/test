"""SEBI / India market filings fetcher using requests + BeautifulSoup.

This module provides a small, dependency-light scraper that parses the SEBI
listing page and returns recent announcements/filings. It intentionally avoids
Selenium and uses only `requests` + `bs4`.
"""

from __future__ import annotations

from typing import List, Dict, Optional, cast
import requests
from bs4 import BeautifulSoup
from bs4.element import Tag


SEBI_LISTING_URL = (
    "https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3"
)


def _abs_sebi(href: str) -> str:
    if not href:
        return ""
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return "https://www.sebi.gov.in" + href
    return "https://www.sebi.gov.in/" + href


def fetch_recent_india_filings(count: int = 10) -> List[Dict[str, str]]:
    """Fetch recent filings/announcements from SEBI.

    Returns a list of dicts with keys: `company` (or `title`), `link`, `date` (if
    available). Falls back between the announcements list and the `#sample_1`
    table depending on page structure.
    """
    resp = requests.get(SEBI_LISTING_URL, timeout=10)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    results: List[Dict[str, str]] = []

    # Primary source: table with id `sample_1` (if present)
    table: Optional[Tag] = cast(Optional[Tag], soup.find("table", {"id": "sample_1"}))
    if table:
        tbody: Optional[Tag] = cast(Optional[Tag], table.find("tbody"))
        if tbody:
            rows = [cast(Tag, r) for r in tbody.find_all("tr")]
            for row in rows[:count]:
                cols = [cast(Tag, c) for c in row.find_all("td")]
                if not cols:
                    continue
                date = cols[0].get_text(strip=True) if len(cols) >= 1 else ""

                # company / link typically in 2nd column
                link_tag: Optional[Tag] = (
                    cast(Optional[Tag], cols[1].find("a")) if len(cols) >= 2 else None
                )
                if link_tag is not None and isinstance(link_tag, Tag):
                    company = link_tag.get_text(strip=True) or ""
                    href = link_tag.get("href") or ""
                    link = _abs_sebi(str(href))
                else:
                    company = cols[1].get_text(strip=True) if len(cols) >= 2 else ""
                    link = ""

                results.append({"company": company, "link": link, "date": date})

            return results

    # Fallback: announcements list (ul.news-list li)
    announcements = [cast(Tag, a) for a in soup.select("ul.news-list li")]
    for ann in announcements[:count]:
        title = ann.get_text(strip=True)
        link_tag = cast(Optional[Tag], ann.find("a"))
        href = link_tag.get("href") if link_tag is not None else ""
        link = _abs_sebi(str(href)) if href else ""
        results.append({"title": title, "link": link})

    return results


if __name__ == "__main__":
    from pprint import pprint

    pprint(fetch_recent_india_filings())
