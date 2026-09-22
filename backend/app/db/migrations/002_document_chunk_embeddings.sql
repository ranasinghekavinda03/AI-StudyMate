-- Enable native vector storage and add embeddings without changing existing text
-- or metadata. Existing rows remain NULL until explicitly backfilled.
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE document_chunks
    ADD COLUMN IF NOT EXISTS embedding vector(384);

-- No ANN index yet: exact cosine search is appropriate for the current small
-- development dataset and avoids index tuning/training requirements.
