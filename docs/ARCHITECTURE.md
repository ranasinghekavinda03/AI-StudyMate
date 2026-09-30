# Architecture

AI StudyMate is a local full-stack study application. The React client calls a FastAPI API, and the backend owns authentication, data access, document processing, retrieval, generation, and citation validation.

## Components

```text
React frontend
      |
      v
FastAPI API and JWT authorization
      |
      +--> PostgreSQL / pgvector
      |
      +--> Local sentence-transformer embedding service
      |
      `--> Gemini provider via google-genai
```

- **Frontend:** React pages for authentication, modules, lectures, chat, quizzes, summaries, flashcards, due review, and dashboard statistics.
- **API:** FastAPI routes validate input, enforce record ownership, and coordinate application services.
- **Database:** SQLAlchemy persists users, modules, lectures, document chunks, quizzes, and flashcard sets. pgvector stores 384-dimensional document embeddings for semantic search.
- **Embedding service:** `sentence-transformers` generates normalized embeddings locally using `all-MiniLM-L6-v2` by default.
- **LLM service:** The `google-genai` SDK provides grounded chat and structured quiz, summary, and flashcard generation.
- **Storage:** Uploaded source files remain in the configured local upload directory.

## Upload Flow

```text
PDF / DOCX / TXT
  -> validate and save file locally
  -> extract text and source-page metadata where available
  -> normalize text
  -> create overlapping word chunks
  -> generate local embeddings
  -> persist lecture, chunks, and vectors
```

PDF chunks retain page numbers. DOCX and TXT sources may have no reliable page number, so their citation metadata can use a null page rather than inventing one. An embedding failure prevents the lecture and chunks from being saved as a successful ingestion.

## RAG Flow

```text
Question
  -> generate query embedding
  -> retrieve user-owned chunks with pgvector cosine distance
  -> build bounded context with backend-assigned source IDs
  -> ask Gemini to answer only from that context
  -> discard unknown citation IDs
  -> return answer plus trusted citation metadata
```

Retrieval can be scoped to a module or lecture. Ownership filters are applied in the database query. Citation titles, pages, chunk indexes, and excerpts come from database records mapped by the backend—not from model-generated metadata. When relevant context is unavailable, the pipeline returns a fixed insufficient-context response.

## Generated Study Material

Quiz, summary, and flashcard services retrieve owned source chunks and request structured output from Gemini. Backend schemas validate generated data before it is returned or persisted. Persistent flashcard sets keep ordered cards and snapshots of their source metadata.

## Flashcard Review Flow

```text
Generate flashcards
  -> save a flashcard set
  -> review a card as known or review again
  -> update review count, streak, interval, and next-review time
  -> query cards whose next-review time is due
  -> present the due-review queue
```

A known response advances through fixed intervals of 1, 3, 7, 14, and 30 days. A review-again response resets the streak and schedules the card for the next day. This is intentionally a basic scheduler, not an SM-2 implementation.

## Local Database Lifecycle

Application startup calls SQLAlchemy `create_all()` to create missing tables. Numbered SQL migrations under `backend/app/db/migrations/` update existing databases for nullable page metadata, pgvector embeddings, flashcard persistence, and review scheduling. This local workflow is functional but is not presented as a production-grade migration history.
