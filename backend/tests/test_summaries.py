import json
from types import SimpleNamespace

import pytest

from app.models.chunk import DocumentChunk
from app.models.lecture import Lecture
from app.services import llm_service, summary_generator
from app.services.llm_service import LLMProviderError
from app.services.retrieval_service import RetrievedChunk
from app.services.summary_generator import (
    InsufficientSummaryMaterial,
    SummaryGenerationError,
    build_summary_prompt,
    generate_summary,
)


class ProviderFailure(Exception):
    def __init__(self, status):
        super().__init__("provider detail must remain private")
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
        chunk_text=f"Trusted study concept {number} and its definition.",
    )
    return RetrievedChunk(
        chunk=chunk,
        lecture_title=f"Lecture {number}",
        module_id=module_id,
        score=1.0,
    )


def _payload(*, source_id="S1", include_terms=True):
    return json.dumps({
        "title": "Grounded Study Summary",
        "overview": "The material introduces a trusted study concept.",
        "key_points": [{"text": "The concept is defined in the lecture.", "source_ids": [source_id]}],
        "important_terms": ([{
            "term": "Study concept",
            "definition": "A concept defined by the uploaded material.",
            "source_ids": [source_id],
        }] if include_terms else []),
        "concept_relationships": [{
            "text": "The concept and its definition are connected.",
            "source_ids": [source_id],
        }],
    })


def _stub_summary(monkeypatch, output, matches=None):
    monkeypatch.setattr(
        summary_generator,
        "collect_summary_chunks",
        lambda *args, **kwargs: [_match(1, page_number=18), _match(2)] if matches is None else matches,
    )
    monkeypatch.setattr(summary_generator, "generate_structured_answer", lambda **kwargs: output)


@pytest.mark.parametrize("summary_type", ["short", "standard", "detailed"])
def test_valid_summary_types_are_structured_and_grounded(monkeypatch, summary_type):
    _stub_summary(monkeypatch, _payload(include_terms=summary_type != "short"))
    result = generate_summary(SimpleNamespace(), user_id="user-1", summary_type=summary_type)
    assert result.summary_type == summary_type
    assert result.title == "Grounded Study Summary"
    assert result.overview
    assert result.key_points[0].source_ids == ["S1"]
    assert len(result.important_terms) == (0 if summary_type == "short" else 1)


def test_invalid_summary_type_is_rejected_by_endpoint(client, auth_headers):
    headers, _ = auth_headers
    response = client.post(
        "/api/v1/summaries/generate",
        headers=headers,
        json={"summary_type": "extreme"},
    )
    assert response.status_code == 422


def test_lecture_and_module_ownership_are_enforced(client, auth_headers):
    owner_headers, _ = auth_headers
    other = client.post(
        "/api/v1/auth/register",
        json={"name": "Other", "email": "summary-other@example.com", "password": "Password123!", "role": "student"},
    )
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}
    module_id = client.post("/api/v1/modules", headers=other_headers, json={"title": "Private"}).json()["id"]
    lecture_id = client.post(
        "/api/v1/lectures",
        headers=other_headers,
        json={"module_id": module_id, "title": "Private Lecture", "file_type": "txt"},
    ).json()["id"]

    module_response = client.post(
        "/api/v1/summaries/generate", headers=owner_headers,
        json={"module_id": module_id, "summary_type": "standard"},
    )
    lecture_response = client.post(
        "/api/v1/summaries/generate", headers=owner_headers,
        json={"lecture_id": lecture_id, "summary_type": "standard"},
    )
    assert module_response.status_code == 404
    assert module_response.json()["detail"] == "Module not found."
    assert lecture_response.status_code == 404
    assert lecture_response.json()["detail"] == "Lecture not found."


def test_trusted_sources_preserve_pdf_and_null_page_metadata(monkeypatch):
    _stub_summary(monkeypatch, _payload(source_id="S2"))
    result = generate_summary(SimpleNamespace(), user_id="user-1", summary_type="standard")
    assert len(result.sources) == 1
    source = result.sources[0]
    assert source.source_id == "S2"
    assert source.chunk_id == "chunk-2"
    assert source.lecture_id == "lecture-2"
    assert source.lecture_title == "Lecture 2"
    assert source.module_id == "module-1"
    assert source.chunk_index == 1
    assert source.page_number is None

    _stub_summary(monkeypatch, _payload(source_id="S1"))
    pdf_result = generate_summary(SimpleNamespace(), user_id="user-1", summary_type="standard")
    assert pdf_result.sources[0].page_number == 18


def test_invalid_source_id_rejects_entire_summary(monkeypatch):
    _stub_summary(monkeypatch, _payload(source_id="S99"))
    with pytest.raises(SummaryGenerationError, match="untrusted summary source"):
        generate_summary(SimpleNamespace(), user_id="user-1", summary_type="standard")


def test_empty_material_never_calls_provider(monkeypatch):
    monkeypatch.setattr(summary_generator, "collect_summary_chunks", lambda *args, **kwargs: [])
    monkeypatch.setattr(
        summary_generator,
        "generate_structured_answer",
        lambda **kwargs: (_ for _ in ()).throw(AssertionError("provider must not be called")),
    )
    with pytest.raises(InsufficientSummaryMaterial):
        generate_summary(SimpleNamespace(), user_id="user-1", summary_type="standard")


def test_insufficient_material_endpoint_is_safe(client, auth_headers):
    headers, _ = auth_headers
    response = client.post(
        "/api/v1/summaries/generate",
        headers=headers,
        json={"summary_type": "standard"},
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "Not enough study material is available to generate a summary."


def test_malformed_provider_output_returns_safe_error(client, auth_headers, monkeypatch):
    headers, _ = auth_headers
    monkeypatch.setattr(summary_generator, "collect_summary_chunks", lambda *args, **kwargs: [_match()])
    monkeypatch.setattr(summary_generator, "generate_structured_answer", lambda **kwargs: "not json")
    response = client.post(
        "/api/v1/summaries/generate", headers=headers,
        json={"summary_type": "standard"},
    )
    assert response.status_code == 502
    assert response.json()["detail"] == "The summary service returned an invalid summary."


def test_prompt_distinguishes_types_and_documents_bounded_coverage():
    sources = [("S1", _match())]
    short = build_summary_prompt(summary_type="short", sources=sources, context_was_limited=False)
    detailed = build_summary_prompt(summary_type="detailed", sources=sources, context_was_limited=True)
    assert "3-5 key points" in short
    assert "8-12 key points" in detailed
    assert "representative excerpts" in detailed
    assert "do not claim exhaustive coverage" in detailed


def _install_real_retry_path(monkeypatch, *outcomes):
    models = FakeModels(outcomes)
    monkeypatch.setattr(llm_service, "_get_gemini_client", lambda: SimpleNamespace(models=models))
    monkeypatch.setattr(llm_service, "_sleep", lambda _delay: None)
    monkeypatch.setattr(llm_service, "_jitter", lambda: 0.0)
    monkeypatch.setattr(summary_generator, "collect_summary_chunks", lambda *args, **kwargs: [_match()])
    return models


def test_transient_provider_failure_recovers_through_shared_retry_layer(client, auth_headers, monkeypatch):
    headers, _ = auth_headers
    models = _install_real_retry_path(monkeypatch, ProviderFailure(503), _payload())
    response = client.post(
        "/api/v1/summaries/generate", headers=headers,
        json={"summary_type": "standard"},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Grounded Study Summary"
    assert models.calls == 2


def test_exhausted_provider_retries_return_safe_502(client, auth_headers, monkeypatch):
    headers, _ = auth_headers
    models = _install_real_retry_path(
        monkeypatch, ProviderFailure(503), ProviderFailure(503), ProviderFailure(503)
    )
    response = client.post(
        "/api/v1/summaries/generate", headers=headers,
        json={"summary_type": "standard"},
    )
    assert response.status_code == 502
    assert response.json()["detail"] == "The summary service is temporarily unavailable."
    assert "provider detail" not in response.text
    assert models.calls == 3


def test_response_exposes_no_embeddings(monkeypatch):
    _stub_summary(monkeypatch, _payload())
    result = generate_summary(SimpleNamespace(), user_id="user-1", summary_type="standard")
    serialized = result.model_dump()
    assert "embedding" not in json.dumps(serialized)


def test_summary_context_collection_is_bounded_and_deterministic(db_session, auth_headers):
    _, user = auth_headers
    from app.models.module import Module

    module = Module(user_id=user["id"], title="Summary ordering")
    db_session.add(module)
    db_session.flush()
    lecture_a = Lecture(module_id=module.id, title="A", file_type="txt")
    lecture_b = Lecture(module_id=module.id, title="B", file_type="txt")
    db_session.add_all([lecture_a, lecture_b])
    db_session.flush()
    for lecture in (lecture_a, lecture_b):
        for index in range(2):
            db_session.add(DocumentChunk(
                lecture_id=lecture.id,
                chunk_index=index,
                chunk_text=f"{lecture.title}-{index}",
                embedding=[0.1] * 384,
            ))
    db_session.commit()

    matches = summary_generator.collect_summary_chunks(
        db_session, user_id=user["id"], module_id=module.id, limit=4
    )
    assert [match.chunk.chunk_index for match in matches] == [0, 0, 1, 1]
    assert {match.chunk.lecture_id for match in matches[:2]} == {lecture_a.id, lecture_b.id}
