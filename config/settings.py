from dotenv import load_dotenv
import os
import json
import tempfile

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL")
GOOGLE_SHEET_NAME = os.getenv("GOOGLE_SHEET_NAME", "")

# Handle Google credentials from environment variable (Render)
# or from local file (development)
GOOGLE_CREDENTIALS_JSON = os.getenv("GOOGLE_CREDENTIALS_JSON")

if GOOGLE_CREDENTIALS_JSON:
    # Cloud deployment — write JSON string to temp file
    try:
        temp = tempfile.NamedTemporaryFile(
            mode='w',
            suffix='.json',
            delete=False
        )
        temp.write(GOOGLE_CREDENTIALS_JSON)
        temp.flush()
        temp.close()
        GOOGLE_CREDENTIALS_PATH = temp.name
        print("Google credentials loaded from environment variable.")
    except Exception as e:
        print(f"Warning: Could not write credentials to temp file: {e}")
        GOOGLE_CREDENTIALS_PATH = os.path.join(
            os.path.dirname(__file__), "google_credentials.json"
        )
else:
    # Local development — use file
    GOOGLE_CREDENTIALS_PATH = os.path.join(
        os.path.dirname(__file__), "google_credentials.json"
    )

if not SUPABASE_DB_URL:
    raise ValueError("SUPABASE_DB_URL is not set in .env")
if not ANTHROPIC_API_KEY:
    raise ValueError("ANTHROPIC_API_KEY is not set in .env")