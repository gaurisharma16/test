import base64
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from docx import Document  # type: ignore
except ImportError:  # pragma: no cover - optional dependency
    Document = None  # type: ignore

try:
    import fitz  # type: ignore
except ImportError:  # pragma: no cover - fallback when pymupdf/fitz not available
    try:
        from pymupdf4llm import fitz as fitz  # type: ignore
    except ImportError:  # pragma: no cover - ultimate fallback
        import pymupdf4llm as fitz  # type: ignore

if not hasattr(fitz, "open"):
    if hasattr(fitz, "Document"):

        def _open_document(path: str):
            return fitz.Document(path)  # type: ignore[attr-defined]

        setattr(fitz, "open", _open_document)
    elif hasattr(fitz, "from_file"):

        def _open_from_file(path: str):
            return fitz.from_file(path)  # type: ignore[attr-defined]

        setattr(fitz, "open", _open_from_file)
    else:
        raise AttributeError("Loaded PyMuPDF variant does not expose an 'open' method.")


"""

Utility to convert PDFs to Markdown using PyMuPDF (pymupdf / pymupdf4llm).
Creates simple heading detection via font-size heuristics, preserves basic
inline bold/italic from font names, detects bullets, and can extract images.
"""


def _sanitize_md(text: str) -> str:
    # minimal escaping for Markdown-sensitive characters at line starts
    text = text.replace("\r", "")
    text = re.sub(r"\t", "    ", text)
    return text


def _wrap_emphasis(text: str, is_bold: bool, is_italic: bool) -> str:
    if not text:
        return text
    if is_bold and is_italic:
        return f"***{text}***"
    if is_bold:
        return f"**{text}**"
    if is_italic:
        return f"*{text}*"
    return text


def convert_pdf_to_md(
    pdf_path: str, images_dir: Optional[str] = None, include_images: bool = True
) -> str:
    """
    Convert a PDF to a Markdown string.

    Args:
        pdf_path: path to the PDF file.
        images_dir: directory where extracted images will be saved (if included).
        include_images: whether to extract and include images in the Markdown.

    Returns:
        Markdown text as a single string.
    """
    doc: Any = fitz.open(pdf_path)  # type: ignore
    try:
        sizes: Dict[float, int] = {}
        for page_index in range(doc.page_count):
            page: Any = doc.load_page(page_index)
            page_dict: Any = page.get_text("dict")
            if not isinstance(page_dict, dict):
                continue
            blocks: Any = page_dict.get("blocks", [])
            if not isinstance(blocks, list):
                continue
            for block in blocks:
                if not isinstance(block, dict) or block.get("type") != 0:
                    continue
                lines: Any = block.get("lines", [])
                if not isinstance(lines, list):
                    continue
                for line in lines:
                    spans: Any = line.get("spans", [])
                    if not isinstance(spans, list):
                        continue
                    for span in spans:
                        if not isinstance(span, dict):
                            continue
                        sz = round(float(span.get("size", 0) or 0), 2)
                        sizes[sz] = sizes.get(sz, 0) + 1

        unique_sizes = sorted(sizes.keys(), reverse=True)
        size_to_heading: Dict[float, int] = {
            sz: idx + 1 for idx, sz in enumerate(unique_sizes[:3])
        }

        md_lines: List[str] = []
        total_pages = doc.page_count
        for page_number in range(total_pages):
            page = doc.load_page(page_number)
            page_dict = page.get_text("dict")
            if not isinstance(page_dict, dict):
                continue
            blocks = page_dict.get("blocks", [])
            if not isinstance(blocks, list):
                continue

            for block in blocks:
                if not isinstance(block, dict):
                    continue
                block_type = block.get("type")
                if block_type == 0:
                    lines = block.get("lines", [])
                    if not isinstance(lines, list):
                        continue
                    for line in lines:
                        spans = line.get("spans", [])
                        if not isinstance(spans, list):
                            continue

                        line_sizes = [
                            round(float(span.get("size", 0) or 0), 2)
                            for span in spans
                            if isinstance(span, dict) and span.get("text")
                        ]
                        dominant_size = max(line_sizes) if line_sizes else 0
                        heading_level = size_to_heading.get(dominant_size, 0)

                        span_texts: List[str] = []
                        for span in spans:
                            if not isinstance(span, dict):
                                continue
                            text = span.get("text", "") or ""
                            if not text.strip():
                                span_texts.append(text)
                                continue
                            fontname = span.get("font", "") or ""
                            fontname_lower = fontname.lower()
                            is_bold = (
                                "bold" in fontname_lower or "black" in fontname_lower
                            )
                            is_italic = (
                                "italic" in fontname_lower
                                or "oblique" in fontname_lower
                            )
                            span_texts.append(_wrap_emphasis(text, is_bold, is_italic))

                        raw_line = _sanitize_md("".join(span_texts).strip())
                        if not raw_line:
                            continue

                        if re.match(r"^[\-\u2022\u2023\u25E6\u2043*o]\s+", raw_line):
                            bullet_text = re.sub(
                                r"^[\-\u2022\u2023\u25E6\u2043*o]\s+", "", raw_line
                            )
                            md_lines.append(f"- {bullet_text}")
                            continue

                        if heading_level:
                            md_lines.append(f"{'#' * heading_level} {raw_line}")
                        else:
                            md_lines.append(raw_line)

                elif block_type == 1 and include_images:
                    imginfo = (
                        block.get("image", {})
                        if isinstance(block.get("image", {}), dict)
                        else {}
                    )
                    xref = imginfo.get("xref")
                    if not xref:
                        continue
                    try:
                        img_dict = doc.extract_image(xref)
                        img_bytes = img_dict.get("image")
                        if not isinstance(img_bytes, (bytes, bytearray)):
                            continue
                        img_data = bytes(img_bytes)
                        img_ext = img_dict.get("ext", "png")
                        if images_dir:
                            os.makedirs(images_dir, exist_ok=True)
                            img_name = f"page{page_number + 1}_img{xref}.{img_ext}"
                            img_path = os.path.join(images_dir, img_name)
                            with open(img_path, "wb") as f:
                                f.write(img_data)
                            md_lines.append(f"![image]({img_path})")
                        else:
                            b64 = base64.b64encode(img_data).decode("ascii")
                            md_lines.append(
                                f"![image](data:image/{img_ext};base64,{b64})"
                            )
                    except Exception:
                        continue

            if page_number != total_pages - 1:
                md_lines.append("\n---\n")

        return "\n".join(md_lines).strip()
    finally:
        doc.close()


def convert_docx_to_md(docx_path: str) -> str:
    if Document is None:
        raise ImportError("python-docx is required to process DOCX files.")
    doc = Document(docx_path)  # type: ignore[misc]
    md_lines = []

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            md_lines.append("")
            continue

        style_name = para.style.name if para.style else ""
        if style_name.lower().startswith("heading"):
            # Extract heading level digits, default to 1 if missing
            digits = "".join(ch for ch in style_name if ch.isdigit())
            level = max(1, min(int(digits or "1"), 6))
            md_lines.append(f"{'#' * level} {text}")

        elif "list" in style_name.lower():
            md_lines.append(f"- {text}")

        else:
            md_lines.append(text)

    return "\n\n".join(line for line in md_lines if line is not None).strip()


def convert_document_to_md(path: str, **kwargs) -> str:
    ext = Path(path).suffix.lower()

    if ext == ".pdf":
        return convert_pdf_to_md(path, **kwargs)

    if ext == ".docx":
        return convert_docx_to_md(path)

    raise ValueError("Unsupported file type. Only PDF and DOCX files are supported.")


__all__ = [
    "convert_pdf_to_md",
    "convert_docx_to_md",
    "convert_document_to_md",
]
