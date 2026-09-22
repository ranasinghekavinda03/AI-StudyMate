import pytest
import math
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import Base
from app.api.deps import get_db
from app.services import embedding_service

# Use an in-memory SQLite database with StaticPool so all connections share the same memory
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class _TestEmbeddingModel:
    """Fast deterministic semantic stand-in; production uses SentenceTransformer."""

    def encode(self, texts, **kwargs):
        vectors = []
        topic_words = (
            {"neural", "network", "overfit", "overfitting", "regularization", "dropout"},
            {"database", "index", "indexing", "query"},
            {"operating", "system", "scheduling", "cpu", "process"},
            {"userbsecret", "quasar"},
        )
        for text in texts:
            words = set(text.lower().replace("?", "").split())
            vector = [0.0] * 384
            for index, vocabulary in enumerate(topic_words):
                vector[index] = float(len(words & vocabulary))
            if not any(vector):
                vector[10] = 1.0
            norm = math.sqrt(sum(value * value for value in vector))
            vectors.append([value / norm for value in vector])
        return vectors


@pytest.fixture(autouse=True)
def deterministic_embedding_model(monkeypatch):
    monkeypatch.setattr(embedding_service, "_get_model", lambda: _TestEmbeddingModel())


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Override the get_db dependency with test database session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client):
    """Helper fixture to register a test user and return Authorization headers."""
    register_data = {
        "name": "Test Student",
        "email": "student@studymate.ai",
        "password": "Password123!",
        "role": "student"
    }
    response = client.post("/api/v1/auth/register", json=register_data)
    assert response.status_code == 201
    data = response.json()
    token = data["access_token"]
    return {"Authorization": f"Bearer {token}"}, data["user"]
