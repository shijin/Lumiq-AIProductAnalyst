import gspread
from oauth2client.service_account import ServiceAccountCredentials
import pandas as pd
from langdetect import detect, LangDetectException
from datetime import datetime

from db.init_db import get_session
from db.schema import RawFeedback
from config.settings import GOOGLE_CREDENTIALS_PATH, GOOGLE_SHEET_NAME
import re
import io
import requests as req

# ── Google Sheets auth ────────────────────────────────────────────
def get_sheet_data(sheet_name: str) -> pd.DataFrame:
    scope = [
        "https://spreadsheets.google.com/feeds",
        "https://www.googleapis.com/auth/drive"
    ]
    creds = ServiceAccountCredentials.from_json_keyfile_name(
        GOOGLE_CREDENTIALS_PATH, scope
    )
    client = gspread.authorize(creds)
    sheet = client.open(sheet_name).sheet1
    data = sheet.get_all_records()
    return pd.DataFrame(data)


# ── Language detection ────────────────────────────────────────────
# Common Hindi/Hinglish words written in Latin script
HINDI_LATIN_WORDS = {
    # Time & quantity
    "bahut", "thoda", "zyada", "kam", "jaldi", "abhi", "pehle",
    "baad", "pura", "sirf", "bilkul", "kabhi", "hamesha",
    # Verbs
    "hai", "hain", "tha", "thi", "the", "ho", "hoga", "hogi",
    "karo", "karna", "karta", "karti", "kar", "kiya", "kiye",
    "leta", "leti", "lena", "dena", "deta", "deti", "milta",
    "milti", "aata", "aati", "jana", "jata", "jati", "raha",
    "rahi", "rahe", "chahiye", "sakta", "sakti",
    # Common nouns & connectors
    "mera", "meri", "mere", "mujhe", "humara", "hamari",
    "aap", "tum", "yeh", "woh", "kya", "kyun", "kaise",
    "nahi", "nhi", "mat", "bhi", "aur", "ya", "lekin",
    "par", "pe", "mein", "se", "ko", "ka", "ki", "ke",
    # Feedback-specific
    "accha", "acha", "bura", "theek", "sahi", "galat",
    "dikkat", "problem", "issue", "kaam", "cheez", "app",
    "band", "chalu", "khul", "load", "slow", "fast"
}


def contains_hindi_latin_words(text: str) -> bool:
    """Check if text contains common Hindi words written in Latin script."""
    words = re.findall(r'\b\w+\b', text.lower())
    matches = [w for w in words if w in HINDI_LATIN_WORDS]
    # Require at least 2 matches to avoid false positives
    return len(matches) >= 2


def is_hindi_script(text: str) -> bool:
    """Check if text contains Hindi Unicode characters."""
    return bool(re.search(r'[\u0900-\u097F]', text))


def is_hinglish(text: str) -> bool:
    """Detect Hinglish — mix of Latin words and Hindi script."""
    has_hindi = is_hindi_script(text)
    has_latin = bool(re.search(r'[a-zA-Z]', text))
    return has_hindi and has_latin


def detect_language(text: str) -> str:
    text = str(text).strip()

    # Rule 1: Contains Hindi Devanagari script
    if is_hindi_script(text):
        if is_hinglish(text):
            return "hinglish"
        return "hi"

    # Rule 2: Latin script but contains Hindi words → Hinglish
    if contains_hindi_latin_words(text):
        return "hinglish"

    # Rule 3: Very short text (under 4 words) → default English
    word_count = len(text.split())
    if word_count < 4:
        return "en"

    # Rule 4: Trust langdetect for longer pure Latin text
    try:
        detected = detect(text)
        trusted_languages = {"en", "hi", "fr", "de", "es", "pt", "it", "nl"}
        if detected not in trusted_languages:
            return "en"
        return detected
    except LangDetectException:
        return "en"

# ── Duplicate check ───────────────────────────────────────────────
def already_ingested(session, raw_text: str, source: str) -> bool:
    exists = session.query(RawFeedback).filter_by(
        raw_text=raw_text.strip(),
        source=source.strip()
    ).first()
    return exists is not None


# ── Main ingestion function ───────────────────────────────────────
def ingest_from_google_sheets():
    print(f"Fetching data from Google Sheet: '{GOOGLE_SHEET_NAME}'...")
    df = get_sheet_data(GOOGLE_SHEET_NAME)
    print(f"Total rows fetched: {len(df)}")

    # Validate required columns
    # New — flexible, only needs feedback_text
    if "feedback_text" not in df.columns:
        raise ValueError(
            "Sheet must have a 'feedback_text' column. "
            f"Found columns: {list(df.columns)}"
        )

    # Use source column if present, otherwise default to 'google_sheets'
    if "source" not in df.columns:
        df["source"] = "google_sheets"

    # Use submitted_at if present, otherwise use current time
    if "submitted_at" not in df.columns:
        df["submitted_at"] = datetime.now()

    session = get_session()
    inserted = 0
    skipped = 0

    for _, row in df.iterrows():
        raw_text = str(row["feedback_text"]).strip()
        source = str(row["source"]).strip()

        # Skip empty rows
        if not raw_text or raw_text.lower() == "nan":
            skipped += 1
            continue

        # Skip duplicates
        if already_ingested(session, raw_text, source):
            skipped += 1
            continue

        # Parse submitted_at safely
        try:
            submitted_at = pd.to_datetime(row["submitted_at"])
        except Exception:
            submitted_at = datetime.now()

        # Detect language
        language = detect_language(raw_text)

        # Create record
        record = RawFeedback(
            source=source,
            raw_text=raw_text,
            language=language,
            submitted_at=submitted_at
        )
        session.add(record)
        inserted += 1

    session.commit()
    session.close()

    print(f"\nIngestion complete.")
    print(f"  Inserted : {inserted}")
    print(f"  Skipped  : {skipped} (empty or duplicate)")


def ingest_from_dataframe(df: pd.DataFrame, source: str = "csv_upload"):
    """
    Ingest feedback from any pandas DataFrame.
    Only requires 'feedback_text' column.
    All other columns are optional.
    """
    # Validate minimum required column
    if "feedback_text" not in df.columns:
        raise ValueError(
            f"DataFrame must have a 'feedback_text' column. "
            f"Found: {list(df.columns)}"
        )

    # Add optional columns with defaults if missing
    if "source" not in df.columns:
        df["source"] = source
    if "submitted_at" not in df.columns:
        df["submitted_at"] = datetime.now()

    session = get_session()
    inserted = 0
    skipped = 0

    for _, row in df.iterrows():
        raw_text = str(row["feedback_text"]).strip()
        source_val = str(row["source"]).strip()

        if not raw_text or raw_text.lower() in ["nan", "none", ""]:
            skipped += 1
            continue

        if already_ingested(session, raw_text, source_val):
            skipped += 1
            continue

        try:
            submitted_at = pd.to_datetime(row["submitted_at"])
        except Exception:
            submitted_at = datetime.now()

        language = detect_language(raw_text)

        record = RawFeedback(
            source=source_val,
            raw_text=raw_text,
            language=language,
            submitted_at=submitted_at
        )
        session.add(record)
        inserted += 1

    session.commit()
    session.close()

    print(f"Ingestion complete. Inserted: {inserted}, Skipped: {skipped}")
    return inserted


def ingest_from_csv_file(file_content: bytes, filename: str = "upload.csv"):
    """Ingest feedback from uploaded CSV bytes."""
    try:
        df = pd.read_csv(io.BytesIO(file_content))
    except Exception as e:
        raise ValueError(f"Could not parse CSV file: {e}")

    print(f"CSV loaded: {len(df)} rows, columns: {list(df.columns)}")
    return ingest_from_dataframe(df, source=f"csv:{filename}")


def ingest_from_public_sheet_url(url: str):
    """
    Ingest feedback from a public Google Sheet URL.
    Converts the URL to CSV export format — no auth needed.
    """
    try:
        import re
        match = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', url)
        if not match:
            raise ValueError(
                "Invalid Google Sheet URL. "
                "Format: https://docs.google.com/spreadsheets/d/SHEET_ID/..."
            )

        sheet_id = match.group(1)
        gid_match = re.search(r'gid=(\d+)', url)
        gid = gid_match.group(1) if gid_match else '0'

        # Build CSV export URL
        csv_url = (
            f"https://docs.google.com/spreadsheets/d/{sheet_id}"
            f"/export?format=csv&gid={gid}"
        )

        print(f"Fetching public sheet: {csv_url}")

        # Add browser-like headers to avoid Google blocking
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                         "AppleWebKit/537.36 (KHTML, like Gecko) "
                         "Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;"
                     "q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }

        response = req.get(csv_url, headers=headers, timeout=30,
                          allow_redirects=True)

        print(f"Response status: {response.status_code}")
        print(f"Content type: {response.headers.get('content-type', '')}")

        if response.status_code != 200:
            raise ValueError(
                f"Could not access Google Sheet (status {response.status_code}). "
                "Make sure the sheet is set to 'Anyone with the link can view'."
            )

        # Check if we got HTML instead of CSV (happens when blocked)
        content_type = response.headers.get('content-type', '')
        if 'text/html' in content_type and 'csv' not in content_type:
            # Try alternative export URL format
            alt_url = (
                f"https://docs.google.com/spreadsheets/d/{sheet_id}"
                f"/gviz/tq?tqx=out:csv&gid={gid}"
            )
            print(f"Trying alternative URL: {alt_url}")
            response = req.get(alt_url, headers=headers,
                             timeout=30, allow_redirects=True)

            if response.status_code != 200:
                raise ValueError(
                    "Could not access Google Sheet. "
                    "Please make sure sharing is set to "
                    "'Anyone with the link can view'."
                )

        # Try to parse as CSV
        content = response.text
        if not content.strip():
            raise ValueError("Google Sheet appears to be empty.")

        df = pd.read_csv(io.StringIO(content))
        print(f"Sheet loaded: {len(df)} rows, columns: {list(df.columns)}")
        return ingest_from_dataframe(df, source="google_sheet_url")

    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Failed to fetch Google Sheet: {e}")

if __name__ == "__main__":
    ingest_from_google_sheets()