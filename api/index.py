import os
import sys

# Add project root to path so Flask can find local modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

# Vercel requires the WSGI app handler to be named 'app'
# This file exposes the app from main.py
