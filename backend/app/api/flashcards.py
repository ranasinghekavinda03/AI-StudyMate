"""Grounded ephemeral flashcard generation routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.flashcard import FlashcardGenerateRequest, FlashcardGenerateResponse
from app.services.flashcard_generator import (
    FlashcardGenerationError,
    InsufficientFlashcardMaterial,
    generate_flashcards,
)
from app.services.llm_service import LLMConfigurationError, LLMProviderError
from app.services.retrieval_service import RetrievalScopeNotFound


router = APIRouter(prefix="/flashcards", tags=["flashcards"])


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
