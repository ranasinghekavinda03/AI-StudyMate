"""Ownership-scoped semantic retrieval over document chunks."""

from dataclasses import dataclass
from math import sqrt

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.chunk import DocumentChunk
from app.models.lecture import Lecture
from app.models.module import Module
from app.services.embedding_service import embed_text, embed_texts


class RetrievalScopeNotFound(LookupError):
    """Raised when a requested module or lecture is not owned by the user."""


@dataclass(frozen=True)
class RetrievedChunk:
    chunk: DocumentChunk
    lecture_title: str
    module_id: str
    score: float


def _scoped_query(db: Session, user_id: str, module_id: str | None, lecture_id: str | None):
    if module_id and not db.query(Module.id).filter(
        Module.id == module_id, Module.user_id == user_id
    ).first():
        raise RetrievalScopeNotFound("Module not found.")
    if lecture_id and not (
        db.query(Lecture.id)
        .join(Module, Lecture.module_id == Module.id)
        .filter(Lecture.id == lecture_id, Module.user_id == user_id)
        .first()
    ):
        raise RetrievalScopeNotFound("Lecture not found.")

    query = (
        db.query(DocumentChunk, Lecture.title, Lecture.module_id)
        .join(Lecture, DocumentChunk.lecture_id == Lecture.id)
        .join(Module, Lecture.module_id == Module.id)
        .filter(Module.user_id == user_id, DocumentChunk.embedding.isnot(None))
    )
    if module_id:
        query = query.filter(Lecture.module_id == module_id)
    if lecture_id:
        query = query.filter(Lecture.id == lecture_id)
    return query


def _cosine_similarity(left, right) -> float:
    left_values = [float(value) for value in left]
    right_values = [float(value) for value in right]
    denominator = sqrt(sum(value * value for value in left_values)) * sqrt(
        sum(value * value for value in right_values)
    )
    return sum(a * b for a, b in zip(left_values, right_values)) / denominator if denominator else 0.0


def retrieve_chunks(
    db: Session,
    *,
    user_id: str,
    query_text: str,
    module_id: str | None = None,
    lecture_id: str | None = None,
    top_k: int | None = None,
) -> list[RetrievedChunk]:
    """Return nearest owned chunks, using native pgvector on PostgreSQL."""
    limit = settings.RETRIEVAL_TOP_K if top_k is None else top_k
    if limit < 1 or limit > settings.RETRIEVAL_MAX_TOP_K:
        raise ValueError(f"top_k must be between 1 and {settings.RETRIEVAL_MAX_TOP_K}.")

    query_embedding = embed_text(query_text)
    scoped = _scoped_query(db, user_id, module_id, lecture_id)

    if db.bind is not None and db.bind.dialect.name == "postgresql":
        distance = DocumentChunk.embedding.cosine_distance(query_embedding)
        rows = scoped.add_columns(distance.label("distance")).order_by(distance).limit(limit).all()
        return [
            RetrievedChunk(chunk=row[0], lecture_title=row[1], module_id=row[2], score=1.0 - float(row[3]))
            for row in rows
        ]

    # SQLite is retained as the project's lightweight test/default database.
    # PostgreSQL always uses the native pgvector expression above.
    ranked = [
        RetrievedChunk(chunk=row[0], lecture_title=row[1], module_id=row[2], score=_cosine_similarity(query_embedding, row[0].embedding))
        for row in scoped.all()
    ]
    return sorted(ranked, key=lambda result: result.score, reverse=True)[:limit]


def backfill_missing_embeddings(db: Session, *, batch_size: int = 64) -> int:
    """Explicitly backfill legacy NULL embeddings; never runs at startup."""
    if batch_size < 1:
        raise ValueError("batch_size must be greater than zero.")
    chunks = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.embedding.is_(None))
        .order_by(DocumentChunk.created_at, DocumentChunk.id)
        .all()
    )
    try:
        for start in range(0, len(chunks), batch_size):
            batch = chunks[start:start + batch_size]
            vectors = embed_texts([chunk.chunk_text for chunk in batch])
            for chunk, vector in zip(batch, vectors):
                chunk.embedding = vector
        db.commit()
    except Exception:
        db.rollback()
        raise
    return len(chunks)
