import re
from typing import Generator
from urllib.parse import quote_plus, unquote
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from app.core.config import settings


def sanitize_database_url(url: str) -> str:
    """Safely escape special characters like '@' in database password if present."""
    if "@" in url and url.count("@") > 1:
        m = re.match(r"^(postgres(?:ql)?:\/\/[^:]+:)(.*)(@[^@]+(?::\d+)?\/.*)$", url)
        if m:
            prefix, raw_pass, suffix = m.groups()
            encoded_pass = quote_plus(unquote(raw_pass))
            return f"{prefix}{encoded_pass}{suffix}"
    return url


db_url = sanitize_database_url(settings.DATABASE_URL)

connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    db_url,
    connect_args=connect_args,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    # Ensure all models are imported before creating tables
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
