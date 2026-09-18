from fastapi import FastAPI

app = FastAPI(
    title="AI StudyMate API",
    version="1.0.0"
)


@app.get("/")
def root():
    return {
        "message": "AI StudyMate API is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }