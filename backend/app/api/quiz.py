"""Grounded MCQ generation routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.quiz import QuizGenerateRequest, QuizGenerateResponse
from app.services.llm_service import LLMConfigurationError, LLMProviderError
from app.services.quiz_generator import InsufficientQuizMaterial, QuizGenerationError, generate_quiz
from app.services.retrieval_service import RetrievalScopeNotFound

router = APIRouter(prefix="/quiz", tags=["quiz"])


@router.post("/generate", response_model=QuizGenerateResponse)
def generate(
    request: QuizGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return generate_quiz(
            db,
            user_id=current_user.id,
            module_id=request.module_id,
            lecture_id=request.lecture_id,
            difficulty=request.difficulty,
            question_count=request.question_count,
        )
    except RetrievalScopeNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InsufficientQuizMaterial as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    except QuizGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The answer service returned an invalid quiz.",
        ) from exc
    except LLMConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The quiz service is not configured.") from exc
    except LLMProviderError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="The quiz service is temporarily unavailable.") from exc
