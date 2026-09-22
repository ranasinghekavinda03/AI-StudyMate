"""Deterministic cleaning and word-based chunking for extracted documents."""

from dataclasses import dataclass
import re

from app.services.document_extractor import ExtractedDocument


@dataclass(frozen=True)
class PreparedChunk:
    page_number: int | None
    chunk_index: int
    chunk_text: str


def clean_document_text(text: str) -> str:
    """Normalize layout noise without rewriting meaningful document content."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"(?<=\w)-[ \t]*\n[ \t]*(?=\w)", "", text)
    lines = [re.sub(r"[ \t\f\v]+", " ", line).strip() for line in text.split("\n")]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk_document(
    document: ExtractedDocument,
    *,
    chunk_size_words: int,
    chunk_overlap_words: int,
) -> list[PreparedChunk]:
    """Create ordered chunks per source page using zero-based global indexes."""
    if chunk_size_words <= 0:
        raise ValueError("Chunk size must be greater than zero.")
    if chunk_overlap_words < 0 or chunk_overlap_words >= chunk_size_words:
        raise ValueError("Chunk overlap must be non-negative and smaller than chunk size.")

    chunks: list[PreparedChunk] = []
    step = chunk_size_words - chunk_overlap_words
    for page in document.pages:
        words = clean_document_text(page.text).split()
        for start in range(0, len(words), step):
            chunk_words = words[start:start + chunk_size_words]
            if not chunk_words:
                continue
            chunks.append(
                PreparedChunk(
                    page_number=page.page_number,
                    chunk_index=len(chunks),
                    chunk_text=" ".join(chunk_words),
                )
            )
            if start + chunk_size_words >= len(words):
                break
    return chunks
