# AI StudyMate

AI StudyMate is an AI-powered study platform where students upload lecture material and study from their own content. It combines semantic retrieval with grounded generation so chat answers and generated study material stay tied to uploaded sources.

This repository is a local practice and portfolio project. It demonstrates a complete study workflow rather than production deployment infrastructure.

## Key Features

- JWT registration, login, session restoration, and protected routes
- User-owned module management
- PDF, DOCX, and TXT lecture upload
- Text extraction, cleaning, overlapping chunking, and local file storage
- Local sentence-transformer embeddings (`all-MiniLM-L6-v2` by default)
- PostgreSQL and pgvector semantic retrieval
- Grounded RAG chat with backend-validated source citations
- Source-grounded MCQ, summary, and flashcard generation
- Persistent flashcard sets with source metadata
- Known and review-again tracking
- Basic interval-based spaced repetition and a due-review queue
- Dashboard statistics for study content and flashcard progress

## Tech Stack

### Frontend

- React 19
- Vite 8
- React Router
- Lucide React
- Node.js built-in test runner
- Oxlint

### Backend

- FastAPI and Uvicorn
- SQLAlchemy
- PostgreSQL with pgvector
- sentence-transformers
- Gemini through the `google-genai` SDK
- PyJWT and bcrypt
- pypdf and python-docx
- pytest

## Architecture Overview

The main retrieval and generation path is:

```text
Upload
  -> extract and clean text
  -> create overlapping chunks
  -> generate local embeddings
  -> store vectors in PostgreSQL/pgvector
  -> retrieve relevant owned chunks
  -> send bounded context to Gemini
  -> validate and return grounded output
```

The backend assigns source identifiers to retrieved chunks and maps generated citations back to trusted lecture, page, and excerpt metadata. It does not trust the model to invent citation metadata.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the principal components and data flows.

## Main Study Workflow

1. Register or sign in.
2. Create a module.
3. Upload a PDF, DOCX, or TXT lecture.
4. Ask grounded questions about a module or lecture.
5. Generate and complete an MCQ quiz.
6. Generate a source-based summary.
7. Generate and save flashcard sets.
8. Mark cards as known or review again, then work through the due queue.
9. View content and review statistics on the dashboard.

## Project Structure

```text
AI-StudyMate/
|-- backend/             FastAPI API, persistence, AI services, and tests
|   `-- app/db/migrations/  Ordered SQL updates for existing databases
|-- frontend/            React application and focused Node tests
`-- docs/                Architecture and project documentation
```

## Local Setup

### Prerequisites

- Python 3.10 or newer
- Node.js with npm (a current LTS release is recommended)
- PostgreSQL with the pgvector extension
- A Gemini API key for chat and generated study material

The embedding model is downloaded by `sentence-transformers` on first use, so that initial operation requires network access. Embedding inference then runs locally.

### Database and backend

Create a PostgreSQL database, enable pgvector, and place your local settings in `backend/.env`. Start from the supplied example:

```powershell
cd backend
Copy-Item .env.example .env
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

For macOS or Linux, activate the environment with `source .venv/bin/activate`.

Set `DATABASE_URL` to a PostgreSQL connection URL. On application startup, SQLAlchemy calls `create_all()` for missing tables. Existing databases use the numbered SQL files in `backend/app/db/migrations/`; apply them in order as described in that directory's [migration README](backend/app/db/migrations/README.md). This is a practical local workflow, not a complete production-grade Alembic history.

The API runs at `http://localhost:8000`, with interactive documentation at `http://localhost:8000/docs`.

### Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

The frontend defaults to `http://localhost:8000/api/v1`. Set `VITE_API_BASE_URL` (or the supported fallback `VITE_API_URL`) to use another API location.

## Environment Variables

The backend reads `backend/.env`. The current configuration supports:

```dotenv
DATABASE_URL=postgresql://user:password@localhost:5432/studymate
JWT_SECRET_KEY=replace-with-a-local-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=["http://localhost:5173"]

LLM_PROVIDER=gemini
LLM_API_KEY=your-gemini-api-key
LLM_MODEL=your-supported-gemini-model
LLM_TIMEOUT_SECONDS=30

EMBEDDING_PROVIDER=local
EMBEDDING_MODEL=all-MiniLM-L6-v2
EMBEDDING_DIMENSION=384
RETRIEVAL_TOP_K=5
RETRIEVAL_MAX_TOP_K=20

FILE_STORAGE=local
UPLOAD_DIR=uploads
CHUNK_SIZE_WORDS=500
CHUNK_OVERLAP_WORDS=75
```

Do not commit real credentials. The application uses `LLM_API_KEY`; it does not read a `GEMINI_API_KEY` variable.

## Testing and Quality Checks

Current verified baseline:

- Backend: **125 tests passing**
- Frontend: **109 tests passing**
- Frontend production build: passing
- Frontend lint: 0 warnings and 0 errors

Run the checks with:

```powershell
cd backend
pytest
```

```powershell
cd frontend
npm test
npm run build
npm run lint
```

Frontend tests use Node's built-in test runner; this project does not use Vitest or React Testing Library.

## Screenshots

Screenshots can be added from the local running application for the dashboard, RAG chat, quiz, flashcards, and due-review views.

## Limitations

- Intended for local practice and portfolio demonstration, not production deployment
- Uploaded files are stored locally; no cloud object storage is configured
- No password-reset email service or notification system
- Spaced repetition uses a basic fixed interval progression rather than advanced SM-2 scheduling
- No native mobile application

## Future Improvements

- Production deployment and managed secrets
- Cloud object storage and production-ready migration management
- More advanced flashcard scheduling
- Stronger browser-level end-to-end coverage
