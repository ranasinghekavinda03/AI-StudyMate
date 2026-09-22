from pydantic import BaseModel, ConfigDict, Field


class RetrievalRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    query: str = Field(min_length=1)
    module_id: str | None = None
    lecture_id: str | None = None
    top_k: int | None = None


class RetrievalResult(BaseModel):
    chunk_id: str
    lecture_id: str
    lecture_title: str
    module_id: str
    page_number: int | None
    chunk_index: int
    chunk_text: str
    score: float


class RetrievalResponse(BaseModel):
    query: str
    results: list[RetrievalResult]
