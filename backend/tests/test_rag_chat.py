from types import SimpleNamespace

from app.core.config import settings
from app.services import rag_pipeline
from app.services.llm_service import LLMProviderError
from app.services.rag_pipeline import INSUFFICIENT_CONTEXT_ANSWER, _citation_for, _validated_answer, answer_question, build_grounded_prompt
from app.services.retrieval_service import RetrievedChunk


def _match(number, *, page_number=None, module_id="module-1", lecture_id=None, text=None):
    lecture_id = lecture_id or f"lecture-{number}"
    chunk = SimpleNamespace(
        id=f"chunk-{number}",
        lecture_id=lecture_id,
        page_number=page_number,
        chunk_index=number - 1,
        chunk_text=text or f"Source text {number}",
    )
    return RetrievedChunk(chunk=chunk, lecture_title=f"Lecture {number}", module_id=module_id, score=0.9)


def _validate_citations(answer, count=5):
    citation_map = {
        f"S{number}": _citation_for(f"S{number}", _match(number, page_number=number if number % 2 else None))
        for number in range(1, count + 1)
    }
    return _validated_answer(answer, citation_map)


def _register(client, email):
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "RAG Student", "email": email, "password": "Password123!", "role": "student"},
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _module(client, headers, title):
    response = client.post("/api/v1/modules", headers=headers, json={"title": title})
    assert response.status_code == 201
    return response.json()["id"]


def _upload(client, headers, module_id, title, text):
    response = client.post(
        "/api/v1/lectures/upload",
        headers=headers,
        data={"module_id": module_id, "title": title},
        files={"file": (f"{title}.txt", text.encode(), "text/plain")},
    )
    assert response.status_code == 201
    return response.json()


def test_grounded_prompt_contains_question_context_sources_and_boundary():
    prompt = build_grounded_prompt("What is early stopping?", [("S1", _match(1, page_number=18, text="Early stopping uses validation data."))])
    assert "What is early stopping?" in prompt
    assert "[S1]" in prompt
    assert "Page: 18" in prompt
    assert "Early stopping uses validation data." in prompt
    assert "using only the retrieved context" in prompt
    assert "untrusted data" in rag_pipeline.SYSTEM_INSTRUCTION
    assert "ONLY the supplied" in rag_pipeline.SYSTEM_INSTRUCTION


def test_citation_mapping_invalid_reference_and_nullable_pages(monkeypatch):
    matches = [_match(1, page_number=7), _match(2, page_number=None)]
    monkeypatch.setattr(rag_pipeline, "retrieve_chunks", lambda *args, **kwargs: matches)
    monkeypatch.setattr(rag_pipeline, "generate_answer", lambda **kwargs: "Grounded [S1], more [S2], invalid [S99].")

    result = answer_question(SimpleNamespace(), user_id="user-1", question="Question")

    assert result.answer == "Grounded [S1], more [S2], invalid."
    assert [citation.source_id for citation in result.citations] == ["S1", "S2"]
    assert result.citations[0].chunk_id == "chunk-1"
    assert result.citations[0].page_number == 7
    assert result.citations[1].page_number is None
    assert all(citation.source_id != "S99" for citation in result.citations)


def test_single_and_grouped_citation_formats():
    cases = [
        ("Answer [S1]", ["S1"]),
        ("Answer [S1, S2]", ["S1", "S2"]),
        ("Answer [S1,S2]", ["S1", "S2"]),
        ("Answer [S1,  S2, S3]", ["S1", "S2", "S3"]),
    ]
    for answer, expected in cases:
        result = _validate_citations(answer)
        assert [citation.source_id for citation in result.citations] == expected


def test_grouped_citations_deduplicate_in_first_appearance_order():
    result = _validate_citations("A [S3, S4]. B [S1, S3]. C [S5].")
    assert [citation.source_id for citation in result.citations] == ["S3", "S4", "S1", "S5"]
    assert result.answer == "A [S3, S4]. B [S1, S3]. C [S5]."

    duplicate = _validate_citations("A [S1]. B [S1, S2].")
    assert [citation.source_id for citation in duplicate.citations] == ["S1", "S2"]


def test_grouped_citations_remove_only_untrusted_ids_and_preserve_readability():
    mixed = _validate_citations("Learning is grounded [S1, S99].")
    assert mixed.answer == "Learning is grounded [S1]."
    assert [citation.source_id for citation in mixed.citations] == ["S1"]

    invalid = _validate_citations("Unsupported [S99, S100].")
    assert invalid.answer == "Unsupported."
    assert invalid.citations == []


def test_grouped_citations_keep_trusted_pdf_and_null_page_metadata():
    result = _validate_citations("Combined evidence [S1, S2].", count=2)
    pdf, text = result.citations
    assert (pdf.lecture_title, pdf.page_number, pdf.chunk_id, pdf.module_id) == (
        "Lecture 1", 1, "chunk-1", "module-1"
    )
    assert text.page_number is None


def test_insufficient_context_skips_provider(monkeypatch):
    monkeypatch.setattr(rag_pipeline, "retrieve_chunks", lambda *args, **kwargs: [])
    monkeypatch.setattr(rag_pipeline, "generate_answer", lambda **kwargs: (_ for _ in ()).throw(AssertionError("must not call LLM")))
    result = answer_question(SimpleNamespace(), user_id="user-1", question="Unknown")
    assert result.answer == INSUFFICIENT_CONTEXT_ANSWER
    assert result.citations == []

    monkeypatch.setattr(rag_pipeline, "retrieve_chunks", lambda *args, **kwargs: [_match(1)])
    monkeypatch.setattr(rag_pipeline, "generate_answer", lambda **kwargs: INSUFFICIENT_CONTEXT_ANSWER + " [S1]")
    model_result = answer_question(SimpleNamespace(), user_id="user-1", question="Unknown")
    assert model_result.answer == INSUFFICIENT_CONTEXT_ANSWER
    assert model_result.citations == []


def test_chat_requires_authentication_and_rejects_blank_question(client, auth_headers):
    assert client.post("/api/v1/rag/chat", json={"question": "Anything"}).status_code == 401
    headers, _ = auth_headers
    assert client.post("/api/v1/rag/chat", headers=headers, json={"question": "   "}).status_code == 422


def test_chat_filters_and_user_isolation(client, auth_headers, tmp_path, monkeypatch):
    headers_a, _ = auth_headers
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    monkeypatch.setattr(rag_pipeline, "generate_answer", lambda **kwargs: "Answer [S1]")

    module_a = _module(client, headers_a, "RAG Module A")
    lecture_a = _upload(client, headers_a, module_a, "Owned Lecture", "neural network overfitting dropout")
    headers_b = _register(client, "rag-other@studymate.ai")
    module_b = _module(client, headers_b, "RAG Module B")
    lecture_b = _upload(client, headers_b, module_b, "Private Lecture", "userbsecret quasar")

    module_response = client.post(
        "/api/v1/rag/chat", headers=headers_a,
        json={"question": "overfitting", "module_id": module_a, "top_k": 5},
    )
    assert module_response.status_code == 200
    assert all(item["module_id"] == module_a for item in module_response.json()["citations"])

    lecture_response = client.post(
        "/api/v1/rag/chat", headers=headers_a,
        json={"question": "overfitting", "lecture_id": lecture_a["id"], "top_k": 5},
    )
    assert lecture_response.status_code == 200
    assert all(item["lecture_id"] == lecture_a["id"] for item in lecture_response.json()["citations"])
    assert lecture_response.json()["citations"][0]["page_number"] is None

    isolated = client.post("/api/v1/rag/chat", headers=headers_a, json={"question": "userbsecret quasar", "top_k": 20})
    assert isolated.status_code == 200
    assert all(item["lecture_id"] != lecture_b["id"] for item in isolated.json()["citations"])
    assert client.post("/api/v1/rag/chat", headers=headers_a, json={"question": "secret", "module_id": module_b}).status_code == 404
    assert client.post("/api/v1/rag/chat", headers=headers_a, json={"question": "secret", "lecture_id": lecture_b["id"]}).status_code == 404


def test_chat_provider_failure_is_safe(client, auth_headers, db_session, monkeypatch):
    headers, user = auth_headers
    monkeypatch.setattr(rag_pipeline, "retrieve_chunks", lambda *args, **kwargs: [_match(1)])
    monkeypatch.setattr(
        rag_pipeline,
        "generate_answer",
        lambda **kwargs: (_ for _ in ()).throw(LLMProviderError("secret-api-key provider detail")),
    )
    response = client.post("/api/v1/rag/chat", headers=headers, json={"question": "Question"})
    assert response.status_code == 502
    assert response.json()["detail"] == "The answer service is temporarily unavailable."
    assert "secret-api-key" not in response.text
