import json
from types import SimpleNamespace

import pytest

from app.core.config import settings
from app.services import flashcard_generator, llm_service
from app.services.flashcard_generator import (
    FLASHCARD_CONTEXT_CHUNK_LIMIT,
    FlashcardGenerationError,
    InsufficientFlashcardMaterial,
    build_flashcard_prompt,
    generate_flashcards,
)
from app.services.retrieval_service import RetrievedChunk


class ProviderFailure(Exception):
    def __init__(self, status):
        super().__init__("private provider detail")
        self.code = status


class FakeModels:
    def __init__(self, outcomes):
        self.outcomes = list(outcomes)
        self.calls = 0

    def generate_content(self, **_kwargs):
        self.calls += 1
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return SimpleNamespace(text=outcome)


def _match(number=1, *, page_number=None, lecture_id=None, module_id="module-1"):
    chunk = SimpleNamespace(
        id=f"chunk-{number}",
        lecture_id=lecture_id or f"lecture-{number}",
        page_number=page_number,
        chunk_index=number - 1,
        chunk_text=f"Grounded concept {number} with an explanation.",
    )
    return RetrievedChunk(
        chunk=chunk, lecture_title=f"Lecture {number}", module_id=module_id, score=1.0
    )


def _payload(count=1, *, source_ids=None, fronts=None, backs=None):
    return json.dumps({
        "flashcards": [
            {
                "front": fronts[index] if fronts else f"What is grounded concept {index + 1}?",
                "back": backs[index] if backs else f"Grounded concept {index + 1} is explained by the material.",
                "source_ids": source_ids or ["S1"],
            }
            for index in range(count)
        ]
    })


def _stub_generation(monkeypatch, output, *, matches=None, capture=None):
    monkeypatch.setattr(
        flashcard_generator,
        "collect_summary_chunks",
        lambda *args, **kwargs: (
            [_match(1, page_number=8), _match(2, page_number=None)]
            if matches is None else matches
        ),
    )

    def generate(**kwargs):
        if capture is not None:
            capture.update(kwargs)
        return output

    monkeypatch.setattr(flashcard_generator, "generate_structured_answer", generate)


def test_valid_easy_deck_returns_exact_count_and_grounded_sources(monkeypatch):
    _stub_generation(monkeypatch, _payload(5))
    result = generate_flashcards(
        SimpleNamespace(), user_id="user-1", difficulty="easy", flashcard_count=5
    )
    assert result.difficulty == "easy"
    assert result.flashcard_set_id
    assert len(result.flashcards) == 5
    assert all(card.front and card.back and card.sources for card in result.flashcards)


def test_medium_and_hard_prompts_include_specific_guidance_and_coverage_limit():
    sources = [("S1", _match())]
    medium = build_flashcard_prompt(
        difficulty="medium", flashcard_count=5, sources=sources, context_was_limited=False
    )
    hard = build_flashcard_prompt(
        difficulty="hard", flashcard_count=5, sources=sources, context_was_limited=True
    )
    assert "concept relationships, comparisons, and applied understanding" in medium
    assert "reasoning prompts, meaningful distinctions, and scenario-based recall" in hard
    assert "do not use trivia" in hard
    assert f"{FLASHCARD_CONTEXT_CHUNK_LIMIT}-chunk context limit" in hard
    assert "do not claim full coverage" in hard


def test_request_defaults_validation_and_authentication(client, auth_headers):
    assert client.post("/api/v1/flashcards/generate", json={}).status_code == 401
    headers, _ = auth_headers
    for count in (0, 31):
        response = client.post(
            "/api/v1/flashcards/generate", headers=headers, json={"flashcard_count": count}
        )
        assert response.status_code == 422
    response = client.post(
        "/api/v1/flashcards/generate", headers=headers, json={"difficulty": "expert"}
    )
    assert response.status_code == 422


def test_flashcard_scope_enforces_module_and_lecture_ownership(client, auth_headers):
    headers_a, _ = auth_headers
    register_b = client.post(
        "/api/v1/auth/register",
        json={"name": "Owner B", "email": "flashcard-b@studymate.ai", "password": "Password123!", "role": "student"},
    )
    headers_b = {"Authorization": f"Bearer {register_b.json()['access_token']}"}
    module_b = client.post(
        "/api/v1/modules", headers=headers_b, json={"title": "Private Flashcard Module"}
    ).json()["id"]
    lecture_b = client.post(
        "/api/v1/lectures",
        headers=headers_b,
        json={"title": "Private Lecture", "module_id": module_b, "file_type": "txt"},
    ).json()["id"]
    assert client.post(
        "/api/v1/flashcards/generate", headers=headers_a, json={"module_id": module_b}
    ).status_code == 404
    assert client.post(
        "/api/v1/flashcards/generate", headers=headers_a, json={"lecture_id": lecture_b}
    ).status_code == 404


def test_valid_source_ids_map_to_trusted_metadata_and_preserve_pages(monkeypatch):
    _stub_generation(monkeypatch, _payload(source_ids=["S2", "S1", "S2"]))
    result = generate_flashcards(
        SimpleNamespace(), user_id="user-1", difficulty="medium", flashcard_count=1
    )
    sources = result.flashcards[0].sources
    assert [source.source_id for source in sources] == ["S2", "S1"]
    assert sources[0].chunk_id == "chunk-2"
    assert sources[0].lecture_title == "Lecture 2"
    assert sources[0].page_number is None
    assert sources[1].page_number == 8


def test_any_invalid_source_id_rejects_whole_output(monkeypatch):
    _stub_generation(monkeypatch, _payload(source_ids=["S1", "S99"]))
    with pytest.raises(FlashcardGenerationError, match="untrusted flashcard source"):
        generate_flashcards(
            SimpleNamespace(), user_id="user-1", difficulty="medium", flashcard_count=1
        )


@pytest.mark.parametrize(
    "fronts,backs",
    [
        (["Same prompt", " same   PROMPT "], ["Answer one", "Answer two"]),
        (["Same prompt", "same prompt"], ["Same answer", "same answer"]),
    ],
)
def test_duplicate_fronts_or_pairs_are_rejected(monkeypatch, fronts, backs):
    _stub_generation(monkeypatch, _payload(2, fronts=fronts, backs=backs))
    with pytest.raises(FlashcardGenerationError, match="invalid flashcard structure"):
        generate_flashcards(
            SimpleNamespace(), user_id="user-1", difficulty="hard", flashcard_count=2
        )


@pytest.mark.parametrize(
    "output",
    [
        "not json",
        json.dumps({"flashcards": [{"front": "", "back": "Answer", "source_ids": ["S1"]}]}),
        json.dumps({"flashcards": [{"front": "Prompt", "back": " ", "source_ids": ["S1"]}]}),
        json.dumps({"flashcards": [{"front": "Prompt", "back": "Answer", "source_ids": []}]}),
    ],
)
def test_malformed_provider_output_fails_safely(monkeypatch, output):
    _stub_generation(monkeypatch, output)
    with pytest.raises(FlashcardGenerationError, match="invalid flashcard structure"):
        generate_flashcards(
            SimpleNamespace(), user_id="user-1", difficulty="medium", flashcard_count=1
        )


def test_wrong_provider_card_count_is_insufficient_material(monkeypatch):
    _stub_generation(monkeypatch, _payload(1))
    with pytest.raises(InsufficientFlashcardMaterial):
        generate_flashcards(
            SimpleNamespace(), user_id="user-1", difficulty="medium", flashcard_count=2
        )


def test_insufficient_material_returns_422_without_provider_call(client, auth_headers, monkeypatch):
    headers, _ = auth_headers
    monkeypatch.setattr(flashcard_generator, "collect_summary_chunks", lambda *args, **kwargs: [])
    monkeypatch.setattr(
        flashcard_generator,
        "generate_structured_answer",
        lambda **kwargs: (_ for _ in ()).throw(AssertionError("provider must not be called")),
    )
    response = client.post("/api/v1/flashcards/generate", headers=headers, json={})
    assert response.status_code == 422
    assert response.json()["detail"] == "Not enough study material is available to generate flashcards."


def _install_retry_path(monkeypatch, *outcomes):
    models = FakeModels(outcomes)
    monkeypatch.setattr(llm_service, "_get_gemini_client", lambda: SimpleNamespace(models=models))
    monkeypatch.setattr(llm_service, "_sleep", lambda _delay: None)
    monkeypatch.setattr(llm_service, "_jitter", lambda: 0.0)
    monkeypatch.setattr(flashcard_generator, "collect_summary_chunks", lambda *args, **kwargs: [_match()])
    return models


def test_transient_provider_failure_recovers_through_shared_retry_layer(client, auth_headers, monkeypatch):
    headers, _ = auth_headers
    models = _install_retry_path(monkeypatch, ProviderFailure(503), _payload(1))
    response = client.post(
        "/api/v1/flashcards/generate",
        headers=headers,
        json={"difficulty": "medium", "flashcard_count": 1},
    )
    assert response.status_code == 200
    assert len(response.json()["flashcards"]) == 1
    assert models.calls == 2


def test_exhausted_provider_retries_return_safe_502(client, auth_headers, monkeypatch):
    headers, _ = auth_headers
    models = _install_retry_path(
        monkeypatch, ProviderFailure(503), ProviderFailure(503), ProviderFailure(503)
    )
    response = client.post(
        "/api/v1/flashcards/generate",
        headers=headers,
        json={"difficulty": "medium", "flashcard_count": 1},
    )
    assert response.status_code == 502
    assert response.json()["detail"] == "The flashcard service is temporarily unavailable."
    assert "private provider detail" not in response.text
    assert models.calls == 3


def test_endpoint_returns_ephemeral_ids_and_no_embeddings(client, auth_headers, tmp_path, monkeypatch):
    headers, _ = auth_headers
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    module_id = client.post(
        "/api/v1/modules", headers=headers, json={"title": "Flashcard Module"}
    ).json()["id"]
    lecture = client.post(
        "/api/v1/lectures/upload",
        headers=headers,
        data={"module_id": module_id, "title": "Flashcard Notes"},
        files={"file": ("cards.txt", b"Regularization reduces overfitting in trained models.", "text/plain")},
    ).json()
    monkeypatch.setattr(flashcard_generator, "generate_structured_answer", lambda **kwargs: _payload(1))
    response = client.post(
        "/api/v1/flashcards/generate",
        headers=headers,
        json={"lecture_id": lecture["id"], "difficulty": "medium", "flashcard_count": 1},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["flashcard_set_id"]
    assert body["flashcards"][0]["id"]
    assert body["flashcards"][0]["sources"][0]["lecture_id"] == lecture["id"]
    assert body["flashcards"][0]["sources"][0]["page_number"] is None
    assert "embedding" not in response.text
