"""
Sunrise System — Analytics Engine
Performance analysis and statistical calculations.
"""
import pandas as pd
from database.db import execute_query
from utils.helpers import get_today
from datetime import datetime, timedelta


def get_weekly_data():
    """Get data for the last 7 days."""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=6)
    
    rows = execute_query(
        """SELECT date, total_points, completed_tasks, total_tasks 
           FROM stats 
           WHERE date >= ? AND date <= ?
           ORDER BY date ASC""",
        (start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")),
        fetch=True
    )
    
    # Build a complete 7-day DataFrame (fill missing days with 0)
    date_range = pd.date_range(start=start_date, end=end_date, freq='D')
    df = pd.DataFrame({
        'date': [d.strftime("%Y-%m-%d") for d in date_range],
        'total_points': [0] * len(date_range),
        'completed_tasks': [0] * len(date_range),
        'total_tasks': [0] * len(date_range),
    })
    
    if rows:
        db_data = {r["date"]: r for r in rows}
        for i, row in df.iterrows():
            if row['date'] in db_data:
                df.at[i, 'total_points'] = db_data[row['date']]['total_points']
                df.at[i, 'completed_tasks'] = db_data[row['date']]['completed_tasks']
                df.at[i, 'total_tasks'] = db_data[row['date']]['total_tasks']
    
    return df


def get_monthly_data():
    """Get data for the last 30 days."""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=29)
    
    rows = execute_query(
        """SELECT date, total_points, completed_tasks, total_tasks 
           FROM stats 
           WHERE date >= ? AND date <= ?
           ORDER BY date ASC""",
        (start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")),
        fetch=True
    )
    
    date_range = pd.date_range(start=start_date, end=end_date, freq='D')
    df = pd.DataFrame({
        'date': [d.strftime("%Y-%m-%d") for d in date_range],
        'total_points': [0] * len(date_range),
        'completed_tasks': [0] * len(date_range),
        'total_tasks': [0] * len(date_range),
    })
    
    if rows:
        db_data = {r["date"]: r for r in rows}
        for i, row in df.iterrows():
            if row['date'] in db_data:
                df.at[i, 'total_points'] = db_data[row['date']]['total_points']
                df.at[i, 'completed_tasks'] = db_data[row['date']]['completed_tasks']
                df.at[i, 'total_tasks'] = db_data[row['date']]['total_tasks']
    
    return df


def get_weekly_average():
    """Get the average daily points for the last 7 days."""
    df = get_weekly_data()
    return round(df['total_points'].mean(), 1)


def get_best_day():
    """Get the best performing day (highest points)."""
    result = execute_query(
        """SELECT date, total_points 
           FROM stats 
           ORDER BY total_points DESC 
           LIMIT 1""",
        params=(),
        fetch_one=True
    )
    if result:
        return {"date": result["date"], "points": result["total_points"]}
    return {"date": get_today(), "points": 0}


def get_total_completed_tasks():
    """Get total number of completed tasks all-time."""
    result = execute_query(
        "SELECT COUNT(*) as count FROM tasks WHERE status = 'done'",
        params=(),
        fetch_one=True
    )
    return result["count"] if result else 0


def get_streak():
    """Calculate current streak of days with at least one completed task."""
    rows = execute_query(
        "SELECT DISTINCT date FROM stats WHERE completed_tasks > 0 ORDER BY date DESC",
        params=(),
        fetch=True
    )
    
    if not rows:
        return 0
    
    dates = [r["date"] for r in rows]
    streak = 0
    check_date = datetime.now().date()
    
    for date_str in dates:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
        if date_obj == check_date:
            streak += 1
            check_date -= timedelta(days=1)
        elif date_obj == check_date - timedelta(days=1):
            # Allow for checking yesterday if today has no tasks yet
            check_date = date_obj
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break
    
    return streak


def get_all_time_stats():
    """Get comprehensive all-time statistics."""
    total_tasks = execute_query(
        "SELECT COUNT(*) as count FROM tasks", params=(), fetch_one=True
    )
    completed_tasks = execute_query(
        "SELECT COUNT(*) as count FROM tasks WHERE status = 'done'", params=(), fetch_one=True
    )
    total_points = execute_query(
        "SELECT COALESCE(SUM(points), 0) as total FROM tasks WHERE status = 'done'",
        params=(), fetch_one=True
    )
    active_days = execute_query(
        "SELECT COUNT(DISTINCT date) as count FROM stats WHERE total_points > 0",
        params=(), fetch_one=True
    )
    reward_days = execute_query(
        "SELECT COUNT(*) as count FROM stats WHERE total_points >= 100",
        params=(), fetch_one=True
    )
    
    return {
        "total_tasks": total_tasks["count"] if total_tasks else 0,
        "completed_tasks": completed_tasks["count"] if completed_tasks else 0,
        "total_points": total_points["total"] if total_points else 0,
        "active_days": active_days["count"] if active_days else 0,
        "reward_days": reward_days["count"] if reward_days else 0,
        "streak": get_streak(),
    }
