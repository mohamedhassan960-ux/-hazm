import sqlite3
import os
from config.settings import DB_PATH

def migrate():
    if not os.path.exists(DB_PATH):
        print("No database found, init_db will create it.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Add points column to tasks if missing
    try:
        cursor.execute("ALTER TABLE tasks ADD COLUMN points INTEGER DEFAULT 10")
        print("Added 'points' column to 'tasks' table.")
    except sqlite3.OperationalError:
        pass
        
    # Add viewed column to poems if missing
    try:
        cursor.execute("ALTER TABLE poems ADD COLUMN viewed INTEGER DEFAULT 0")
        print("Added 'viewed' column to 'poems' table.")
    except sqlite3.OperationalError:
        pass

    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
