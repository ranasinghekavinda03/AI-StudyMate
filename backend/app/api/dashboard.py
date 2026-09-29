from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.chunk import DocumentChunk
from app.models.flashcard import Flashcard, FlashcardSet
from app.models.lecture import Lecture
from app.models.module import Module
from app.models.user import User
from app.schemas.dashboard import (
    DashboardResponse,
    DashboardStats,
    RecentFlashcardSetResponse,
    RecentLectureResponse,
)


router = APIRouter(prefix="/dashboard", tags=["dashboard"])
RECENT_ITEM_LIMIT = 5


@router.get("", response_model=DashboardResponse)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    module_count = db.query(func.count(Module.id)).filter(Module.user_id == current_user.id).scalar() or 0
    lecture_count = (
        db.query(func.count(Lecture.id))
        .join(Module, Lecture.module_id == Module.id)
        .filter(Module.user_id == current_user.id)
        .scalar() or 0
    )
    chunk_count = (
        db.query(func.count(DocumentChunk.id))
        .join(Lecture, DocumentChunk.lecture_id == Lecture.id)
        .join(Module, Lecture.module_id == Module.id)
        .filter(Module.user_id == current_user.id)
        .scalar() or 0
    )
    set_count = db.query(func.count(FlashcardSet.id)).filter(FlashcardSet.user_id == current_user.id).scalar() or 0
    card_query = db.query(Flashcard).join(
        FlashcardSet, Flashcard.flashcard_set_id == FlashcardSet.id
    ).filter(FlashcardSet.user_id == current_user.id)
    card_count = card_query.count()
    known_count = card_query.filter(Flashcard.review_status == "known").count()
    review_again_count = card_query.filter(Flashcard.review_status == "review_again").count()
    unreviewed_count = card_query.filter(Flashcard.review_status == "unreviewed").count()
    review_total = (
        db.query(func.coalesce(func.sum(Flashcard.review_count), 0))
        .join(FlashcardSet, Flashcard.flashcard_set_id == FlashcardSet.id)
        .filter(FlashcardSet.user_id == current_user.id)
        .scalar() or 0
    )

    recent_lecture_rows = (
        db.query(Lecture, Module.title)
        .join(Module, Lecture.module_id == Module.id)
        .filter(Module.user_id == current_user.id)
        .order_by(Lecture.created_at.desc(), Lecture.id.desc())
        .limit(RECENT_ITEM_LIMIT)
        .all()
    )
    recent_set_rows = (
        db.query(FlashcardSet, func.count(Flashcard.id))
        .outerjoin(Flashcard, Flashcard.flashcard_set_id == FlashcardSet.id)
        .filter(FlashcardSet.user_id == current_user.id)
        .group_by(FlashcardSet.id)
        .order_by(FlashcardSet.created_at.desc(), FlashcardSet.id.desc())
        .limit(RECENT_ITEM_LIMIT)
        .all()
    )

    return DashboardResponse(
        stats=DashboardStats(
            modules=module_count,
            lectures=lecture_count,
            document_chunks=chunk_count,
            flashcard_sets=set_count,
            flashcards=card_count,
            known_cards=known_count,
            review_again_cards=review_again_count,
            unreviewed_cards=unreviewed_count,
            total_flashcard_reviews=int(review_total),
        ),
        recent_lectures=[
            RecentLectureResponse(
                id=lecture.id,
                title=lecture.title,
                module_id=lecture.module_id,
                module_title=module_title,
                file_type=lecture.file_type,
                created_at=lecture.created_at,
            )
            for lecture, module_title in recent_lecture_rows
        ],
        recent_flashcard_sets=[
            RecentFlashcardSetResponse(
                id=deck.id,
                title=deck.title,
                difficulty=deck.difficulty,
                card_count=card_count,
                created_at=deck.created_at,
            )
            for deck, card_count in recent_set_rows
        ],
    )
