import os
from pathlib import Path

from app.api import modules as modules_api
from app.core.config import BACKEND_DIR, settings
from app.models.chunk import DocumentChunk
from app.models.lecture import Lecture
from app.models.module import Module


def _create_module(client, headers, title="Module cleanup"):
    response = client.post(
        "/api/v1/modules",
        headers=headers,
        json={"title": title, "code": "CLEAN"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def _add_lecture(db_session, module_id, file_url, title="Lecture", with_chunk=False):
    lecture = Lecture(
        module_id=module_id,
        title=title,
        file_type="txt",
        file_url=file_url,
    )
    db_session.add(lecture)
    db_session.flush()
    if with_chunk:
        db_session.add(
            DocumentChunk(
                lecture_id=lecture.id,
                chunk_index=0,
                chunk_text="cleanup content",
            )
        )
    db_session.commit()
    return lecture.id


def test_module_delete_removes_lecture_chunk_and_physical_file(
    client, auth_headers, db_session, tmp_path, monkeypatch
):
    headers, _ = auth_headers
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    module_id = _create_module(client, headers)
    stored_file = tmp_path / "one.txt"
    stored_file.write_text("one", encoding="utf-8")
    lecture_id = _add_lecture(db_session, module_id, str(stored_file), with_chunk=True)

    response = client.delete(f"/api/v1/modules/{module_id}", headers=headers)

    assert response.status_code == 204
    assert db_session.get(Module, module_id) is None
    assert db_session.get(Lecture, lecture_id) is None
    assert db_session.query(DocumentChunk).filter_by(lecture_id=lecture_id).count() == 0
    assert not stored_file.exists()


def test_module_delete_removes_multiple_files(
    client, auth_headers, db_session, tmp_path, monkeypatch
):
    headers, _ = auth_headers
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    module_id = _create_module(client, headers)
    files = [tmp_path / name for name in ("one.txt", "two.txt", "three.txt")]
    for path in files:
        path.write_text(path.stem, encoding="utf-8")
    for index, path in enumerate(files):
        _add_lecture(db_session, module_id, str(path), title=f"Lecture {index}")

    response = client.delete(f"/api/v1/modules/{module_id}", headers=headers)

    assert response.status_code == 204
    assert all(not path.exists() for path in files)


def test_module_delete_succeeds_when_only_upload_is_missing(
    client, auth_headers, db_session, tmp_path, monkeypatch
):
    headers, _ = auth_headers
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    module_id = _create_module(client, headers)
    missing_file = tmp_path / "already-missing.txt"
    lecture_id = _add_lecture(db_session, module_id, str(missing_file))

    response = client.delete(f"/api/v1/modules/{module_id}", headers=headers)

    assert response.status_code == 204
    assert db_session.get(Module, module_id) is None
    assert db_session.get(Lecture, lecture_id) is None


def test_module_delete_removes_existing_files_when_another_is_missing(
    client, auth_headers, db_session, tmp_path, monkeypatch
):
    headers, _ = auth_headers
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    module_id = _create_module(client, headers)
    existing_files = [tmp_path / "existing-one.txt", tmp_path / "existing-two.txt"]
    missing_file = tmp_path / "missing.txt"
    for path in existing_files:
        path.write_text(path.stem, encoding="utf-8")
    for index, path in enumerate([*existing_files, missing_file]):
        _add_lecture(db_session, module_id, str(path), title=f"Mixed {index}")

    response = client.delete(f"/api/v1/modules/{module_id}", headers=headers)

    assert response.status_code == 204
    assert all(not path.exists() for path in existing_files)


def test_module_delete_refuses_relative_and_absolute_outside_paths(
    client, auth_headers, db_session, tmp_path, monkeypatch
):
    headers, _ = auth_headers
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(upload_dir))
    module_id = _create_module(client, headers)
    relative_outside = tmp_path / "relative-outside.txt"
    absolute_outside = tmp_path / "absolute-outside.txt"
    relative_outside.write_text("keep relative", encoding="utf-8")
    absolute_outside.write_text("keep absolute", encoding="utf-8")
    malicious_relative = os.path.relpath(relative_outside, BACKEND_DIR)
    assert ".." in Path(malicious_relative).parts
    _add_lecture(db_session, module_id, malicious_relative, title="Relative")
    _add_lecture(db_session, module_id, str(absolute_outside), title="Absolute")

    response = client.delete(f"/api/v1/modules/{module_id}", headers=headers)

    assert response.status_code == 204
    assert relative_outside.read_text(encoding="utf-8") == "keep relative"
    assert absolute_outside.read_text(encoding="utf-8") == "keep absolute"


def test_module_delete_isolates_cleanup_failure_and_continues(
    client, auth_headers, db_session, tmp_path, monkeypatch, caplog
):
    headers, _ = auth_headers
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    module_id = _create_module(client, headers)
    locked = tmp_path / "locked.txt"
    removable = tmp_path / "removable.txt"
    locked.write_text("locked", encoding="utf-8")
    removable.write_text("remove", encoding="utf-8")
    lecture_ids = [
        _add_lecture(db_session, module_id, str(locked), title="Locked", with_chunk=True),
        _add_lecture(db_session, module_id, str(removable), title="Removable", with_chunk=True),
    ]
    original_unlink = Path.unlink
    attempted = []

    def fail_one(path, *args, **kwargs):
        attempted.append(path)
        if path == locked:
            raise PermissionError("sensitive path must not reach the API")
        return original_unlink(path, *args, **kwargs)

    monkeypatch.setattr(Path, "unlink", fail_one)

    response = client.delete(f"/api/v1/modules/{module_id}", headers=headers)

    assert response.status_code == 204
    assert set(attempted) == {locked, removable}
    assert locked.exists()
    assert not removable.exists()
    assert db_session.get(Module, module_id) is None
    assert all(db_session.get(Lecture, lecture_id) is None for lecture_id in lecture_ids)
    assert db_session.query(DocumentChunk).count() == 0
    assert "PermissionError" in caplog.text
    assert str(tmp_path) not in caplog.text


def test_module_delete_deduplicates_file_paths(
    client, auth_headers, db_session, tmp_path, monkeypatch
):
    headers, _ = auth_headers
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    module_id = _create_module(client, headers)
    shared = tmp_path / "duplicate.txt"
    shared.write_text("duplicate", encoding="utf-8")
    _add_lecture(db_session, module_id, str(shared), title="First")
    _add_lecture(db_session, module_id, str(shared), title="Second")
    attempted = []
    original_remove = modules_api.remove_upload_file

    def record_remove(path):
        attempted.append(path)
        return original_remove(path)

    monkeypatch.setattr(modules_api, "remove_upload_file", record_remove)

    assert client.delete(f"/api/v1/modules/{module_id}", headers=headers).status_code == 204
    assert attempted == [shared]
    assert not shared.exists()


def test_module_delete_preserves_file_referenced_by_surviving_lecture(
    client, auth_headers, db_session, tmp_path, monkeypatch
):
    headers, _ = auth_headers
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    deleted_module_id = _create_module(client, headers, "Deleted")
    surviving_module_id = _create_module(client, headers, "Surviving")
    shared = tmp_path / "shared.txt"
    shared.write_text("shared", encoding="utf-8")
    _add_lecture(db_session, deleted_module_id, str(shared), title="Deleted reference")
    surviving_lecture_id = _add_lecture(
        db_session, surviving_module_id, str(shared), title="Surviving reference"
    )

    response = client.delete(f"/api/v1/modules/{deleted_module_id}", headers=headers)

    assert response.status_code == 204
    assert shared.exists()
    assert db_session.get(Lecture, surviving_lecture_id) is not None


def test_user_cannot_delete_another_users_module_or_files(
    client, auth_headers, db_session, tmp_path, monkeypatch
):
    owner_headers, _ = auth_headers
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    module_id = _create_module(client, owner_headers)
    stored_file = tmp_path / "owned.txt"
    stored_file.write_text("owned", encoding="utf-8")
    lecture_id = _add_lecture(db_session, module_id, str(stored_file))
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Other",
            "email": "module-other@example.com",
            "password": "Password123!",
            "role": "student",
        },
    )
    other_headers = {"Authorization": f"Bearer {registration.json()['access_token']}"}

    response = client.delete(f"/api/v1/modules/{module_id}", headers=other_headers)

    assert response.status_code == 404
    assert db_session.get(Module, module_id) is not None
    assert db_session.get(Lecture, lecture_id) is not None
    assert stored_file.exists()
