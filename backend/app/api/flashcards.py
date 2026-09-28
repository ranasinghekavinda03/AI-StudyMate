"""Grounded flashcard generation, persistence, and review routes."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, get_db
from app.models.flashcard import Flashcard, FlashcardSet
from app.models.user import User
from app.schemas.flashcard import (
    FlashcardGenerateRequest,
    FlashcardGenerateResponse,
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
    card.review_status = request.status
    card.reviewed_at = datetime.now(timezone.utc)
    card.review_count += 1
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
