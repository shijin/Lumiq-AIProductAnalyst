from db.init_db import get_session
from db.schema import RawFeedback, CleanedFeedback
from preprocessing.translator import translate_to_english
from preprocessing.intent_classifier import classify_intents_batch

# Batch size — how many rows to send to Claude at once
INTENT_BATCH_SIZE = 20


def preprocess_all():
    """
    Process all unprocessed raw feedback rows:
    1. Translate to English (if needed)
    2. Classify intent (batched Claude call)
    3. Write to cleaned_feedback table
    """
    session = get_session()

    # Fetch raw rows that haven't been preprocessed yet
    processed_raw_ids = session.query(
        CleanedFeedback.raw_id
    ).subquery()

    unprocessed = session.query(RawFeedback).filter(
        RawFeedback.id.notin_(processed_raw_ids)
    ).all()

    if not unprocessed:
        print("No new rows to preprocess.")
        session.close()
        return

    print(f"Preprocessing {len(unprocessed)} rows...")

    # ── Step 1: Translate all rows ──────────────────────────────
    translated_rows = []
    for row in unprocessed:
        translated = translate_to_english(row.raw_text, row.language)
        translated_rows.append({
            "raw_id": row.id,
            "original_language": row.language,
            "translated_text": translated if row.language != "en" else None,
            "text_for_intent": translated  # always English at this point
        })
        print(f"  Translated [{row.language}]: {row.raw_text[:40]} → {translated[:40]}")

    # ── Step 2: Classify intents in batches ─────────────────────
    intent_map = {}
    for i in range(0, len(translated_rows), INTENT_BATCH_SIZE):
        batch = translated_rows[i: i + INTENT_BATCH_SIZE]
        feedback_for_claude = [
            {"id": row["raw_id"], "text": row["text_for_intent"]}
            for row in batch
        ]
        print(f"  Classifying intents for batch {i // INTENT_BATCH_SIZE + 1}...")
        batch_intents = classify_intents_batch(feedback_for_claude)
        intent_map.update(batch_intents)

    # ── Step 3: Write to cleaned_feedback ───────────────────────
    inserted = 0
    for row in translated_rows:
        raw_id = row["raw_id"]
        intent = intent_map.get(raw_id, "complaint")  # safe fallback

        # cleaned_text = translated English version
        cleaned_text = row["translated_text"] if row["translated_text"] else \
            next(r.raw_text for r in unprocessed if r.id == raw_id)

        record = CleanedFeedback(
            raw_id=raw_id,
            original_language=row["original_language"],
            translated_text=row["translated_text"],
            cleaned_text=cleaned_text,
            intent=intent,
            sentiment=None  # sentiment will be added in Step 4 (cleaning)
        )
        session.add(record)
        inserted += 1

    session.commit()
    session.close()

    print(f"\nPreprocessing complete.")
    print(f"  Rows processed : {inserted}")
    print(f"  Intent batches : {len(translated_rows) // INTENT_BATCH_SIZE + 1}")


if __name__ == "__main__":
    preprocess_all()