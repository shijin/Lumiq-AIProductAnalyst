from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from db.schema import Base
from config.settings import SUPABASE_DB_URL


# ── Single shared engine for entire app ───────────────────────────
engine = create_engine(
    SUPABASE_DB_URL,
    connect_args={"sslmode": "require"},
    poolclass=QueuePool,
    pool_size=3,          # max 3 connections open at once
    max_overflow=2,       # allow 2 extra temporarily
    pool_timeout=30,      # wait 30s for available connection
    pool_recycle=1800,    # recycle connections every 30 mins
    pool_pre_ping=True,   # test connection before using
    echo=False
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def get_engine():
    return engine


def get_session() -> Session:
    """Get a database session. Always use with try/finally to close."""
    return SessionLocal()


def init_db():
    print("Connecting to Supabase PostgreSQL...")
    Base.metadata.create_all(engine)
    print("All tables created successfully.")

    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """))
        tables = [row[0] for row in result]
        print(f"Tables found: {tables}")

    return engine


if __name__ == "__main__":
    init_db()