from app.core.config import settings
from app.models.chunk import DocumentChunk
from app.services.embedding_service import embed_text, embed_texts


def _register(client, email):
    response = client.post(
        "/api/v1/auth/register",
        json={"name": email, "email": email, "password": "Password123!", "role": "student"},
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


def _retrieve(client, headers, **payload):
    return client.post("/api/v1/rag/retrieve", headers=headers, json=payload)


def test_embedding_dimension_and_numeric_values():
    vector = embed_text("neural network regularization")
    assert len(vector) == settings.EMBEDDING_DIMENSION == 384
    assert all(isinstance(value, float) for value in vector)


def test_batch_embeddings_preserve_count_and_order():
    vectors = embed_texts(["neural overfitting", "database indexing", "cpu scheduling"])
    assert len(vectors) == 3
    assert all(len(vector) == 384 for vector in vectors)
    assert vectors[0][0] > vectors[0][1]
    assert vectors[1][1] > vectors[1][2]
    assert vectors[2][2] > vectors[2][0]


def test_upload_persists_embedding_and_nullable_page(client, auth_headers, db_session, tmp_path, monkeypatch):
    headers, _ = auth_headers
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    module_id = _module(client, headers, "ML")
    lecture = _upload(client, headers, module_id, "Notes", "neural network overfitting")
    chunk = db_session.query(DocumentChunk).filter_by(lecture_id=lecture["id"]).one()
    assert chunk.embedding is not None
    assert len(chunk.embedding) == 384

    response = _retrieve(client, headers, query="overfitting", top_k=1)
    assert response.status_code == 200
    assert response.json()["results"][0]["page_number"] is None


def test_semantic_ranking_filters_top_k_and_isolation(client, auth_headers, tmp_path, monkeypatch):
    headers_a, _ = auth_headers
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    ml_module = _module(client, headers_a, "Machine Learning")
    systems_module = _module(client, headers_a, "Systems")
    ml_lecture = _upload(client, headers_a, ml_module, "Overfitting", "neural network overfitting regularization dropout")
    _upload(client, headers_a, systems_module, "Databases", "database indexing query performance")
    systems_lecture = _upload(client, headers_a, systems_module, "Operating Systems", "operating system cpu process scheduling")

    ranked = _retrieve(client, headers_a, query="How can overfitting be reduced?", top_k=3)
    assert ranked.status_code == 200
    assert ranked.json()["results"][0]["lecture_id"] == ml_lecture["id"]

    lecture_filtered = _retrieve(client, headers_a, query="database query", lecture_id=systems_lecture["id"], top_k=5)
    assert lecture_filtered.status_code == 200
    assert all(item["lecture_id"] == systems_lecture["id"] for item in lecture_filtered.json()["results"])

    module_filtered = _retrieve(client, headers_a, query="overfitting", module_id=systems_module, top_k=5)
    assert module_filtered.status_code == 200
    assert all(item["module_id"] == systems_module for item in module_filtered.json()["results"])

    one = _retrieve(client, headers_a, query="notes", top_k=1)
    two = _retrieve(client, headers_a, query="notes", top_k=2)
    assert len(one.json()["results"]) == 1
    assert len(two.json()["results"]) == 2

    headers_b = _register(client, "other@studymate.ai")
    module_b = _module(client, headers_b, "Private")
    lecture_b = _upload(client, headers_b, module_b, "Secret", "userbsecret quasar")
    isolated = _retrieve(client, headers_a, query="userbsecret quasar", top_k=20)
    assert isolated.status_code == 200
    assert all(item["lecture_id"] != lecture_b["id"] for item in isolated.json()["results"])
    assert all(item["module_id"] != module_b for item in isolated.json()["results"])


def test_non_owned_filters_are_rejected(client, auth_headers, tmp_path, monkeypatch):
    headers_a, _ = auth_headers
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    headers_b = _register(client, "owner-b@studymate.ai")
    module_b = _module(client, headers_b, "Private B")
    lecture_b = _upload(client, headers_b, module_b, "B Notes", "userbsecret")
    assert _retrieve(client, headers_a, query="secret", module_id=module_b).status_code == 404
    assert _retrieve(client, headers_a, query="secret", lecture_id=lecture_b["id"]).status_code == 404


def test_invalid_top_k_values(client, auth_headers):
    headers, _ = auth_headers
    for value in (0, -1, settings.RETRIEVAL_MAX_TOP_K + 1):
        response = _retrieve(client, headers, query="anything", top_k=value)
        assert response.status_code == 422
