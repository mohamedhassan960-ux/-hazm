"""
Sunrise Strategic System — Database Connection & Operations
Updated to support PostgreSQL (Supabase) with SQLite fallback.
"""
import sqlite3
import os
import json
import logging
from config.settings import DB_PATH, DATABASE_URL

logger = logging.getLogger(__name__)

def get_connection():
    """Get a database connection, supporting PostgreSQL (Supabase) or SQLite fallback."""
    if DATABASE_URL and not DATABASE_URL.startswith("YOUR_DATABASE") and "placeholder" not in DATABASE_URL.lower():
        import psycopg2
        from psycopg2.extras import RealDictCursor
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        return conn, True # True means it's PostgreSQL
    else:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn, False # False means it's SQLite

def execute_query(query, params=(), fetch=False, fetch_one=False):
    """Execute a query with optional fetch."""
    conn, is_pg = get_connection()
    cursor = conn.cursor()
    
    try:
        # Simple syntax adjustments for psycopg2 vs sqlite3
        if is_pg:
            query = query.replace('?', '%s')
        
        cursor.execute(query, params)
        
        result = None
        if fetch_one:
            row = cursor.fetchone()
            result = dict(row) if row else None
        elif fetch:
            rows = cursor.fetchall()
            result = [dict(r) for r in rows]
        
        conn.commit()
        return result
    except Exception as e:
        conn.rollback()
        logger.error(f"DB Error: {e} - Query: {query}")
        raise
    finally:
        cursor.close()
        conn.close()

def execute_insert(query, params=()):
    """Execute an insert and return the last inserted row ID (SQLite only, or requires RETURNING in PG)."""
    conn, is_pg = get_connection()
    cursor = conn.cursor()
    
    try:
        if is_pg:
            query = query.replace('?', '%s')
            if "RETURNING" not in query.upper():
                query = f"{query} RETURNING id"
        
        cursor.execute(query, params)
        
        last_id = None
        if is_pg:
            row = cursor.fetchone()
            if row:
                last_id = row['id'] if isinstance(row, dict) else row[0]
        else:
            last_id = cursor.lastrowid
            
        conn.commit()
        return last_id
    except Exception as e:
        conn.rollback()
        logger.error(f"DB Insert Error: {e} - Query: {query}")
        raise
    finally:
        cursor.close()
        conn.close()

def init_db():
    """Initialize tables and seed data."""
    conn, is_pg = get_connection()
    try:
        if not is_pg:
            # If SQLite, run ALL_TABLES from models.py
            from database.models import ALL_TABLES
            cursor = conn.cursor()
            for table_sql in ALL_TABLES:
                cursor.execute(table_sql)
            
            pillars = ["الجانب الديني", "الجانب المهني", "الجانب الاجتماعي", "الجانب الصحي"]
            for p in pillars:
                cursor.execute("INSERT OR IGNORE INTO pillars (name) VALUES (?)", (p,))
            conn.commit()
            cursor.close()
    finally:
        conn.close()
    
    # Common: Seed poems from JSON
    json_path = os.path.join(os.path.dirname(DB_PATH), "poems.json")
    if os.path.exists(json_path):
        try:
            count_res = execute_query("SELECT COUNT(*) as count FROM poems", fetch_one=True)
            count = count_res['count'] if count_res else 0
            
            if count < 500:
                with open(json_path, 'r', encoding='utf-8') as f:
                    poems_data = json.load(f)
                    
                    for p in poems_data:
                        if is_pg:
                            execute_query(
                                "INSERT INTO poems (content, poet, category) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                                (p['content'], p['poet'], p['category'])
                            )
                        else:
                            execute_query(
                                "INSERT OR IGNORE INTO poems (content, poet, category) VALUES (?, ?, ?)",
                                (p['content'], p['poet'], p['category'])
                            )
        except Exception as e:
            logger.error(f"Error seeding poems: {e}")

