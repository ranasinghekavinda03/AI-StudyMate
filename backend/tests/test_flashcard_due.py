from datetime import datetime, timedelta

from app.api import flashcards as flashcards_api
from app.models.flashcard import Flashcard, FlashcardSet, FlashcardSource


NOW = datetime(2026, 9, 29, 12, 0, 0)


def _register_other(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Due Other",
            "email": "due-other@example.com",
            "password": "Password123!",
            "role": "student",
        },
    )
    return response.json()


def _card(deck, position, *, next_review_at=None, status="unreviewed"):
    return Flashcard(
        flashcard_set_id=deck.id,
        position=position,
        front=f"Front {position}",
        back=f"Back {position}",
        review_status=status,
        review_count=0,
        review_streak=0,
        interval_days=0,
        next_review_at=next_review_at,
    )


def test_review_patch_progression_reset_and_saved_detail(
    client, auth_headers, db_session
):
    headers, owner = auth_headers
    deck = FlashcardSet(user_id=owner["id"], title="Scheduling Deck", difficulty="medium")
    db_session.add(deck)
    db_session.flush()
    card = _card(deck, 0)
    db_session.add(card)
    db_session.commit()

    expected_intervals = [1, 3, 7, 14, 30, 30]
    for expected_streak, expected_interval in enumerate(expected_intervals, start=1):
        response = client.patch(
            f"/api/v1/flashcards/{card.id}/review",
            headers=headers,
            json={"status": "known"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["review_status"] == "known"
        assert body["review_count"] == expected_streak
        assert body["review_streak"] == expected_streak
        assert body["interval_days"] == expected_interval
        assert body["reviewed_at"] is not None
        assert body["next_review_at"] is not None

    reset = client.patch(
        f"/api/v1/flashcards/{card.id}/review",
        headers=headers,
        json={"status": "review_again"},
    )
    assert reset.status_code == 200
    assert reset.json()["review_count"] == 7
    assert reset.json()["review_streak"] == 0
    assert reset.json()["interval_days"] == 1

    detail = client.get(f"/api/v1/flashcards/sets/{deck.id}", headers=headers)
    saved = detail.json()["flashcards"][0]
    assert saved["review_streak"] == 0
    assert saved["interval_days"] == 1
    assert saved["next_review_at"] is not None


def test_due_cards_order_limit_ownership_and_null_source_survival(
    client, auth_headers, db_session, monkeypatch
):
    headers, owner = auth_headers
    other = _register_other(client)
    owner_deck = FlashcardSet(user_id=owner["id"], title="Owned Due Deck", difficulty="easy")
    other_deck = FlashcardSet(user_id=other["user"]["id"], title="Private Due Deck", difficulty="hard")
    db_session.add_all([owner_deck, other_deck])
    db_session.flush()
    never = _card(owner_deck, 0)
    past = _card(owner_deck, 1, next_review_at=NOW - timedelta(days=2), status="known")
    now_card = _card(owner_deck, 2, next_review_at=NOW, status="review_again")
    future = _card(owner_deck, 3, next_review_at=NOW + timedelta(days=1), status="known")
    private = _card(other_deck, 0)
    db_session.add_all([never, past, now_card, future, private])
    db_session.flush()
    db_session.add(FlashcardSource(
        flashcard_id=never.id,
        position=0,
        source_id="S1",
        chunk_id=None,
        lecture_id=None,
        module_id=None,
        lecture_title_snapshot="Deleted Source Snapshot",
        page_number=None,
        chunk_index=4,
    ))
    db_session.commit()
    monkeypatch.setattr(flashcards_api, "utc_now_naive", lambda: NOW)

    response = client.get("/api/v1/flashcards/due?limit=2", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert [card["id"] for card in body["cards"]] == [never.id, past.id]
    assert body["cards"][0]["flashcard_set_id"] == owner_deck.id
    assert body["cards"][0]["set_title"] == "Owned Due Deck"
    assert body["cards"][0]["sources"][0]["chunk_id"] is None
    assert body["cards"][0]["sources"][0]["lecture_title"] == "Deleted Source Snapshot"
    assert private.id not in {card["id"] for card in body["cards"]}
    assert future.id not in {card["id"] for card in body["cards"]}

    all_due = client.get("/api/v1/flashcards/due?limit=100", headers=headers).json()
    assert [card["id"] for card in all_due["cards"]] == [never.id, past.id, now_card.id]
    assert client.get("/api/v1/flashcards/due?limit=0", headers=headers).status_code == 422
    assert client.get("/api/v1/flashcards/due?limit=101", headers=headers).status_code == 422
