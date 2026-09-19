"""Helper script to test database connectivity and list tables."""
import sys
from pathlib import Path

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import inspect, text
from app.db.session import engine, init_db
from app.core.config import settings

def check_connection():
    print("\n--- AI StudyMate Database Diagnostic ---")
    print(f"Target URL: {engine.url}")

    try:
        # 1. Test basic connection
        with engine.connect() as conn:
            # Query version
            if "postgresql" in str(engine.url):
                db_ver = conn.execute(text("SELECT version();")).scalar()
            else:
                db_ver = conn.execute(text("SELECT sqlite_version();")).scalar()
            print(f"[OK] Successfully connected to database engine!")
            print(f"     Version: {db_ver.splitlines()[0]}")

        # 2. Ensure tables are initialized
        init_db()

        # 3. Inspect existing tables
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"[OK] Found {len(tables)} tables:")
        for t in tables:
            columns = [col["name"] for col in inspector.get_columns(t)]
            print(f"     - {t}: {', '.join(columns[:4])}...")

        print("\n--> Database is FULLY CONNECTED and OPERATIONAL! <---\n")
        return True
    except Exception as e:
        print(f"\n[FAIL] Could not connect to database: {e}\n")
        return False

if __name__ == "__main__":
    success = check_connection()
    sys.exit(0 if success else 1)
