from datetime import datetime

from pydantic import BaseModel


class DashboardStats(BaseModel):
    modules: int
    lectures: int
    document_chunks: int
    flashcard_sets: int
    flashcards: int
    known_cards: int
    review_again_cards: int
    unreviewed_cards: int
    total_flashcard_reviews: int


class RecentLectureResponse(BaseModel):
    id: str
    title: str
    module_id: str
    module_title: str
    file_type: str
    created_at: datetime


class RecentFlashcardSetResponse(BaseModel):
    id: str
    title: str | None
    difficulty: str
    card_count: int
    created_at: datetime


class DashboardResponse(BaseModel):
    stats: DashboardStats
    recent_lectures: list[RecentLectureResponse]
    recent_flashcard_sets: list[RecentFlashcardSetResponse]
