from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.module import Module
from app.models.lecture import Lecture
from app.models.chunk import DocumentChunk
from app.schemas.lecture import LectureCreate, LectureResponse

router = APIRouter(prefix="/lectures", tags=["lectures"])


@router.get("", response_model=List[LectureResponse])
def get_lectures(
    module_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = (
        db.query(Lecture)
        .join(Module, Lecture.module_id == Module.id)
        .filter(Module.user_id == current_user.id)
    )
    if module_id:
        query = query.filter(Lecture.module_id == module_id)

    lectures = query.order_by(Lecture.created_at.desc()).all()
    results = []
    for lec in lectures:
        chunks_count = db.query(DocumentChunk).filter(DocumentChunk.lecture_id == lec.id).count()
        lec_resp = LectureResponse.model_validate(lec)
        lec_resp.chunks_count = chunks_count
        results.append(lec_resp)
    return results


@router.post("", response_model=LectureResponse, status_code=status.HTTP_201_CREATED)
def create_lecture(
    lecture_in: LectureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify module belongs to user
    module = db.query(Module).filter(Module.id == lecture_in.module_id, Module.user_id == current_user.id).first()
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module not found."
        )

    lecture = Lecture(
        title=lecture_in.title,
        module_id=lecture_in.module_id,
        file_type=lecture_in.file_type or "pdf",
        file_url=lecture_in.file_url,
        page_count=lecture_in.page_count or 0,
    )
    db.add(lecture)
    db.commit()
    db.refresh(lecture)

    lec_resp = LectureResponse.model_validate(lecture)
    lec_resp.chunks_count = 0
    return lec_resp


@router.get("/{lecture_id}", response_model=LectureResponse)
def get_lecture(
    lecture_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lecture = (
        db.query(Lecture)
        .join(Module, Lecture.module_id == Module.id)
        .filter(Lecture.id == lecture_id, Module.user_id == current_user.id)
        .first()
    )
    if not lecture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lecture not found."
        )

    chunks_count = db.query(DocumentChunk).filter(DocumentChunk.lecture_id == lecture.id).count()
    lec_resp = LectureResponse.model_validate(lecture)
    lec_resp.chunks_count = chunks_count
    return lec_resp


@router.delete("/{lecture_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lecture(
    lecture_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lecture = (
        db.query(Lecture)
        .join(Module, Lecture.module_id == Module.id)
        .filter(Lecture.id == lecture_id, Module.user_id == current_user.id)
        .first()
    )
    if not lecture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lecture not found."
        )

    db.delete(lecture)
    db.commit()
    return None
