import os
from pathlib import Path

from app.core.config import BACKEND_DIR, settings
from app.models.chunk import DocumentChunk
from app.models.lecture import Lecture


def _create_module(client, headers, title="Cleanup"):
    response = client.post(
        "/api/v1/modules",
        headers=headers,
        json={"title": title, "code": "CLEAN"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def _upload_txt(client, headers, module_id):
    response = client.post(
        "/api/v1/lectures/upload",
        headers=headers,
        data={"module_id": module_id},
        files={"file": ("cleanup.txt", b"Grounded cleanup test material.", "text/plain")},
    )
    assert response.status_code == 201
    return response.json()


def test_delete_removes_database_chunks_and_physical_upload(
    client, auth_headers, db_session, tmp_path, monkeypatch
):
    headers, _ = auth_headers
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    module_id = _create_module(client, headers)
    lecture = _upload_txt(client, headers, module_id)
    stored_file = next(tmp_path.glob("*.txt"))
    assert stored_file.exists()
    assert db_session.query(DocumentChunk).filter_by(lecture_id=lecture["id"]).count() == 1

    response = client.delete(f"/api/v1/lectures/{lecture['id']}", headers=headers)

    assert response.status_code == 204
    assert db_session.get(Lecture, lecture["id"]) is None
    assert db_session.query(DocumentChunk).filter_by(lecture_id=lecture["id"]).count() == 0
    assert not stored_file.exists()


def test_delete_succeeds_when_physical_upload_is_missing(
    client, auth_headers, db_session, tmp_path, monkeypatch
):
    headers, _ = auth_headers
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    lecture = _upload_txt(client, headers, _create_module(client, headers))
    next(tmp_path.glob("*.txt")).unlink()

    response = client.delete(f"/api/v1/lectures/{lecture['id']}", headers=headers)

    assert response.status_code == 204
    assert db_session.get(Lecture, lecture["id"]) is None


def test_outside_root_relative_path_is_never_deleted(
    client, auth_headers, db_session, tmp_path, monkeypatch
):
    headers, _ = auth_headers
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    outside = tmp_path / "outside.txt"
    outside.write_text("keep", encoding="utf-8")
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(upload_dir))
    module_id = _create_module(client, headers)
    malicious_path = os.path.relpath(outside, BACKEND_DIR)
    assert ".." in Path(malicious_path).parts
    lecture = Lecture(module_id=module_id, title="Malicious", file_type="txt", file_url=malicious_path)
    db_session.add(lecture)
    db_session.commit()

    response = client.delete(f"/api/v1/lectures/{lecture.id}", headers=headers)

    assert response.status_code == 204
    assert outside.read_text(encoding="utf-8") == "keep"


def test_outside_root_absolute_path_is_never_deleted(
    client, auth_headers, db_session, tmp_path, monkeypatch
):
    headers, _ = auth_headers
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    outside = tmp_path / "absolute-outside.txt"
    outside.write_text("keep", encoding="utf-8")
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(upload_dir))
    module_id = _create_module(client, headers)
    lecture = Lecture(module_id=module_id, title="Absolute", file_type="txt", file_url=str(outside))
    db_session.add(lecture)
    db_session.commit()

    response = client.delete(f"/api/v1/lectures/{lecture.id}", headers=headers)

    assert response.status_code == 204
    assert outside.exists()


def test_user_cannot_delete_another_users_lecture_file(
    client, auth_headers, db_session, tmp_path, monkeypatch
):
    owner_headers, _ = auth_headers
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    lecture = _upload_txt(client, owner_headers, _create_module(client, owner_headers))
    stored_file = next(tmp_path.glob("*.txt"))
    registration = client.post(
        "/api/v1/auth/register",
        json={"name": "Other", "email": "other@example.com", "password": "Password123!", "role": "student"},
    )
    other_headers = {"Authorization": f"Bearer {registration.json()['access_token']}"}

    response = client.delete(f"/api/v1/lectures/{lecture['id']}", headers=other_headers)

    assert response.status_code == 404
    assert db_session.get(Lecture, lecture["id"]) is not None
    assert stored_file.exists()


def test_filesystem_failure_does_not_undo_database_delete(
    client, auth_headers, db_session, tmp_path, monkeypatch, caplog
):
    headers, _ = auth_headers
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    lecture = _upload_txt(client, headers, _create_module(client, headers))
    stored_file = next(tmp_path.glob("*.txt"))
    original_unlink = Path.unlink

    def locked_file(path, *args, **kwargs):
        if path == stored_file:
            raise PermissionError("sensitive path must not reach the API or logs")
        return original_unlink(path, *args, **kwargs)

    monkeypatch.setattr(Path, "unlink", locked_file)
    response = client.delete(f"/api/v1/lectures/{lecture['id']}", headers=headers)

    assert response.status_code == 204
    assert db_session.get(Lecture, lecture["id"]) is None
    assert "PermissionError" in caplog.text
    assert str(tmp_path) not in caplog.text


def test_shared_upload_is_kept_until_last_reference_is_deleted(
    client, auth_headers, db_session, tmp_path, monkeypatch
):
    headers, _ = auth_headers
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    module_id = _create_module(client, headers)
    lecture = _upload_txt(client, headers, module_id)
    original = db_session.get(Lecture, lecture["id"])
    shared = Lecture(module_id=module_id, title="Shared", file_type="txt", file_url=original.file_url)
    db_session.add(shared)
    db_session.commit()
    stored_file = next(tmp_path.glob("*.txt"))

    assert client.delete(f"/api/v1/lectures/{original.id}", headers=headers).status_code == 204
    assert stored_file.exists()
    assert client.delete(f"/api/v1/lectures/{shared.id}", headers=headers).status_code == 204
    assert not stored_file.exists()
