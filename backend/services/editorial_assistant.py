"""Utility functions for generating editorial content using Google GenAI."""

from __future__ import annotations

import json
import re
from typing import Sequence

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

_client = genai.Client()

_DEFAULT_STRUCTURE = {
    "headline": "",
    "subheadline": "",
    "article": "",
    "key_points": [],
    "next_steps": [],
    "data_callouts": [],
    "risk_disclaimer": "",
}


def _strip_code_fences(payload: str) -> str:
    """Remove markdown code fences if the model wraps JSON output."""
    if payload.startswith("```"):
        # Tolerate both ```json and ``` fences
        return re.sub(r"^```(?:json)?\s*|\s*```$", "", payload).strip()
    return payload


def _format_list(items: Sequence[str]) -> str:
    """Build a bullet-style string the model can consume."""
    if not items:
        return "- None"
    return "\n".join(f"- {item}" for item in items)


def generate_editorial_article(
    *,
    market_summary: str,
    reports: Sequence[str],
    market_filings: Sequence[str],
    tone: str = "Professional and informative",
    articles: Sequence[str] | None = None,
    additional_context: Sequence[str] | None = None,
) -> dict[str, object]:
    """Create an editorial article informed by market context."""
    prompt = f"""
    You are an editorial assistant for a financial news desk. Draft a concise briefing article for the daily newsletter.

    Context to incorporate:
    • Article highlights:
    {_format_list(articles or [])}

    • Market summary:
    {market_summary}

    • Research reports:
    {_format_list(reports)}

    • Regulatory filings:
    {_format_list(market_filings)}

    • Additional context:
    {_format_list(additional_context or [])}

    Tone: {tone}.

    Output strictly valid JSON (no markdown) with the schema:
    {{
        "headline": str,
        "subheadline": str,
        "article": str,              # 400-600 words, markdown paragraphs
        "key_points": [str],         # 3-5 investor takeaways
        "next_steps": [str],         # Suggested follow-up actions for readers
        "data_callouts": [str],      # Important metrics or figures to surface
        "risk_disclaimer": str       # Short reminder about market risks
    }}

    Do not include explanations, apologies, or additional keys beyond the schema.
    Ensure figures tie back to the provided inputs or flag when assumptions are made.
    """

    response = _client.models.generate_content(
        model="gemini-2.5-flash",
        config=types.GenerateContentConfig(
            temperature=0.25,
            top_p=0.9,
            top_k=40,
            system_instruction=(
                "You craft investor-ready editorial copy grounded in supplied market intelligence. "
                "You never speculate beyond the given context without clearly labelling assumptions."
            ),
        ),
        contents=[prompt],
    )

    text = _strip_code_fences(getattr(response, "text", "").strip())
    if not text:
        raise ValueError("No content returned from editorial generation model.")

    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError("Model response was not valid JSON.") from exc

    result: dict[str, object] = {}
    for key, default in _DEFAULT_STRUCTURE.items():
        value = payload.get(key, default) if isinstance(payload, dict) else default
        if isinstance(default, list) and not isinstance(value, list):
            value = [str(value)] if value else []
        elif isinstance(default, str):
            value = str(value) if value is not None else default
        result[key] = value

    article_text = str(result["article"])
    if not article_text:
        raise ValueError("Generated article content is empty.")

    result["article"] = article_text

    if not result["headline"]:
        result["headline"] = article_text.split(". ")[0][:120].strip()

    if not result["subheadline"]:
        result["subheadline"] = "Key developments in today's markets"

    if not result["risk_disclaimer"]:
        result["risk_disclaimer"] = (
            "Investing involves risks, including the possible loss of principal. Past performance does not guarantee future results."
        )

    return result
