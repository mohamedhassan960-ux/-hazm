import sqlite3

DB_PATH = r'c:\Users\moham\HAZM\life_system\data\sunrise.db'

def reseed_pillars():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    pillars = ["الجانب الديني", "الجانب المهني", "الجانب الاجتماعي", "الجانب الصحي"]
    
    # Clear existing pillars to avoid duplication issues with garbage data
    cursor.execute("DELETE FROM pillars")
    
    for p in pillars:
        print(f"Inserting: {p}")
        cursor.execute("INSERT INTO pillars (name) VALUES (?)", (p,))
    
    conn.commit()
    conn.close()
    print("Pillars re-seeded successfully.")

if __name__ == "__main__":
    reseed_pillars()
