import { supabaseConfig } from "./supabase-config.js";

// ─── Initialize Supabase ─────────────────────────────
let supabase = null;
const isSupabaseConfigured = supabaseConfig.url && 
                             supabaseConfig.url !== "YOUR_SUPABASE_PROJECT_URL" && 
                             !supabaseConfig.url.includes("YOUR_SUPABASE");

if (isSupabaseConfigured) {
    try {
        supabase = window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey);
    } catch (e) {
        console.error("Failed to initialize Supabase:", e);
    }
}

// ─── State & Memory ──────────────────────────────────
const state = {
    user: null,
    tasks: [],
    goals: [],
    gains: [],
    habits: [],
    aiHistory: []
};

let radarChartInstance = null;

// ─── Guest Mode: localStorage Data Layer ─────────────
function isGuestUser() {
    return state.user && state.user.uid === 'guest_local_user';
}

const guestDB = {
    _getStore(key) {
        try { return JSON.parse(localStorage.getItem(`hazm_guest_${key}`) || '[]'); }
        catch (e) { return []; }
    },
    _setStore(key, data) {
        localStorage.setItem(`hazm_guest_${key}`, JSON.stringify(data));
    },
    _genId() { return 'g_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6); },

    // Tasks
    getTasks(date) {
        return this._getStore('tasks').filter(t => !date || t.date === date);
    },
    addTask(task) {
        const tasks = this._getStore('tasks');
        const newTask = { id: this._genId(), ...task, created_at: new Date().toISOString() };
        tasks.push(newTask);
        this._setStore('tasks', tasks);
        return newTask;
    },
    updateTask(id, updates) {
        const tasks = this._getStore('tasks');
        const idx = tasks.findIndex(t => t.id === id);
        if (idx !== -1) { Object.assign(tasks[idx], updates); this._setStore('tasks', tasks); }
    },
    deleteTask(id) {
        const tasks = this._getStore('tasks').filter(t => t.id !== id);
        this._setStore('tasks', tasks);
    },

    // Habits
    getHabits() { return this._getStore('habits'); },
    addHabit(habit) {
        const habits = this._getStore('habits');
        const newHabit = { id: this._genId(), ...habit, created_at: new Date().toISOString() };
        habits.push(newHabit);
        this._setStore('habits', habits);
        return newHabit;
    },

    // Goals
    getGoals() { return this._getStore('goals'); },
    addGoal(goal) {
        const goals = this._getStore('goals');
        const newGoal = { id: this._genId(), ...goal, progress: goal.progress || 0, created_at: new Date().toISOString() };
        goals.push(newGoal);
        this._setStore('goals', goals);
        return newGoal;
    },
    updateGoal(id, updates) {
        const goals = this._getStore('goals');
        const idx = goals.findIndex(g => g.id === id);
        if (idx !== -1) { Object.assign(goals[idx], updates); this._setStore('goals', goals); }
    },

    // Gains
    getGains() { return this._getStore('gains'); },
    addGain(gain) {
        const gains = this._getStore('gains');
        const newGain = { id: this._genId(), ...gain, created_at: new Date().toISOString() };
        gains.push(newGain);
        this._setStore('gains', gains);
        return newGain;
    },

    // Daily habit generation
    generateDailyHabits(today) {
        const habits = this.getHabits();
        const todayTasks = this.getTasks(today);
        const todayHabitIds = todayTasks.filter(t => t.is_habit).map(t => t.habit_id);
        for (const habit of habits) {
            if (!todayHabitIds.includes(habit.id)) {
                this.addTask({
                    title: habit.title,
                    start_time: habit.start_time || null,
                    pillar_id: habit.pillar_id || 1,
                    is_habit: true,
                    habit_id: habit.id,
                    status: 'pending',
                    date: today
                });
            }
        }
    }
};

function guestSyncState() {
    const today = new Date().toISOString().split('T')[0];
    state.tasks = guestDB.getTasks(today);
    state.goals = guestDB.getGoals();
    state.gains = guestDB.getGains();
    state.habits = guestDB.getHabits();
    renderPillarsView();
    renderAnalyticsView();
    renderDailyTimelineView();
}

// ─── Initialization ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Splash Screen Sequence
    setTimeout(() => {
        document.getElementById('splash-screen').classList.add('fade-out');
        initAuth();
    }, 2000);

    setupEventListeners();
});

function initAuth() {
    // Check if user chose to stay as guest previously
    const isGuest = localStorage.getItem('hazm_is_guest');
    if (isGuest === 'true' || !supabase) {
        const googleBtn = document.getElementById('google-login-btn');
        if (googleBtn) {
            googleBtn.style.display = 'none';
        }

        const guestUser = { uid: 'guest_local_user', displayName: 'زائر' };
        state.user = guestUser;
        document.getElementById('auth-overlay').classList.add('hidden');
        document.querySelector('.greeting-text').innerText = `أهلاً يا بطل 👋`;

        const onboardingDone = localStorage.getItem(`hazm_ob_guest_local_user`);
        if (!onboardingDone) {
            showOnboarding();
        }
        startSync();
        return;
    }

    // Supabase auth listener
    supabase.auth.getSession().then(({ data: { session } }) => {
        handleAuthSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
        handleAuthSession(session);
    });

    function handleAuthSession(session) {
        if (state.user && state.user.uid === 'guest_local_user') return;

        if (session && session.user) {
            const user = session.user;
            state.user = { uid: user.id, displayName: user.user_metadata?.full_name || 'بطل' };
            document.getElementById('auth-overlay').classList.add('hidden');
            document.querySelector('.greeting-text').innerText = `أهلاً يا ${state.user.displayName.split(' ')[0]} 👋`;

            // Check if user completed onboarding
            const onboardingDone = localStorage.getItem(`hazm_ob_${state.user.uid}`);
            if (!onboardingDone) {
                showOnboarding();
            }

            startSync();
        } else {
            document.getElementById('auth-overlay').classList.remove('hidden');
        }
    }
}

function setupEventListeners() {
    const googleBtn = document.getElementById('google-login-btn');
    if (googleBtn) {
        googleBtn.onclick = async () => {
            if (!supabase) {
                alert("قاعدة البيانات السحابية (Supabase) غير مهيأة بعد.");
                return;
            }
            await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin }
            });
        };
    }

    // Guest Login for local testing
    document.getElementById('guest-login-btn').onclick = () => {
        localStorage.setItem('hazm_is_guest', 'true');
        const guestUser = { uid: 'guest_local_user', displayName: 'زائر' };
        state.user = guestUser;
        document.getElementById('auth-overlay').classList.add('hidden');
        document.querySelector('.greeting-text').innerText = `أهلاً يا بطل 👋`;

        const onboardingDone = localStorage.getItem(`hazm_ob_guest_local_user`);
        if (!onboardingDone) {
            showOnboarding();
        }

        startSync();
    };
    // Bottom Navigation Logic
    window.switchMainView = (viewId, btnElement) => {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        if (btnElement) btnElement.classList.add('active');

        document.querySelectorAll('.app-view').forEach(sec => sec.classList.remove('active-view'));
        const target = document.getElementById(viewId);
        if (target) target.classList.add('active-view');

        if (viewId === 'view-chat') {
            const chatArea = document.getElementById('ai-chat-area');
            chatArea.scrollTop = chatArea.scrollHeight;
        }
    };

    // Accordion Toggle Logic
    window.togglePillar = (card) => {
        // Close others
        document.querySelectorAll('.expandable-card').forEach(c => {
            if (c !== card) c.classList.remove('active');
        });
        card.classList.toggle('active');
    };

    // AI Chat Submission & Voice
    const chatInput = document.getElementById('ai-chat-input');
    const chatBtn = document.getElementById('ai-send-btn');
    const voiceBtn = document.getElementById('ai-voice-btn');
    let isSubmitting = false;

    // --- Speech Recognition ---
    let recognition = null;
    let isRecording = false;
    let finalTranscript = '';
    let recordingTimerInterval = null;
    let recordingSeconds = 0;

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'ar-EG'; // Supports Egyptian Arabic and mixed English well
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
            isRecording = true;
            voiceBtn.classList.add('recording');
            chatInput.placeholder = 'حازم بيسمعك...';

            // Start Timer
            const timerEl = document.getElementById('recording-timer');
            if (timerEl) {
                recordingSeconds = 0;
                timerEl.textContent = '00:00';
                clearInterval(recordingTimerInterval);
                recordingTimerInterval = setInterval(() => {
                    recordingSeconds++;
                    const m = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');
                    const s = String(recordingSeconds % 60).padStart(2, '0');
                    timerEl.textContent = `${m}:${s}`;
                }, 1000);
            }
        };

        recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    const current = chatInput.value;
                    chatInput.value = (current ? current + ' ' : '') + event.results[i][0].transcript.trim();
                } else {
                    interim += event.results[i][0].transcript;
                }
            }
            if (chatInput.value.trim().length > 0) {
                chatBtn.classList.add('active');
            }
        };

        recognition.onerror = (e) => {
            console.error('Speech error', e);
        };

        recognition.onend = () => {
            // Keep listening if user didn't explicitly stop
            if (isRecording) {
                try { recognition.start(); } catch (e) { }
            } else {
                voiceBtn.classList.remove('recording');
                chatInput.placeholder = 'اكتب أو فضفض لحازم...';
                clearInterval(recordingTimerInterval);
            }
        };
    }

    if (voiceBtn) {
        voiceBtn.onclick = () => {
            if (!recognition) return alert('متصفحك لا يدعم هذه الخاصية. جرب Chrome.');
            if (isRecording) {
                isRecording = false;
                recognition.stop();
                clearInterval(recordingTimerInterval);
            } else {
                recognition.start();
            }
        };
    }

    // Toggle send button style based on input
    chatInput.addEventListener('input', () => {
        if (chatInput.value.trim().length > 0) chatBtn.classList.add('active');
        else chatBtn.classList.remove('active');
    });

    // --- Submit Text ---
    if (chatBtn && chatInput) {
        const handleSend = async () => {
            if (isSubmitting) return;
            const text = chatInput.value.trim();
            if (text) {
                isSubmitting = true;
                if (isRecording) {
                    isRecording = false;
                    try { recognition.stop(); } catch (e) { }
                }
                chatInput.value = '';
                try {
                    await submitChatMessage(text);
                } catch (e) {
                    console.error("Submission error:", e);
                }
                isSubmitting = false;
            }
        };

        chatBtn.onclick = handleSend;
        chatInput.onkeypress = (e) => {
            if (e.key === 'Enter') handleSend();
        };
    }
}

async function submitChatMessage(text) {
    appendAIChat('user', text);
    state.aiHistory.push({ user: text, ai: '' });

    // Show typing indicator
    const chatArea = document.getElementById('ai-chat-area');
    const typingId = 'typing-' + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.id = typingId;
    typingDiv.className = 'chat-bubble ai typing-indicator';
    typingDiv.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    chatArea.appendChild(typingDiv);
    chatArea.scrollTop = chatArea.scrollHeight;

    const userContext = `
الأهداف والتقدم: ${state.goals.length ? state.goals.map(g => `${g.title} (${g.progress}%)`).join('، ') : 'لا يوجد'}
مهام اليوم: ${state.tasks.length ? state.tasks.map(t => `${t.title} - ${t.status === 'done' ? 'مكتملة' : 'معلقة'}`).join(' | ') : 'فارغ'}
    `;

    try {
        const res = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, history: state.aiHistory.slice(0, -1), context: userContext })
        });
        const data = await res.json();

        // Remove typing indicator
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        const aiResponse = data.response || data;
        const actions = Array.isArray(aiResponse) ? aiResponse : [aiResponse];

        let firstMessage = null;
        for (const a of actions) {
            if (a && typeof a === 'object' && a.message) {
                firstMessage = typeof a.message === 'string' ? a.message : JSON.stringify(a.message);
                break;
            }
        }

        // Fallback if AI returned JSON without 'message' key
        if (!firstMessage) {
            firstMessage = typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse);
        }

        if (firstMessage) {
            appendAIChat('assistant', firstMessage);
            state.aiHistory[state.aiHistory.length - 1].ai = firstMessage;
        }

        for (const actionObj of actions) {
            if (!actionObj || !state.user) continue;
            const actionType = actionObj.action;
            const actionData = actionObj.data || {};
            const today = new Date().toISOString().split('T')[0];

            if (isGuestUser()) {
                // ── Guest Mode Actions (localStorage) ──
                if (actionType === 'add_habit') {
                    const newHabit = guestDB.addHabit({ title: actionData.title, start_time: actionData.start_time || null, pillar_id: actionData.pillar_id || 1 });
                    guestDB.addTask({ title: actionData.title, start_time: actionData.start_time || null, pillar_id: actionData.pillar_id || 1, is_habit: true, habit_id: newHabit.id, status: 'pending', date: today });
                } else if (actionType === 'add_task') {
                    guestDB.addTask({ title: actionData.title, start_time: actionData.start_time || null, pillar_id: actionData.pillar_id || 1, is_habit: false, status: 'pending', date: today });
                } else if (actionType === 'log_gain') {
                    guestDB.addGain({ pillar_id: actionData.pillar_id || 1, type: actionData.type || 'مكسب', value: actionData.value || '', date: today });
                } else if (actionType === 'set_goal') {
                    const year = new Date().getFullYear();
                    guestDB.addGoal({ title: actionData.title || actionData.goal_title || '', pillar_id: actionData.pillar_id || 1, type: actionData.type || 'annual', month: actionData.month || 0, week: actionData.week || 0, year: actionData.year || year });
                } else if (actionType === 'complete_task') {
                    const matchTitle = actionData.task_title_match || actionData.title || '';
                    const task = state.tasks.find(t => t.title.includes(matchTitle) && t.status !== 'done');
                    if (task && matchTitle) { guestDB.updateTask(task.id, { status: 'done' }); if (navigator.vibrate) navigator.vibrate(50); if (window.confetti) confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } }); }
                } else if (actionType === 'delete_task') {
                    const matchTitle = actionData.task_title_match || actionData.title || '';
                    const task = state.tasks.find(t => t.title.includes(matchTitle));
                    if (task && matchTitle) guestDB.deleteTask(task.id);
                } else if (actionType === 'update_goal_progress') {
                    const matchTitle = actionData.goal_title_match || actionData.goal_title || actionData.title || '';
                    const goal = state.goals.find(g => g.title.includes(matchTitle));
                    if (goal && matchTitle) { let newProgress = Math.min(100, goal.progress + (actionData.progress_add || 10)); guestDB.updateGoal(goal.id, { progress: newProgress }); }
                }
                guestSyncState(); // Re-render after any guest action
            } else {
                // ── Supabase Mode Actions ──
                if (actionType === 'add_habit') {
                    const { data: habitRef } = await supabase.from('habits').insert({
                        user_id: state.user.uid, title: actionData.title, start_time: actionData.start_time || null, pillar_id: actionData.pillar_id || 1
                    }).select().single();
                    await supabase.from('tasks').insert({
                        user_id: state.user.uid, title: actionData.title, start_time: actionData.start_time || null, pillar_id: actionData.pillar_id || 1,
                        is_habit: true, habit_id: habitRef.id, status: 'pending', date: today
                    });
                } else if (actionType === 'add_task') {
                    await supabase.from('tasks').insert({
                        user_id: state.user.uid, title: actionData.title, start_time: actionData.start_time || null, pillar_id: actionData.pillar_id || 1,
                        is_habit: false, status: 'pending', date: today
                    });
                } else if (actionType === 'log_gain') {
                    await supabase.from('gains').insert({
                        user_id: state.user.uid, pillar_id: actionData.pillar_id || 1, type: actionData.type || 'مكسب', value: actionData.value || '', date: today
                    });
                } else if (actionType === 'set_goal') {
                    const year = new Date().getFullYear();
                    await supabase.from('goals').insert({
                        user_id: state.user.uid, title: actionData.title || actionData.goal_title || '', pillar_id: actionData.pillar_id || 1,
                        type: actionData.type || 'annual', month: actionData.month || 0, week: actionData.week || 0,
                        year: actionData.year || year, progress: 0
                    });
                } else if (actionType === 'complete_task') {
                    const matchTitle = actionData.task_title_match || actionData.title || '';
                    const task = state.tasks.find(t => t.title.includes(matchTitle) && t.status !== 'done');
                    if (task && matchTitle) await toggleTaskStatus(task.id, task.status);
                } else if (actionType === 'delete_task') {
                    const matchTitle = actionData.task_title_match || actionData.title || '';
                    const task = state.tasks.find(t => t.title.includes(matchTitle));
                    if (task && matchTitle) await supabase.from('tasks').delete().eq('id', task.id);
                } else if (actionType === 'update_goal_progress') {
                    const matchTitle = actionData.goal_title_match || actionData.goal_title || actionData.title || '';
                    const goal = state.goals.find(g => g.title.includes(matchTitle));
                    if (goal && matchTitle) {
                        let newProgress = Math.min(100, goal.progress + (actionData.progress_add || 10));
                        await supabase.from('goals').update({ progress: newProgress }).eq('id', goal.id);
                    }
                }
            }
        }
    } catch (e) {
        console.error("AI Parse Error:", e);
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();
        appendAIChat('assistant', "عذراً يا برو، حصلت مشكلة تقنية وأنا بفكر. جرب تاني أو غير صيغة الكلام.");
    }
}

function appendAIChat(sender, text) {
    const chatArea = document.getElementById('ai-chat-area');
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-bubble ${sender === 'user' ? 'user' : 'ai'}`;

    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
    msgDiv.innerHTML = formattedText;

    chatArea.appendChild(msgDiv);
    chatArea.scrollTop = chatArea.scrollHeight;
}

// ─── Data Sync ──────────────────────────────────────
async function checkAndCreateDailyHabits(uid, today) {
    try {
        const { data: habits } = await supabase.from('habits').select('*').eq('user_id', uid);
        const { data: tasks } = await supabase.from('tasks').select('habit_id').eq('user_id', uid).eq('date', today).eq('is_habit', true);
        
        const todayHabitTasks = tasks ? tasks.map(d => d.habit_id) : [];

        for (const habit of habits || []) {
            if (!todayHabitTasks.includes(habit.id)) {
                await supabase.from('tasks').insert({
                    user_id: uid,
                    title: habit.title,
                    start_time: habit.start_time || null,
                    pillar_id: habit.pillar_id || 1,
                    is_habit: true,
                    habit_id: habit.id,
                    status: 'pending',
                    date: today
                });
            }
        }
    } catch (e) {
        console.error("Habits generation error:", e);
    }
}

async function loadAllData() {
    if (!state.user || isGuestUser()) return;
    const today = new Date().toISOString().split('T')[0];
    const uid = state.user.uid;
    
    const [tasksRes, goalsRes, gainsRes, habitsRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('user_id', uid).eq('date', today).order('created_at', { ascending: true }),
        supabase.from('goals').select('*').eq('user_id', uid).order('created_at', { ascending: true }),
        supabase.from('gains').select('*').eq('user_id', uid).order('created_at', { ascending: true }),
        supabase.from('habits').select('*').eq('user_id', uid)
    ]);
    
    if(tasksRes.data) state.tasks = tasksRes.data;
    if(goalsRes.data) state.goals = goalsRes.data;
    if(gainsRes.data) state.gains = gainsRes.data;
    if(habitsRes.data) state.habits = habitsRes.data;
    
    renderPillarsView();
    renderAnalyticsView();
    renderDailyTimelineView();
}

function startSync() {
    const today = new Date().toISOString().split('T')[0];

    // ── Guest Mode: Use localStorage ──
    if (isGuestUser()) {
        guestDB.generateDailyHabits(today);
        guestSyncState();
        checkAndDisplayDailyPoem('guest');
        return;
    }

    // ── Supabase Mode ──
    checkAndCreateDailyHabits(state.user.uid, today).then(() => {
        loadAllData();
    });
    
    checkAndDisplayDailyPoem(state.user.uid);

    // Setup Realtime subscriptions
    supabase.channel('custom-all-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
          loadAllData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, payload => {
          loadAllData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habits' }, payload => {
          loadAllData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gains' }, payload => {
          loadAllData();
      })
      .subscribe();
}

// --- Rendering Engine ---
const PILLAR_ICONS = {
    1: '<svg viewBox="0 0 40 40" fill="none"><path d="M20 6c-4 0-8 5-8 10h16c0-5-4-10-8-10Z" fill="currentColor" opacity=".85"/><rect x="4" y="16" width="32" height="2" rx="1" fill="currentColor"/><rect x="6" y="18" width="4" height="14" rx="1" fill="currentColor" opacity=".6"/><rect x="30" y="18" width="4" height="14" rx="1" fill="currentColor" opacity=".6"/><rect x="14" y="18" width="12" height="14" rx="1" fill="currentColor" opacity=".5"/><path d="M17 32h6v-6a3 3 0 0 0-6 0v6Z" fill="currentColor"/><rect x="3" y="32" width="34" height="3" rx="1" fill="currentColor"/><rect x="7" y="4" width="1.5" height="12" rx=".75" fill="currentColor" opacity=".7"/><rect x="31.5" y="4" width="1.5" height="12" rx=".75" fill="currentColor" opacity=".7"/><circle cx="7.75" cy="3.5" r="1.5" fill="currentColor" opacity=".8"/><circle cx="32.25" cy="3.5" r="1.5" fill="currentColor" opacity=".8"/><path d="M19 5a2.5 2.5 0 0 1 2 0" stroke="currentColor" stroke-width="1" fill="none" opacity=".7"/></svg>',
    2: '<svg viewBox="0 0 40 40" fill="none"><rect x="5" y="10" width="30" height="22" rx="3" stroke="currentColor" stroke-width="2.5" fill="none"/><path d="M14 10V7a6 6 0 0 1 12 0v3" stroke="currentColor" stroke-width="2.5" fill="none"/><circle cx="20" cy="21" r="3" fill="currentColor"/><path d="M20 24v3" stroke="currentColor" stroke-width="2"/></svg>',
    3: '<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="14" r="5" fill="currentColor"/><path d="M10 32c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="currentColor" stroke-width="2.5" fill="none"/><circle cx="31" cy="16" r="3.5" fill="currentColor" opacity=".6"/><circle cx="9" cy="16" r="3.5" fill="currentColor" opacity=".6"/></svg>',
    4: '<svg viewBox="0 0 40 40" fill="none"><path d="M20 35s-12-7.5-12-17c0-5 4-9 8.5-9 2.7 0 5.1 1.3 6.5 3.4C24.4 10.3 26.8 9 29.5 9c4.5 0 8.5 4 8.5 9 0 9.5-12 17-12 17h-6Z" fill="currentColor"/><path d="M16 19l3 3 6-6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
const PILLARS = [
    { id: 1, label: 'الديني', colorHex: '#f59e0b' },
    { id: 2, label: '\u0627\u0644\u0645\u0647\u0646\u064a', colorHex: '#8b5cf6' },
    { id: 3, label: '\u0627\u0644\u0627\u062c\u062a\u0645\u0627\u0639\u064a', colorHex: '#06b6d4' },
    { id: 4, label: '\u0627\u0644\u0635\u062d\u064a', colorHex: '#10b981' },
];
window._pillarsState = { activePillar: null, activeMonth: new Date().getMonth() + 1 };
window.openPillarDetail = (id) => { window._pillarsState.activePillar = id; window._pillarsState.activeMonth = new Date().getMonth() + 1; renderPillarsView(); };
window.closePillarDetail = () => { window._pillarsState.activePillar = null; renderPillarsView(); };
window.selectMonth = (m) => { window._pillarsState.activeMonth = m; renderPillarsView(); };

function renderPillarsView() {
    const container = document.getElementById('rpg-screen');
    if (!container) return;
    const ps = window._pillarsState;
    const year = new Date().getFullYear();
    const goals = state.goals;
    const habits = state.habits || [];

    if (ps.activePillar) {
        const p = PILLARS.find(x => x.id === ps.activePillar);
        const annualGoal = goals.find(g => g.pillar_id == p.id && g.type === 'annual' && g.year == year);
        const monthsHtml = Array.from({ length: 12 }, (_, i) => {
            const mNum = i + 1;
            const has = goals.some(g => g.pillar_id == p.id && g.type === 'monthly' && g.month == mNum && g.year == year);
            return '<button class="month-btn ' + (ps.activeMonth === mNum ? 'active' : '') + ' ' + (has ? 'has-goal' : '') + '" style="--pc:' + p.colorHex + '" onclick="selectMonth(' + mNum + ')">' + mNum + '</button>';
        }).join('');
        const monthGoal = goals.find(g => g.pillar_id == p.id && g.type === 'monthly' && g.month == ps.activeMonth && g.year == year);
        const weekGoals = [1, 2, 3, 4].map(w => {
            const wg = goals.find(g => g.pillar_id == p.id && g.type === 'weekly' && g.month == ps.activeMonth && g.week == w && g.year == year);
            return '<div class="week-goal-item" style="--pc:' + p.colorHex + '"><div class="week-num">' + w + '</div><div class="week-goal-title ' + (wg ? '' : 'empty') + '">' + (wg ? wg.title : '\u0644\u0645 \u064a\u062a\u062d\u062f\u062f') + '</div></div>';
        }).join('');
        const pHabits = habits.filter(h => h.pillar_id == p.id);
        const habitsHtml = pHabits.length === 0
            ? '<div class="habits-empty">\u0644\u0627 \u062a\u0648\u062c\u062f \u0639\u0627\u062f\u0627\u062a. \u0642\u0644 \u0644\u062d\u0627\u0632\u0645!</div>'
            : pHabits.map(h => '<div class="habit-chip" style="--pc:' + p.colorHex + '">' + h.title + (h.start_time ? '<span class="hc-time">' + h.start_time + '</span>' : '') + '</div>').join('');

        container.innerHTML = '<div class="detail-page" style="--pc:' + p.colorHex + '">'
            + '<button class="detail-back" onclick="closePillarDetail()">\u2190 \u0631\u062c\u0648\u0639</button>'
            + '<div class="detail-header"><div class="detail-icon">' + PILLAR_ICONS[p.id] + '</div><div class="detail-pillar-name">' + p.label + '</div></div>'
            + '<div class="detail-section"><div class="ds-label">\u0627\u0644\u0647\u062f\u0641 \u0627\u0644\u0633\u0646\u0648\u064a ' + year + '</div><div class="ds-value ' + (annualGoal ? '' : 'empty') + '">' + (annualGoal ? annualGoal.title : '\u0644\u0645 \u064a\u062a\u062d\u062f\u062f \u0628\u0639\u062f') + '</div></div>'
            + '<div class="detail-section"><div class="ds-label">\u0627\u0644\u0634\u0647\u0631</div><div class="months-nav">' + monthsHtml + '</div><div class="ds-value ' + (monthGoal ? '' : 'empty') + '" style="margin-top:10px">' + (monthGoal ? monthGoal.title : '\u0644\u0627 \u064a\u0648\u062c\u062f \u0647\u062f\u0641 \u0644\u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631') + '</div></div>'
            + '<div class="detail-section"><div class="ds-label">\u0627\u0644\u0623\u0633\u0627\u0628\u064a\u0639</div><div class="weekly-goals-grid">' + weekGoals + '</div></div>'
            + '<div class="detail-section"><div class="ds-label">\u0627\u0644\u0639\u0627\u062f\u0627\u062a \u0627\u0644\u064a\u0648\u0645\u064a\u0629</div><div class="habits-chips">' + habitsHtml + '</div></div>'
            + '</div>';
        return;
    }

    const cardsHtml = PILLARS.map(p => {
        const ag = goals.find(g => g.pillar_id == p.id && g.type === 'annual' && g.year == year);
        const hc = habits.filter(h => h.pillar_id == p.id).length;
        return '<div class="pillar-card" style="--pc:' + p.colorHex + '" onclick="openPillarDetail(' + p.id + ')">'
            + '<div class="pc-icon" style="color:' + p.colorHex + '">' + PILLAR_ICONS[p.id] + '</div>'
            + '<div class="pc-label">' + p.label + '</div>'
            + '<div class="pc-goal">' + (ag ? ag.title : '\u0644\u0627 \u064a\u0648\u062c\u062f \u0647\u062f\u0641') + '</div>'
            + '<div class="pc-meta">' + hc + ' \u0639\u0627\u062f\u0629</div>'
            + '</div>';
    }).join('');
    container.innerHTML = '<div class="pillars-page"><div class="pillars-grid">' + cardsHtml + '</div></div>';
}





window.toggleTaskStatus = async function (taskId, currentStatus) {
    if (!state.user) return;
    const newStatus = currentStatus === 'done' ? 'pending' : 'done';

    if (newStatus === 'done') {
        if (navigator.vibrate) navigator.vibrate(50);
        if (window.confetti) confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    }

    if (isGuestUser()) {
        guestDB.updateTask(taskId, { status: newStatus });
        guestSyncState();
    } else {
        await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
        loadAllData(); // Refresh UI optimistically
    }
};

function renderAnalyticsView() {
    // 1. Radar Balance (Chart.js)
    let p = [0, 0, 0, 0, 0]; // completed
    let t = [0, 0, 0, 0, 0]; // total
    state.tasks.forEach(task => {
        let pid = task.pillar_id || 1;
        t[pid]++;
        if (task.status === 'done') p[pid]++;
    });

    const radarData = [
        t[1] ? (p[1] / t[1]) * 100 : 20, // Religious
        t[2] ? (p[2] / t[2]) * 100 : 20, // Professional
        t[3] ? (p[3] / t[3]) * 100 : 20, // Social
        t[4] ? (p[4] / t[4]) * 100 : 20  // Health
    ];

    const ctxRadar = document.getElementById('balanceRadarChart');
    if (ctxRadar) {
        if (radarChartInstance) radarChartInstance.destroy();
        Chart.defaults.color = '#a1a1aa';
        Chart.defaults.font.family = "'Cairo', sans-serif";
        radarChartInstance = new Chart(ctxRadar, {
            type: 'radar',
            data: {
                labels: ['روحي', 'مهني', 'اجتماعي', 'صحي'],
                datasets: [{
                    label: 'نسبة التوازن (%)',
                    data: radarData,
                    backgroundColor: 'rgba(139, 92, 246, 0.2)',
                    borderColor: '#8b5cf6',
                    pointBackgroundColor: ['#fbbf24', '#3b82f6', '#ec4899', '#10b981'],
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#8b5cf6',
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        pointLabels: { font: { size: 14, weight: 'bold' }, color: '#fff' },
                        ticks: { display: false, min: 0, max: 100 }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    // 2. Specific Habit Analytics Setup
    const habitSelector = document.getElementById('habit-analytics-selector');
    if (habitSelector) {
        let optionsHTML = '<option value="">-- اختر العادة للتحليل --</option>';
        const allHabits = state.habits || [];
        allHabits.forEach((habit, idx) => {
            optionsHTML += `<option value="${habit.id || idx}">${habit.title}</option>`;
        });

        // If no habits exist, add placeholders for demo
        if (allHabits.length === 0) {
            optionsHTML += `<option value="demo_1">شرب الماء صباحاً</option>`;
            optionsHTML += `<option value="demo_2">القراءة (١٥ دقيقة)</option>`;
            optionsHTML += `<option value="demo_3">الرياضة المنزلية</option>`;
        }

        habitSelector.innerHTML = optionsHTML;

        // Auto-select the first available habit (real or demo)
        if (habitSelector.options.length > 1) {
            habitSelector.selectedIndex = 1;
            renderSpecificHabitAnalytics();
        } else {
            document.getElementById('consistency-heatmap').innerHTML = '<p class="empty-list" style="width: 100%; text-align: center;">لا توجد عادات لعرضها</p>';
            document.getElementById('habit-stats-container').style.display = 'none';
        }
    }

}

window.renderSpecificHabitAnalytics = function () {
    const selector = document.getElementById('habit-analytics-selector');
    const heatmapContainer = document.getElementById('consistency-heatmap');
    const statsContainer = document.getElementById('habit-stats-container');
    const val = selector.value;

    if (!val) {
        heatmapContainer.innerHTML = '<p class="empty-list" style="width: 100%; text-align: center;">الرجاء اختيار عادة لعرض خريطة الالتزام</p>';
        statsContainer.style.display = 'none';
        return;
    }

    // Determine mock stats based on selected value hash to make it consistent per habit
    let hash = 0;
    for (let i = 0; i < val.length; i++) hash += val.charCodeAt(i);

    const isNewHabit = hash % 3 === 0;
    const totalDays = isNewHabit ? 14 : 30; // heatmap grid limit to 30
    const startOffset = isNewHabit ? 14 : 85 + (hash % 20);
    const reps = isNewHabit ? 9 : 68 + (hash % 10);
    const rate = Math.round((reps / startOffset) * 100);

    // Render Stats
    statsContainer.style.display = 'grid';
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - startOffset);

    document.getElementById('hs-start').innerText = startDate.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    document.getElementById('hs-reps').innerText = `${reps} مرة`;
    document.getElementById('hs-rate').innerText = `${rate > 100 ? 100 : rate}٪`;

    // Render specific Heatmap for the habit
    let heatmapHTML = '';
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);

        let level = 0;
        if (i > startOffset) {
            level = 0; // Haven't started yet
        } else {
            // Predictable simulation based on hash and day
            const randomizer = (hash + i) % 10;
            if (rate > 80) level = randomizer > 1 ? 3 : 0; // Very committed
            else if (rate > 50) level = randomizer > 4 ? 2 : 0; // Medium
            else level = randomizer > 7 ? 1 : 0; // Low
        }

        heatmapHTML += `<div class="heatmap-cell" data-level="${level}" title="${d.toLocaleDateString('ar-EG')} - الإنجاز: ${level > 0 ? 'مُنجز' : 'لم ينجز'}"></div>`;
    }
    heatmapContainer.innerHTML = heatmapHTML;
};

// ─── Daily Timeline Logic ───
function renderDailyTimelineView() {
    const container = document.getElementById('daily-timeline-list');
    if (!container) return;

    const prayers = [
        { title: 'المغرب', time: '18:00', type: 'prayer', hour: 18 },
        { title: 'العشاء', time: '19:30', type: 'prayer', hour: 19.5 },
        { title: 'الفجر', time: '04:30', type: 'prayer', hour: 28.5 }, // +24 for next day sorting
        { title: 'الشروق', time: '06:00', type: 'sunrise', hour: 30 },
        { title: 'الظهر', time: '12:00', type: 'prayer', hour: 36 },
        { title: 'العصر', time: '15:30', type: 'prayer', hour: 39.5 }
    ];

    let items = [...prayers];

    // Map tasks to hours
    state.tasks.forEach(task => {
        let taskHour = 37; // Default to after Dhuhr if no time
        if (task.start_time && task.start_time !== '--:--') {
            const parts = task.start_time.split(':');
            let h = parseInt(parts[0], 10);
            let m = parseInt(parts[1], 10);
            if (h < 18) h += 24; // If before Maghrib, it's the next day in the Islamic calendar
            taskHour = h + (m / 60);
        }
        items.push({ ...task, type: 'task', hour: taskHour });
    });

    // Sort by Islamic Day Flow (Maghrib to Maghrib)
    items.sort((a, b) => a.hour - b.hour);

    container.innerHTML = '<div class="timeline-track"></div>';
    items.forEach((item) => {
        if (item.type === 'prayer' || item.type === 'sunrise') {
            container.innerHTML += `
                <div class="tl-item tl-prayer">
                    <div class="tl-title">${item.title}</div>
                    <div class="tl-time">${item.time}</div>
                </div>
            `;
        } else {
            // Pick color based on pillar_id
            let taskColor = 'var(--primary)';
            if (item.pillar_id == 1) taskColor = 'var(--accent-religious)';
            if (item.pillar_id == 2) taskColor = 'var(--accent-professional)';
            if (item.pillar_id == 3) taskColor = 'var(--accent-social)';
            if (item.pillar_id == 4) taskColor = 'var(--accent-health)';

            container.innerHTML += `
                <div class="tl-item tl-task ${item.status === 'done' ? 'done' : ''}" style="--task-color: ${taskColor};" onclick="toggleTaskStatus('${item.id}', '${item.status}')">
                    <div class="tl-title">${item.title}</div>
                    <div class="tl-time">${item.start_time && item.start_time !== '--:--' ? item.start_time : 'مرن'}</div>
                </div>
            `;
        }
    });

    // If no tasks at all, add a subtle call to action
    if (state.tasks.length === 0) {
        container.innerHTML += `
            <div style="text-align: center; margin-top: 40px; padding: 20px; background: rgba(255,255,255,0.02); border-radius: 16px; border: 1px dashed rgba(255,255,255,0.1);">
                <i class="ph-fill ph-calendar-blank" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 10px; opacity: 0.5;"></i>
                <p style="color: var(--text-muted); font-size: 0.95rem; font-weight: 700;">يومك يبدو هادئاً جداً</p>
                <p style="color: rgba(255,255,255,0.4); font-size: 0.85rem; margin-top: 5px;">تحدث مع حازم لإضافة مهام أو عادات جديدة لخطتك اليومية</p>
            </div>
        `;
    }
}

// ─────────────────────────────────────────────────────────
// ─── ONBOARDING SYSTEM (3 Phases) ─────────────────────
// ─────────────────────────────────────────────────────────

let obStoryStep = 1;
const OB_STORY_TOTAL = 5;

let obQuestionIndex = 0;
const obQuestions = [
    'إيه اسمك الأول؟ عشان أناديك بيه 😊',
    'بتشتغل إيه دلوقتي؟ أو لسه طالب؟',
    'إيه أكتر جانب في حياتك حاسس إنه محتاج تركيز؟ (ديني / مهني / اجتماعي / صحي)',
    'عندك عادة يومية نفسك تلتزم بيها بس مش قادر؟',
    'إيه أكبر هدف نفسك تحققه في الـ ٦ شهور الجاية؟'
];
const obAnswers = [];

let obTourStep = 0;
const obTourSteps = [
    { selector: '.nav-btn[data-view="view-chat"]', text: 'هنا بيتك الأساسي 🏠 كلّم حازم بأي حاجة: ضيف مهمة، اتكلم عن يومك، أو اطلب نصيحة. حازم بيفهمك بالمصري والإنجليزي.' },
    { selector: '.nav-btn[data-view="view-timeline"]', text: 'اليومية بتاعتك 📅 يومك منظم من المغرب للمغرب حسب أوقات الصلوات. كل مهمة بتظهر في وقتها الطبيعي.' },
    { selector: '.nav-btn[data-view="view-pillars"]', text: 'الجوانب الأربعة ⚡ هنا بتشوف حياتك مقسّمة: ديني، مهني، اجتماعي، صحي. كل جانب فيه أهدافه وعاداته.' },
    { selector: '.nav-btn[data-view="view-analytics"]', text: 'التحليلات 📊 هنا بتشوف مدى توازن حياتك وتتابع التزامك بالعادات. الأرقام بتحفّزك تكمّل!' },
];

function showOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    overlay.style.display = 'block';
    obStoryStep = 1;
    renderStoryDots();
    updateStorySlide();
    setupOnboardingButtons();
}

function setupOnboardingButtons() {
    const nextBtn = document.getElementById('ob-next-story-btn');
    const skipBtn = document.getElementById('ob-skip-btn');
    const startChatBtn = document.getElementById('ob-start-chat-btn');

    if (nextBtn) nextBtn.addEventListener('click', nextStorySlide);
    if (skipBtn) skipBtn.addEventListener('click', skipToApp);
    if (startChatBtn) startChatBtn.addEventListener('click', startPersonalization);

    const chatSendBtn = document.getElementById('ob-chat-send-btn');
    const chatInput = document.getElementById('ob-chat-input');
    if (chatSendBtn) chatSendBtn.addEventListener('click', submitOnboardingAnswer);
    if (chatInput) chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitOnboardingAnswer();
    });

    const tourNextBtn = document.getElementById('ob-tour-next-btn');
    if (tourNextBtn) tourNextBtn.addEventListener('click', nextTourStep);
}

function renderStoryDots() {
    const dotsContainer = document.getElementById('ob-story-dots');
    if (!dotsContainer) return;
    let html = '';
    for (let i = 1; i <= OB_STORY_TOTAL; i++) {
        html += `<div class="ob-dot ${i === obStoryStep ? 'active' : ''}"></div>`;
    }
    dotsContainer.innerHTML = html;
}

function updateStorySlide() {
    document.querySelectorAll('.ob-slide').forEach(s => s.classList.remove('active'));
    const target = document.querySelector(`.ob-slide[data-slide="${obStoryStep}"]`);
    if (target) target.classList.add('active');
    renderStoryDots();

    const nextBtn = document.getElementById('ob-next-story-btn');
    if (nextBtn) {
        nextBtn.style.display = obStoryStep >= OB_STORY_TOTAL ? 'none' : 'inline-block';
    }
}

function nextStorySlide() {
    if (obStoryStep < OB_STORY_TOTAL) {
        obStoryStep++;
        updateStorySlide();
    }
}

function startPersonalization() {
    document.getElementById('ob-phase-story').classList.remove('active');
    document.getElementById('ob-phase-chat').classList.add('active');
    obQuestionIndex = 0;
    obAnswers.length = 0;

    const chatArea = document.getElementById('ob-chat-messages');
    chatArea.innerHTML = '';
    addObMessage('hazm', obQuestions[0]);
    updateObProgress();
}

function addObMessage(type, text) {
    const chatArea = document.getElementById('ob-chat-messages');
    const msg = document.createElement('div');
    msg.className = `ob-msg ${type}`;
    msg.textContent = text;
    chatArea.appendChild(msg);
    setTimeout(() => { chatArea.scrollTop = chatArea.scrollHeight; }, 50);
}

function updateObProgress() {
    const nums = ['١', '٢', '٣', '٤', '٥'];
    const el = document.getElementById('ob-q-progress');
    if (el) el.textContent = `سؤال ${nums[Math.min(obQuestionIndex, 4)]} من ٥`;
}

function submitOnboardingAnswer() {
    const input = document.getElementById('ob-chat-input');
    const answer = input.value.trim();
    if (!answer) return;

    addObMessage('user', answer);
    obAnswers.push(answer);
    input.value = '';
    obQuestionIndex++;

    if (obQuestionIndex < obQuestions.length) {
        updateObProgress();
        setTimeout(() => addObMessage('hazm', obQuestions[obQuestionIndex]), 600);
    } else {
        setTimeout(() => {
            const name = obAnswers[0] || 'بطل';
            addObMessage('hazm', `تشرفت بيك يا ${name}! 🔥 دلوقتي هوريك التطبيق في ثواني وبعدها نبدأ رحلتنا سوا.`);

            const uid = state.user ? state.user.uid : 'guest';
            localStorage.setItem(`hazm_name_${uid}`, obAnswers[0] || '');
            localStorage.setItem(`hazm_job_${uid}`, obAnswers[1] || '');
            localStorage.setItem(`hazm_focus_${uid}`, obAnswers[2] || '');
            localStorage.setItem(`hazm_habit_${uid}`, obAnswers[3] || '');
            localStorage.setItem(`hazm_goal_${uid}`, obAnswers[4] || '');

            setTimeout(() => startSpotlightTour(), 2000);
        }, 600);
    }
}

function startSpotlightTour() {
    document.getElementById('ob-phase-chat').classList.remove('active');
    document.getElementById('ob-phase-tour').classList.add('active');
    document.getElementById('onboarding-overlay').style.background = 'transparent';
    obTourStep = 0;
    showTourStep();
}

function showTourStep() {
    if (obTourStep >= obTourSteps.length) {
        finishFullOnboarding();
        return;
    }

    const step = obTourSteps[obTourStep];
    const targetEl = document.querySelector(step.selector);
    if (!targetEl) { obTourStep++; showTourStep(); return; }

    const rect = targetEl.getBoundingClientRect();
    const pad = 12; // Increased padding for better framing

    const spotlightBg = document.getElementById('ob-spotlight-bg');
    spotlightBg.style.cssText = `
        position: fixed; z-index: 9996;
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.92), 
                    0 0 0 3px rgba(139, 92, 246, 0.9),
                    0 0 30px 10px rgba(139, 92, 246, 0.4);
        border-radius: 20px; pointer-events: none;
        top: ${rect.top - pad}px; left: ${rect.left - pad}px;
        width: ${rect.width + pad * 2}px; height: ${rect.height + pad * 2}px;
        transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        background: transparent;
    `;

    const tooltip = document.getElementById('ob-tooltip');
    tooltip.style.display = 'block';
    tooltip.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
    tooltip.style.bottom = `${window.innerHeight - rect.top + 24}px`;
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translateX(-50%)';
    tooltip.style.top = 'auto';

    document.getElementById('ob-tooltip-text').textContent = step.text;
    document.getElementById('ob-tooltip-counter').textContent = `${obTourStep + 1} / ${obTourSteps.length}`;

    const nextBtn = document.getElementById('ob-tour-next-btn');
    nextBtn.textContent = obTourStep === obTourSteps.length - 1 ? 'ابدأ رحلتي! 🚀' : 'التالي ←';
}

function nextTourStep() {
    obTourStep++;
    showTourStep();
}

function finishFullOnboarding() {
    const uid = state.user ? state.user.uid : 'guest';
    localStorage.setItem(`hazm_ob_${uid}`, 'done');

    const overlay = document.getElementById('onboarding-overlay');
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.5s ease';
    setTimeout(() => {
        overlay.style.display = 'none';
        overlay.style.opacity = '1';
        const name = obAnswers[0] || state.user?.displayName?.split(' ')[0] || 'بطل';
        document.querySelector('.greeting-text').innerText = `أهلاً يا ${name} 👋`;
    }, 500);
}

function skipToApp() {
    const uid = state.user ? state.user.uid : 'guest';
    localStorage.setItem(`hazm_ob_${uid}`, 'done');
    document.getElementById('onboarding-overlay').style.display = 'none';
}

// Dev function to reset onboarding for testing
window.resetHazmTour = function () {
    localStorage.clear();
    location.reload();
};

// ─── Daily Motivational Poem Logic ───
async function checkAndDisplayDailyPoem(uid) {
    const sessionKey = `hazm_session_count_${uid}`;
    let sessionCount = parseInt(localStorage.getItem(sessionKey) || '0');
    
    // Increment session count
    sessionCount += 1;
    localStorage.setItem(sessionKey, sessionCount.toString());

    // Only show poem from session 2 onwards (session 1 is for onboarding usually)
    if (sessionCount >= 2) {
        const overlay = document.getElementById('daily-poem-overlay');
        const poemText = document.getElementById('dp-poem-text');
        const poetName = document.getElementById('dp-poet-name');
        const startBtn = document.getElementById('dp-start-btn');
        
        if (!overlay) return;
        
        try {
            const res = await fetch('/api/poems/random?category=motivation');
            const data = await res.json();
            
            if (data && data.content) {
                let formatted = data.content.replace(' ... ', '<span class="verse-separator">✦</span>');
                poemText.innerHTML = formatted;
                poetName.innerText = `— ${data.poet} —`;
                
                overlay.style.display = 'flex';
                // Slight delay to allow display flex to apply before opacity transition
                setTimeout(() => {
                    overlay.classList.add('active');
                }, 50);
                
                startBtn.onclick = () => {
                    overlay.classList.remove('active');
                    setTimeout(() => {
                        overlay.style.display = 'none';
                    }, 800); // Wait for fade out animation
                };
            }
        } catch(e) {
            console.error('Failed to load daily poem', e);
        }
    }
}
