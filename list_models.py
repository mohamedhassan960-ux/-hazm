import os
from google import genai
from dotenv import load_dotenv

load_dotenv(r'c:\Users\moham\HAZM\life_system\.env')

def list_models():
    api_key = os.environ.get("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)
    try:
        print("Available models:")
        for m in client.models.list():
            print(f"- {m}")
    except Exception as e:
        print(f"Error listing models: {e}")

if __name__ == "__main__":
    list_models()
