# AI-StudyMate

AI-StudyMate is a study assistant with a Python API backend and a JavaScript frontend.

## Project Structure

- `backend/` - FastAPI application, domain services, database layer, and tests.
- `frontend/` - Frontend application and tests.
- `docs/` - Project documentation.

## Getting Started

### Backend

```text
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```text
cd frontend
npm install
npm run dev
```

The backend API is available at `http://localhost:8000` and its interactive documentation is at `http://localhost:8000/docs`.
