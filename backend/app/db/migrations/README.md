# Database Migrations

Alembic migration revisions belong in this directory.

The project does not yet include a complete Alembic revision environment. For an
existing PostgreSQL database, apply numbered SQL migrations in order. Migration
`001_nullable_chunk_page_number.sql` allows `NULL` page metadata for formats such
as DOCX and TXT that do not expose reliable page boundaries.
