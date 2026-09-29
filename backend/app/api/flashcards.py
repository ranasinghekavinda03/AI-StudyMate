"""Grounded flashcard generation, persistence, and review routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, get_db
from app.models.flashcard import Flashcard, FlashcardSet
from app.models.user import User
from app.schemas.flashcard import (
    FlashcardGenerateRequest,
    FlashcardGenerateResponse,
    DueFlashcardResponse,
    DueFlashcardsResponse,
    FlashcardResponse,
    FlashcardReviewResponse,
    FlashcardReviewUpdate,
    FlashcardSetDetailResponse,
    FlashcardSetSummaryResponse,
    FlashcardSourceResponse,
)
from app.services.flashcard_generator import (
    FlashcardGenerationError,
    InsufficientFlashcardMaterial,
    FlashcardPersistenceError,
    generate_flashcards,
)
from app.services.flashcard_scheduler import apply_review_schedule, utc_now_naive
from app.services.llm_service import LLMConfigurationError, LLMProviderError
from app.services.retrieval_service import RetrievalScopeNotFound


router = APIRouter(prefix="/flashcards", tags=["flashcards"])


def _card_response(card: Flashcard) -> FlashcardResponse:
    return FlashcardResponse(
        id=card.id,
        front=card.front,
        back=card.back,
        review_status=card.review_status,
        reviewed_at=card.reviewed_at,
        review_count=card.review_count,
        review_streak=card.review_streak,
        interval_days=card.interval_days,
        next_review_at=card.next_review_at,
        sources=[
            FlashcardSourceResponse(
                source_id=source.source_id,
                chunk_id=source.chunk_id,
                lecture_id=source.lecture_id,
                lecture_title=source.lecture_title_snapshot,
                module_id=source.module_id,
                page_number=source.page_number,
                chunk_index=source.chunk_index,
            )
            for source in card.sources
        ],
    )


@router.get("/due", response_model=DueFlashcardsResponse)
def get_due_cards(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = utc_now_naive()
    due_filter = or_(Flashcard.next_review_at.is_(None), Flashcard.next_review_at <= now)
    owned_due = (
        db.query(Flashcard)
        .join(FlashcardSet, Flashcard.flashcard_set_id == FlashcardSet.id)
        .filter(FlashcardSet.user_id == current_user.id, due_filter)
    )
    total = owned_due.count()
    cards = (
        owned_due.options(selectinload(Flashcard.sources))
        .order_by(
            case((Flashcard.next_review_at.is_(None), 0), else_=1),
            Flashcard.next_review_at.asc(),
            Flashcard.flashcard_set_id.asc(),
            Flashcard.position.asc(),
            Flashcard.id.asc(),
        )
        .limit(limit)
        .all()
    )
    set_titles = {
        deck_id: title
        for deck_id, title in db.query(FlashcardSet.id, FlashcardSet.title)
        .filter(FlashcardSet.id.in_({card.flashcard_set_id for card in cards}))
        .all()
    } if cards else {}
    return DueFlashcardsResponse(
        cards=[
            DueFlashcardResponse(
                **_card_response(card).model_dump(),
                flashcard_set_id=card.flashcard_set_id,
                set_title=set_titles.get(card.flashcard_set_id),
            )
            for card in cards
        ],
        total=total,
    )


@router.post("/generate", response_model=FlashcardGenerateResponse)
def generate(
    request: FlashcardGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return generate_flashcards(
            db,
            user_id=current_user.id,
            module_id=request.module_id,
            lecture_id=request.lecture_id,
            difficulty=request.difficulty,
            flashcard_count=request.flashcard_count,
        )
    except RetrievalScopeNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InsufficientFlashcardMaterial as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    except FlashcardGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The flashcard service returned invalid flashcards.",
        ) from exc
    except FlashcardPersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The generated flashcards could not be saved.",
        ) from exc
    except LLMConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The flashcard service is not configured.",
        ) from exc
    except LLMProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The flashcard service is temporarily unavailable.",
        ) from exc


@router.get("/sets", response_model=list[FlashcardSetSummaryResponse])
def list_sets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(FlashcardSet, func.count(Flashcard.id))
        .outerjoin(Flashcard, Flashcard.flashcard_set_id == FlashcardSet.id)
        .filter(FlashcardSet.user_id == current_user.id)
        .group_by(FlashcardSet.id)
        .order_by(FlashcardSet.created_at.desc(), FlashcardSet.id.desc())
        .all()
    )
    return [
        FlashcardSetSummaryResponse(
            id=deck.id,
            difficulty=deck.difficulty,
            card_count=card_count,
            module_id=deck.module_id,
            lecture_id=deck.lecture_id,
            title=deck.title,
            created_at=deck.created_at,
        )
        for deck, card_count in rows
    ]


@router.get("/sets/{set_id}", response_model=FlashcardSetDetailResponse)
def get_set(
    set_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deck = (
        db.query(FlashcardSet)
        .options(selectinload(FlashcardSet.flashcards).selectinload(Flashcard.sources))
        .filter(FlashcardSet.id == set_id, FlashcardSet.user_id == current_user.id)
        .first()
    )
    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard set not found.")
    return FlashcardSetDetailResponse(
        id=deck.id,
        difficulty=deck.difficulty,
        module_id=deck.module_id,
        lecture_id=deck.lecture_id,
        title=deck.title,
        created_at=deck.created_at,
        updated_at=deck.updated_at,
        flashcards=[_card_response(card) for card in deck.flashcards],
    )


@router.patch("/{card_id}/review", response_model=FlashcardReviewResponse)
def update_review(
    card_id: str,
    request: FlashcardReviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    card = (
        db.query(Flashcard)
        .join(FlashcardSet, Flashcard.flashcard_set_id == FlashcardSet.id)
        .filter(Flashcard.id == card_id, FlashcardSet.user_id == current_user.id)
        .first()
    )
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard not found.")
    apply_review_schedule(card, request.status)
    try:
        db.commit()
        db.refresh(card)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The flashcard review could not be saved.",
        ) from exc
    return FlashcardReviewResponse(
        id=card.id,
        review_status=card.review_status,
        reviewed_at=card.reviewed_at,
        review_count=card.review_count,
        review_streak=card.review_streak,
        interval_days=card.interval_days,
        next_review_at=card.next_review_at,
    )


@router.delete("/sets/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_set(
    set_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deck = db.query(FlashcardSet).filter(
        FlashcardSet.id == set_id, FlashcardSet.user_id == current_user.id
    ).first()
    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard set not found.")
    db.delete(deck)
    try:
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The flashcard set could not be deleted.",
        ) from exc
    return None
