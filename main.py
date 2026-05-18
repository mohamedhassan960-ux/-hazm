"""
🌅 Sunrise Strategic System — Flask API Server
A mobile-first behavior engine handling life goals, tasks, and habits.
"""
import os
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.db import init_db, execute_query
from ui.dashboard import dashboard_bp
from migrate_db import migrate
from utils.helpers import get_today

app = Flask(__name__)
CORS(app)

# ─── Initialize ──────────────────────────────────────
migrate()
init_db()

# ─── API: AI Companion ──────────────────────────────
@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    from utils.ai_engine import process_ai_command
    data = request.json
    user_message = data.get('message', '')
    conversation_history = data.get('history', [])
    context = data.get('context', '')
    
    response = process_ai_command(user_message, context, conversation_history)
    
    return jsonify({"response": response})

# ─── API: Analytics ──────────────────────────────────
@app.route('/api/stats/summary', methods=['GET'])
def get_stats_summary():
    # Progress per pillar
    stats = execute_query("""
        SELECT p.name, 
               COUNT(t.id) as total,
               SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done
        FROM pillars p
        LEFT JOIN tasks t ON p.id = t.pillar_id AND t.date = ?
        GROUP BY p.id
    """, (get_today(),))
    return jsonify(stats)

# ─── Register Blueprints ─────────────────────────────
app.register_blueprint(dashboard_bp)

# ─── PWA Routes ──────────────────────────────────────
from flask import send_from_directory

@app.route('/manifest.json')
def serve_manifest():
    return send_from_directory('static', 'manifest.json')

@app.route('/sw.js')
def serve_sw():
    return send_from_directory('static', 'sw.js')

if __name__ == '__main__':
    # Flask runs on 5000 by default
    app.run(host='0.0.0.0', port=5000, debug=True)
