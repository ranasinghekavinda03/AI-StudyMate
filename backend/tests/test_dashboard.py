from datetime import datetime, timedelta, timezone

from app.models.chunk import DocumentChunk
from app.models.flashcard import Flashcard, FlashcardSet
from app.models.lecture import Lecture
from app.models.module import Module


ZERO_STATS = {
    "modules": 0,
    "lectures": 0,
    "document_chunks": 0,
    "flashcard_sets": 0,
    "flashcards": 0,
    "known_cards": 0,
    "review_again_cards": 0,
    "unreviewed_cards": 0,
    "total_flashcard_reviews": 0,
}


def test_empty_dashboard_returns_zeros_and_empty_recent_lists(client, auth_headers):
    headers, _ = auth_headers
    response = client.get("/api/v1/dashboard", headers=headers)
    assert response.status_code == 200
    assert response.json() == {
        "stats": ZERO_STATS,
        "recent_lectures": [],
        "recent_flashcard_sets": [],
    }


def test_dashboard_aggregates_owned_data_and_bounds_recent_items(
    client, auth_headers, db_session
):
    headers, owner = auth_headers
    other_response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Dashboard Other",
            "email": "dashboard-other@example.com",
            "password": "Password123!",
            "role": "student",
        },
    )
    other_id = other_response.json()["user"]["id"]
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)

    owner_modules = [
        Module(user_id=owner["id"], title="Owned Module A", created_at=base),
        Module(user_id=owner["id"], title="Owned Module B", created_at=base + timedelta(minutes=1)),
    ]
    other_module = Module(user_id=other_id, title="Private Other Module", created_at=base)
    db_session.add_all([*owner_modules, other_module])
    db_session.flush()

    owner_lectures = []
    for index in range(6):
        lecture = Lecture(
            module_id=owner_modules[index % 2].id,
            title=f"Owned Lecture {index}",
            file_type="pdf" if index % 2 == 0 else "txt",
            created_at=base + timedelta(days=index),
        )
        db_session.add(lecture)
        db_session.flush()
        owner_lectures.append(lecture)
        db_session.add(DocumentChunk(
            lecture_id=lecture.id,
            chunk_index=0,
            chunk_text=f"private owned chunk text {index}",
            embedding=None,
        ))
    other_lecture = Lecture(
        module_id=other_module.id,
        title="Private Other Lecture",
        file_type="pdf",
        created_at=base + timedelta(days=20),
    )
    db_session.add(other_lecture)
    db_session.flush()
    db_session.add(DocumentChunk(
        lecture_id=other_lecture.id,
        chunk_index=0,
        chunk_text="private other chunk content",
        embedding=None,
    ))

    owner_sets = []
    for index in range(6):
        deck = FlashcardSet(
            user_id=owner["id"],
            title=f"Owned Set {index}",
            difficulty="medium",
            created_at=base + timedelta(days=index),
            updated_at=base + timedelta(days=index),
        )
        db_session.add(deck)
        db_session.flush()
        owner_sets.append(deck)
    cards = [
        Flashcard(flashcard_set_id=owner_sets[0].id, position=0, front="A", back="A", review_status="known", review_count=3),
        Flashcard(flashcard_set_id=owner_sets[0].id, position=1, front="B", back="B", review_status="known", review_count=2),
        Flashcard(flashcard_set_id=owner_sets[1].id, position=0, front="C", back="C", review_status="review_again", review_count=4),
        Flashcard(flashcard_set_id=owner_sets[2].id, position=0, front="D", back="D", review_status="unreviewed", review_count=0),
    ]
    other_set = FlashcardSet(
        user_id=other_id,
        title="Private Other Set",
        difficulty="hard",
        created_at=base + timedelta(days=20),
        updated_at=base + timedelta(days=20),
    )
    db_session.add(other_set)
    db_session.flush()
    db_session.add(Flashcard(
        flashcard_set_id=other_set.id,
        position=0,
        front="Private other prompt",
        back="Private other answer",
        review_status="known",
        review_count=99,
    ))
    db_session.add_all(cards)
    db_session.commit()

    response = client.get("/api/v1/dashboard", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["stats"] == {
        "modules": 2,
        "lectures": 6,
        "document_chunks": 6,
        "flashcard_sets": 6,
        "flashcards": 4,
        "known_cards": 2,
        "review_again_cards": 1,
        "unreviewed_cards": 1,
        "total_flashcard_reviews": 9,
    }
    assert len(body["recent_lectures"]) == 5
    assert [item["title"] for item in body["recent_lectures"]] == [
        "Owned Lecture 5", "Owned Lecture 4", "Owned Lecture 3", "Owned Lecture 2", "Owned Lecture 1",
    ]
    assert body["recent_lectures"][0]["module_title"] == "Owned Module B"
    assert len(body["recent_flashcard_sets"]) == 5
    assert [item["title"] for item in body["recent_flashcard_sets"]] == [
        "Owned Set 5", "Owned Set 4", "Owned Set 3", "Owned Set 2", "Owned Set 1",
    ]
    assert body["recent_flashcard_sets"][-1]["card_count"] == 1
    assert "Private Other" not in response.text
    assert "chunk_text" not in response.text
    assert "embedding" not in response.text
    assert "private owned chunk text" not in response.text
