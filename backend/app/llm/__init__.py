from app.llm.gemini import GeminiProvider
from app.llm.groq import GroqProvider

def get_gemini():
    return GeminiProvider()

def get_groq():
    return GroqProvider()
