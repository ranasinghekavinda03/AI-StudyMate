# Database Migrations

Alembic migration revisions belong in this directory.

The project does not yet include a complete Alembic revision environment. For an
existing PostgreSQL database, apply numbered SQL migrations in order. Migration
`001_nullable_chunk_page_number.sql` allows `NULL` page metadata for formats such
as DOCX and TXT that do not expose reliable page boundaries.

`002_document_chunk_embeddings.sql` enables the PostgreSQL `vector` extension
and adds a nullable `vector(384)` column. Apply it once to an existing database;
then run the explicit embedding backfill for legacy chunks if required. New
uploads always receive embeddings. No backfill runs at application startup.
