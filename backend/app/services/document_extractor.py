"""Text extraction helpers for supported lecture document formats."""

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from docx import Document
from docx.opc.exceptions import PackageNotFoundError
from pypdf import PdfReader
from pypdf.errors import PdfReadError


class DocumentExtractionError(ValueError):
    """Raised when a document cannot be parsed or contains no useful text."""


@dataclass(frozen=True)
class ExtractedDocument:
    pages: list[str]

    @property
    def text(self) -> str:
        return "\n\n".join(page for page in self.pages if page).strip()

    @property
    def page_count(self) -> int:
        return len(self.pages)


def extract_document(data: bytes, filename: str) -> ExtractedDocument:
    """Extract text from PDF, DOCX, or UTF-8 TXT bytes."""
    extension = Path(filename).suffix.lower()

    try:
        if extension == ".pdf":
            reader = PdfReader(BytesIO(data))
            if reader.is_encrypted:
                try:
                    reader.decrypt("")
                except Exception as exc:
                    raise DocumentExtractionError("Password-protected PDFs are not supported.") from exc
            pages = [(page.extract_text() or "").strip() for page in reader.pages]
        elif extension == ".docx":
            document = Document(BytesIO(data))
            blocks = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
            for table in document.tables:
                for row in table.rows:
                    cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                    if cells:
                        blocks.append("\t".join(cells))
            pages = ["\n".join(blocks)]
        elif extension == ".txt":
            pages = [data.decode("utf-8-sig").strip()]
        else:
            raise DocumentExtractionError("Unsupported file type. Upload a PDF, DOCX, or TXT file.")
    except DocumentExtractionError:
        raise
    except UnicodeDecodeError as exc:
        raise DocumentExtractionError("TXT files must use UTF-8 encoding.") from exc
    except (PdfReadError, PackageNotFoundError, KeyError, ValueError) as exc:
        raise DocumentExtractionError(f"The {extension[1:].upper()} file is invalid or corrupted.") from exc
    except Exception as exc:
        raise DocumentExtractionError("The document could not be processed.") from exc

    extracted = ExtractedDocument(pages=pages)
    if not extracted.text:
        raise DocumentExtractionError("No extractable text was found in the document.")
    return extracted
