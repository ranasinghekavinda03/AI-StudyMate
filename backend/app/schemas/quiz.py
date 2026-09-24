from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


Difficulty = Literal["easy", "medium", "hard"]


class QuizGenerateRequest(BaseModel):
    module_id: str | None = None
    lecture_id: str | None = None
    difficulty: Difficulty = "medium"
    question_count: int = Field(default=5, ge=1, le=20)


class GeneratedMCQ(BaseModel):
    question_text: str = Field(min_length=1)
    options: list[str] = Field(min_length=4, max_length=4)
    correct_answers: list[int] = Field(min_length=1, max_length=1)
    explanation: str = Field(min_length=1)
    source_ids: list[str] = Field(min_length=1)

    @field_validator("question_text", "explanation")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Text fields must not be blank.")
        return value

    @field_validator("options")
    @classmethod
    def validate_options(cls, options: list[str]) -> list[str]:
        cleaned = [option.strip() for option in options]
        if any(not option for option in cleaned):
            raise ValueError("Options must not be blank.")
        if len(set(cleaned)) != 4:
            raise ValueError("Options must be unique.")
        return cleaned

    @model_validator(mode="after")
    def validate_single_answer(self):
        if self.correct_answers[0] not in range(4):
            raise ValueError("The correct answer index must be between 0 and 3.")
        return self


class GeneratedQuizPayload(BaseModel):
    questions: list[GeneratedMCQ]


class QuizSourceResponse(BaseModel):
    source_id: str
    chunk_id: str
    lecture_id: str
    lecture_title: str
    module_id: str
    page_number: int | None
    chunk_index: int


class QuizQuestionResponse(BaseModel):
    id: str
    question_text: str
    options: list[str]
    correct_answers: list[int]
    explanation: str
    sources: list[QuizSourceResponse]


class QuizGenerateResponse(BaseModel):
    quiz_id: str
    difficulty: Difficulty
    questions: list[QuizQuestionResponse]
