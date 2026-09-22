import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.db.session import Base


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    lecture_id = Column(String(36), ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False, index=True)
    # PDF pages are 1-based. Formats without real pages (DOCX/TXT) store NULL.
    page_number = Column(Integer, nullable=True)
    chunk_index = Column(Integer, nullable=False, default=0)
    chunk_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    lecture = relationship("Lecture", back_populates="chunks")
