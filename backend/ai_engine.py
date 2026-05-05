from google import genai
from config.settings import GEMINI_API_KEY
import json

client = genai.Client(api_key=GEMINI_API_KEY)

def generate_insights(summary: dict) -> list:
    prompt = f"""
You are a business analyst AI. Analyze this business data summary and give exactly 6 clear,
actionable insights for an e-commerce startup owner.

Data Summary:
{json.dumps(summary, indent=2)}

Rules:
- Write in plain simple English (no jargon)
- Each insight must be 1-2 sentences
- Start each insight with an emoji
- Focus on: trends, top performers, warnings, recommendations
- Number them 1 to 6

Return ONLY the 6 numbered insights, nothing else.
"""
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt
    )
    raw = response.text.strip()
    lines = [line.strip() for line in raw.split("\n") if line.strip()]
    insights = [l for l in lines if l and l[0].isdigit()]
    return insights if insights else [raw]