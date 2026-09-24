import json
from types import SimpleNamespace

import pytest

from app.core.config import settings
from app.models.quiz import Question, Quiz
from app.services import quiz_generator
from app.services.quiz_generator import (
    InsufficientQuizMaterial,
    QuizGenerationError,
    build_quiz_prompt,
    generate_quiz,
)
from app.services.retrieval_service import RetrievedChunk


def _match(number, *, page_number=None, module_id="module-1", lecture_id=None):
    chunk = SimpleNamespace(
        id=f"chunk-{number}",
        lecture_id=lecture_id or f"lecture-{number}",
        page_number=page_number,
        chunk_index=number - 1,
        chunk_text=f"Grounded study material concept {number}.",
    )
    return RetrievedChunk(chunk=chunk, lecture_title=f"Lecture {number}", module_id=module_id, score=1.0)


def _payload(count=1, *, source_ids=None, options=None, correct_answers=None):
    return json.dumps({
        "questions": [
            {
                "question_text": f"Grounded question {index + 1}?",
                "options": options or ["Option A", "Option B", "Option C", "Option D"],
                "correct_answers": correct_answers or [1],
                "explanation": "The supplied material supports option B.",
                "source_ids": source_ids or ["S1"],
            }
            for index in range(count)
        ]
    })


def _stub_generation(monkeypatch, output, matches=None, capture=None):
    monkeypatch.setattr(
        quiz_generator,
        "retrieve_scoped_chunks",
        lambda *args, **kwargs: [_match(1, page_number=18), _match(2, page_number=None)] if matches is None else matches,
    )

    def generate(**kwargs):
        if capture is not None:
            capture.update(kwargs)
        return output

    monkeypatch.setattr(quiz_generator, "generate_structured_answer", generate)


def test_valid_easy_quiz_has_requested_single_answer_questions(monkeypatch):
    _stub_generation(monkeypatch, _payload(3))
    result = generate_quiz(SimpleNamespace(), user_id="user-1", difficulty="easy", question_count=3)
    assert result.difficulty == "easy"
    assert len(result.questions) == 3
    assert all(len(question.options) == 4 for question in result.questions)
    assert all(len(question.correct_answers) == 1 for question in result.questions)
    assert all(question.correct_answers == [1] for question in result.questions)


def test_medium_and_hard_prompt_guidance():
    sources = [("S1", _match(1))]
    medium = build_quiz_prompt(difficulty="medium", question_count=2, sources=sources)
    hard = build_quiz_prompt(difficulty="hard", question_count=2, sources=sources)
    assert "application, comparison, interpretation" in medium
    assert "scenario-based reasoning" in hard
    assert "exactly four" in medium
    assert "zero-based" in medium


def test_source_mapping_uses_trusted_metadata_and_filters_invalid_ids(monkeypatch):
    _stub_generation(monkeypatch, _payload(source_ids=["S2", "S99", "S1", "S2"]))
    result = generate_quiz(SimpleNamespace(), user_id="user-1", difficulty="medium", question_count=1)
    sources = result.questions[0].sources
    assert [source.source_id for source in sources] == ["S2", "S1"]
    assert sources[0].chunk_id == "chunk-2"
    assert sources[0].lecture_title == "Lecture 2"
    assert sources[0].page_number is None
    assert sources[1].page_number == 18
    assert all(source.source_id != "S99" for source in sources)


def test_all_invalid_source_ids_are_rejected(monkeypatch):
    _stub_generation(monkeypatch, _payload(source_ids=["S99"]))
    with pytest.raises(QuizGenerationError, match="valid study source"):
        generate_quiz(SimpleNamespace(), user_id="user-1", difficulty="medium", question_count=1)


@pytest.mark.parametrize(
    "output",
    [
        "not json",
        _payload(options=["A", "B", "C"]),
        _payload(options=["A", "B", "C", "D", "E"]),
        _payload(correct_answers=[0, 1]),
    ],
)
def test_malformed_wrong_option_count_and_multiple_answers_are_rejected(monkeypatch, output):
    _stub_generation(monkeypatch, output)
    with pytest.raises(QuizGenerationError, match="invalid quiz structure"):
        generate_quiz(SimpleNamespace(), user_id="user-1", difficulty="medium", question_count=1)


def test_insufficient_material_never_calls_provider(monkeypatch):
    monkeypatch.setattr(quiz_generator, "retrieve_scoped_chunks", lambda *args, **kwargs: [])
    monkeypatch.setattr(
        quiz_generator,
        "generate_structured_answer",
        lambda **kwargs: (_ for _ in ()).throw(AssertionError("provider must not be called")),
    )
    with pytest.raises(InsufficientQuizMaterial):
        generate_quiz(SimpleNamespace(), user_id="user-1", difficulty="medium", question_count=3)


def test_request_validation_and_authentication(client, auth_headers):
    assert client.post("/api/v1/quiz/generate", json={}).status_code == 401
    headers, _ = auth_headers
    for count in (0, 21):
        response = client.post("/api/v1/quiz/generate", headers=headers, json={"question_count": count})
        assert response.status_code == 422
    response = client.post("/api/v1/quiz/generate", headers=headers, json={"difficulty": "impossible"})
    assert response.status_code == 422


def test_quiz_scope_enforces_user_ownership(client, auth_headers):
    headers_a, _ = auth_headers
    register_b = client.post(
        "/api/v1/auth/register",
        json={"name": "Quiz Owner B", "email": "quiz-b@studymate.ai", "password": "Password123!", "role": "student"},
    )
    headers_b = {"Authorization": f"Bearer {register_b.json()['access_token']}"}
    module_b = client.post("/api/v1/modules", headers=headers_b, json={"title": "Private Quiz Module"}).json()["id"]
    lecture_b = client.post(
        "/api/v1/lectures",
        headers=headers_b,
        json={"title": "Private Lecture", "module_id": module_b, "file_type": "txt"},
    ).json()["id"]
    assert client.post("/api/v1/quiz/generate", headers=headers_a, json={"module_id": module_b}).status_code == 404
    assert client.post("/api/v1/quiz/generate", headers=headers_a, json={"lecture_id": lecture_b}).status_code == 404


def test_generate_endpoint_and_response_only_persistence(client, auth_headers, db_session, tmp_path, monkeypatch):
    headers, _ = auth_headers
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    module_id = client.post("/api/v1/modules", headers=headers, json={"title": "Quiz Module"}).json()["id"]
    lecture = client.post(
        "/api/v1/lectures/upload",
        headers=headers,
        data={"module_id": module_id, "title": "Quiz Lecture"},
        files={"file": ("quiz.txt", b"Early stopping reduces overfitting using validation performance.", "text/plain")},
    ).json()
    monkeypatch.setattr(quiz_generator, "generate_structured_answer", lambda **kwargs: _payload(1))

    response = client.post(
        "/api/v1/quiz/generate",
        headers=headers,
        json={"lecture_id": lecture["id"], "difficulty": "medium", "question_count": 1},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["quiz_id"]
    assert body["questions"][0]["sources"][0]["lecture_id"] == lecture["id"]
    assert db_session.query(Quiz).count() == 0
    assert db_session.query(Question).count() == 0
