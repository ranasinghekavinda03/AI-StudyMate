# AI StudyMate – Intelligent Student Learning Platform 🎓

A full-stack, RAG-powered study assistant where students upload lecture notes/PDFs, chat with their own material, auto-generate MCQs and flashcards, take quizzes, and track progress — with every AI answer backed by a cited source (lecture + page number).

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [Feature Roadmap (V1 → V3)](#4-feature-roadmap-v1--v3)
5. [Detailed Feature Breakdown](#5-detailed-feature-breakdown)
6. [The RAG Pipeline (Core AI Workflow)](#6-the-rag-pipeline-core-ai-workflow)
7. [Database Schema](#7-database-schema)
8. [Backend API / Function Reference](#8-backend-api--function-reference)
9. [Folder Structure](#9-folder-structure)
10. [Authentication Flow](#10-authentication-flow)
11. [UI/UX Design System — Prompts & Color Palette](#11-uiux-design-system--prompts--color-palette)
12. [Do You Need to "Buy" an AI Module for the Agent?](#12-do-you-need-to-buy-an-ai-module-for-the-agent)
13. [Machine Learning — Do You Need Training Data?](#13-machine-learning--do-you-need-training-data)
14. [Environment Variables](#14-environment-variables)
15. [Testing Strategy](#15-testing-strategy)
16. [Deployment Plan](#16-deployment-plan)
17. [Milestone Checklist](#17-milestone-checklist)
18. [Future Enhancements (V3+)](#18-future-enhancements-v3)

---

## 1. Project Overview

**AI StudyMate** is a student learning platform built around a real Retrieval-Augmented Generation (RAG) pipeline rather than a simple "wrap an API call" chatbot. Students upload lecture material, and the system extracts, cleans, chunks, embeds, and stores it in a vector database. When a student asks a question, generates a quiz, or requests a summary, the relevant chunks are retrieved and passed to the LLM — and every answer cites its source lecture and page number.

**Why this project is strong for a portfolio:**
- Demonstrates a real RAG pipeline (not just an API wrapper)
- Full-stack (React + FastAPI + PostgreSQL)
- Touches auth, file handling, vector search, LLM orchestration, analytics, and dashboards
- Staged roadmap shows planning discipline
- Evidence-based answers (source citation) show attention to AI reliability — a real industry concern

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React + Vite + Tailwind CSS | Fast dev server, utility-first styling |
| Charts | Recharts | Progress/analytics dashboards |
| Backend | FastAPI (Python) | Async, auto-generated OpenAPI docs |
| ORM | SQLAlchemy (+ Alembic for migrations) | |
| Database | PostgreSQL | Relational data + pgvector extension |
| Vector Store | pgvector (or Chroma standalone) | Start with pgvector to avoid a second DB |
| Auth | JWT (access + refresh tokens) | `python-jose` + `passlib[bcrypt]` |
| AI / LLM | Gemini API or OpenAI-compatible endpoint | Swappable via an interface layer |
| Embeddings | Gemini/OpenAI embeddings OR `sentence-transformers` (free, local) | See Section 12 |
| RAG Framework | LangChain (v1), LangGraph (v3 for agentic flows) | |
| File Parsing | `pypdf` / `pdfplumber`, `python-docx` | |
| File Storage | Local disk (dev) → Supabase Storage / S3 / Cloudinary (prod) | |
| Testing | Pytest (backend), Vitest + React Testing Library (frontend) | |
| Deployment | Vercel (frontend) + Railway/Render (backend + Postgres) | |
| Version Control | Git + GitHub | |

---

## 3. System Architecture

```mermaid
flowchart LR
    subgraph Client["React Frontend (Vite + Tailwind)"]
        UI[UI Pages / Components]
    end

    subgraph API["FastAPI Backend"]
        Auth[Auth Service - JWT]
        Docs[Document Service]
        RAGSvc[RAG / Chat Service]
        Quiz[MCQ + Flashcard Generator]
        Analytics[Progress & Analytics Service]
        Planner[Study Planner Service]
    end

    subgraph AI["AI Layer"]
        Embed[Embedding Model]
        LLM[LLM - Gemini/OpenAI-compatible]
        Chain[LangChain Orchestration]
    end

    subgraph DB["Data Layer"]
        PG[(PostgreSQL - core data)]
        Vec[(pgvector - embeddings)]
        Store[(File Storage - local/S3/Cloudinary)]
    end

    UI -->|REST/JSON + JWT| API
    Docs --> Store
    Docs --> Embed --> Vec
    RAGSvc --> Vec
    RAGSvc --> Chain --> LLM
    Quiz --> Chain
    Auth --> PG
    Docs --> PG
    Analytics --> PG
    Planner --> PG
```

**Flow in words:** the React app talks to FastAPI over REST with a JWT in the header. FastAPI routes split into services (auth, documents, RAG chat, quiz/flashcard generation, analytics, planner). Document uploads go to file storage and, in parallel, get embedded and stored in pgvector. Chat/quiz/summary requests retrieve relevant vectors, build a prompt via LangChain, and call the LLM. All structured data (users, courses, quizzes, results, bookmarks) lives in PostgreSQL.

---

## 4. Feature Roadmap (V1 → V3)

Building everything at once is the #1 way these projects stall. Ship in stages:

### 🟢 Version 1 — Core MVP
- Register / Login (JWT auth)
- Module/course management (CRUD)
- Document upload (PDF/DOCX/TXT)
- RAG pipeline: extract → chunk → embed → store → retrieve → answer
- Basic AI chat over uploaded documents (with source citation)
- MCQ generator (single-answer, one difficulty level)
- Basic quiz-taking screen with score

### 🟡 Version 2 — Study Tools
- Flashcards (auto-generated from content)
- Multi-answer MCQs + difficulty levels (easy/medium/hard)
- Smart summaries (simple/medium/detailed)
- Quiz history + explanations
- Progress tracking (per-module completion, accuracy)
- Bookmarks & personal notes
- Search across notes/lectures

### 🔵 Version 3 — Intelligence Layer
- Weak-topic detection (from quiz performance)
- Personalized study recommendations ("Revise Lecture 5 — weak in A* Search")
- Study planner (exam dates, revision sessions, task reminders)
- Admin dashboard (user/content management, usage stats)
- Analytics dashboard (charts: accuracy trends, module progress, activity heatmap)
- AI study agent (LangGraph-based multi-step planning agent)

---

## 5. Detailed Feature Breakdown

| Feature | Description | Key Tech |
|---|---|---|
| Auth | Register, login, password reset, profile edit | JWT, bcrypt |
| Module Management | CRUD for subjects (ML, AI, Statistics, etc.) | PostgreSQL |
| Document Upload | PDF/DOCX/TXT ingestion, tied to a module/lecture | pypdf, python-docx |
| RAG Chat | Ask questions grounded only in uploaded material | LangChain + pgvector + LLM |
| Smart Summaries | Simple/medium/detailed explanation levels | Prompt templating |
| MCQ Generator | Easy/medium/hard, single + multi-answer | LLM + structured JSON output |
| Flashcards | Q/A pairs generated from chunk content | LLM |
| Quiz System | Timed quiz, immediate feedback + explanation | FastAPI + Postgres |
| Progress Tracking | Marks, weak topics, lecture completion | Postgres aggregation queries |
| AI Recommendations | Suggests what to revise based on weak areas | Rule-based (V2) → ML-assisted (V3) |
| Study Planner | Exam dates, tasks, revision calendar | Postgres + cron/reminders |
| Notes Search | Full-text / semantic search across all lectures | pgvector similarity search |
| Bookmarks | Save specific chunks/answers for later | Postgres |
| Admin Dashboard | Manage users, content, flagged issues | Role-based access control |
| Analytics Dashboard | Charts for accuracy, progress, activity | Recharts |

---

## 6. The RAG Pipeline (Core AI Workflow)

This is the technically impressive part of the project — build it as an explicit pipeline, not a single API call.

```mermaid
flowchart TD
    A[Student uploads PDF/DOCX] --> B[Extract raw text]
    B --> C[Clean text - remove headers/footers/noise]
    C --> D[Chunk text - e.g. 500-800 tokens, with overlap]
    D --> E[Generate embeddings per chunk]
    E --> F[Store vectors + metadata in pgvector]
    F --> G{Student asks a question}
    G --> H[Embed the question]
    H --> I[Similarity search - top-k relevant chunks]
    I --> J[Build prompt: question + retrieved chunks + citation instructions]
    J --> K[LLM generates answer]
    K --> L[Return answer + source lecture/page citation]
```

**Step-by-step:**

1. **Extract** — `pypdf`/`pdfplumber` pulls raw text (and page numbers!) from the PDF; `python-docx` for Word files.
2. **Clean** — strip repeated headers/footers, fix broken line breaks, normalize whitespace.
3. **Chunk** — split into ~500–800 token chunks with ~50–100 token overlap so context isn't cut mid-idea. Store `{lecture_id, page_number, chunk_text}` per chunk.
4. **Embed** — convert each chunk into a vector using an embedding model.
5. **Store** — save vectors + metadata (lecture title, page number, module) in pgvector.
6. **Retrieve** — when a question comes in, embed the question and run a similarity search (cosine distance) to get the top-k (e.g. 4–6) most relevant chunks.
7. **Augment + Generate** — build a prompt that includes the retrieved chunks, the question, and an instruction to only answer from provided context and cite the source.
8. **Cite** — the LLM is prompted to output in a structured format so the frontend can render:

   > *"Early stopping prevents overfitting by halting training once validation performance stops improving."*
   > **Source: ANN Lecture 04 — Page 18**

   This is done by including page/lecture metadata alongside each chunk in the prompt, and instructing the model (via system prompt + few-shot example) to always attach `Source: {lecture} — Page {page}` to claims.

**Same pipeline powers everything else:**
- **Summaries** → retrieve all chunks for a lecture → summarize at requested depth
- **MCQ generation** → retrieve chunks for a topic/lecture → prompt LLM for structured JSON questions
- **Flashcards** → same retrieval, different output prompt (Q/A pairs)

---

## 7. Database Schema

Core tables (simplified — add indexes/foreign keys in migrations):

```mermaid
erDiagram
    USERS ||--o{ MODULES : creates
    MODULES ||--o{ LECTURES : contains
    LECTURES ||--o{ DOCUMENT_CHUNKS : "split into"
    LECTURES ||--o{ QUIZZES : generates
    QUIZZES ||--o{ QUESTIONS : contains
    USERS ||--o{ QUIZ_ATTEMPTS : takes
    QUIZ_ATTEMPTS ||--o{ ANSWERS : records
    USERS ||--o{ FLASHCARDS : owns
    USERS ||--o{ BOOKMARKS : saves
    USERS ||--o{ STUDY_PLAN_ITEMS : schedules

    USERS {
        uuid id PK
        string email
        string password_hash
        string name
        string role
        timestamp created_at
    }
    MODULES {
        uuid id PK
        uuid user_id FK
        string title
        string description
    }
    LECTURES {
        uuid id PK
        uuid module_id FK
        string title
        string file_url
        string file_type
    }
    DOCUMENT_CHUNKS {
        uuid id PK
        uuid lecture_id FK
        int page_number
        text chunk_text
        vector embedding
    }
    QUIZZES {
        uuid id PK
        uuid lecture_id FK
        string difficulty
    }
    QUESTIONS {
        uuid id PK
        uuid quiz_id FK
        text question_text
        json options
        json correct_answers
        text explanation
    }
    QUIZ_ATTEMPTS {
        uuid id PK
        uuid user_id FK
        uuid quiz_id FK
        float score
        timestamp taken_at
    }
    FLASHCARDS {
        uuid id PK
        uuid user_id FK
        uuid lecture_id FK
        text question
        text answer
    }
    BOOKMARKS {
        uuid id PK
        uuid user_id FK
        uuid chunk_id FK
        text note
    }
    STUDY_PLAN_ITEMS {
        uuid id PK
        uuid user_id FK
        string task
        date due_date
        boolean completed
    }
```

---

## 8. Backend API / Function Reference

Organize FastAPI routes by domain (`/api/v1/...`):

| Module | Endpoint | Function | Description |
|---|---|---|---|
| Auth | `POST /auth/register` | `register_user()` | Create account, hash password |
| Auth | `POST /auth/login` | `login_user()` | Verify credentials, issue JWT |
| Auth | `POST /auth/refresh` | `refresh_token()` | Issue new access token |
| Auth | `POST /auth/reset-password` | `reset_password()` | Email-based reset flow |
| Modules | `GET/POST/PUT/DELETE /modules` | `crud_module()` | Manage subjects |
| Lectures | `POST /lectures/upload` | `upload_lecture()` | Save file, trigger ingestion pipeline |
| Lectures | `GET /lectures/{id}` | `get_lecture()` | Fetch lecture metadata |
| RAG | `POST /rag/ingest` | `ingest_document()` | Extract → clean → chunk → embed → store |
| RAG | `POST /rag/chat` | `answer_question()` | Retrieve chunks → build prompt → call LLM → return cited answer |
| RAG | `POST /rag/summarize` | `generate_summary()` | Retrieve lecture chunks → summarize at chosen depth |
| Quiz | `POST /quiz/generate` | `generate_mcqs()` | Retrieve chunks → prompt LLM for structured MCQ JSON |
| Quiz | `POST /quiz/{id}/submit` | `submit_quiz()` | Score attempt, store answers |
| Flashcards | `POST /flashcards/generate` | `generate_flashcards()` | Retrieve chunks → prompt LLM for Q/A pairs |
| Progress | `GET /progress/summary` | `get_progress()` | Aggregate scores, completion, weak topics |
| Planner | `CRUD /planner/items` | `crud_study_plan()` | Manage tasks/exam dates |
| Search | `GET /search?q=` | `semantic_search()` | Vector search across all user's chunks |
| Bookmarks | `CRUD /bookmarks` | `crud_bookmark()` | Save/annotate chunks |
| Admin | `GET /admin/users` | `list_users()` | Admin-only user management |
| Admin | `GET /admin/analytics` | `platform_analytics()` | Usage-wide stats |

Each endpoint should have a matching Pytest test and a Pydantic request/response schema.

---

## 9. Folder Structure

```
ai-studymate/
├── backend/
│   ├── app/
│   │   ├── api/            # route files per domain (auth.py, rag.py, quiz.py...)
│   │   ├── core/           # config, security, JWT handling
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # rag_pipeline.py, quiz_generator.py, etc.
│   │   ├── db/             # session, migrations (Alembic)
│   │   └── main.py
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── api/            # axios/fetch wrappers
│   │   ├── context/        # auth context, theme context
│   │   └── App.jsx
│   ├── tests/
│   └── package.json
├── docs/
│   └── AI-StudyMate-Project-Documentation.md   # this file
└── README.md
```

---

## 10. Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant D as Database

    U->>F: Enter email/password
    F->>B: POST /auth/login
    B->>D: Verify hashed password
    D-->>B: User record
    B-->>F: access_token + refresh_token (JWT)
    F->>F: Store tokens (memory/secure storage)
    F->>B: Subsequent requests with Authorization: Bearer <token>
    B->>B: Validate JWT on each protected route
```

- Access token: short-lived (~15–30 min)
- Refresh token: longer-lived, used to silently renew access token
- Passwords hashed with bcrypt, never stored in plain text
- Role field (`student` / `admin`) drives access control on admin routes

---

## 11. UI/UX Design System — Prompts & Color Palette

### Recommended color palette

A calm, "focused study" palette works better than a flashy one — students will stare at this for long sessions.

| Role | Color | Hex | Where to use it |
|---|---|---|---|
| Primary | Indigo | `#4F46E5` | Primary buttons, active nav item, links, focus rings |
| Primary Dark (hover) | Deep Indigo | `#4338CA` | Button hover/active states |
| Secondary / Accent | Teal | `#14B8A6` | Success states, "AI answer" bubbles, progress bars |
| Warning | Amber | `#F59E0B` | Quiz "medium" difficulty tag, streak/reminder badges |
| Danger | Rose | `#F43F5E` | Wrong answers, delete actions, "hard" difficulty tag |
| Background (light) | Off-white | `#F8FAFC` | App background |
| Background (dark) | Slate 900 | `#0F172A` | Dark mode background |
| Surface/Card | White / Slate 800 | `#FFFFFF` / `#1E293B` | Cards, modals, panels |
| Text Primary | Slate 900 / Slate 100 | `#0F172A` / `#F1F5F9` | Headings, body text |
| Text Muted | Slate 500 | `#64748B` | Captions, timestamps, helper text |
| Border | Slate 200 / Slate 700 | `#E2E8F0` / `#334155` | Dividers, input borders |

**Difficulty tags:** Easy = Teal `#14B8A6`, Medium = Amber `#F59E0B`, Hard = Rose `#F43F5E` — gives instant visual meaning across MCQ and flashcard screens.

**Typography suggestion:** `Inter` or `Plus Jakarta Sans` for UI text, a monospace font (e.g. `JetBrains Mono`) for any code/formula snippets in lecture content.

### Prompts to use with an AI design tool (or to guide your own Tailwind styling)

Use these as literal prompts if you're using an AI UI generator, or as a design brief for yourself:

**1. Overall design direction**
> "Design a clean, modern student learning dashboard UI using a soft indigo (#4F46E5) and teal (#14B8A6) color scheme on an off-white (#F8FAFC) background. Use generous whitespace, rounded-xl cards with subtle shadows, and Inter font. The tone should feel calm and focused, like Notion or Linear — not flashy or gamified."

**2. Dashboard/home page**
> "Create a dashboard layout with a left sidebar (modules list, study planner, bookmarks) and a main content area showing: a welcome header, 3 stat cards (modules in progress, quiz accuracy %, upcoming exam countdown), and a recent activity feed. Use indigo accents for active states and teal for positive progress indicators."

**3. AI chat interface**
> "Design a two-panel chat interface: left panel shows the uploaded PDF/lecture title and a small document preview; right panel is a chat thread. AI answer bubbles should have a light teal background with a small 'Source: Lecture X — Page Y' citation chip below each answer in muted slate text. User messages align right in indigo bubbles."

**4. Quiz-taking screen**
> "Design a focused, distraction-free quiz interface: one question per screen, a progress bar at top in teal, difficulty badge (easy/medium/hard) color-coded top-right, large tappable answer options with a subtle indigo border on hover/selection, and a clear 'Submit' button in indigo."

**5. Flashcard screen**
> "Design a flip-card component: front shows the question in bold slate text on a white card with a soft shadow, back shows the answer on a light teal background. Include a 'Know it / Still learning' button pair below in teal and amber."

**6. Analytics dashboard**
> "Design an analytics page with 4 chart cards: a line chart of quiz accuracy over time (indigo line), a bar chart of module progress (teal bars), a radar/heatmap of topic strength/weakness (amber-to-rose gradient for weak areas), and a study activity calendar heatmap. Use Recharts styling with consistent axis fonts and light gridlines."

**7. Dark mode**
> "Extend the design system to dark mode: background #0F172A, cards #1E293B, primary indigo lightened to #6366F1 for contrast, text in slate-100. Keep teal and amber accents but slightly desaturated for reduced eye strain during night study sessions."

---

## 12. Do You Need to "Buy" an AI Module for the Agent?

**Short answer: no purchase is required to get started — but you do need access to an LLM API, and free tiers exist.**

Breaking down what "the agent" actually needs:

1. **An LLM (the "brain")** — used for chat answers, summaries, MCQ/flashcard generation.
   - **Free/low-cost options:** Google Gemini API has a free tier (rate-limited, fine for a solo/portfolio project); Groq offers free fast inference on open models (e.g. Llama 3); OpenAI's API is paid but very cheap at small volume (a few cents per hundred requests on `gpt-4o-mini`-class models).
   - **Fully local/free option:** run an open-source model via **Ollama** (e.g. Llama 3.1, Mistral) on your own machine — zero API cost, but needs a reasonably capable GPU/CPU and will be slower and lower quality than hosted models.
   - You don't need to "buy a module" in the sense of purchasing a package — you sign up for an API key, and most providers have a free tier sufficient for development and a portfolio demo.

2. **An embedding model** — used to convert text chunks into vectors.
   - Can be the same provider's embedding endpoint (Gemini/OpenAI embeddings — cheap, usually fractions of a cent per document).
   - Or fully free/local: `sentence-transformers` (e.g. `all-MiniLM-L6-v2`) runs on your machine via Hugging Face, no API key or cost at all. This is a great choice for a student project since it keeps embedding cost at zero.

3. **LangChain/LangGraph** — these are free, open-source Python libraries (`pip install langchain langgraph`), not paid products. They're orchestration frameworks, not something you buy.

4. **Vector database** — pgvector is a free, open-source PostgreSQL extension. Chroma is also free and open-source. No purchase needed.

**Recommended free-tier setup for building this:** Gemini API (LLM, generous free tier) + `sentence-transformers` (free local embeddings) + pgvector (free). This costs $0 to develop and demo. If you later want faster/higher-quality responses, upgrading to a paid tier (OpenAI/Anthropic/Gemini paid) is a config change, not a rebuild — this is why the docs recommend building an "AI provider" interface layer so swapping providers only touches one file.

---

## 13. Machine Learning — Do You Need Training Data?

**Short answer: for most of this project, no — you are using pre-trained models, not training your own.**

It's a common mix-up: "AI features" ≠ "training a machine learning model from scratch." Here's how it breaks down in this project:

- **RAG chat, summaries, MCQ/flashcard generation** → these use a **pre-trained LLM** (Gemini/OpenAI/Llama) as-is. You are not training anything. Your "data" is just the student's own uploaded lecture PDFs, which get embedded and retrieved — that's retrieval, not training.
- **Embeddings** → the embedding model (e.g. `sentence-transformers`) is also pre-trained. You use it directly; no training step needed.
- **Weak-topic detection / recommendations (V3)** → this sounds like ML but can be done with **simple heuristics/statistics**, no training data required: e.g. "if accuracy on questions tagged with topic X < 60%, flag topic X as weak." This is just aggregation logic over your own quiz_attempts table — genuinely no dataset needed.
- **If you later want a real trained classifier** (e.g. predicting which topics a student is likely to struggle with before they even take a quiz) — that *would* need training data, but it would be the data your own app generates over time (quiz results, time spent, topics), not an external dataset. You'd use lightweight tools like `scikit-learn` for this, and realistically you'd need a reasonable volume of real usage data first, so this is a good "future work" item rather than a V1/V2 requirement.

**Bottom line:** don't worry about sourcing or buying a training dataset for this project. Everything through V2, and most of V3, runs on pre-trained models + your own users' content and quiz history. Only a genuinely custom predictive model (optional, later) would need training data, and it would come from your own app's usage, not a purchased dataset.

---

## 14. Environment Variables

```env
# Backend (.env)
DATABASE_URL=postgresql://user:password@localhost:5432/studymate
JWT_SECRET_KEY=change_me
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

LLM_PROVIDER=gemini          # gemini | openai | ollama
LLM_API_KEY=your_api_key_here
EMBEDDING_PROVIDER=local     # local (sentence-transformers) | gemini | openai
EMBEDDING_API_KEY=optional_if_using_hosted_embeddings

FILE_STORAGE=local           # local | s3 | cloudinary | supabase
STORAGE_BUCKET_URL=

# Frontend (.env)
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

---

## 15. Testing Strategy

- **Backend (Pytest):** unit tests per service (`test_rag_pipeline.py`, `test_auth.py`, `test_quiz_generator.py`), and integration tests hitting the FastAPI test client for full request/response cycles. Mock the LLM/embedding calls in unit tests to avoid real API costs.
- **Frontend (Vitest + React Testing Library):** component tests for forms, quiz flow, and chat UI; snapshot tests for dashboard cards.
- **RAG-specific tests:** verify chunking produces expected chunk counts/overlaps, verify retrieval returns chunks from the correct lecture, verify citation metadata is preserved end-to-end.

---

## 16. Deployment Plan

| Component | Platform | Notes |
|---|---|---|
| Frontend | Vercel | Auto-deploy from GitHub `main` branch |
| Backend | Railway or Render | FastAPI + background workers if needed |
| Database | Railway/Render/Supabase Postgres | Enable pgvector extension |
| File Storage | Supabase Storage / Cloudinary / S3 | Swap from local storage once deployed |
| Secrets | Platform's env var manager | Never commit `.env` to GitHub |

---

## 17. Milestone Checklist

- [x] Repo scaffolded (frontend + backend), CI running lint/tests
- [x] Auth (register/login/JWT) working end-to-end
- [x] Module CRUD working
- [ ] Document upload + storage working
- [ ] RAG ingestion pipeline (extract → clean → chunk → embed → store)
- [ ] RAG chat endpoint returning cited answers
- [ ] MCQ generation (single difficulty, single-answer)
- [ ] Basic quiz-taking + scoring UI
- [ ] **→ V1 demo-able**
- [ ] Flashcards
- [ ] Multi-answer + difficulty-tiered MCQs
- [ ] Smart summaries (3 depth levels)
- [ ] Progress tracking + quiz history
- [ ] Bookmarks + notes search
- [ ] **→ V2 demo-able**
- [ ] Weak-topic detection (heuristic)
- [ ] Recommendations engine
- [ ] Study planner
- [ ] Admin + analytics dashboards
- [ ] **→ V3 demo-able**

---

## 18. Future Enhancements (V3+)

- **AI Study Agent (LangGraph):** a multi-step agent that plans a full revision session on its own — e.g. "check weak topics → pull relevant chunks → generate a mixed-difficulty quiz → schedule a follow-up review in 3 days" — instead of one-shot LLM calls.
- **Spaced repetition** for flashcards (SM-2 algorithm) instead of simple review lists.
- **Voice input** for asking questions.
- **Collaborative study groups** with shared modules.
- **Export** summaries/flashcards to PDF/Anki format.

---

*This document is meant to live in your repo (e.g. `docs/AI-StudyMate-Project-Documentation.md`) as the single source of truth for architecture, workflow, and roadmap decisions as the project evolves.*
