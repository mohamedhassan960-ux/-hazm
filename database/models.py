"""
Sunrise Strategic System — Database Models
Advanced hierarchical schema for pillars, goals, habits, and tasks.
"""

PILLARS_TABLE = """
CREATE TABLE IF NOT EXISTS pillars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
)
"""

GOALS_TABLE = """
CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pillar_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('yearly', 'monthly', 'weekly')),
    title TEXT NOT NULL,
    description TEXT,
    parent_id INTEGER, -- Links weekly to monthly, etc.
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'done')),
    date TEXT NOT NULL, -- The target period (e.g. "2026", "2026-04")
    FOREIGN KEY (pillar_id) REFERENCES pillars (id),
    FOREIGN KEY (parent_id) REFERENCES goals (id)
)
"""

TASKS_TABLE = """
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pillar_id INTEGER NOT NULL,
    goal_id INTEGER, -- Optional link to a weekly goal
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'done', 'late')),
    date TEXT NOT NULL, -- YYYY-MM-DD
    start_time TEXT, -- HH:MM
    end_time TEXT,   -- HH:MM
    is_habit BOOLEAN DEFAULT 0,
    points INTEGER DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (pillar_id) REFERENCES pillars (id),
    FOREIGN KEY (goal_id) REFERENCES goals (id)
)
"""

HABITS_TABLE = """
CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pillar_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (pillar_id) REFERENCES pillars (id)
)
"""

POEMS_TABLE = """
CREATE TABLE IF NOT EXISTS poems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    poet TEXT,
    category TEXT NOT NULL CHECK(category IN ('motivation', 'praise')),
    viewed INTEGER DEFAULT 0
)
"""

STATS_TABLE = """
CREATE TABLE IF NOT EXISTS stats (
    date TEXT PRIMARY KEY,
    total_points INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    total_tasks INTEGER DEFAULT 0
)
"""

ALL_TABLES = [PILLARS_TABLE, GOALS_TABLE, TASKS_TABLE, HABITS_TABLE, POEMS_TABLE, STATS_TABLE]
