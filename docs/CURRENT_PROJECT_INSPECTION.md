# AI StudyMate — Current Project Inspection

## Scope

This report documents the current frontend and backend implementation as it exists in the repository. No AI, RAG, embedding, LangChain, Gemini, pgvector, or quiz features are proposed for the immediate implementation step.

## Relevant Files

### Frontend

- `frontend/src/api/api.js` — shared API client and endpoint wrappers
- `frontend/src/context/AuthContext.jsx` — authentication state and local storage
- `frontend/src/components/ProtectedRoute.jsx` — frontend route protection
- `frontend/src/pages/ModulesPage.jsx` — module interface and current demo data
- `frontend/src/pages/LecturePage.jsx` — lecture upload/library interface and current demo data

### Backend

- `backend/app/main.py` — FastAPI application and `/api/v1` router mounting
- `backend/app/api/__init__.py` — registered API routers
- `backend/app/api/auth.py` — register, login, refresh, and profile endpoints
- `backend/app/api/deps.py` — JWT authentication dependency
- `backend/app/api/modules.py` — module CRUD endpoints
- `backend/app/api/lectures.py` — lecture CRUD and file upload endpoints
- `backend/app/schemas/user.py` — user and authentication schemas
- `backend/app/schemas/token.py` — token schemas
- `backend/app/schemas/module.py` — module schemas
- `backend/app/schemas/lecture.py` — lecture schemas

## API Base URL

The backend mounts its API router under:

```text
/api/v1
```

The frontend uses the first configured value from:

```text
VITE_API_BASE_URL
VITE_API_URL
http://localhost:8000/api/v1
```

## Authentication Endpoints

### Register

```http
POST /api/v1/auth/register
Content-Type: application/json
```

Request:

```json
{
  "name": "Student Name",
  "email": "student@example.com",
  "password": "password",
  "role": "student"
}
```

Response status: `201 Created`

```json
{
  "user": {
    "id": "string",
    "name": "Student Name",
    "email": "student@example.com",
    "role": "student",
    "created_at": "datetime"
  },
  "access_token": "string",
  "refresh_token": "string",
  "token_type": "bearer"
}
```

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json
```

Request:

```json
{
  "email": "student@example.com",
  "password": "password"
}
```

Response:

```json
{
  "user": {
    "id": "string",
    "name": "Student Name",
    "email": "student@example.com",
    "role": "student",
    "created_at": "datetime"
  },
  "access_token": "string",
  "refresh_token": "string",
  "token_type": "bearer"
}
```

### Refresh Tokens

```http
POST /api/v1/auth/refresh
Content-Type: application/json
```

Request:

```json
{
  "refresh_token": "string"
}
```

Response:

```json
{
  "access_token": "string",
  "refresh_token": "string",
  "token_type": "bearer"
}
```

### Current User

```http
GET /api/v1/auth/me
Authorization: Bearer <access_token>
```

## Module Endpoints

Every module endpoint requires a valid access token.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/modules` | List the signed-in user's modules |
| `POST` | `/api/v1/modules` | Create a module |
| `GET` | `/api/v1/modules/{module_id}` | Get one owned module |
| `PUT` | `/api/v1/modules/{module_id}` | Update one owned module |
| `DELETE` | `/api/v1/modules/{module_id}` | Delete one owned module |

Create request:

```json
{
  "title": "Artificial Intelligence",
  "code": "CS 401",
  "description": "Course description"
}
```

Update request fields are optional:

```json
{
  "title": "Updated title",
  "code": "CS 402",
  "description": "Updated description"
}
```

Module response:

```json
{
  "id": "string",
  "user_id": "string",
  "title": "Artificial Intelligence",
  "code": "CS 401",
  "description": "Course description",
  "created_at": "datetime",
  "lectures_count": 0
}
```

Successful deletion returns `204 No Content`.

## Lecture Endpoints

Every lecture endpoint requires a valid access token.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/lectures` | List the signed-in user's lectures |
| `GET` | `/api/v1/lectures?module_id={module_id}` | List lectures for one module |
| `POST` | `/api/v1/lectures` | Create lecture metadata from JSON |
| `POST` | `/api/v1/lectures/upload` | Upload and extract a document |
| `GET` | `/api/v1/lectures/{lecture_id}` | Get one owned lecture |
| `DELETE` | `/api/v1/lectures/{lecture_id}` | Delete one owned lecture record |

### Lecture Metadata Request

```json
{
  "module_id": "string",
  "title": "Introduction to AI",
  "file_type": "pdf",
  "file_url": null,
  "page_count": 0
}
```

### Lecture Upload Request

The upload endpoint requires `multipart/form-data`:

```text
module_id: required string
file: required PDF, DOCX, or TXT file
title: optional string
```

The upload limit is 25 MB.

### Lecture Response

```json
{
  "id": "string",
  "module_id": "string",
  "title": "Introduction to AI",
  "file_type": "pdf",
  "file_url": "uploads/generated-name.pdf",
  "page_count": 10,
  "created_at": "datetime",
  "chunks_count": 0
}
```

The upload response additionally contains:

```json
{
  "extracted_text": "Extracted document contents"
}
```

Successful deletion returns `204 No Content`.

## Current JWT Handling

The frontend stores these values in browser local storage:

```text
studymate_token
studymate_user
```

The API client sends the access token using:

```http
Authorization: Bearer <access_token>
```

Current limitations:

- The refresh token returned by registration and login is not stored.
- The existing refresh API wrapper is not used automatically.
- Expired access tokens are not refreshed automatically.
- The protected route checks whether a user object exists, not whether a valid token exists.
- `AuthContext.jsx` supplies a default mock user.
- Login and registration fall back to mock authentication when the backend is unavailable.
- A user can therefore reach protected frontend pages without a valid backend session.

## Current Frontend Demo Data

### Modules

`ModulesPage.jsx` defines an `INITIAL_MODULES` array with four hardcoded modules:

- CS 401 — Artificial Intelligence
- CS 480 — Machine Learning & Deep Learning
- STAT 350 — Applied Probability & Statistics
- CS 210 — Data Structures & Algorithms

The page initializes local state from this array. Creating a module only updates React state and does not call the backend. The new module disappears after a page refresh.

### Lectures

`LecturePage.jsx` defines an `INITIAL_LECTURES` array with four hardcoded lecture records.

The current upload flow:

- Uses nested timers to simulate processing.
- Does not call `/api/v1/lectures/upload`.
- Generates random page and chunk counts.
- Adds the result only to local React state.
- Uses a hardcoded module selector.

The delete confirmation dialog works visually, but confirmed deletion only removes the lecture from local state. It does not call the backend delete endpoint.

## Existing API Client Gap

`frontend/src/api/api.js` already contains wrappers for:

- Authentication
- Module CRUD
- Lecture list, metadata creation, retrieval, and deletion

It does not contain a wrapper for `POST /lectures/upload`.

The shared request helper also adds this header to every request:

```http
Content-Type: application/json
```

That behavior must be adjusted for file uploads. When sending `FormData`, the browser must generate the multipart `Content-Type` header and boundary.

## Recommended Next Change

Implement one real end-to-end workflow without adding AI features:

1. Remove the default mock user and offline authentication fallback.
2. Store both access and refresh tokens.
3. Restore sessions through `/auth/me` and refresh expired access tokens.
4. Load modules through `GET /api/v1/modules`.
5. Create modules through `POST /api/v1/modules`.
6. Populate the lecture module selector from the returned modules.
7. Add a multipart upload wrapper for `POST /api/v1/lectures/upload`.
8. Replace simulated uploads with the real upload endpoint.
9. Load lectures through `GET /api/v1/lectures`.
10. Connect confirmed deletion to `DELETE /api/v1/lectures/{lecture_id}`.
11. Display loading, empty, success, and API error states.
12. Remove random page counts, random chunk counts, and hardcoded module/lecture records.

## Target Workflow

```text
Register or log in
        ↓
Create a module
        ↓
Upload PDF, DOCX, or TXT
        ↓
Display the persisted lecture
        ↓
Confirm deletion
        ↓
Delete the persisted lecture
```

This should be completed before beginning any RAG, embedding, LLM, or quiz-generation work.
