from deep_translator import GoogleTranslator


def translate_to_english(text: str, source_language: str) -> str:
    """
    Translate Hindi or Hinglish text to English.
    Returns original text if already English or translation fails.
    """
    text = str(text).strip()

    # Skip if already English
    if source_language == "en":
        return text

    try:
        if source_language == "hi":
            translated = GoogleTranslator(
                source="hi",
                target="en"
            ).translate(text)
            return translated

        elif source_language == "hinglish":
            # Hinglish is Latin script — use auto-detect for best results
            translated = GoogleTranslator(
                source="auto",
                target="en"
            ).translate(text)
            return translated

        else:
            # For any other detected language, attempt auto-translation
            translated = GoogleTranslator(
                source="auto",
                target="en"
            ).translate(text)
            return translated

    except Exception as e:
        print(f"Translation failed for text: '{text[:50]}...' | Error: {e}")
        return text  # Fall back to original text safely