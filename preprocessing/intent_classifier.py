import json
from anthropic import Anthropic
from config.settings import ANTHROPIC_API_KEY

client = Anthropic(api_key=ANTHROPIC_API_KEY)

VALID_INTENTS = {
    "bug",
    "feature_request",
    "complaint",
    "praise",
    "question",
    "churn_signal",
    "pricing_feedback"
}

INTENT_PROMPT = """You are an intent classifier for product feedback.

Classify each feedback item into exactly one of these labels:
- bug: A technical issue or malfunction
- feature_request: A request for new functionality
- complaint: Dissatisfaction that is not a bug
- praise: Positive feedback or appreciation
- question: A query or request for information
- churn_signal: User hinting at leaving or switching
- pricing_feedback: Feedback about cost or value for money

Rules:
- Return ONLY a JSON array of objects with "id" and "intent" fields
- Every id must have exactly one intent
- Do not include any explanation or extra text
- If unsure, pick the closest match

Example output:
[
  {{"id": 1, "intent": "bug"}},
  {{"id": 2, "intent": "feature_request"}}
]

Feedback items to classify:
{feedback_items}"""


def classify_intents_batch(feedback_list: list[dict]) -> dict[int, str]:
    """
    Classify intents for a batch of feedback items.

    Args:
        feedback_list: List of dicts with 'id' and 'text' keys
        Example: [{"id": 1, "text": "App keeps crashing"}]

    Returns:
        Dict mapping id → intent
        Example: {1: "bug", 2: "feature_request"}
    """
    if not feedback_list:
        return {}

    # Format feedback for prompt
    formatted = "\n".join([
        f'{item["id"]}. {item["text"]}'
        for item in feedback_list
    ])

    prompt = INTENT_PROMPT.format(feedback_items=formatted)

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",  # Haiku — fastest + cheapest for classification
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )

        raw = response.content[0].text.strip()

        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        results = json.loads(raw)

        # Build id → intent mapping
        intent_map = {}
        for item in results:
            intent = item["intent"] if item["intent"] in VALID_INTENTS else "complaint"
            intent_map[int(item["id"])] = intent

        return intent_map

    except Exception as e:
        print(f"Intent classification failed: {e}")
        # Safe fallback — mark all as complaint
        return {item["id"]: "complaint" for item in feedback_list}