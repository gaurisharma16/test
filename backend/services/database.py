import os

from dotenv import load_dotenv
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.database import Database

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "stock_broker_assistant")

client: MongoClient = MongoClient(MONGODB_URL)
database: Database = client[DATABASE_NAME]


def get_collection(name: str) -> Collection:
    """Return a typed collection handle."""

    return database.get_collection(name)


users_collection: Collection = get_collection("users")
articles_collection: Collection = get_collection("articles")
report_analysis_collection: Collection = get_collection("report_analysis")
financial_analysis_collection: Collection = get_collection("financial_analysis")
market_filings_collection: Collection = get_collection("market_filings")
watchlists_collection: Collection = get_collection("watchlists")
favorite_articles_collection: Collection = get_collection("favorite_articles")
admin_logs_collection: Collection = get_collection("admin_logs")
user_settings_collection: Collection = get_collection("user_settings")
application_settings_collection: Collection = get_collection("application_settings")

# Ensure useful indexes exist (no-op if already created)
users_collection.create_index(
    [("email", ASCENDING)],
    unique=True,
)
users_collection.create_index(
    [("username", ASCENDING)],
    unique=True,
)
users_collection.create_index(
    [("reset_token", ASCENDING)],
    unique=True,
    sparse=True,
)

articles_collection.create_index(
    [("link", ASCENDING)],
    unique=True,
)
articles_collection.create_index(
    [("created_at", ASCENDING)],
)

report_analysis_collection.create_index(
    [("created_at", ASCENDING)],
)

financial_analysis_collection.create_index(
    [("created_at", ASCENDING)],
)
financial_analysis_collection.create_index(
    [("file_id", ASCENDING)],
    unique=True,
)

market_filings_collection.create_index(
    [("source", ASCENDING), ("link", ASCENDING)],
    unique=True,
)
market_filings_collection.create_index(
    [("created_at", ASCENDING)],
)

watchlists_collection.create_index(
    [("user_id", ASCENDING)],
    unique=True,
)

favorite_articles_collection.create_index(
    [("user_id", ASCENDING), ("article_id", ASCENDING)],
    unique=True,
)
favorite_articles_collection.create_index(
    [("created_at", ASCENDING)],
)

admin_logs_collection.create_index(
    [
        ("created_at", DESCENDING),
    ]
)
admin_logs_collection.create_index(
    [
        ("level", ASCENDING),
        ("created_at", DESCENDING),
    ]
)

user_settings_collection.create_index(
    [
        ("user_id", ASCENDING),
    ],
    unique=True,
)
user_settings_collection.create_index(
    [
        ("updated_at", DESCENDING),
    ]
)
