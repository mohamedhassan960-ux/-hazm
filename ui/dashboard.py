from flask import Blueprint, render_template, request, jsonify
from database.db import execute_query, execute_insert
from utils.helpers import get_today
import json
import re

# Import Core Modules
from core import task_manager

dashboard_bp = Blueprint('dashboard', __name__)

# ─── Page Routes ─────────────────────────────────────
@dashboard_bp.route('/')
def index():
    """Main dashboard page."""
    return render_template('index.html')

# ─── API: Pillars ────────────────────────────────────
@dashboard_bp.route('/api/pillars', methods=['GET'])
def get_pillars():
    pillars = execute_query("SELECT id, name FROM pillars", fetch=True)
    return jsonify(pillars)

# ─── API: Tasks ──────────────────────────────────────
@dashboard_bp.route('/api/tasks/today', methods=['GET'])
def get_today_tasks():
    _update_late_tasks()
    tasks = execute_query(
        """SELECT t.*, p.name as pillar_name 
           FROM tasks t 
           JOIN pillars p ON t.pillar_id = p.id 
           WHERE t.date = ? 
           ORDER BY t.start_time ASC, t.status ASC""",
        (get_today(),),
        fetch=True
    )
    return jsonify(tasks)

@dashboard_bp.route('/api/tasks', methods=['POST'])
def add_new_task():
    data = request.json
    task_id = task_manager.add_task(
        title=data['title'],
        pillar_id=data['pillar_id'],
        start_time=data.get('start_time'),
        end_time=data.get('end_time'),
        is_habit=data.get('is_habit', 0),
        points=data.get('points', 10)
    )
    return jsonify({"id": task_id, "status": "success"})

@dashboard_bp.route('/api/tasks/<int:task_id>/toggle', methods=['PUT'])
def toggle_task(task_id):
    current = execute_query("SELECT status, pillar_id FROM tasks WHERE id = ?", (task_id,), fetch_one=True)
    if not current:
        return jsonify({"error": "Task not found"}), 404
        
    if current['status'] == 'done':
        task_manager.uncomplete_task(task_id)
        new_status = 'pending'
    else:
        task_manager.complete_task(task_id)
        new_status = 'done'
        
    return jsonify({"status": new_status, "pillar_id": current['pillar_id']})

@dashboard_bp.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task_api(task_id):
    task_manager.delete_task(task_id)
    return jsonify({"status": "deleted"})

# ─── API: Goals ──────────────────────────────────────
@dashboard_bp.route('/api/goals', methods=['GET'])
def get_goals():
    g_type = request.args.get('type')
    query = "SELECT g.*, p.name as pillar_name FROM goals g JOIN pillars p ON g.pillar_id = p.id"
    params = ()
    if g_type:
        query += " WHERE type = ?"
        params = (g_type,)
    goals = execute_query(query, params, fetch=True)
    return jsonify(goals)

@dashboard_bp.route('/api/goals', methods=['POST'])
def add_goal():
    data = request.json
    goal_id = execute_insert(
        "INSERT INTO goals (pillar_id, type, title, description, parent_id, date) VALUES (?, ?, ?, ?, ?, ?)",
        (data['pillar_id'], data['type'], data['title'], data.get('description'), 
         data.get('parent_id'), data['date'])
    )
    return jsonify({"id": goal_id})


# ─── API: Poems ──────────────────────────────────────
@dashboard_bp.route('/api/poems/random', methods=['GET'])
def get_random_poem():
    import random
    category = request.args.get('category', 'motivation')
    
    # Masterful Curated Arabic Poems tailored for deep psychological impact
    curated_poems = {
        'splash_striving': [
            {"content": "بقدرِ الكدِّ تُكتسبُ المَعالي، ومَن طلبَ العُلا سَهِرَ اللّيالي", "poet": "الإمام الشافعي"},
            {"content": "وَما نَيلُ المطالِبِ بالتَمنّي، وَلَكِن تُؤخَذُ الدُنيا غِلابا", "poet": "أحمد شوقي"},
            {"content": "إذا غامَرتَ في شَرَفٍ مَرومٍ، فَلا تَرضَ بِما دونَ النُجومِ", "poet": "المتنبي"},
            {"content": "عَلى قَدرِ أَهلِ العَزمِ تَأتي العَزائِمُ، وَتَأتي عَلى قَدرِ الكِرامِ المَكارِمُ", "poet": "المتنبي"},
            {"content": "ولا يمشي على قَدَمَيهِ ساعٍ، إلى العَلْياءِ إلا بالسَّعْيِ يُرْزَقُ", "poet": "أبو العتاهية"}
        ],
        'pillar_1': [ # Religious
            {"content": "وَمَن يَتَّقِ اللَّهَ يَجعَل لَهُ مَخرَجاً، وَيَرزُقهُ مِن حَيثُ لا يَحتَسِبُ", "poet": "القرآن الكريم"},
            {"content": "إذا كانَ اللّٰهُ مَعَكَ فَمَن عَلَيك، وَإذا كانَ اللّٰهُ عَلَيك فَمن مَعَكَ", "poet": "حكمة إيمانية"},
            {"content": "أطعنِ الإلهَ بصدقِ القصدِ مجتهداً، فالخيرُ كُلُّ الخيرِ في الطّاعاتِ", "poet": "شعر إسلامي"}
        ],
        'pillar_2': [ # Professional
            {"content": "أَعلَمُ أَنَّ المَرءَ بِالمَساعي، وَالمرءُ يُدعى لِأَجَلِ الدَواعي", "poet": "شعر عباسي"},
            {"content": "شبِّرْ بيُمناك المَعالي مُقدِماً، لا بالمُنى يُبنى المَجدُ ويُعْتَلى", "poet": "البارودي"},
            {"content": "وقلِ اعملوا فالسعيُ من شِيَمِ النُّهَى، فبالعملِ الدؤوبِ تُنالُ المَقاصِدُ", "poet": "حديث همة"}
        ],
        'pillar_3': [ # Social
            {"content": "أَحسِن إِلى النّاسِ تَستَعبِد قُلوبَهُمُ، فَطالَما استَعبَدَ الإِنسانَ إِحسانُ", "poet": "أبو الفتح البستي"},
            {"content": "الناسُ بالناسِ ما دامَ الحَياءُ بِهِم، وَالسَعدُ لا شَكَّ تَاراتٌ وَهَبَّاتُ", "poet": "الإمام الشافعي"},
            {"content": "إنَّ المَكارِمَ أَخلاقٌ مُطَهَّرَةٌ، فالدّينُ أَوَّلُها وَالعَقلُ ثانيها", "poet": "علي بن أبي طالب"}
        ],
        'pillar_4': [ # Health
            {"content": "وَفي الجِسْمِ صحَّةٌ تَشفي الغَليلَ، وَفي الرّوحِ طُهرٌ يَقيكَ العَليلَ", "poet": "شعر الحكمة"},
            {"content": "حريصٌ على العافيَةِ المُرتَجاة، مُداوٍ لنفسِهِ مِن كدرِ الحَياة", "poet": "من وحي السعي"},
            {"content": "متِّع قواك بعافياتٍ تصونها، فالجسم مَركَبُ طامحٍ لِسماءِ", "poet": "أدب الحكمة"}
        ],
        'generic_praise': [
            {"content": "لَقَد أَنجَزتَ ما يُعجِزُ وَأَبدَعتَ، كَمَن صاغَ مِن صَخرٍ نُجومَ السَماءِ", "poet": "صوت الحكمة"},
            {"content": "تَسيلُ العَزائِمُ مِن كَفِّهِ، كَما سالَ في الأَرضِ غَيثُ السَحابِ", "poet": "شعر حديث"}
        ]
    }
    
    # For splash motivation poems, use the 500 DB poems with a non-repeating loop
    if category == 'motivation':
        poem = execute_query("SELECT id, content, poet FROM poems WHERE category = 'motivation' ORDER BY RANDOM() LIMIT 1", fetch_one=True)
        
        if poem:
            return jsonify(poem)
            
    # For praise/pillar completion, use the curated deep impact dict
    if category in curated_poems:
        poem = random.choice(curated_poems[category])
        return jsonify(poem)
        
    # Generic fallback
    return jsonify(random.choice(curated_poems['generic_praise']))

# ─── API: Stats ──────────────────────────────────────
@dashboard_bp.route('/api/stats/today', methods=['GET'])
def get_today_stats():
    today = get_today()
    total = execute_query("SELECT COUNT(*) as count FROM tasks WHERE date = ?", (today,), fetch_one=True)
    done = execute_query("SELECT COUNT(*) as count FROM tasks WHERE date = ? AND status = 'done'", (today,), fetch_one=True)
    
    total_count = total['count'] if total else 0
    done_count = done['count'] if done else 0
    progress = round((done_count / total_count * 100), 1) if (total_count > 0) else 0
    
    return jsonify({
        "total": total_count,
        "done": done_count,
        "progress": progress
    })

def _update_late_tasks():
    """Mark yesterday's pending tasks as late."""
    today = get_today()
    execute_query(
        "UPDATE tasks SET status = 'late' WHERE date < ? AND status = 'pending'",
        (today,)
    )
