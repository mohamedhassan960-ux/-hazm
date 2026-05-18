"""
Sunrise System — Task Manager
Handles all task CRUD operations.
"""
from database.db import execute_query, execute_insert
from utils.helpers import get_today
from core.scoring_system import apply_late_penalties
from datetime import datetime


def add_task(title, pillar_id, points=10, is_habit=0, start_time=None, end_time=None):
    """Add a new task for today."""
    today = get_today()
    task_id = execute_insert(
        """INSERT INTO tasks (pillar_id, title, points, status, date, is_habit, start_time, end_time) 
           VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)""",
        (pillar_id, title, points, today, is_habit, start_time, end_time)
    )
    # Update stats
    _update_stats(today)
    return task_id


def get_today_tasks():
    """Get all tasks for today, ensuring old ones are marked late."""
    apply_late_penalties()
    today = get_today()
    rows = execute_query(
        "SELECT * FROM tasks WHERE date = ? ORDER BY status ASC, created_at DESC",
        (today,),
        fetch=True
    )
    return rows if rows else []


def get_tasks_by_date(date_str):
    """Get all tasks for a specific date."""
    rows = execute_query(
        "SELECT * FROM tasks WHERE date = ? ORDER BY status ASC, created_at DESC",
        (date_str,),
        fetch=True
    )
    return rows if rows else []


def complete_task(task_id):
    """Mark a task as done."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    execute_query(
        "UPDATE tasks SET status = 'done', completed_at = ? WHERE id = ?",
        (now, task_id)
    )
    # Get the task's date and update stats
    task = execute_query("SELECT date FROM tasks WHERE id = ?", (task_id,), fetch_one=True)
    if task:
        _update_stats(task["date"])


def uncomplete_task(task_id):
    """Mark a task as pending again."""
    execute_query(
        "UPDATE tasks SET status = 'pending', completed_at = NULL WHERE id = ?",
        (task_id,)
    )
    task = execute_query("SELECT date FROM tasks WHERE id = ?", (task_id,), fetch_one=True)
    if task:
        _update_stats(task["date"])


def delete_task(task_id):
    """Delete a task."""
    task = execute_query("SELECT date FROM tasks WHERE id = ?", (task_id,), fetch_one=True)
    execute_query("DELETE FROM tasks WHERE id = ?", (task_id,))
    if task:
        _update_stats(task["date"])


def get_pending_count():
    """Get the number of pending tasks for today."""
    today = get_today()
    result = execute_query(
        "SELECT COUNT(*) as count FROM tasks WHERE date = ? AND status = 'pending'",
        (today,),
        fetch_one=True
    )
    return result["count"] if result else 0


def get_completed_count():
    """Get the number of completed tasks for today."""
    today = get_today()
    result = execute_query(
        "SELECT COUNT(*) as count FROM tasks WHERE date = ? AND status = 'done'",
        (today,),
        fetch_one=True
    )
    return result["count"] if result else 0


def _update_stats(date_str):
    """Update the stats table for a given date."""
    # Calculate totals
    result = execute_query(
        """SELECT 
            COUNT(*) as total_tasks,
            COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END), 0) as completed_tasks,
            COALESCE(SUM(CASE WHEN status = 'done' THEN points ELSE 0 END), 0) as total_points
        FROM tasks WHERE date = ?""",
        (date_str,),
        fetch_one=True
    )
    
    if result:
        data = result
        execute_query(
            """INSERT INTO stats (date, total_points, completed_tasks, total_tasks) 
               VALUES (?, ?, ?, ?)
               ON CONFLICT(date) DO UPDATE SET 
                   total_points = ?, completed_tasks = ?, total_tasks = ?""",
            (date_str, data["total_points"], data["completed_tasks"], data["total_tasks"],
             data["total_points"], data["completed_tasks"], data["total_tasks"])
        )
