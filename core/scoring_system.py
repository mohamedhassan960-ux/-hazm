"""
Sunrise System — Scoring System
Handles points calculation and reward logic.
"""
from database.db import execute_query
from utils.helpers import get_today
from config.settings import REWARD_THRESHOLD


def get_today_points():
    """Get total points earned today."""
    today = get_today()
    result = execute_query(
        "SELECT COALESCE(SUM(points), 0) as total FROM tasks WHERE date = ? AND status = 'done'",
        (today,),
        fetch_one=True
    )
    return result["total"] if result else 0


def get_today_potential_points():
    """Get total potential points for today (all tasks, pending + done)."""
    today = get_today()
    result = execute_query(
        "SELECT COALESCE(SUM(points), 0) as total FROM tasks WHERE date = ?",
        (today,),
        fetch_one=True
    )
    return result["total"] if result else 0


def check_reward():
    """Check if user reached the reward threshold today."""
    points = get_today_points()
    return points >= REWARD_THRESHOLD


def get_progress_percentage():
    """Get progress percentage toward the daily goal (100 points)."""
    points = get_today_points()
    return min(round((points / REWARD_THRESHOLD) * 100, 1), 100)


def get_points_remaining():
    """Get how many more points needed to reach the reward."""
    points = get_today_points()
    remaining = REWARD_THRESHOLD - points
    return max(remaining, 0)


def get_points_by_date(date_str):
    """Get total points for a specific date."""
    result = execute_query(
        "SELECT COALESCE(SUM(points), 0) as total FROM tasks WHERE date = ? AND status = 'done'",
        (date_str,),
        fetch_one=True
    )
    return result["total"] if result else 0


def apply_late_penalties():
    """Find all pending tasks from previous days and mark them as 'late'."""
    today = get_today()
    # Mark old pending tasks as late
    execute_query(
        "UPDATE tasks SET status = 'late' WHERE date < ? AND status = 'pending'",
        (today,)
    )
    # Note: Points are already assigned to the task. 
    # For a stricter system, we could set points = 0 for late tasks, 
    # but marking status as 'late' is the first step.

