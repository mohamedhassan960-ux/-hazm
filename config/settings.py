"""
🌅 Sunrise Strategic System — Flask Backend Configuration
"""
import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

# AI Configuration
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "YOUR_API_KEY_HERE")

# ─── Paths ───────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "sunrise.db")
DATABASE_URL = os.environ.get("DATABASE_URL")

# ─── Points System ───────────────────────────────────
MIN_POINTS = 1
MAX_POINTS = 30
REWARD_THRESHOLD = 100

# ─── Theme Colors (Sunrise) ──────────────────────────
COLORS = {
    "primary": "#FFA726",        # Orange Soft
    "secondary": "#FF7043",      # Warm Pink/Coral
    "background": "#FFF3E0",     # Light Yellow
    "accent": "#FFD54F",         # Gold
    "text_dark": "#3E2723",      # Dark Brown
    "text_light": "#5D4037",     # Medium Brown
    "success": "#66BB6A",        # Green
    "card_bg": "#FFFFFF",        # White
    "gradient_start": "#FF7043", # Sunrise gradient start
    "gradient_mid": "#FFA726",   # Sunrise gradient mid
    "gradient_end": "#FFD54F",   # Sunrise gradient end
}


