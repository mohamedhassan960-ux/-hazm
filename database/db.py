"""
Sunrise Strategic System — Database Connection & Operations
Updated to support advanced schema and pillar seeding.
"""
import sqlite3
import os
from config.settings import DB_PATH
from database.models import ALL_TABLES


def get_connection():
    """Get a database connection, creating the DB file and tables if needed."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    """Initialize database — create all tables and seed default data."""
    conn = get_connection()
    cursor = conn.cursor()
    for table_sql in ALL_TABLES:
        cursor.execute(table_sql)
    
    # ─── Seed Pillars ────────────────────────────────
    pillars = ["الجانب الديني", "الجانب المهني", "الجانب الاجتماعي", "الجانب الصحي"]
    for p in pillars:
        cursor.execute("INSERT OR IGNORE INTO pillars (name) VALUES (?)", (p,))

    # ─── Seed Poems (Bulk Load from JSON) ─────────────
    import json
    json_path = os.path.join(os.path.dirname(DB_PATH), "poems.json")
    
    # Simple deduplication check
    count = cursor.execute("SELECT COUNT(*) FROM poems").fetchone()[0]
    
    if count < 500 and os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            poems_data = json.load(f)
            for p in poems_data:
                cursor.execute(
                    "INSERT OR IGNORE INTO poems (content, poet, category) VALUES (?, ?, ?)",
                    (p['content'], p['poet'], p['category'])
                )
        
    conn.commit()
    conn.close()


def execute_query(query, params=(), fetch=False, fetch_one=False):
    """Execute a query with optional fetch."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(query, params)
    
    result = None
    if fetch_one:
        row = cursor.fetchone()
        result = dict(row) if row else None
    elif fetch:
        rows = cursor.fetchall()
        result = [dict(r) for r in rows]
    
    conn.commit()
    conn.close()
    return result


def execute_insert(query, params=()):
    """Execute an insert and return the last inserted row ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(query, params)
    last_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return last_id
