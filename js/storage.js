'use strict';

// ── ALSM  (localStorage — key: "alsm") ──────────────────────────────────────
const ALSM = {
  KEY: 'alsm',

  blank(name) {
    const today = todayStr();
    return {
      schema_version: 1,
      profile: { name, joined: today, streak: 1, last_visited: today, total_questions: 0 },
      category_totals: {},
      weak_questions: {},
      weak_streaks: {},
      progress_log: [],
      sessions: []
    };
  },

  load() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || null; }
    catch { return null; }
  },

  loadSafe() {
    const data = this.load();
    if (!data) return null;
    data.progress_log    = data.progress_log    || [];
    data.sessions        = data.sessions        || [];
    data.category_totals = data.category_totals || {};
    data.weak_questions  = data.weak_questions  || {};
    data.weak_streaks    = data.weak_streaks    || {};
    if (!data.profile) data.profile = { name: '', streak: 0, last_visited: todayStr(), total_questions: 0 };
    return data;
  },

  save(data) { localStorage.setItem(this.KEY, JSON.stringify(data)); },

  updateStreak(data) {
    const today = todayStr();
    if (data.profile.last_visited === today) return;
    data.profile.streak = data.profile.last_visited === dateMinus1(today)
      ? (data.profile.streak || 0) + 1 : 1;
    data.profile.last_visited = today;
    this.save(data);
  },

  // Called once per session on stop. Folds results into persistent state.
  stopSession(data, meta, results) {
    if (!results.length) return null;

    // 1. Compute score_percent + category_breakdown
    const byCat = {}, byCatN = {};
    results.forEach(r => {
      byCat[r.category]  = (byCat[r.category]  || 0) + r.score;
      byCatN[r.category] = (byCatN[r.category] || 0) + 1;
    });
    const catBreakdown = {};
    for (const cat of Object.keys(byCat))
      catBreakdown[cat] = (byCat[cat] / byCatN[cat]) * 100;

    const n        = results.length;
    const scorePct = (results.reduce((s, r) => s + r.score, 0) / n) * 100;

    const session = {
      ...meta,
      ended: new Date().toISOString(),
      ended_abruptly: false,
      questions_attempted: n,
      score_percent: scorePct,
      category_breakdown: catBreakdown
    };

    // 2. Rolling averages in category_totals
    for (const [cat, pct] of Object.entries(catBreakdown)) {
      const ct = data.category_totals[cat];
      if (!ct) { data.category_totals[cat] = { sessions: 1, avg_percent: pct }; }
      else { ct.avg_percent = (ct.avg_percent * ct.sessions + pct) / (ct.sessions + 1); ct.sessions++; }
    }

    // 3. progress_log — one entry per day, exact average using sample count
    const today    = todayStr();
    const existing = data.progress_log.find(e => e.date === today);
    if (existing) {
      const n = (existing.samples || 1) + 1;
      existing.overall_percent = (existing.overall_percent * (n - 1) + scorePct) / n;
      existing.samples = n;
      if (!existing._cat_n) existing._cat_n = {};
      for (const [cat, pct] of Object.entries(catBreakdown)) {
        if (existing.by_category[cat] != null) {
          const cn = (existing._cat_n[cat] || 1) + 1;
          existing.by_category[cat] = (existing.by_category[cat] * (cn - 1) + pct) / cn;
          existing._cat_n[cat] = cn;
        } else {
          existing.by_category[cat] = pct;
        }
      }
    } else {
      data.progress_log.push({ date: today, overall_percent: scorePct, by_category: { ...catBreakdown }, samples: 1 });
    }

    // 4. weak_questions + weak_streaks
    if (!data.weak_streaks) data.weak_streaks = {};
    results.forEach(r => {
      const inWeak = r.id in data.weak_questions;
      if (r.score < 0.5) {
        data.weak_questions[r.id] = (data.weak_questions[r.id] || 0) + 1;
        if (inWeak) data.weak_streaks[r.id] = 0;
      } else if (inWeak) {
        data.weak_streaks[r.id] = (data.weak_streaks[r.id] || 0) + 1;
        if (data.weak_streaks[r.id] >= 2) {
          delete data.weak_questions[r.id];
          delete data.weak_streaks[r.id];
        }
      }
    });

    // 5. total_questions counter
    data.profile.total_questions = (data.profile.total_questions || 0) + n;

    // 6. Push session, cap at last 10
    data.sessions.push(session);
    if (data.sessions.length > 10) data.sessions = data.sessions.slice(-10);

    this.save(data);
    return session;
  }
};
