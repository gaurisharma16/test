from typing import List, Union

from .constants import client
from google.genai import types
import re
import json
from .types import EvaluationParameters


def generate_evaluated_parameter_code(
    report: str, parameter: Union[EvaluationParameters, List[EvaluationParameters]]
) -> Union[dict, List[dict]]:
    """
    Generates evaluated parameter code for a financial report using Google GenAI.

    Args:
        report (str): The financial report text.
        parameter (EvaluationParameters): The parameter to evaluate.

    Returns:
        str: The generated evaluated parameter code.
    """

    if isinstance(parameter, list):
        evaluations: List[dict] = []
        for item in parameter:
            evaluated = generate_evaluated_parameter_code(report, item)
            if isinstance(evaluated, dict):
                evaluations.append(evaluated)
        return evaluations

    prompt = f"""
    As a financial expert, evaluate the following parameter based on the provided report and return the result in JSON format matching the EvaluationParameters model.

    Parameter to evaluate:
    {parameter.model_dump_json(indent=2)}

    Report:
    {report}

    Output Format:
        {{
            "parameter_name": "<string>",
            "report": "<string>",
            "interpretation": "Increase = <positive/negative>, Decrease = <positive/negative>",
            "benchmark_or_note": "<optional>"
        }}

    Make sure to just give the JSON without any additional explanation or conversation.
    """

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        config=types.GenerateContentConfig(
            temperature=0.1,
            system_instruction="You are a financial expert assistant. You are supposed to help users understand financial reports.",
        ),
        contents=[prompt],
    )

    text = getattr(response, "text", "")

    m = re.search(r"```(?:[^\n]*\n)?(.*?)```", text, re.S)

    if m:
        output = m.group(1).strip()
    else:
        output = text

    formated_dict = json.loads(output)

    return formated_dict
