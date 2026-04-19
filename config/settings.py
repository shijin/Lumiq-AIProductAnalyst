from dotenv import load_dotenv
import os

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL")
GOOGLE_SHEET_NAME = os.getenv("GOOGLE_SHEET_NAME")
GOOGLE_CREDENTIALS_PATH = os.path.join(
    os.path.dirname(__file__), "google_credentials.json"
)

# Ollama config — runs locally, no API key needed
# OLLAMA_EMBEDDING_MODEL = "nomic-embed-text"
#OLLAMA_BASE_URL = "http://localhost:11434"

if not SUPABASE_DB_URL:
    raise ValueError("SUPABASE_DB_URL is not set in .env")
if not ANTHROPIC_API_KEY:
    raise ValueError("ANTHROPIC_API_KEY is not set in .env")
#if not GOOGLE_SHEET_NAME:
    raise ValueError("GOOGLE_SHEET_NAME is not set in .env")