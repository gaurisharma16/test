import os
import shutil
import nltk
import newspaper
import json


# =========================
# NLTK SAFE PRODUCTION SETUP
# =========================
# Create a local nltk_data directory INSIDE project
LOCAL_NLTK_PATH = os.path.join(os.path.dirname(__file__), "nltk_data")
os.makedirs(LOCAL_NLTK_PATH, exist_ok=True)

# Add path to nltk search list
if LOCAL_NLTK_PATH not in nltk.data.path:
    nltk.data.path.append(LOCAL_NLTK_PATH)


def ensure_nltk_resource(path_key: str, download_name: str):
    """
    Ensures an nltk resource exists. If not, downloads it safely.
    """
    try:
        nltk.data.find(path_key)
    except LookupError:
        try:
            nltk.download(download_name, download_dir=LOCAL_NLTK_PATH, quiet=True)
        except Exception as e:
            print(f"Failed to download {download_name}: {e}")


ensure_nltk_resource("tokenizers/punkt", "punkt")
ensure_nltk_resource("tokenizers/punkt_tab", "punkt_tab")
ensure_nltk_resource("corpora/stopwords", "stopwords")


# =========================
# Newspaper Cache Folder
# =========================
CACHE_FOLDER = os.path.join(
    os.path.dirname(__file__),
    ".newspaper_scraper",
)


def clear_cache():
    """
    Clears the newspaper cache folder to force fresh scraping of all articles.
    """
    if os.path.exists(CACHE_FOLDER):
        try:
            shutil.rmtree(CACHE_FOLDER)
            print("Cache cleared successfully.")
        except Exception as e:
            print(f"Failed to clear cache: {e}")
    else:
        print("No cache to clear.")


# =========================
# SCRAPING FUNCTION
# =========================
def scrape(websites: list, count: int = 5) -> list:
    """
    Scrapes articles from a list of websites and extracts metadata, including thumbnails.
    """
    articles_data = []
    temp = count

    for website in websites:
        temp = count
        try:
            site = newspaper.build(
                website,
                language="en",
                memoize_articles=False,
                fetch_images=False,
                browser_user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0 Safari/537.36"
                ),
            )

            print(f"Links from {website} = {len(site.articles)}")

            for article in site.articles:
                try:
                    if temp == 0:
                        break

                    article.download()
                    article.parse()
                    article.nlp()

                    articles_data.append(
                        {
                            "link": article.url,
                            "title": article.title,
                            "text": article.text,
                            "author": article.authors,
                            "publish_date": (
                                article.publish_date.strftime("%Y-%m-%d")
                                if article.publish_date
                                else None
                            ),
                            "keywords": article.keywords,
                            "tags": list(article.tags),
                            "thumbnail": article.top_image,
                        }
                    )
                    temp -= 1

                except Exception as e:
                    print(f"Failed to parse article: {article.url}. Error: {e}")
                    continue

        except Exception as e:
            print(f"Failed to process website: {website}. Error: {e}")
            continue

    print("**Finished Parsing**")
    print(f"Total Articles - {len(articles_data)}")
    return articles_data


# =========================
# PUBLIC SCRAPER FUNCTION
# =========================
def scrape_articles(
    websites: list | None = None, count: int = 5, max_articles: int = 1500
) -> dict:
    """
    Scrapes articles from a list of websites and returns structured data.
    """

    if websites is None:
        websites = [
            "http://livemint.com/",
            "https://www.bloomberg.com/asia",
            "https://www.marketwatch.com/",
            "https://www.reuters.com/business/finance/",
            "https://www.cnbctv18.com/",
        ]

    results = scrape(websites, count=count)
    valid_results = [r for r in results if r.get("title") and r.get("text")]

    if not valid_results:
        return {
            "status": "success",
            "message": "No valid articles found",
            "total_articles": 0,
            "articles": [],
        }

    unwanted_texts = [
        "",
        "Get App for Better Experience",
        "Log onto movie.ndtv.com for more celebrity pictures",
        "No description available.",
    ]

    filtered_results = [
        r
        for r in valid_results
        if not (
            r["title"]
            and any(
                brand in r["title"].lower()
                for brand in ["dell", "hp", "acer", "lenovo"]
            )
            or r["text"] in unwanted_texts
        )
    ]

    def get_date(article):
        return article.get("publish_date") or "0000-00-00"

    filtered_results.sort(key=get_date)

    if len(filtered_results) > max_articles:
        filtered_results = filtered_results[-max_articles:]

    return {
        "status": "success",
        "message": f"Successfully scraped {len(filtered_results)} articles",
        "total_articles": len(filtered_results),
        "articles": filtered_results,
    }


# =========================
# RUN DIRECTLY (DEV USAGE)
# =========================
def main():
    result = scrape_articles(count=5000)

    if result["status"] == "success" and result["total_articles"] > 0:
        output_file = os.path.join(os.path.dirname(__file__), "articles.json")
        with open(output_file, "w", encoding="utf-8") as json_file:
            json.dump(result["articles"], json_file, ensure_ascii=False, indent=4)

        print(f"Scraping completed! Articles saved: {result['total_articles']}")
    else:
        print(result["message"])


if __name__ == "__main__":
    main()
