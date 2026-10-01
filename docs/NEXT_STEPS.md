# AI StudyMate — Recommended Next Steps

## Current State

The project already has:

- FastAPI application structure and database models
- JWT registration, login, refresh, and protected routes
- Module CRUD endpoints
- Lecture metadata CRUD endpoints
- PDF, DOCX, and TXT upload with text extraction
- A React interface for dashboard, modules, lectures, chat, and quizzes
- A consistent warm-library visual theme
- Backend tests for authentication, modules, health checks, and document uploads

The main product screens still use demo data, and the RAG and quiz services are placeholders. The next goal should be a complete real-data flow from module creation to document upload.

## Recommended Implementation Order

### Milestone 1 — Connect the Frontend to Real Data

This should be the immediate priority.

- [ ] Replace demo modules in `ModulesPage.jsx` with `api.modules.list()`
- [ ] Connect module creation to `api.modules.create()`
- [ ] Add module update and delete actions
- [ ] Replace demo lectures in `LecturePage.jsx` with `api.lectures.list()`
- [ ] Add an upload method to `frontend/src/api/api.js`
- [ ] Submit files as `multipart/form-data` to `POST /api/v1/lectures/upload`
- [ ] Populate the module selector using real modules
- [ ] Connect confirmed lecture deletion to `api.lectures.delete()`
- [ ] Show loading, empty, success, and error states
- [ ] Refresh dashboard totals using real module and lecture data

Definition of done:

1. A user can create a module in the browser.
2. The user can upload a PDF, DOCX, or TXT document to that module.
3. The uploaded lecture appears after refreshing the page.
4. A lecture is deleted from the database only after confirmation.
5. API errors are visible to the user.

## Milestone 2 — Persist Extracted Text and Build Ingestion

The upload endpoint currently returns extracted text, but it does not persist document content for retrieval.

- [ ] Split extracted text into chunks while preserving page numbers
- [ ] Save chunks in the `document_chunks` table
- [ ] Normalize whitespace and remove repeated headers or footers
- [ ] Add configurable chunk size and overlap settings
- [ ] Store ingestion status: `processing`, `ready`, or `failed`
- [ ] Move extraction and chunking out of the request when processing becomes slow
- [ ] Return the real chunk count in lecture responses
- [ ] Delete the stored physical file when its lecture is deleted
- [ ] Add tests for PDF page tracking and chunk persistence

Suggested chunk metadata:

```text
lecture_id
page_number
chunk_index
chunk_text
embedding
```

Definition of done: every uploaded document produces searchable chunks with reliable lecture and page references.

## Milestone 3 — Embeddings and Semantic Retrieval

- [ ] Choose an embedding provider
- [ ] Use PostgreSQL with the `pgvector` extension for production
- [ ] Generate an embedding for each stored chunk
- [ ] Implement similarity search scoped to the signed-in user
- [ ] Allow retrieval by module, lecture, or all user documents
- [ ] Add a retrieval endpoint for development and testing
- [ ] Test that one user can never retrieve another user's content

Definition of done: a question returns the most relevant document chunks with lecture titles and page numbers.

## Milestone 4 — RAG Study Chat

- [ ] Implement the service in `backend/app/services/rag_pipeline.py`
- [ ] Add a protected chat request and response schema
- [ ] Implement `POST /api/v1/rag/chat`
- [ ] Build prompts using only retrieved study material
- [ ] Require citations in generated answers
- [ ] Return citation objects containing lecture ID, title, page, and excerpt
- [ ] Connect `ChatPage.jsx` to the real endpoint
- [ ] Add conversation loading and error states
- [ ] Clearly explain when the uploaded material does not contain an answer

Definition of done: users can ask a question and receive a grounded response with clickable source citations.

## Milestone 5 — Quiz Generation and Results

- [ ] Implement `backend/app/services/quiz_generator.py`
- [ ] Generate structured multiple-choice questions from retrieved chunks
- [ ] Validate LLM output with Pydantic schemas
- [ ] Save quizzes, questions, answers, and scores
- [ ] Connect `QuizPage.jsx` to real lectures and modules
- [ ] Add difficulty and question-count controls
- [ ] Show explanations and source citations after submission
- [ ] Display quiz history and progress on the dashboard

Definition of done: users can generate, complete, and review a quiz based only on their uploaded material.

## Milestone 6 — Production Readiness

- [ ] Add database migrations with Alembic
- [ ] Move from SQLite to PostgreSQL for deployed environments
- [ ] Validate uploaded files by content as well as extension
- [ ] Add rate limiting and stricter upload security
- [ ] Configure structured logging and error reporting
- [ ] Add frontend component and API integration tests
- [ ] Add CI checks for backend tests, frontend linting, and frontend builds
- [ ] Document environment variables and deployment steps
- [ ] Add backups and a retention policy for uploaded documents
- [ ] Perform accessibility and mobile-layout testing

## Suggested Next Sprint

Keep the first sprint focused on one complete user workflow.

### Sprint Goal

Create a module, upload a real document, list it, and delete it safely from the browser.

### Task Order

1. Load modules from the API.
2. Connect the module creation form.
3. Add `api.lectures.upload(file, moduleId, title, token)`.
4. Replace the simulated lecture upload process.
5. Load lectures from the API.
6. Connect the existing delete-confirmation dialog to the delete endpoint.
7. Add user-facing API error messages.
8. Add frontend tests for the workflow.

### Avoid in This Sprint

- Do not add an LLM before real uploads and persistence work end to end.
- Do not display random page or chunk counts.
- Do not expose extracted document text in normal frontend responses once ingestion is implemented.
- Do not introduce background workers until synchronous ingestion creates a measurable performance issue.

## Recommended First Task

Start with **Frontend Module and Lecture API Integration**. It unlocks the first genuine end-to-end workflow and provides a stable base for chunking, retrieval, chat, and quizzes.

