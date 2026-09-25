"""Grounded study-summary generation routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.summary import SummaryGenerateRequest, SummaryGenerateResponse
from app.services.llm_service import LLMConfigurationError, LLMProviderError
from app.services.retrieval_service import RetrievalScopeNotFound
from app.services.summary_generator import (
    InsufficientSummaryMaterial,
    SummaryGenerationError,
    generate_summary,
)

router = APIRouter(prefix="/summaries", tags=["summaries"])


@router.post("/generate", response_model=SummaryGenerateResponse)
def generate(
    request: SummaryGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return generate_summary(
            db,
            user_id=current_user.id,
            module_id=request.module_id,
            lecture_id=request.lecture_id,
            summary_type=request.summary_type,
        )
    except RetrievalScopeNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InsufficientSummaryMaterial as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    except SummaryGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The summary service returned an invalid summary.",
        ) from exc
    except LLMConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The summary service is not configured.",
        ) from exc
    except LLMProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The summary service is temporarily unavailable.",
        ) from exc
