-- Persist generated flashcard study artifacts and their source snapshots.
CREATE TABLE flashcard_sets (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id VARCHAR(36) REFERENCES modules(id) ON DELETE SET NULL,
    lecture_id VARCHAR(36) REFERENCES lectures(id) ON DELETE SET NULL,
    difficulty VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX ix_flashcard_sets_user_id ON flashcard_sets(user_id);
CREATE INDEX ix_flashcard_sets_module_id ON flashcard_sets(module_id);
CREATE INDEX ix_flashcard_sets_lecture_id ON flashcard_sets(lecture_id);
CREATE INDEX ix_flashcard_sets_user_created_at ON flashcard_sets(user_id, created_at DESC);

CREATE TABLE flashcards (
    id VARCHAR(36) PRIMARY KEY,
    flashcard_set_id VARCHAR(36) NOT NULL REFERENCES flashcard_sets(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    review_status VARCHAR(20) NOT NULL DEFAULT 'unreviewed',
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_flashcards_review_status CHECK (review_status IN ('unreviewed', 'known', 'review_again')),
    CONSTRAINT uq_flashcards_set_position UNIQUE (flashcard_set_id, position)
);
CREATE INDEX ix_flashcards_flashcard_set_id ON flashcards(flashcard_set_id);
CREATE INDEX ix_flashcards_review_status ON flashcards(review_status);

CREATE TABLE flashcard_sources (
    id VARCHAR(36) PRIMARY KEY,
    flashcard_id VARCHAR(36) NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    source_id VARCHAR(50) NOT NULL,
    chunk_id VARCHAR(36) REFERENCES document_chunks(id) ON DELETE SET NULL,
    lecture_id VARCHAR(36) REFERENCES lectures(id) ON DELETE SET NULL,
    lecture_title_snapshot VARCHAR(255) NOT NULL,
    module_id VARCHAR(36) REFERENCES modules(id) ON DELETE SET NULL,
    page_number INTEGER,
    chunk_index INTEGER NOT NULL,
    CONSTRAINT uq_flashcard_sources_card_source UNIQUE (flashcard_id, source_id)
);
CREATE INDEX ix_flashcard_sources_flashcard_id ON flashcard_sources(flashcard_id);
CREATE INDEX ix_flashcard_sources_chunk_id ON flashcard_sources(chunk_id);
