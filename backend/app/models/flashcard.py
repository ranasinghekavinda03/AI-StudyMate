import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.session import Base


def utc_now():
    return datetime.now(timezone.utc)


class FlashcardSet(Base):
    __tablename__ = "flashcard_sets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    module_id = Column(String(36), ForeignKey("modules.id", ondelete="SET NULL"), nullable=True, index=True)
    lecture_id = Column(String(36), ForeignKey("lectures.id", ondelete="SET NULL"), nullable=True, index=True)
    difficulty = Column(String(50), nullable=False)
    title = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="flashcard_sets")
    flashcards = relationship("Flashcard", back_populates="flashcard_set", cascade="all, delete-orphan", order_by="Flashcard.position")


class Flashcard(Base):
    __tablename__ = "flashcards"
    __table_args__ = (
        CheckConstraint("review_status IN ('unreviewed', 'known', 'review_again')", name="ck_flashcards_review_status"),
        UniqueConstraint("flashcard_set_id", "position", name="uq_flashcards_set_position"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    flashcard_set_id = Column(String(36), ForeignKey("flashcard_sets.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(Integer, nullable=False)
    front = Column(Text, nullable=False)
    back = Column(Text, nullable=False)
    review_status = Column(String(20), default="unreviewed", nullable=False, index=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_count = Column(Integer, default=0, nullable=False)
    review_streak = Column(Integer, default=0, nullable=False)
    interval_days = Column(Integer, default=0, nullable=False)
    next_review_at = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    flashcard_set = relationship("FlashcardSet", back_populates="flashcards")
    sources = relationship("FlashcardSource", back_populates="flashcard", cascade="all, delete-orphan", order_by="FlashcardSource.position")


class FlashcardSource(Base):
    __tablename__ = "flashcard_sources"
    __table_args__ = (UniqueConstraint("flashcard_id", "source_id", name="uq_flashcard_sources_card_source"),)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    flashcard_id = Column(String(36), ForeignKey("flashcards.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(Integer, nullable=False)
    source_id = Column(String(50), nullable=False)
    chunk_id = Column(String(36), ForeignKey("document_chunks.id", ondelete="SET NULL"), nullable=True, index=True)
    lecture_id = Column(String(36), ForeignKey("lectures.id", ondelete="SET NULL"), nullable=True)
    lecture_title_snapshot = Column(String(255), nullable=False)
    module_id = Column(String(36), ForeignKey("modules.id", ondelete="SET NULL"), nullable=True)
    page_number = Column(Integer, nullable=True)
    chunk_index = Column(Integer, nullable=False)

    flashcard = relationship("Flashcard", back_populates="sources")
