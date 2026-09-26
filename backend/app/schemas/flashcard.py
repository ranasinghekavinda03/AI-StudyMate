from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


Difficulty = Literal["easy", "medium", "hard"]


class FlashcardGenerateRequest(BaseModel):
    module_id: str | None = None
    lecture_id: str | None = None
    flashcard_count: int = Field(default=10, ge=1, le=30)
    difficulty: Difficulty = "medium"


class GeneratedFlashcard(BaseModel):
    front: str = Field(min_length=1)
    back: str = Field(min_length=1)
    source_ids: list[str] = Field(min_length=1)

    @field_validator("front", "back")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Flashcard text must not be blank.")
        return value


class GeneratedFlashcardPayload(BaseModel):
    flashcards: list[GeneratedFlashcard]

    @model_validator(mode="after")
    def cards_must_be_unique(self):
        fronts: set[str] = set()
        pairs: set[tuple[str, str]] = set()
        for card in self.flashcards:
            front = " ".join(card.front.casefold().split())
            back = " ".join(card.back.casefold().split())
            pair = (front, back)
            if front in fronts or pair in pairs:
                raise ValueError("Flashcards must not contain duplicate prompts or pairs.")
            fronts.add(front)
            pairs.add(pair)
        return self


class FlashcardSourceResponse(BaseModel):
    source_id: str
    chunk_id: str
    lecture_id: str
    lecture_title: str
    module_id: str
    page_number: int | None
    chunk_index: int


class FlashcardResponse(BaseModel):
    id: str
    front: str
    back: str
    sources: list[FlashcardSourceResponse]


class FlashcardGenerateResponse(BaseModel):
    flashcard_set_id: str
    difficulty: Difficulty
    flashcards: list[FlashcardResponse]
