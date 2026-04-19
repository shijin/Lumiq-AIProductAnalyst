from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from db.schema import Base
from config.settings import SUPABASE_DB_URL


def get_engine():
    engine = create_engine(
        SUPABASE_DB_URL,
        connect_args={"sslmode": "require"},
        pool_pre_ping=True      # auto-reconnects if connection drops
    )
    return engine


def get_session():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    return Session()


def init_db():
    print("Connecting to Supabase PostgreSQL...")
    engine = get_engine()

    print("Creating tables...")
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
        print(f"\nTables found in database: {tables}")

    return engine


if __name__ == "__main__":
    init_db()