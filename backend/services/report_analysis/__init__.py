"""
this is a genai - langchain based resport financial report anaylsiser
"""

from .parameter_generation import generate_evaluation_parameters
from .summary_generator import generate_report_summary
from .parameter_evaluator import generate_evaluated_parameter_code


def report_analysis_pipeline(report: str) -> tuple[str, dict]:
    """
    Complete pipeline to analyze a financial report.

    Args:
        report (str): The financial report text.

    Returns:
        str: The generated report summary.
    """
    # Step 1: Generate evaluation parameters
    parameters = generate_evaluation_parameters(report)
    if not parameters:
        raise ValueError("Failed to generate evaluation parameters.")

    # Step 2: Generate report summary
    evaluated_parameters = generate_evaluated_parameter_code(report, parameters)
    if not evaluated_parameters:
        raise ValueError("Failed to generate evaluated parameters.")

    summary = generate_report_summary(report, parameters)

    return summary, evaluated_parameters
