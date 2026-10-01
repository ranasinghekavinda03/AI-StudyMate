AI StudyMate
AI StudyMate is a full-stack AI-powered study platform that helps students learn from their own lecture materials.
Students can upload PDF, DOCX, or TXT files and use the uploaded content to ask grounded questions, generate summaries and quizzes, create flashcards, and review cards with a simple spaced-repetition workflow.
Project type: Local practice and portfolio project.

✨ Features
- JWT-based registration and login
- Protected student workspace
- Module management
- PDF, DOCX, and TXT lecture uploads
- Text extraction, cleaning, and chunking
- Local sentence-transformer embeddings
- PostgreSQL + pgvector semantic search
- Grounded RAG chat with source citations
- AI-generated MCQ quizzes
- AI-generated summaries
- AI-generated flashcards
- Persistent saved flashcard sets
- Known / Review Again tracking
- Basic spaced-repetition scheduling
- Due for Review study queue
- Real dashboard statistics
- Public animated landing page
- Responsive educational UI with reduced-motion support
🧠 How It Works
Lecture Upload
      ↓
Text Extraction & Cleaning
      ↓
Overlapping Chunks
      ↓
Local Embeddings
      ↓
PostgreSQL + pgvector
      ↓
Relevant Context Retrieval
      ↓
Gemini
      ↓
Grounded Answer / Quiz / Summary / Flashcards
      ↓
Validated Source Citations
AI StudyMate retrieves relevant content from the authenticated user's own study materials before sending bounded context to the LLM. Citation identifiers returned by the model are validated against trusted backend metadata.
For more detail, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
🛠 Tech Stack
Frontend
- React 19
- Vite 8
- React Router
- Lucide React
- Node.js built-in test runner
- Oxlint
Backend
- FastAPI
- Uvicorn
- SQLAlchemy
- PostgreSQL
- pgvector
- sentence-transformers
- Google Gemini via google-genai
- PyJWT
- bcrypt
- pypdf
- python-docx
- pytest
📚 Study Workflow
1. Create an account and sign in.
2. Create a module.
3. Upload lecture material.
4. Ask questions using grounded RAG chat.
5. Generate and complete quizzes.
6. Generate structured summaries.
7. Generate and save flashcards.
8. Mark cards as Known or Review Again.
9. Review due cards using the spaced-repetition queue.
10. Track study activity from the dashboard.
📁 Project Structure
AI-StudyMate/
├── backend/        # FastAPI API, database models, AI services, migrations, tests
├── frontend/       # React/Vite application and frontend tests
└── docs/           # Architecture and project documentation
🚀 Local Setup
Prerequisites
- Python 3.10+
- Node.js + npm
- PostgreSQL
- pgvector
- Gemini API key
The embedding model (all-MiniLM-L6-v2) is downloaded on first use and then runs locally.
Backend
cd backend
Copy-Item .env.example .env
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
For macOS/Linux:
source .venv/bin/activate
Backend API:
http://localhost:8000
Swagger/OpenAPI docs:
http://localhost:8000/docs
Frontend
cd frontend
npm install
npm run dev
Vite normally runs at:
http://localhost:5173
⚙️ Environment Configuration
Create backend/.env from the provided example file.
Important variables include:
DATABASE_URL=
JWT_SECRET_KEY=

LLM_PROVIDER=gemini
LLM_API_KEY=
LLM_MODEL=
LLM_TIMEOUT_SECONDS=

EMBEDDING_PROVIDER=local
EMBEDDING_MODEL=all-MiniLM-L6-v2
EMBEDDING_DIMENSION=384

UPLOAD_DIR=uploads
CORS_ORIGINS=["http://localhost:5173"]
The frontend can use:
VITE_API_BASE_URL=http://localhost:8000/api/v1
Never commit real passwords, API keys, JWT secrets, or database credentials.

🗄 Database
AI StudyMate uses PostgreSQL with the pgvector extension for vector similarity search.
The project currently uses a practical local-development database workflow with SQLAlchemy models and numbered SQL migrations.
Migration files are located in:
backend/app/db/migrations/
See the migration README in that directory for details.
✅ Testing
Current verified project status:
- Backend: 125 tests passing
- Frontend: 115 tests passing
- Frontend production build: passing
- Frontend lint: 0 warnings / 0 errors
Run backend tests:
cd backend
pytest
Run frontend checks:
cd frontend
npm test
npm run build
npm run lint
🎨 UI
The frontend includes:
- Public animated landing page
- Educational indigo / blue / violet design system
- Responsive login and registration pages
- Modern dashboard
- Animated study cards and flashcards
- Reduced-motion accessibility support
- Responsive layouts for desktop, tablet, and mobile
📸 Screenshots
Recommended screenshots for the repository:
- Landing Page
- Dashboard
- RAG Chat
- Quiz
- Summary
- Flashcards
- Due Review
Add screenshots from the local running application when ready.

⚠️ Scope
This project is designed for practice and portfolio use, not as a production SaaS platform.
Current intentional limitations:
- Local file storage
- No password-reset email service
- No notification system
- Basic fixed-interval spaced repetition instead of advanced SM-2
- No native mobile application
🔮 Possible Future Improvements
- Browser-level end-to-end testing
- Cloud file storage
- Production deployment
- More advanced review scheduling
📌 Project Purpose
AI StudyMate was built to practice and demonstrate:
- Full-stack development
- REST API design
- Authentication and ownership isolation
- PostgreSQL and pgvector
- Retrieval-Augmented Generation (RAG)
- Embeddings and semantic retrieval
- LLM integration
- Grounded citation handling
- AI-assisted study tools
- Persistent learning workflows
- Frontend UX and responsive design
