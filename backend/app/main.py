"""FastAPI application entry point."""

from fastapi import FastAPI

app = FastAPI(title="AI-StudyMate API", version="0.1.0")


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    """Return a simple service health response."""
    return {"status": "ok"}
