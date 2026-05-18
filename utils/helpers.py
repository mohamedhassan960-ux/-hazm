"""
Sunrise System — Utility Helpers
"""
from datetime import datetime


def get_today():
    """Get today's date as a string (YYYY-MM-DD)."""
    return datetime.now().strftime("%Y-%m-%d")


def get_greeting():
    """Get a time-appropriate greeting in Arabic."""
    hour = datetime.now().hour
    if 5 <= hour < 12:
        return "☀️ صباح الخير"
    elif 12 <= hour < 17:
        return "🌤️ مساء النور"
    elif 17 <= hour < 21:
        return "🌅 مساء الخير"
    else:
        return "🌙 مساء الأنوار"


def format_date_display(date_str):
    """Format a date string for display."""
    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        return date_obj.strftime("%d %b %Y")
    except (ValueError, TypeError):
        return date_str


def get_day_name_arabic(date_str):
    """Get the Arabic day name for a date."""
    days_ar = {
        0: "الإثنين",
        1: "الثلاثاء",
        2: "الأربعاء",
        3: "الخميس",
        4: "الجمعة",
        5: "السبت",
        6: "الأحد",
    }
    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        return days_ar.get(date_obj.weekday(), "")
    except (ValueError, TypeError):
        return ""


def calculate_percentage(current, target):
    """Calculate percentage with safety checks."""
    if target <= 0:
        return 0
    return min(round((current / target) * 100, 1), 100)
