"""Local sentence-transformer embedding generation."""

from functools import lru_cache
from typing import Sequence

from app.core.config import settings


class EmbeddingError(RuntimeError):
    """Raised when the local embedding model cannot initialize or encode."""


@lru_cache(maxsize=1)
def _get_model():
    """Load the configured model once per application process, on first use."""
    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer(settings.EMBEDDING_MODEL)
    except Exception as exc:
        raise EmbeddingError(
            f"Could not initialize embedding model '{settings.EMBEDDING_MODEL}'."
        ) from exc


def embed_texts(texts: Sequence[str]) -> list[list[float]]:
    """Embed texts as a normalized batch, preserving input order."""
    values = list(texts)
    if not values:
        return []
    if any(not isinstance(value, str) or not value.strip() for value in values):
        raise EmbeddingError("Embedding input must contain non-empty text strings.")

    try:
        vectors = _get_model().encode(
            values,
            batch_size=32,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        result = [[float(component) for component in vector] for vector in vectors]
    except EmbeddingError:
        raise
    except Exception as exc:
        raise EmbeddingError("Embedding generation failed.") from exc

    if len(result) != len(values):
        raise EmbeddingError("Embedding model returned an unexpected batch size.")
    if any(len(vector) != settings.EMBEDDING_DIMENSION for vector in result):
        raise EmbeddingError(
            f"Embedding dimension does not match configured dimension {settings.EMBEDDING_DIMENSION}."
        )
    return result


def embed_text(text: str) -> list[float]:
    """Embed one text using the same cached model and validation as batches."""
    return embed_texts([text])[0]
