import os
from google import genai
from dotenv import load_dotenv

load_dotenv(r'c:\Users\moham\HAZM\life_system\.env')

def find_working_model():
    api_key = os.environ.get("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)
    
    models_to_try = [
        'gemini-flash-latest',
        'gemini-2.0-flash',
        'gemini-2.5-flash',
        'gemini-2.0-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-pro-latest'
    ]
    
    for model_name in models_to_try:
        print(f"Trying {model_name}...")
        try:
            _ = client.models.generate_content(
                model=model_name,
                contents="test"
            )
            print(f"SUCCESS: {model_name} works!")
            return model_name
        except Exception as e:
            print(f"FAILED: {model_name}: {str(e)[:100]}...")
            
    return None

if __name__ == "__main__":
    find_working_model()
