"""Development semantic retrieval routes (no answer generation)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.retrieval import RetrievalRequest, RetrievalResponse, RetrievalResult
from app.schemas.rag import ChatRequest, ChatResponse, CitationResponse
from app.services.embedding_service import EmbeddingError
from app.services.llm_service import LLMConfigurationError, LLMProviderError
from app.services.rag_pipeline import answer_question
from app.services.retrieval_service import RetrievalScopeNotFound, retrieve_chunks

router = APIRouter(prefix="/rag", tags=["retrieval"])


@router.post("/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        result = answer_question(
            db,
            user_id=current_user.id,
            question=request.question,
            module_id=request.module_id,
            lecture_id=request.lecture_id,
            top_k=request.top_k,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    except RetrievalScopeNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except EmbeddingError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Query embedding failed.") from exc
    except LLMConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The answer service is not configured.",
        ) from exc
    except LLMProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The answer service is temporarily unavailable.",
        ) from exc

    return ChatResponse(
        answer=result.answer,
        citations=[CitationResponse(**citation.__dict__) for citation in result.citations],
    )


@router.post("/retrieve", response_model=RetrievalResponse)
def retrieve(
    request: RetrievalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        matches = retrieve_chunks(
            db,
            user_id=current_user.id,
            query_text=request.query,
            module_id=request.module_id,
            lecture_id=request.lecture_id,
            top_k=request.top_k,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    except RetrievalScopeNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except EmbeddingError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Query embedding failed.",
        ) from exc

    return RetrievalResponse(
        query=request.query,
        results=[
            RetrievalResult(
                chunk_id=match.chunk.id,
                lecture_id=match.chunk.lecture_id,
                lecture_title=match.lecture_title,
                module_id=match.module_id,
                page_number=match.chunk.page_number,
                chunk_index=match.chunk.chunk_index,
                chunk_text=match.chunk.chunk_text,
                score=match.score,
            )
            for match in matches
        ],
    )
