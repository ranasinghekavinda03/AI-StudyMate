from pathlib import Path
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.module import Module
from app.models.lecture import Lecture
from app.models.chunk import DocumentChunk
from app.core.config import BACKEND_DIR, settings
from app.schemas.lecture import LectureCreate, LectureResponse, LectureUploadResponse
from app.services.document_extractor import DocumentExtractionError, extract_document
from app.services.document_ingestion import chunk_document
from app.services.embedding_service import EmbeddingError, embed_texts
from app.services.upload_storage import collect_unshared_upload_paths, remove_upload_file

router = APIRouter(prefix="/lectures", tags=["lectures"])
MAX_UPLOAD_SIZE = 25 * 1024 * 1024
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt"}


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


@router.post("/upload", response_model=LectureUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_lecture(
    module_id: str = Form(...),
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a lecture file, extract its text, and save its metadata."""
    module = db.query(Module).filter(Module.id == module_id, Module.user_id == current_user.id).first()
    if not module:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found.")

    original_name = Path(file.filename or "").name
    extension = Path(original_name).suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type. Upload a PDF, DOCX, or TXT file.",
        )

    contents = bytearray()
    while chunk := await file.read(1024 * 1024):
        contents.extend(chunk)
        if len(contents) > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File exceeds the 25 MB upload limit.",
            )

    if not contents:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="The uploaded file is empty.")

    try:
        extracted = extract_document(bytes(contents), original_name)
    except DocumentExtractionError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc

    lecture_title = (title or Path(original_name).stem).strip()
    if not 2 <= len(lecture_title) <= 255:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Title must contain between 2 and 255 characters.",
        )

    chunks = chunk_document(
        extracted,
        chunk_size_words=settings.CHUNK_SIZE_WORDS,
        chunk_overlap_words=settings.CHUNK_OVERLAP_WORDS,
    )
    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="No usable text chunks could be created from the document.",
        )

    try:
        embeddings = embed_texts([chunk.chunk_text for chunk in chunks])
    except EmbeddingError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Document embedding failed; no lecture or chunks were saved.",
        ) from exc

    upload_dir = Path(settings.UPLOAD_DIR)
    if not upload_dir.is_absolute():
        upload_dir = BACKEND_DIR / upload_dir
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_path = upload_dir / f"{uuid4().hex}{extension}"
    try:
        file_url = str(stored_path.relative_to(BACKEND_DIR)).replace("\\", "/")
    except ValueError:
        file_url = str(stored_path)

    try:
        stored_path.write_bytes(contents)
        lecture = Lecture(
            title=lecture_title,
            module_id=module_id,
            file_type=extension.lstrip("."),
            file_url=file_url,
            page_count=extracted.page_count,
        )
        db.add(lecture)
        db.flush()
        db.add_all([
            DocumentChunk(
                lecture_id=lecture.id,
                page_number=chunk.page_number,
                chunk_index=chunk.chunk_index,
                chunk_text=chunk.chunk_text,
                embedding=embedding,
            )
            for chunk, embedding in zip(chunks, embeddings)
        ])
        db.commit()
        db.refresh(lecture)
    except SQLAlchemyError as exc:
        db.rollback()
        stored_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Document ingestion failed; no lecture or chunks were saved.",
        ) from exc
    except Exception:
        db.rollback()
        stored_path.unlink(missing_ok=True)
        raise

    lecture_data = LectureResponse.model_validate(lecture).model_dump()
    lecture_data["chunks_count"] = len(chunks)
    return LectureUploadResponse(**lecture_data, extracted_text=extracted.text)


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

    other_file_urls = (
        file_url
        for (file_url,) in db.query(Lecture.file_url)
        .filter(Lecture.id != lecture.id, Lecture.file_url.isnot(None))
        .all()
    )
    cleanup_paths = collect_unshared_upload_paths([lecture.file_url], other_file_urls)

    db.delete(lecture)
    db.commit()
    for path in cleanup_paths:
        remove_upload_file(path)
    return None
