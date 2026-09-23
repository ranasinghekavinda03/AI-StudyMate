from pydantic import BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    question: str = Field(min_length=1)
    module_id: str | None = None
    lecture_id: str | None = None
    top_k: int | None = None


class CitationResponse(BaseModel):
    source_id: str
    chunk_id: str
    lecture_id: str
    lecture_title: str
    module_id: str
    page_number: int | None
    chunk_index: int
    excerpt: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[CitationResponse]
