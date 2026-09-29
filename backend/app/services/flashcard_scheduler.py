from datetime import datetime, timedelta, timezone

from app.models.flashcard import Flashcard


KNOWN_INTERVAL_DAYS = (1, 3, 7, 14, 30)


def utc_now_naive() -> datetime:
    """Return naive UTC for the project's TIMESTAMP WITHOUT TIME ZONE columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def interval_for_streak(review_streak: int) -> int:
    if review_streak < 1:
        raise ValueError("Review streak must be positive for a known review.")
    return KNOWN_INTERVAL_DAYS[min(review_streak, len(KNOWN_INTERVAL_DAYS)) - 1]


def apply_review_schedule(
    card: Flashcard,
    review_status: str,
    *,
    now: datetime | None = None,
) -> Flashcard:
    if review_status not in {"known", "review_again"}:
        raise ValueError("Unsupported flashcard review status.")
    reviewed_at = now or utc_now_naive()
    if reviewed_at.tzinfo is not None:
        reviewed_at = reviewed_at.astimezone(timezone.utc).replace(tzinfo=None)

    card.review_status = review_status
    card.reviewed_at = reviewed_at
    card.review_count += 1
    if review_status == "known":
        card.review_streak += 1
        card.interval_days = interval_for_streak(card.review_streak)
    else:
        card.review_streak = 0
        card.interval_days = 1
    card.next_review_at = reviewed_at + timedelta(days=card.interval_days)
    return card
