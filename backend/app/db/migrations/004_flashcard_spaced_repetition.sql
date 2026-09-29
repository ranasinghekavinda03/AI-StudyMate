-- Add deterministic basic spaced-repetition scheduling to persisted flashcards.
-- Existing cards are backfilled before the non-null constraints are applied.
ALTER TABLE flashcards
    ADD COLUMN next_review_at TIMESTAMP WITHOUT TIME ZONE,
    ADD COLUMN interval_days INTEGER,
    ADD COLUMN review_streak INTEGER;

UPDATE flashcards
SET interval_days = 0,
    review_streak = 0;

ALTER TABLE flashcards
    ALTER COLUMN interval_days SET NOT NULL,
    ALTER COLUMN review_streak SET NOT NULL;

CREATE INDEX ix_flashcards_next_review_at ON flashcards(next_review_at);
