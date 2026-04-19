import re
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from db.init_db import get_session
from db.schema import CleanedFeedback

analyzer = SentimentIntensityAnalyzer()

# ── Abbreviation expansion dictionary ────────────────────────────
ABBREVIATIONS = {
    "u": "you",
    "r": "are",
    "ur": "your",
    "n": "and",
    "cant": "cannot",
    "wont": "will not",
    "dont": "do not",
    "doesnt": "does not",
    "didnt": "did not",
    "isnt": "is not",
    "wasnt": "was not",
    "shouldnt": "should not",
    "wouldnt": "would not",
    "couldnt": "could not",
    "ive": "i have",
    "im": "i am",
    "its": "it is",
    "thats": "that is",
    "whats": "what is",
    "app": "app",
    "pls": "please",
    "plz": "please",
    "asap": "as soon as possible",
    "tbh": "to be honest",
    "ngl": "not going to lie",
    "imo": "in my opinion",
    "fyi": "for your information",
    "omg": "oh my god",
    "wtf": "what the hell",
    "lol": "laughing",
    "idk": "i do not know",
    "smh": "shaking my head",
    "gr8": "great",
    "b4": "before",
    "2": "to",
    "4": "for",
}

# ── Ambiguity indicators ──────────────────────────────────────────
AMBIGUITY_MARKERS = [
    "maybe", "i think", "not sure", "kind of", "sort of",
    "i guess", "could be", "might be", "possibly", "sometimes",
    "idk", "not really", "hmm", "unclear", "confusing"
]


# ── Text cleaning functions ───────────────────────────────────────

def remove_special_characters(text: str) -> str:
    """Keep letters, numbers, spaces and basic punctuation."""
    return re.sub(r"[^a-zA-Z0-9\s.,!?'-]", " ", text)


def normalize_whitespace(text: str) -> str:
    """Collapse multiple spaces into one and strip edges."""
    return re.sub(r"\s+", " ", text).strip()


def expand_abbreviations(text: str) -> str:
    """Replace known abbreviations with full forms."""
    words = text.split()
    expanded = [
        ABBREVIATIONS.get(word.lower(), word)
        for word in words
    ]
    return " ".join(expanded)


def remove_repeated_chars(text: str) -> str:
    """Fix elongated words like 'sooooo slow' → 'so slow'."""
    return re.sub(r"(.)\1{2,}", r"\1\1", text)


def clean_text(text: str) -> str:
    """
    Full rule-based cleaning pipeline.
    Runs in order: lowercase → special chars → repeated chars
    → abbreviations → whitespace
    """
    text = text.lower()
    text = remove_special_characters(text)
    text = remove_repeated_chars(text)
    text = expand_abbreviations(text)
    text = normalize_whitespace(text)
    return text


# ── Sentiment detection ───────────────────────────────────────────

# ── Negation patterns ─────────────────────────────────────────────
NEGATION_PATTERNS = [
    r"\bnot\s+\w+",           # not working, not responsive
    r"\bno\s+\w+",            # no response, no update
    r"\bunable\s+to\b",       # unable to apply
    r"\bfailed\b",            # payment failed
    r"\bfailing\b",
    r"\bdoesn't\s+\w+",
    r"\bdoes\s+not\b",
    r"\bisn't\s+\w+",
    r"\bis\s+not\b",
    r"\bwon't\s+\w+",
    r"\bwill\s+not\b",
    r"\bcan't\s+\w+",
    r"\bcannot\b",
    r"\bnever\s+\w+",
]

# ── Domain-specific negative keywords ────────────────────────────
NEGATIVE_KEYWORDS = [
    "crash", "crashes", "crashing", "crashed",
    "hang", "hangs", "hanging", "hanged",
    "lag", "laggy", "lagging",
    "slow", "sluggish",
    "broken", "bug", "buggy", "glitch",
    "error", "errors",
    "unresponsive", "unresponsiveness",
    "difficult", "confusing", "confused",
    "frustrating", "frustrated", "frustration",
    "annoying", "annoyed",
    "terrible", "horrible", "awful", "worst",
    "useless", "pathetic",
    "disappointed", "disappointing", "disappointment",
    "issue", "problem", "trouble",
    "missing", "missing out",
    "overpriced", "expensive",
    "switching", "uninstall", "deleted",
]

# ── Positive keywords (to avoid false negatives) ──────────────────
POSITIVE_KEYWORDS = [
    "love", "loved", "loving",
    "great", "excellent", "amazing", "awesome",
    "fantastic", "wonderful", "brilliant",
    "smooth", "fast", "quick", "easy",
    "helpful", "useful", "intuitive",
    "improved", "better", "best",
    "happy", "satisfied", "perfect",
]


def detect_sentiment(text: str) -> str:
    """
    Negation-aware sentiment detection.

    Priority order:
    1. Check for negation patterns → negative
    2. Check for negative keywords → negative
    3. Check for positive keywords → positive
    4. Fall back to VADER compound score
    """
    text_lower = text.lower()

    # Rule 1: Negation patterns → always negative
    for pattern in NEGATION_PATTERNS:
        if re.search(pattern, text_lower):
            return "negative"

    # Rule 2: Strong negative domain keywords → negative
    for keyword in NEGATIVE_KEYWORDS:
        if re.search(r'\b' + keyword + r'\b', text_lower):
            return "negative"

    # Rule 3: Strong positive keywords → positive
    for keyword in POSITIVE_KEYWORDS:
        if re.search(r'\b' + keyword + r'\b', text_lower):
            return "positive"

    # Rule 4: Fall back to VADER
    scores = analyzer.polarity_scores(text)
    compound = scores["compound"]
    if compound >= 0.05:
        return "positive"
    elif compound <= -0.05:
        return "negative"
    else:
        return "neutral"


# ── Ambiguity detection ───────────────────────────────────────────

def is_ambiguous(text: str) -> bool:
    """
    Flag text that is unclear or hedged.
    These rows will be candidates for Claude review in Layer 2.
    """
    text_lower = text.lower()
    return any(marker in text_lower for marker in AMBIGUITY_MARKERS)


# ── Main cleaning orchestrator ────────────────────────────────────

def clean_all():
    """
    Process all cleaned_feedback rows:
    1. Apply rule-based cleaning to cleaned_text
    2. Detect sentiment using VADER
    3. Flag ambiguous rows
    4. Update records in DB
    """
    session = get_session()

    # Fetch rows where sentiment is not yet set
    unprocessed = session.query(CleanedFeedback).filter(
        CleanedFeedback.sentiment.is_(None)
    ).all()

    if not unprocessed:
        print("No rows to clean.")
        session.close()
        return

    print(f"Cleaning {len(unprocessed)} rows...")

    positive_count = 0
    negative_count = 0
    neutral_count = 0
    ambiguous_count = 0

    for row in unprocessed:
        # Use translated text if available, otherwise use cleaned_text
        source_text = row.translated_text if row.translated_text else row.cleaned_text

        # Layer 1: Rule-based cleaning
        cleaned = clean_text(source_text)

        # Detect sentiment
        sentiment = detect_sentiment(cleaned)

        # Flag ambiguity
        ambiguous = is_ambiguous(cleaned)

        # Update record
        row.cleaned_text = cleaned
        row.sentiment = sentiment

        # Track counts
        if sentiment == "positive":
            positive_count += 1
        elif sentiment == "negative":
            negative_count += 1
        else:
            neutral_count += 1

        if ambiguous:
            ambiguous_count += 1

        print(f"  [{sentiment}] {cleaned[:60]}...")

    session.commit()
    session.close()

    print(f"\nCleaning complete.")
    print(f"  Total processed : {len(unprocessed)}")
    print(f"  Positive        : {positive_count}")
    print(f"  Negative        : {negative_count}")
    print(f"  Neutral         : {neutral_count}")
    print(f"  Ambiguous flags : {ambiguous_count}")


if __name__ == "__main__":
    clean_all()