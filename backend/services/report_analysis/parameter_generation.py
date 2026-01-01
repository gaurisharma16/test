from google.genai import types
from .constants import client
from google.genai import types
from .types import EvaluationParameters
import re
import json


def generate_evaluation_parameters(report: str) -> list[EvaluationParameters] | None:
    """
    Generates evaluation parameters for a financial report using Google GenAI.

    Args:
        report (str): The financial report text.

    Returns:
        dict: The generated evaluation parameters.
    """

    prompt = f"""
You are an AI financial analyst that analyzes broker report data and defines all key parameters mentioned in the report.

Your task:
1. Identify every financial and operational parameter relevant to the broker report or dataset provided.
2. Determine whether the report belongs to a specific sector (e.g., Technology, Banking, Energy, FMCG, etc.).
3. Define each parameter clearly, explain its importance, and describe whether an increase (↑) or decrease (↓) generally indicates improvement or deterioration.
4. If the sector or its parameters cannot be inferred, use the predefined fallback parameter list to ensure a complete response.

Response structure (required):
[
    {{
        "parameter_name": "<string>",
        "definition": "<string>",
        "importance": "<string>",
        "interpretation": "Increase = <positive/negative>, Decrease = <positive/negative>",
        "benchmark_or_note": "<optional>"
    }},
    ...
]

Fallback Parameter List (used only if sector cannot be inferred):
- Total Revenue
- Net Income
- Gross Margin
- Operating Margin
- EBITDA Margin
- Return on Equity (ROE)
- Return on Assets (ROA)
- Debt-to-Equity Ratio
- Earnings per Share (EPS)
- Free Cash Flow (FCF)
- Price-to-Earnings (P/E) Ratio

Sector detection hint (if available in text or data):
- Technology/SaaS → ARR, ARPU, Churn Rate, R&D Spend %, etc.
- Banking/Financials → NIM, CAR, GNPA, NNPA, CASA Ratio, etc.
- Energy/Oil & Gas → Production Volume, RRR, Lifting Cost, etc.
- Retail/FMCG → Same-Store Sales Growth, Inventory Turnover, etc.
- Manufacturing → Capacity Utilization, Order Book Growth, etc.
- Telecom → ARPU, Subscriber Growth, CapEx, etc.
- Healthcare/Pharma → R&D Spend %, Pipeline Progress, Patent Expiry Risk, etc.

If uncertain, return the Fallback Parameter List with definitions.

here is the report:
{report}

Output only in structured JSON format — no narrative explanation.
    """

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        config=types.GenerateContentConfig(
            temperature=0.1,
            system_instruction="You are a financial expert assistant. You are supposed to help users understand financial reports.",
        ),
        contents=[prompt],
    )

    # extract a text representation from the response object
    raw = ""
    for attr in ("candidates", "output", "text", "content", "response"):
        val = getattr(response, attr, None)
        if val:
            raw = val
            break

    if not isinstance(raw, str):
        raw = str(raw)

    # try to find JSON inside triple-backticks (optionally fenced as json)
    m = re.search(r"```(?:json)?\s*(.*?)```", raw, re.S | re.I)
    if m:
        json_text = m.group(1).strip()

    else:
        # fallback: try to find the first JSON object/array in the text
        m2 = re.search(r"(\[.*\]|\{.*\})", raw, re.S)
        json_text = m2.group(1).strip() if m2 else raw

    # attempt to parse JSON, with a simple cleanup for trailing commas
    try:
        parsed = json.loads(json_text)

    except json.JSONDecodeError:
        cleaned = re.sub(r",\s*(\]|})", r"\1", json_text)

        try:
            parsed = json.loads(cleaned)

        except Exception:
            return None

    if isinstance(parsed, dict):
        parsed = [parsed]

    if not isinstance(parsed, list):
        return None

    parameters: list[EvaluationParameters] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        try:
            parameters.append(EvaluationParameters.model_validate(item))
        except Exception:
            continue

    return parameters or None
