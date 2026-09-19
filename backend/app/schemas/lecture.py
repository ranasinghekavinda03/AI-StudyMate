from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class LectureBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    file_type: Optional[str] = "pdf"
    file_url: Optional[str] = None
    page_count: Optional[int] = 0


class LectureCreate(LectureBase):
    module_id: str


class LectureResponse(LectureBase):
    id: str
    module_id: str
    created_at: datetime
    chunks_count: Optional[int] = 0

    model_config = {"from_attributes": True}


class LectureUploadResponse(LectureResponse):
    extracted_text: str
