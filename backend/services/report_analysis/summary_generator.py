from .types import EvaluationParameters
from .constants import client
from google.genai import types
import json
import re


def generate_report_summary(report: str, parameters: list[EvaluationParameters]) -> str:
    """
    Generates a detailed summary of a financial report using Google GenAI.

    Args:
        report (str): The financial report text.
        parameters (EvaluationParameters): The parameters to include in the summary.

    Returns:
        str: The generated summary.
    """

    parameters_json = json.dumps(
        [param.model_dump(mode="json") for param in parameters], indent=2
    )

    prompt = f"""
    As a financial expert, generate a detailed summary of this report make sure to includes these parameters:
    {parameters_json}

    Report:
    {report}

    Make sure to just give the report without any additional explanation. or any conversation. no not engage in conversation and return proper markdown.
    """

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        config=types.GenerateContentConfig(
            temperature=0.1,
            system_instruction="You are a financial expert assitant. You are supposed to help users understand financial reports.",
        ),
        contents=[prompt],
    )

    text = getattr(response, "text", "")

    m = re.search(r"```(?:[^\n]*\n)?(.*?)```", text, re.S)

    if m:
        output = m.group(1).strip()
    else:
        output = text

    return output
