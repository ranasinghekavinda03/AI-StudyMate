from fastapi import APIRouter
from app.api.auth import router as auth_router
from app.api.modules import router as modules_router
from app.api.lectures import router as lectures_router
from app.api.rag import router as rag_router
from app.api.quiz import router as quiz_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(modules_router)
api_router.include_router(lectures_router)
api_router.include_router(rag_router)
api_router.include_router(quiz_router)

__all__ = ["api_router"]
