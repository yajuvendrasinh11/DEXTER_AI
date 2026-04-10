# sentiment.py
# Lightweight sentiment analysis using VADER

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

# Initialize the analyzer once at module level
_analyzer = SentimentIntensityAnalyzer()


def analyze_sentiment(text: str) -> dict:
    """
    Analyse the sentiment of the given text.

    Returns a dict with:
      - label : 'positive' | 'negative' | 'neutral'
      - score : compound score from -1.0 to 1.0
    """
    scores = _analyzer.polarity_scores(text)
    compound = scores["compound"]

    if compound >= 0.05:
        label = "positive"
    elif compound <= -0.05:
        label = "negative"
    else:
        label = "neutral"

    return {"label": label, "score": round(compound, 4)}
