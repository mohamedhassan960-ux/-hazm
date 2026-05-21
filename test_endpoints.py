import requests
import json

def test_api():
    base_url = "http://127.0.0.1:5000"
    
    print("--- Testing /api/pillars ---")
    try:
        r = requests.get(f"{base_url}/api/pillars")
        print(f"Status: {r.status_code}")
        print(f"Data: {json.dumps(r.json(), indent=2, ensure_ascii=False)}")
    except Exception as e:
        print(f"Pillars Error: {e}")

    print("\n--- Testing /api/tasks/today ---")
    try:
        r = requests.get(f"{base_url}/api/tasks/today")
        print(f"Status: {r.status_code}")
        print(f"Data: {json.dumps(r.json(), indent=2, ensure_ascii=False)}")
    except Exception as e:
        print(f"Tasks Error: {e}")

    print("\n--- Testing /api/ai/chat ---")
    try:
        r = requests.post(f"{base_url}/api/ai/chat", json={"message": "أريد إضافة مهمة قراءة القرآن"})
        print(f"Status: {r.status_code}")
        print(f"Data: {json.dumps(r.json(), indent=2, ensure_ascii=False)}")
    except Exception as e:
        print(f"AI Error: {e}")

if __name__ == "__main__":
    test_api()
