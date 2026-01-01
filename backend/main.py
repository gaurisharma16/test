from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import (
    market_filling,
    article_scrapper,
    report_analysis,
    financial_data,
    editorial,
    editorial_assistant,
    market_summary,
    admin_settings,
    auth,
    user_content,
)
from services.database import client  # Initialize database connection

app = FastAPI(title="Stock Broker Assistant")

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:5173",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health() -> dict:
    return {
        "status": "ok",
    }


# Include all routers
app.include_router(market_filling.router)
app.include_router(article_scrapper.router)
app.include_router(report_analysis.router)
app.include_router(financial_data.router)
app.include_router(editorial.router)
app.include_router(editorial_assistant.router)
app.include_router(market_summary.router)
app.include_router(admin_settings.router)
app.include_router(auth.router)
app.include_router(user_content.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
        reload=True,
    )
