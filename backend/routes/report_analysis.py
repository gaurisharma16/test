import asyncio
import os
import tempfile
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from services.report_analysis.parameter_generation import generate_evaluation_parameters
from services.report_analysis.parameter_evaluator import (
    generate_evaluated_parameter_code,
)
from services.report_analysis.summary_generator import generate_report_summary
from services.report_analysis.types import EvaluationParameters
from services.content_service import list_report_analysis, save_report_analysis
from models.content import ReportAnalysisRecord
from services.process_pdf import convert_document_to_md

router = APIRouter(prefix="/report-analysis", tags=["report-analysis"])


uploaded_reports: Dict[str, Dict[str, Any]] = {}


class ReportRequest(BaseModel):
    report: Optional[str] = None
    file_id: Optional[str] = None


class EvaluateParameterRequest(BaseModel):
    report: Optional[str] = None
    file_id: Optional[str] = None
    parameter: EvaluationParameters


class SummaryRequest(BaseModel):
    report: Optional[str] = None
    file_id: Optional[str] = None
    parameters: list[EvaluationParameters]


class ReportUploadResponse(BaseModel):
    file_id: str
    filename: str
    status: str


async def _get_report_content(
    report_text: Optional[str], file_id: Optional[str]
) -> str:
    if report_text:
        return report_text

    if file_id:
        file_info = uploaded_reports.get(file_id)
        if not file_info:
            raise HTTPException(status_code=404, detail="Uploaded file not found")

        file_path = file_info.get("path")
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Uploaded file not found")

        file_ext = Path(file_path).suffix.lower()
        if file_ext not in {".pdf", ".docx"}:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type. Only PDF and DOCX files are supported.",
            )

        if markdown := file_info.get("markdown"):
            return markdown

        markdown_content = await asyncio.to_thread(convert_document_to_md, file_path)
        file_info["status"] = "processed"
        file_info["markdown"] = markdown_content
        return markdown_content

    raise HTTPException(
        status_code=400,
        detail="A report body or an uploaded file_id is required.",
    )


@router.post("/upload", response_model=ReportUploadResponse)
async def upload_report_document(file: UploadFile = File(...)) -> ReportUploadResponse:
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="Filename is required")

        suffix = Path(file.filename).suffix.lower()
        if suffix not in {".pdf", ".docx"}:
            raise HTTPException(
                status_code=400,
                detail="Only PDF or DOCX files are supported",
            )

        file_id = str(uuid.uuid4())
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, f"{file_id}{suffix}")

        contents = await file.read()
        with open(temp_path, "wb") as temp_file:
            temp_file.write(contents)

        uploaded_reports[file_id] = {
            "filename": file.filename,
            "path": temp_path,
            "status": "uploaded",
            "markdown": None,
        }

        return ReportUploadResponse(
            file_id=file_id,
            filename=file.filename,
            status="uploaded",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/generate-parameters")
async def generate_parameters(request: ReportRequest) -> dict:
    """
    Generate evaluation parameters for a financial report.

    Args:
        request: Contains the financial report text

    Returns:
        Dictionary containing the generated evaluation parameters
    """
    try:
        report_content = await _get_report_content(request.report, request.file_id)
        parameters = generate_evaluation_parameters(report_content)

        if parameters is None:
            raise HTTPException(
                status_code=400,
                detail="Failed to generate evaluation parameters. Please check the report format.",
            )

        parameters_payload = []
        if parameters:
            parameters_payload = [param.model_dump(mode="json") for param in parameters]

        return {
            "status": "success",
            "message": "Successfully generated evaluation parameters",
            "parameters": parameters_payload,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error generating parameters: {str(e)}"
        )


@router.post("/evaluate-parameter")
async def evaluate_parameter(request: EvaluateParameterRequest) -> dict:
    """
    Evaluate a specific parameter based on the financial report.

    Args:
        request: Contains the report text and parameter to evaluate

    Returns:
        Dictionary containing the evaluated parameter
    """
    try:
        report_content = await _get_report_content(request.report, request.file_id)
        evaluated = generate_evaluated_parameter_code(report_content, request.parameter)

        return {
            "status": "success",
            "message": "Successfully evaluated parameter",
            "evaluation": evaluated,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error evaluating parameter: {str(e)}"
        )


@router.post("/generate-summary")
async def generate_summary(request: SummaryRequest) -> dict:
    """
    Generate a detailed summary of the financial report.

    Args:
        request: Contains the report text and parameters to include

    Returns:
        Dictionary containing the generated summary
    """
    try:
        if not request.parameters:
            raise HTTPException(
                status_code=400,
                detail="At least one parameter is required for summary generation",
            )

        report_content = await _get_report_content(request.report, request.file_id)
        summary = generate_report_summary(report_content, request.parameters)

        return {
            "status": "success",
            "message": "Successfully generated report summary",
            "summary": summary,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error generating summary: {str(e)}"
        )


@router.post("/full-analysis")
async def full_analysis(request: ReportRequest) -> dict:
    """
    Perform a complete analysis: generate parameters, evaluate them, and create a summary.

    Args:
        request: Contains the financial report text

    Returns:
        Dictionary containing parameters, evaluations, and summary
    """
    try:
        # Step 1: Generate parameters
        report_content = await _get_report_content(request.report, request.file_id)
        parameters = generate_evaluation_parameters(report_content)

        if not parameters:
            raise HTTPException(
                status_code=400, detail="Failed to generate evaluation parameters"
            )

        # Step 2: Evaluate the parameters (returns list)
        evaluation = generate_evaluated_parameter_code(report_content, parameters)

        # Step 3: Generate summary
        summary = generate_report_summary(report_content, parameters)

        parameters_payload = [param.model_dump(mode="json") for param in parameters]

        response_payload = {
            "status": "success",
            "message": "Successfully completed full analysis",
            "parameters": parameters_payload,
            "evaluation": evaluation,
            "summary": summary,
        }

        evaluation_payload = evaluation

        await save_report_analysis(
            report=report_content,
            parameters=parameters_payload,
            evaluation=evaluation_payload,
            summary=summary,
        )

        if request.file_id and request.file_id in uploaded_reports:
            uploaded_reports[request.file_id]["status"] = "analyzed"
            uploaded_reports[request.file_id]["summary"] = summary
            uploaded_reports[request.file_id]["parameters"] = parameters_payload
            uploaded_reports[request.file_id]["evaluation"] = evaluation_payload

        return response_payload

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error performing full analysis: {str(e)}"
        )


@router.get("/history", response_model=List[ReportAnalysisRecord])
async def get_report_analysis_history(
    limit: int = Query(20, ge=1, le=100, description="Maximum records to return"),
):
    records = await list_report_analysis(limit=limit)
    return records
