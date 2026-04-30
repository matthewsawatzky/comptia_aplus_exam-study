'use strict';

// ── NAVIGATION ───────────────────────────────────────────────────────────────
function show(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById('view-' + id).classList.remove('hidden');
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.view === id));
}

function navTo(id) {
  if (SS.active) { alert('Stop your current session before navigating away.'); return; }
  if (id === 'home')     renderHome();
  if (id === 'progress') renderProgress();
  if (id === 'settings') renderSettings();
  show(id);
}

function enterSessionMode() {
  document.getElementById('nav-normal').style.display = 'none';
  document.getElementById('nav-sess').style.display   = 'flex';
  show('session');
}

function exitSessionMode() {
  document.getElementById('nav-normal').style.display = '';
  document.getElementById('nav-sess').style.display   = 'none';
  renderHome();
  show('home');
}

// ── VIEW: SETUP ──────────────────────────────────────────────────────────────
function createProfile() {
  const name = document.getElementById('setup-name').value.trim();
  if (!name) { document.getElementById('setup-name').focus(); return; }
  ALSM.save(ALSM.blank(name));
  renderHome();
  show('home');
}

// ── VIEW: HOME ───────────────────────────────────────────────────────────────
function renderHome() {
  const data  = ALSM.load();
  if (!data) return;

  const sessions  = [...data.sessions].reverse();
  const totalQ    = data.profile.total_questions || 0;

  let overallAvg = null;
  if (sessions.length) {
    const wt = sessions.reduce((s, r) => s + r.score_percent * r.questions_attempted, 0);
    const nt = sessions.reduce((s, r) => s + r.questions_attempted, 0);
    if (nt > 0) overallAvg = wt / nt;
  }

  const cats = Object.entries(data.category_totals).sort((a,b) => b[1].avg_percent - a[1].avg_percent);
  const best  = cats[0]    ?? null;
  const worst = cats[cats.length - 1] ?? null;
  const allPerfect = !!worst && worst[1].avg_percent >= 100;
  const needsWorkValue = allPerfect ? "You're good to go" : (worst ? worst[0] : '—');
  const needsWorkSub = allPerfect
    ? 'All categories are at 100% avg'
    : (worst ? worst[1].avg_percent.toFixed(1) + '% avg' : 'No data yet');
  const needsWorkColor = allPerfect
    ? 'var(--ok)'
    : (worst ? scoreColor(worst[1].avg_percent) : 'var(--dim)');
  const avgC  = overallAvg != null ? scoreColor(overallAvg) : 'var(--dim)';

  const recentHTML = sessions.length === 0
    ? `<div class="empty"><div class="big">🏁</div>No sessions yet — start one!</div>`
    : sessions.slice(0, 5).map(s => {
        const catBadges = Object.keys(s.category_breakdown || {}).map(c => `<span class="badge bd-dim">${c}</span>`).join('');
        return `<div class="sess-row">
          <span class="sess-date">${fmtDate(s.started)}</span>
          <div class="sess-cats">${catBadges}</div>
          <span class="sess-score" style="color:${scoreColor(s.score_percent)}">${s.score_percent.toFixed(1)}%</span>
          <span class="c-dim xs">${s.questions_attempted} q · ${fmtTime(Math.round((new Date(s.ended) - new Date(s.started)) / 1000))}</span>
        </div>`;
      }).join('');

  document.getElementById('home-body').innerHTML = `
    <div class="flex ai-c jb mb-8">
      <h1>Welcome back, ${esc(data.profile.name)}</h1>
      <span class="streak-badge">🔥 ${data.profile.streak}-day streak</span>
    </div>
    <p class="c-muted sm mb-24">
      ${sessions.length > 0
        ? `Last session ${fmtDate(sessions[0].started)} · ${sessions[0].score_percent.toFixed(1)}%`
        : 'No sessions yet'}
    </p>

    <div class="stat-grid mb-20" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat-card">
        <div class="stat-label">Overall Avg</div>
        <div class="stat-value" style="color:${avgC}">${overallAvg != null ? overallAvg.toFixed(1)+'%' : '—'}</div>
        <div class="stat-sub">${sessions.length} recent session${sessions.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Questions</div>
        <div class="stat-value">${totalQ}</div>
        <div class="stat-sub">total answered</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Best Category</div>
        <div class="stat-value" style="font-size:14px;padding-top:6px">${best ? best[0] : '—'}</div>
        <div class="stat-sub" style="color:${best ? scoreColor(best[1].avg_percent) : 'var(--dim)'}">
          ${best ? best[1].avg_percent.toFixed(1)+'% avg' : 'No data yet'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Needs Work</div>
        <div class="stat-value" style="font-size:14px;padding-top:6px">${needsWorkValue}</div>
        <div class="stat-sub" style="color:${needsWorkColor}">
          ${needsWorkSub}</div>
      </div>
    </div>

    <div class="flex g-8 mb-24">
      <button class="btn btn-primary btn-lg" onclick="showCategories()">▶&nbsp; Start New Session</button>
      <button class="btn btn-secondary" onclick="navTo('progress')">View Progress</button>
    </div>

    <div class="card">
      <h3 class="mb-12">Recent Sessions</h3>
      ${recentHTML}
    </div>`;
}

// ── VIEW: CATEGORIES ─────────────────────────────────────────────────────────
async function showCategories() {
  const data = ALSM.loadSafe();
  const grid = document.getElementById('cat-grid');
  const startBtn = document.querySelector('#view-categories .btn-primary');
  if (startBtn) { startBtn.disabled = false; startBtn.textContent = 'Start Session →'; }
  grid.innerHTML = '<div class="c-muted sm" style="padding:12px">Loading questions…</div>';
  if (!data) return;

  try {
    await QRepo.loadAll();
  } catch (e) {
    grid.innerHTML = '<div style="color:var(--err);padding:12px">Failed to load question data. Please refresh.</div>';
    return;
  }

  grid.innerHTML = '';
  CAT_KEYS.forEach(key => {
    const ct  = data.category_totals[key];
    const pct = ct ? ct.avg_percent : null;
    const qn  = QRepo.getCategoryCount(key) ?? '?';
    const c   = scoreColor(pct);
    const el  = document.createElement('div');
    el.className = 'cat-card';
    el.dataset.cat = key;
    el.onclick = () => el.classList.toggle('selected');
    el.innerHTML = `
      <div class="flex ai-c jb mb-8">
        <span style="font-size:20px">${CAT_ICON[key]}</span>
        <span class="badge bd-dim">${qn} q</span>
      </div>
      <div style="font-size:14px;font-weight:600;margin-bottom:3px">${CAT_LABEL[key]}</div>
      <div class="sm c-muted mb-12">${ct ? ct.sessions+' session'+(ct.sessions!==1?'s':'')+' · rolling avg' : 'Not started yet'}</div>
      <div class="flex ai-c jb mb-6">
        <span style="font-family:var(--mono);font-size:20px;font-weight:700;color:${c}">${pct!=null?pct.toFixed(1)+'%':'—'}</span>
        ${pct!=null?`<span class="xs c-muted">${pct>=75?'✓ passing':pct>=50?'~ borderline':'✗ needs work'}</span>`:''}
      </div>
      ${pct!=null?`<div class="ptrack"><div class="pfill" style="width:${Math.max(0,pct)}%;background:${c}"></div></div>`:'<div style="height:6px"></div>'}`;
    grid.appendChild(el);
  });

  show('categories');
}

async function startSession() {
  const selected = [...document.querySelectorAll('.cat-card.selected')].map(el => el.dataset.cat);
  if (!selected.length) { alert('Select at least one category.'); return; }

  const btn = document.querySelector('#view-categories .btn-primary');
  btn.disabled = true;
  btn.textContent = 'Loading…';

  let pool;
  try {
    pool = shuffle(await QRepo.getQuestionsByCategories(selected));
  } catch (e) {
    alert('Failed to load questions. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Start Session →';
    return;
  }

  if (!pool.length) { alert('No questions available.'); btn.disabled = false; btn.textContent = 'Start Session →'; return; }

  SS.active     = true;
  SS.id         = 'session-' + Date.now();
  SS.started    = new Date().toISOString();
  SS.categories = selected;
  SS.questions  = pool;
  SS.idx        = 0;
  SS.results    = [];
  SS.elapsed    = 0;
  SS.timer      = setInterval(() => {
    SS.elapsed++;
    document.getElementById('sn-timer').textContent = fmtTime(SS.elapsed);
  }, 1000);

  enterSessionMode();
  renderQuestion(0);
}

// ── VIEW: PROGRESS ───────────────────────────────────────────────────────────
function renderProgress() {
  const data = ALSM.loadSafe();
  if (!data) {
    document.getElementById('prog-body').innerHTML =
      `<div class="empty"><div class="big">📊</div>No data yet — complete a session first.</div>`;
    return;
  }
  const log  = data.progress_log;
  const wq   = data.weak_questions;
  const ct   = data.category_totals;

  const catRows = CAT_KEYS.map(key => {
    const d   = ct[key];
    const pct = d ? d.avg_percent : null;
    const c   = scoreColor(pct);
    return `<div class="catbar-row">
      <span class="catbar-label">${CAT_LABEL[key]}</span>
      <div class="catbar-track">${pct!=null?`<div class="catbar-fill" style="width:${Math.max(0,pct)}%;background:${c}"></div>`:''}</div>
      <span class="catbar-pct" style="color:${c}">${pct!=null?pct.toFixed(1)+'%':'—'}</span>
    </div>`;
  }).join('');

  const weakRows = Object.entries(wq)
    .sort((a, b) => b[1] - a[1])
    .map(([id, fails]) => {
      const q = QRepo.getQuestionById(id);
      if (!q) return '';
      const fc = fails >= 4 ? `background:var(--errd);color:var(--err)` : fails >= 2 ? `background:var(--warnd);color:var(--warn)` : `background:var(--s3);color:var(--muted)`;
      const preview = q.question.length > 60 ? q.question.slice(0, 57) + '…' : q.question;
      return `<tr>
        <td><code class="mono sm c-accent">${q.id}</code></td>
        <td><span class="badge bd-dim">${q.category}</span></td>
        <td class="c-muted sm">${q.subcategory}</td>
        <td class="c-muted sm" style="max-width:220px">${esc(preview)}</td>
        <td style="text-align:center"><span class="fail-dot" style="${fc}">${fails}</span></td>
      </tr>`;
    }).join('');

  document.getElementById('prog-body').innerHTML = `
    <div class="flex ai-c jb mb-20">
      <h2>Progress Dashboard</h2>
    </div>

    <div class="card mb-14">
      <h3 class="mb-12">Score Over Time</h3>
      ${log.length === 0
        ? `<div class="empty"><div class="big">📊</div>Complete a session to see your chart here.</div>`
        : `<svg id="prog-chart" class="lchart"></svg>`}
    </div>

    <div class="card mb-14">
      <h3 class="mb-16">Per-Category Breakdown</h3>
      ${Object.keys(ct).length === 0
        ? `<div class="empty">No category data yet.</div>`
        : catRows}
    </div>

    <div class="card">
      <div class="flex ai-c jb mb-12">
        <h3>Weak Questions</h3>
        <span class="badge bd-red">${Object.keys(wq).length} flagged</span>
      </div>
      ${Object.keys(wq).length === 0
        ? `<div class="empty">No weak questions yet — keep quizzing!</div>`
        : `<table class="weak-tbl">
            <thead><tr><th>ID</th><th>Category</th><th>Subcategory</th><th>Question</th><th style="text-align:center">Fails</th></tr></thead>
            <tbody>${weakRows}</tbody>
          </table>`}
    </div>`;

  if (log.length > 0) requestAnimationFrame(() => drawChart(log));
}

function drawChart(log) {
  const svg = document.getElementById('prog-chart');
  if (!svg) return;
  const W=800, H=180, pL=44, pR=20, pT=14, pB=34;
  const cW = W - pL - pR, cH = H - pT - pB;
  const xs = log.map((_, i) => pL + (i / Math.max(log.length - 1, 1)) * cW);
  const ys = log.map(d  => pT + cH - (Math.max(0, Math.min(100, d.overall_percent)) / 100) * cH);

  let out = `<defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#58a6ff" stop-opacity=".18"/>
    <stop offset="100%" stop-color="#58a6ff" stop-opacity="0"/>
  </linearGradient></defs>`;

  [0, 25, 50, 75, 100].forEach(p => {
    const y = pT + cH - (p / 100) * cH;
    out += `<line x1="${pL}" y1="${y}" x2="${W-pR}" y2="${y}" stroke="#21262d" stroke-width="1"/>`;
    out += `<text x="${pL-6}" y="${y+4}" text-anchor="end" fill="#656d76" font-size="10" font-family="monospace">${p}</text>`;
  });

  if (log.length > 1) {
    const area = `M${xs[0]},${ys[0]} ` + xs.slice(1).map((x,i) => `L${x},${ys[i+1]}`).join(' ')
      + ` L${xs.at(-1)},${pT+cH} L${xs[0]},${pT+cH}Z`;
    out += `<path d="${area}" fill="url(#ag)"/>`;
    const line = `M${xs[0]},${ys[0]} ` + xs.slice(1).map((x,i) => `L${x},${ys[i+1]}`).join(' ');
    out += `<path d="${line}" fill="none" stroke="#58a6ff" stroke-width="2" stroke-linejoin="round"/>`;
  }

  log.forEach((d, i) => {
    out += `<circle cx="${xs[i]}" cy="${ys[i]}" r="3.5" fill="#0d1117" stroke="#58a6ff" stroke-width="2"/>`;
    out += `<text x="${xs[i]}" y="${ys[i]-8}" text-anchor="middle" fill="#8b949e" font-size="10" font-family="monospace">${d.overall_percent.toFixed(0)}</text>`;
    if (i % 2 === 0 || i === log.length - 1)
      out += `<text x="${xs[i]}" y="${H-4}" text-anchor="middle" fill="#656d76" font-size="10" font-family="monospace">${fmtDate(d.date)}</text>`;
  });

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = out;
}

// ── VIEW: SETTINGS ───────────────────────────────────────────────────────────
function renderSettings() {
  const data = ALSM.load();
  const name = data ? esc(data.profile.name) : '';

  document.getElementById('settings-body').innerHTML = `
    <h2 class="mb-24">Settings</h2>

    <div class="card mb-12">
      <h3 class="mb-4">Export Data</h3>
      <p class="c-muted sm mb-16">Download your quiz history and scores as a JSON backup file.</p>
      <button class="btn btn-secondary" onclick="exportData()">&#x2B07; Export JSON</button>
    </div>

    <div class="card mb-12">
      <h3 class="mb-4">Import Data</h3>
      <p class="c-muted sm mb-16">Restore from a previously exported file. Overwrites your current data.</p>
      <div class="flex ai-c g-8">
        <input id="import-file" type="file" accept=".json" style="display:none" onchange="importData(this)">
        <button class="btn btn-secondary" onclick="document.getElementById('import-file').click()">&#x2B06; Choose File</button>
        <span id="import-status" class="sm c-dim"></span>
      </div>
    </div>

    <div class="card mb-12">
      <h3 class="mb-4">Change Name</h3>
      <p class="c-muted sm mb-16">Update the name shown on your home screen.</p>
      <div class="flex ai-c g-8">
        <input id="settings-name" class="setup-input" type="text" value="${name}" maxlength="32"
               style="max-width:260px" onkeydown="if(event.key==='Enter')changeName()">
        <button class="btn btn-primary" onclick="changeName()">Save</button>
        <span id="name-status" class="sm"></span>
      </div>
    </div>

    <div class="card" style="border-color:rgba(248,81,73,.35)">
      <h3 class="mb-4 c-err">Delete All Data</h3>
      <p class="c-muted sm mb-16">Permanently remove all history, scores, and settings. Cannot be undone.</p>
      <button class="btn btn-danger" onclick="deleteData()">Delete Everything</button>
    </div>`;
}

function exportData() {
  const data = ALSM.load();
  if (!data) return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `itquiz-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(input) {
  const file = input.files[0];
  if (!file) return;
  const status = document.getElementById('import-status');
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      const invalid =
        typeof parsed.schema_version !== 'number' ||
        typeof parsed.profile !== 'object' || parsed.profile === null ||
        typeof parsed.profile.name !== 'string' || !parsed.profile.name.trim() ||
        !Array.isArray(parsed.sessions) ||
        (parsed.progress_log    !== undefined && !Array.isArray(parsed.progress_log)) ||
        (parsed.category_totals !== undefined && typeof parsed.category_totals !== 'object') ||
        (parsed.weak_questions  !== undefined && typeof parsed.weak_questions  !== 'object');
      if (invalid) {
        status.textContent = 'Invalid file — missing or malformed required fields.';
        status.style.color = 'var(--err)';
        return;
      }
      parsed.progress_log    = parsed.progress_log    || [];
      parsed.category_totals = parsed.category_totals || {};
      parsed.weak_questions  = parsed.weak_questions  || {};
      parsed.weak_streaks    = parsed.weak_streaks    || {};
      ALSM.save(parsed);
      status.textContent = 'Imported. Redirecting…';
      status.style.color = 'var(--ok)';
      setTimeout(() => { renderHome(); show('home'); }, 900);
    } catch {
      status.textContent = 'Failed to parse JSON.';
      status.style.color = 'var(--err)';
    }
  };
  reader.readAsText(file);
  input.value = '';
}

function changeName() {
  const input  = document.getElementById('settings-name');
  const status = document.getElementById('name-status');
  const name   = input.value.trim();
  if (!name) { input.focus(); return; }
  const data = ALSM.load();
  if (!data) return;
  data.profile.name = name;
  ALSM.save(data);
  status.textContent = 'Saved.';
  status.style.color = 'var(--ok)';
  setTimeout(() => { status.textContent = ''; }, 2000);
}

function deleteData() {
  if (!confirm('Delete all quiz data? This cannot be undone.')) return;
  localStorage.removeItem(ALSM.KEY);
  document.getElementById('setup-name').value = '';
  show('setup');
}
