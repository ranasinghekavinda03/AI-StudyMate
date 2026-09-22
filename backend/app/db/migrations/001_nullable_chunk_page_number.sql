-- PostgreSQL migration for existing databases.
-- DOCX and TXT have no reliable page boundary, so their chunks store NULL.
ALTER TABLE document_chunks ALTER COLUMN page_number DROP NOT NULL;
ALTER TABLE document_chunks ALTER COLUMN page_number DROP DEFAULT;
