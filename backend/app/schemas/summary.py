from typing import Literal

from pydantic import BaseModel, Field, field_validator


SummaryType = Literal["short", "standard", "detailed"]


class SummaryGenerateRequest(BaseModel):
    module_id: str | None = None
    lecture_id: str | None = None
    summary_type: SummaryType = "standard"


class GeneratedSummaryPoint(BaseModel):
    text: str = Field(min_length=1)
    source_ids: list[str] = Field(min_length=1)

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Summary text must not be blank.")
        return value


class GeneratedImportantTerm(BaseModel):
    term: str = Field(min_length=1)
    definition: str = Field(min_length=1)
    source_ids: list[str] = Field(min_length=1)

    @field_validator("term", "definition")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Important-term fields must not be blank.")
        return value


class GeneratedSummaryPayload(BaseModel):
    title: str = Field(min_length=1)
    overview: str = Field(min_length=1)
    key_points: list[GeneratedSummaryPoint] = Field(min_length=1)
    important_terms: list[GeneratedImportantTerm] = Field(default_factory=list)
    concept_relationships: list[GeneratedSummaryPoint] = Field(default_factory=list)

    @field_validator("title", "overview")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Summary fields must not be blank.")
        return value


class SummarySourceResponse(BaseModel):
    source_id: str
    chunk_id: str
    lecture_id: str
    lecture_title: str
    module_id: str
    page_number: int | None
    chunk_index: int


class SummaryGenerateResponse(BaseModel):
    summary_type: SummaryType
    title: str
    overview: str
    key_points: list[GeneratedSummaryPoint]
    important_terms: list[GeneratedImportantTerm]
    concept_relationships: list[GeneratedSummaryPoint]
    sources: list[SummarySourceResponse]
