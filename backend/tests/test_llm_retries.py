import json
from types import SimpleNamespace

import pytest

from app.core.config import settings
from app.services import llm_service, quiz_generator, rag_pipeline
from app.services.llm_service import LLMProviderError, generate_answer, generate_structured_answer
from app.services.retrieval_service import RetrievedChunk


class ProviderFailure(Exception):
    def __init__(self, status):
        super().__init__("provider detail must remain private")
        self.code = status


class FakeModels:
    def __init__(self, outcomes):
        self.outcomes = list(outcomes)
        self.calls = []

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return SimpleNamespace(text=outcome)


@pytest.fixture(autouse=True)
def no_retry_waits(monkeypatch):
    cached_client = llm_service._get_gemini_client
    cached_client.cache_clear()
    monkeypatch.setattr(llm_service, "_sleep", lambda _delay: None)
    monkeypatch.setattr(llm_service, "_jitter", lambda: 0.125)
    yield
    cached_client.cache_clear()


def _install_client(monkeypatch, *outcomes):
    models = FakeModels(outcomes)
    monkeypatch.setattr(
        llm_service,
        "_get_gemini_client",
        lambda: SimpleNamespace(models=models),
    )
    return models


def _answer():
    return generate_answer(system_instruction="Stay grounded.", prompt="Question")


def _structured():
    return generate_structured_answer(
        system_instruction="Return JSON.",
        prompt="Question",
        response_schema=dict,
    )


def _match(number=1):
    chunk = SimpleNamespace(
        id=f"chunk-{number}",
        lecture_id=f"lecture-{number}",
        page_number=None,
        chunk_index=number - 1,
        chunk_text=f"Grounded material {number}.",
    )
    return RetrievedChunk(
        chunk=chunk,
        lecture_title=f"Lecture {number}",
        module_id="module-1",
        score=1.0,
    )


def _quiz_payload():
    return json.dumps({
        "questions": [{
            "question_text": "Grounded question?",
            "options": ["A", "B", "C", "D"],
            "correct_answers": [1],
            "explanation": "The material supports B.",
            "source_ids": ["S1"],
        }]
    })


def test_immediate_success_uses_one_provider_call(monkeypatch):
    models = _install_client(monkeypatch, " OK ")
    assert _answer() == "OK"
    assert len(models.calls) == 1


@pytest.mark.parametrize("status", [503, 504, 429])
def test_transient_status_then_success_retries_once(monkeypatch, status):
    models = _install_client(monkeypatch, ProviderFailure(status), "Recovered")
    assert _answer() == "Recovered"
    assert len(models.calls) == 2


def test_repeated_500_stops_after_three_attempts(monkeypatch):
    models = _install_client(
        monkeypatch,
        ProviderFailure(500),
        ProviderFailure(500),
        ProviderFailure(500),
    )
    with pytest.raises(LLMProviderError, match="could not generate an answer"):
        _answer()
    assert len(models.calls) == 3


def test_404_does_not_retry(monkeypatch):
    models = _install_client(monkeypatch, ProviderFailure(404))
    with pytest.raises(LLMProviderError):
        _answer()
    assert len(models.calls) == 1


def test_invalid_model_failure_does_not_retry(monkeypatch):
    models = _install_client(monkeypatch, ProviderFailure(404))
    with pytest.raises(LLMProviderError):
        _structured()
    assert len(models.calls) == 1


@pytest.mark.parametrize("status", [401, 403])
def test_invalid_api_key_status_does_not_retry(monkeypatch, status):
    models = _install_client(monkeypatch, ProviderFailure(status))
    with pytest.raises(LLMProviderError):
        _answer()
    assert len(models.calls) == 1


def test_empty_text_then_success_retries(monkeypatch):
    models = _install_client(monkeypatch, "   ", "Usable")
    assert _answer() == "Usable"
    assert len(models.calls) == 2


def test_repeated_empty_structured_text_stops_after_three_attempts(monkeypatch):
    models = _install_client(monkeypatch, None, " ", "")
    with pytest.raises(LLMProviderError, match="structured output"):
        _structured()
    assert len(models.calls) == 3


def test_backoff_is_exponential_with_bounded_jitter(monkeypatch):
    delays = []
    monkeypatch.setattr(llm_service, "_sleep", delays.append)
    models = _install_client(monkeypatch, ProviderFailure(503), ProviderFailure(504), "OK")
    assert _answer() == "OK"
    assert len(models.calls) == 3
    assert delays == [1.125, 2.125]


def test_configured_timeout_and_single_sdk_attempt_are_passed_to_client(monkeypatch):
    from google import genai

    captured = {}

    def fake_client(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace()

    monkeypatch.setattr(settings, "LLM_TIMEOUT_SECONDS", 60)
    monkeypatch.setattr(genai, "Client", fake_client)
    llm_service._get_gemini_client.cache_clear()
    llm_service._get_gemini_client()

    assert captured["http_options"].timeout == 60_000
    assert captured["http_options"].retry_options.attempts == 1
    assert captured["api_key"] == settings.LLM_API_KEY


def test_rag_endpoint_succeeds_on_third_provider_attempt(client, auth_headers, monkeypatch):
    headers, _ = auth_headers
    monkeypatch.setattr(rag_pipeline, "retrieve_chunks", lambda *args, **kwargs: [_match()])
    models = _install_client(
        monkeypatch,
        ProviderFailure(503),
        ProviderFailure(504),
        "Grounded answer [S1]",
    )

    response = client.post("/api/v1/rag/chat", headers=headers, json={"question": "Question"})

    assert response.status_code == 200
    assert response.json()["answer"] == "Grounded answer [S1]"
    assert len(models.calls) == 3


def test_quiz_endpoint_succeeds_after_transient_failure(client, auth_headers, monkeypatch):
    headers, _ = auth_headers
    monkeypatch.setattr(quiz_generator, "retrieve_scoped_chunks", lambda *args, **kwargs: [_match()])
    models = _install_client(monkeypatch, ProviderFailure(503), _quiz_payload())

    response = client.post(
        "/api/v1/quiz/generate",
        headers=headers,
        json={"difficulty": "medium", "question_count": 1},
    )

    assert response.status_code == 200
    assert response.json()["questions"][0]["correct_answers"] == [1]
    assert len(models.calls) == 2


def test_exhausted_rag_retries_keep_safe_http_error(client, auth_headers, monkeypatch):
    headers, _ = auth_headers
    monkeypatch.setattr(rag_pipeline, "retrieve_chunks", lambda *args, **kwargs: [_match()])
    models = _install_client(
        monkeypatch,
        ProviderFailure(503),
        ProviderFailure(503),
        ProviderFailure(503),
    )

    response = client.post("/api/v1/rag/chat", headers=headers, json={"question": "Question"})

    assert response.status_code == 502
    assert response.json()["detail"] == "The answer service is temporarily unavailable."
    assert "provider detail" not in response.text
    assert len(models.calls) == 3


def test_exhausted_quiz_retries_keep_safe_http_error(client, auth_headers, monkeypatch):
    headers, _ = auth_headers
    monkeypatch.setattr(quiz_generator, "retrieve_scoped_chunks", lambda *args, **kwargs: [_match()])
    models = _install_client(
        monkeypatch,
        ProviderFailure(500),
        ProviderFailure(500),
        ProviderFailure(500),
    )

    response = client.post(
        "/api/v1/quiz/generate",
        headers=headers,
        json={"difficulty": "medium", "question_count": 1},
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "The quiz service is temporarily unavailable."
    assert "provider detail" not in response.text
    assert len(models.calls) == 3
