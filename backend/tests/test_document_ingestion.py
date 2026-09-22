from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.models.chunk import DocumentChunk
from app.models.lecture import Lecture
from app.services.document_extractor import ExtractedDocument, ExtractedPage
from app.services.document_ingestion import clean_document_text, chunk_document


def _create_module(client, headers):
    response = client.post(
        "/api/v1/modules",
        headers=headers,
        json={"title": "Ingestion", "code": "ING101"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def _multi_page_pdf(page_texts):
    """Build a small dependency-free PDF fixture with one text stream per page."""
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        f"<< /Type /Pages /Kids [{' '.join(f'{3 + index * 2} 0 R' for index in range(len(page_texts)))}] /Count {len(page_texts)} >>".encode(),
    ]
    for index, text in enumerate(page_texts):
        page_object = 3 + index * 2
        content_object = page_object + 1
        escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream = f"BT /F1 12 Tf 72 720 Td ({escaped}) Tj ET".encode()
        objects.extend([
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents {content_object} 0 R >>".encode(),
            b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        ])

    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(output))
        output.extend(f"{number} 0 obj\n".encode() + obj + b"\nendobj\n")
    xref = len(output)
    output.extend(f"xref\n0 {len(objects) + 1}\n".encode())
    output.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode())
    output.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode())
    return bytes(output)


def test_pdf_upload_persists_chunks_with_real_page_numbers(client, auth_headers, db_session, tmp_path, monkeypatch):
    headers, _ = auth_headers
    module_id = _create_module(client, headers)
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))

    response = client.post(
        "/api/v1/lectures/upload",
        headers=headers,
        data={"module_id": module_id},
        files={"file": ("pages.pdf", _multi_page_pdf(["First page notes", "Second page notes"]), "application/pdf")},
    )

    assert response.status_code == 201
    body = response.json()
    chunks = (
        db_session.query(DocumentChunk)
        .filter(DocumentChunk.lecture_id == body["id"])
        .order_by(DocumentChunk.chunk_index)
        .all()
    )
    assert body["page_count"] == 2
    assert body["chunks_count"] == len(chunks) == 2
    assert [chunk.page_number for chunk in chunks] == [1, 2]
    assert [chunk.chunk_index for chunk in chunks] == [0, 1]


def test_cleaning_and_word_overlap_are_deterministic():
    assert clean_document_text("  alpha   beta\r\n\r\n\r\ngam-\nma  ") == "alpha beta\n\ngamma"
    document = ExtractedDocument([
        ExtractedPage(text="zero one two three four five six seven eight nine", page_number=None),
    ])

    chunks = chunk_document(document, chunk_size_words=6, chunk_overlap_words=2)

    assert [chunk.chunk_index for chunk in chunks] == [0, 1]
    assert [chunk.page_number for chunk in chunks] == [None, None]
    assert chunks[0].chunk_text.split()[-2:] == chunks[1].chunk_text.split()[:2]
    assert all(chunk.chunk_text for chunk in chunks)


def test_list_count_and_delete_cascade_use_persisted_chunks(client, auth_headers, db_session, tmp_path, monkeypatch):
    headers, _ = auth_headers
    module_id = _create_module(client, headers)
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    upload = client.post(
        "/api/v1/lectures/upload",
        headers=headers,
        data={"module_id": module_id},
        files={"file": ("notes.txt", b"persisted lecture content", "text/plain")},
    )
    assert upload.status_code == 201
    lecture_id = upload.json()["id"]
    actual_count = db_session.query(DocumentChunk).filter(DocumentChunk.lecture_id == lecture_id).count()

    listed = client.get("/api/v1/lectures", headers=headers)
    listed_lecture = next(item for item in listed.json() if item["id"] == lecture_id)
    assert listed_lecture["chunks_count"] == actual_count == 1

    deleted = client.delete(f"/api/v1/lectures/{lecture_id}", headers=headers)
    assert deleted.status_code == 204
    assert db_session.query(Lecture).filter(Lecture.id == lecture_id).count() == 0
    assert db_session.query(DocumentChunk).filter(DocumentChunk.lecture_id == lecture_id).count() == 0


def test_chunk_persistence_failure_rolls_back_lecture_and_file(client, auth_headers, db_session, tmp_path, monkeypatch):
    headers, _ = auth_headers
    module_id = _create_module(client, headers)
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    original_commit = db_session.commit

    def fail_commit():
        raise SQLAlchemyError("simulated persistence failure")

    monkeypatch.setattr(db_session, "commit", fail_commit)
    response = client.post(
        "/api/v1/lectures/upload",
        headers=headers,
        data={"module_id": module_id},
        files={"file": ("failure.txt", b"content that should roll back", "text/plain")},
    )
    monkeypatch.setattr(db_session, "commit", original_commit)

    assert response.status_code == 500
    assert response.json()["detail"] == "Document ingestion failed; no lecture or chunks were saved."
    assert db_session.query(Lecture).filter(Lecture.module_id == module_id).count() == 0
    assert db_session.query(DocumentChunk).count() == 0
    assert not list(tmp_path.iterdir())
