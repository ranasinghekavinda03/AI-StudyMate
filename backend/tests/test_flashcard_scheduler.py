from datetime import datetime, timedelta, timezone

import pytest

from app.models.flashcard import Flashcard
from app.services.flashcard_scheduler import apply_review_schedule, interval_for_streak


@pytest.mark.parametrize(
    "starting_streak,expected_streak,expected_interval",
    [
        (0, 1, 1),
        (1, 2, 3),
        (2, 3, 7),
        (3, 4, 14),
        (4, 5, 30),
        (5, 6, 30),
        (20, 21, 30),
    ],
)
def test_known_interval_progression(starting_streak, expected_streak, expected_interval):
    now = datetime(2026, 9, 29, 8, 30, 0)
    card = Flashcard(
        flashcard_set_id="set-1",
        position=0,
        front="Front",
        back="Back",
        review_status="known",
        review_count=4,
        review_streak=starting_streak,
        interval_days=0,
    )
    apply_review_schedule(card, "known", now=now)
    assert card.review_streak == expected_streak
    assert card.interval_days == expected_interval
    assert card.review_count == 5
    assert card.reviewed_at == now
    assert card.next_review_at == now + timedelta(days=expected_interval)


def test_review_again_resets_streak_and_schedules_one_day():
    aware_now = datetime(2026, 9, 29, 8, 30, tzinfo=timezone.utc)
    card = Flashcard(
        flashcard_set_id="set-1",
        position=0,
        front="Front",
        back="Back",
        review_status="known",
        review_count=6,
        review_streak=4,
        interval_days=14,
    )
    apply_review_schedule(card, "review_again", now=aware_now)
    expected_now = aware_now.replace(tzinfo=None)
    assert card.review_status == "review_again"
    assert card.review_streak == 0
    assert card.interval_days == 1
    assert card.review_count == 7
    assert card.reviewed_at == expected_now
    assert card.next_review_at == expected_now + timedelta(days=1)


def test_interval_requires_a_positive_known_streak():
    with pytest.raises(ValueError, match="positive"):
        interval_for_streak(0)
