"""SEC / US market filings fetcher using requests + BeautifulSoup.

This is a compact reimplementation of the previous SEC feed reader. It
fetches the SEC "current" feed (Atom) and returns a list of recent filings.
"""

from __future__ import annotations

from typing import List, Dict, Optional, cast
import requests
from bs4 import BeautifulSoup
from bs4.element import Tag


SEC_FEED_URL = (
    "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&output=atom&count=10"
)

SEC_HEADERS = {
    "User-Agent": "MarketFilingsApp/1.0 (contact@example.com)",
    "Accept-Encoding": "gzip, deflate",
}


def fetch_recent_sec_filings(count: int = 10) -> List[Dict[str, str]]:
    """Fetch recent filings from the SEC Atom feed.

    Returns a list of dicts with `title` and `link` keys.
    """
    resp = requests.get(SEC_FEED_URL, headers=SEC_HEADERS, timeout=10)
    if resp.status_code != 200:
        # keep API simple: return empty list on error
        return []

    # Feed is XML (Atom). Use the xml parser for safety.
    soup = BeautifulSoup(resp.content, "lxml-xml")
    raw_entries = soup.find_all(["entry", "item"]) or []

    entries: List[Tag] = [cast(Tag, e) for e in raw_entries]
    results: List[Dict[str, str]] = []

    for entry in entries[:count]:
        title_tag: Optional[Tag] = cast(Optional[Tag], entry.find("title"))
        title = (
            title_tag.get_text(strip=True)
            if title_tag is not None and isinstance(title_tag, Tag)
            else "No title"
        )

        # Atom feed uses <link href="..."/>, RSS may have <link>url</link>
        link_tag: Optional[Tag] = cast(Optional[Tag], entry.find("link"))
        link = ""
        if link_tag is not None and isinstance(link_tag, Tag):
            # prefer href attribute
            href = link_tag.get("href")
            if href:
                link = str(href)
            elif link_tag.string:
                link = link_tag.get_text(strip=True)

        results.append({"title": title, "link": link})

    return results


if __name__ == "__main__":
    from pprint import pprint

    pprint(fetch_recent_sec_filings())
