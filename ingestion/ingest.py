import gspread
from oauth2client.service_account import ServiceAccountCredentials
import pandas as pd
from langdetect import detect, LangDetectException
from datetime import datetime

from db.init_db import get_session
from db.schema import RawFeedback
from config.settings import GOOGLE_CREDENTIALS_PATH, GOOGLE_SHEET_NAME
import re


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
    required_cols = {"feedback_text", "submitted_at", "source"}
    if not required_cols.issubset(df.columns):
        missing = required_cols - set(df.columns)
        raise ValueError(f"Missing columns in sheet: {missing}")

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


if __name__ == "__main__":
    ingest_from_google_sheets()