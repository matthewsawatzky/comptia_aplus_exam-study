'use strict';

// ── SESSION STATE ────────────────────────────────────────────────────────────
const SS = {
  active:          false,
  id:              null,
  started:         null,
  categories:      [],
  questions:       [],
  idx:             0,
  results:         [],   // { id, category, score }
  elapsed:         0,
  timer:           null,
  answeredCurrent: false,
  // per-question mutable state
  matchState:    {},   // target → item
  matchDrag:     null,
  orderDrag:     null,
  wbFilled:      [],   // null | string per blank
  fbMode:        null, // 'word_bank' | 'typed'
};

// ── SESSION NAV STRIP ────────────────────────────────────────────────────────
function updateSessNav() {
  const q  = SS.questions[SS.idx];
  document.getElementById('sn-q').textContent   = `Q ${SS.idx + 1} / ${SS.questions.length}`;
  document.getElementById('sn-cat').textContent = q.category;

  const el = document.getElementById('sn-score');
  if (SS.results.length) {
    const avg = SS.results.reduce((s, r) => s + r.score, 0) / SS.results.length;
    const pct = (avg * 100).toFixed(1) + '%';
    el.textContent    = pct;
    el.style.color    = scoreColor(avg * 100);
  } else {
    el.textContent = '—';
    el.style.color = 'var(--dim)';
  }
}

// ── RENDER ONE QUESTION ──────────────────────────────────────────────────────
function renderQuestion(idx) {
  SS.idx             = idx;
  SS.answeredCurrent = false;
  SS.matchState      = {};
  SS.matchDrag       = null;
  SS.orderDrag       = null;
  SS.wbFilled        = [];
  SS.fbMode          = null;

  document.getElementById('sess-q').classList.remove('hidden');
  document.getElementById('sess-done').classList.add('hidden');

  const q   = SS.questions[idx];
  const tot = SS.questions.length;
  updateSessNav();

  const area = document.getElementById('sess-q');
  area.innerHTML = buildQCard(q, idx, tot);

  const optsEl = document.getElementById('q-opts');
  if (optsEl) {
    optsEl.addEventListener('change', e => {
      if (e.target.matches('input[type="radio"]')) {
        optsEl.querySelectorAll('.opt').forEach(o => o.classList.remove('opt-checked'));
        e.target.closest('.opt')?.classList.add('opt-checked');
      } else if (e.target.matches('input[type="checkbox"]')) {
        e.target.closest('.opt')?.classList.toggle('opt-checked', e.target.checked);
      }
    });
  }

  if (q.type === 'drag_drop') {
    q.drag_type === 'match' ? initMatch(q) : initOrder(q);
  }
}

function buildQCard(q, idx, tot) {
  const isLast = idx === tot - 1;
  let inputHTML = '';

  if (q.type === 'single_choice') {
    const opts = shuffle(q.options);
    inputHTML = `<div class="opts" id="q-opts">${
      opts.map(o => `<label class="opt"><input type="radio" name="sess-r" value="${esc(o)}"><label>${esc(o)}</label></label>`).join('')
    }</div>`;
  }

  else if (q.type === 'multi_choice') {
    const opts = shuffle(q.options);
    inputHTML = `<p class="mc-hint">Select all that apply</p><div class="opts" id="q-opts">${
      opts.map(o => `<label class="opt"><input type="checkbox" value="${esc(o)}"><label>${esc(o)}</label></label>`).join('')
    }</div>`;
  }

  else if (q.type === 'drag_drop') {
    inputHTML = q.drag_type === 'match'
      ? `<div class="pool-label">Available — drag to targets</div>
         <div class="item-pool" id="match-pool"></div>
         <div class="match-targets" id="match-targets"></div>`
      : `<div class="order-list" id="order-list"></div>`;
  }

  else if (q.type === 'fill_blank') {
    const mode = q.input_mode === 'random'
      ? (Math.random() < .5 ? 'word_bank' : 'typed') : q.input_mode;
    SS.fbMode = mode;

    const parts = q.question.split('___');
    SS.wbFilled = Array(parts.length - 1).fill(null);

    let qHTML = '';
    parts.forEach((part, i) => {
      qHTML += esc(part);
      if (i < parts.length - 1) {
        qHTML += mode === 'word_bank'
          ? `<span class="blank-tok" data-idx="${i}" onclick="clearBlank(${i})">___</span>`
          : `<input class="blank-input" data-idx="${i}" type="text" autocomplete="off" spellcheck="false" onkeydown="if(event.key==='Enter')checkCurrent()">`;
      }
    });

    const bankHTML = mode === 'word_bank'
      ? `<div class="pool-label mb-4">Word bank — click to fill, click a filled blank to clear</div>
         <div class="word-bank" id="q-wb">${
           shuffle(q.word_bank).map(w =>
             `<span class="wchip" data-word="${esc(w)}" onclick="fillBlank('${esc(w)}',this)">${esc(w)}</span>`
           ).join('')
         }</div>` : '';

    return `<div class="qcard">
      <div class="qmeta"><span class="badge bd-dim">${q.id}</span><span class="badge bd-dim">${q.subcategory}</span></div>
      <p class="qtext">${qHTML}</p>
      ${bankHTML}
      <div class="flex g-8" id="q-act">
        <button class="btn btn-primary btn-sm" id="chk-btn" onclick="checkCurrent()">Check Answer</button>
      </div>
      <div id="q-res" class="hidden mt-12"></div>
      <div id="q-nxt" class="hidden mt-12">
        <button class="btn btn-primary" onclick="nextQuestion()">${isLast ? 'Finish Session ✓' : 'Next →'}</button>
      </div>
    </div>`;
  }

  return `<div class="qcard">
    <div class="qmeta"><span class="badge bd-dim">${q.id}</span><span class="badge bd-dim">${q.subcategory}</span></div>
    <p class="qtext">${esc(q.question)}</p>
    ${inputHTML}
    <div class="flex g-8" id="q-act">
      <button class="btn btn-primary btn-sm" id="chk-btn" onclick="checkCurrent()">Check Answer</button>
    </div>
    <div id="q-res" class="hidden mt-12"></div>
    <div id="q-nxt" class="hidden mt-12">
      <button class="btn btn-primary" onclick="nextQuestion()">${isLast ? 'Finish Session ✓' : 'Next →'}</button>
    </div>
  </div>`;
}

// ── DRAG-DROP: MATCH ─────────────────────────────────────────────────────────
function initMatch(q) {
  const pool = document.getElementById('match-pool');
  const tgts = document.getElementById('match-targets');

  pool.addEventListener('dragover',  e => { e.preventDefault(); pool.classList.add('dragover'); });
  pool.addEventListener('dragleave', () => pool.classList.remove('dragover'));
  pool.addEventListener('drop', e => {
    e.preventDefault();
    pool.classList.remove('dragover');
    if (!SS.matchDrag) return;
    const prev = SS.matchDrag.dataset.inTarget;
    if (prev) {
      const oz = findZone(prev);
      if (oz) oz.classList.remove('dz-filled');
      delete SS.matchState[prev];
      delete SS.matchDrag.dataset.inTarget;
    }
    pool.appendChild(SS.matchDrag);
  });

  shuffle(q.items).forEach(item => pool.appendChild(makeDragItem(item)));

  q.targets.forEach(tgt => {
    const row  = document.createElement('div'); row.className = 'match-row';
    const lbl  = document.createElement('span'); lbl.className = 'tgt-label'; lbl.textContent = tgt;
    const zone = document.createElement('div'); zone.className = 'drop-zone'; zone.dataset.target = tgt;

    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (!SS.matchDrag) return;

      const itemText = SS.matchDrag.dataset.item;
      const prev     = SS.matchDrag.dataset.inTarget;
      const existing = zone.querySelector('.drag-item');

      if (existing && existing !== SS.matchDrag) {
        if (prev) {
          const oz = findZone(prev);
          if (oz) { oz.appendChild(existing); oz.classList.add('dz-filled'); existing.dataset.inTarget = prev; SS.matchState[prev] = existing.dataset.item; }
        } else {
          pool.appendChild(existing);
          delete existing.dataset.inTarget;
        }
      } else if (prev) {
        const oz = findZone(prev);
        if (oz) oz.classList.remove('dz-filled');
        delete SS.matchState[prev];
      }

      zone.appendChild(SS.matchDrag);
      zone.classList.add('dz-filled');
      SS.matchDrag.dataset.inTarget = tgt;
      SS.matchState[tgt]            = itemText;
      SS.matchDrag.classList.remove('dragging');
      SS.matchDrag = null;
    });

    row.appendChild(lbl); row.appendChild(zone); tgts.appendChild(row);
  });
}

function makeDragItem(text) {
  const el = document.createElement('div');
  el.className = 'drag-item'; el.textContent = text; el.draggable = true; el.dataset.item = text;
  el.addEventListener('dragstart', () => { SS.matchDrag = el; el.classList.add('dragging'); });
  el.addEventListener('dragend',   () => { el.classList.remove('dragging'); SS.matchDrag = null; });
  return el;
}

function findZone(target) {
  return [...document.querySelectorAll('.drop-zone')].find(z => z.dataset.target === target) || null;
}

// ── DRAG-DROP: ORDER ─────────────────────────────────────────────────────────
function initOrder(q) {
  const list = document.getElementById('order-list');
  shuffle(q.items).forEach((text, i) => {
    const el = document.createElement('div');
    el.className = 'order-item'; el.draggable = true; el.dataset.text = text;
    el.innerHTML = `<span class="drag-handle">⋮⋮</span><span class="order-num">${i+1}</span><span style="flex:1;font-size:13px">${esc(text)}</span>`;

    el.addEventListener('dragstart', () => { SS.orderDrag = el; el.classList.add('dragging'); });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      list.querySelectorAll('.order-item').forEach(i => i.classList.remove('drag-over'));
      SS.orderDrag = null;
      list.querySelectorAll('.order-item').forEach((el, i) => el.querySelector('.order-num').textContent = i + 1);
    });
    el.addEventListener('dragover', e => {
      e.preventDefault();
      if (SS.orderDrag === el) return;
      list.querySelectorAll('.order-item').forEach(i => i.classList.remove('drag-over'));
      el.classList.add('drag-over');
      const mid = el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2;
      e.clientY < mid ? el.before(SS.orderDrag) : el.after(SS.orderDrag);
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    list.appendChild(el);
  });
}

// ── FILL BLANK: WORD BANK ────────────────────────────────────────────────────
function fillBlank(word, chip) {
  if (chip.classList.contains('used')) return;
  const next = SS.wbFilled.indexOf(null);
  if (next === -1) return;
  SS.wbFilled[next] = word;
  chip.classList.add('used');
  const tok = document.querySelector(`.blank-tok[data-idx="${next}"]`);
  if (tok) { tok.textContent = word; tok.classList.add('bt-filled'); }
}

function clearBlank(idx) {
  const word = SS.wbFilled[idx];
  if (!word) return;
  const tok = document.querySelector(`.blank-tok[data-idx="${idx}"]`);
  if (!tok || tok.classList.contains('bt-ok') || tok.classList.contains('bt-err')) return;
  SS.wbFilled[idx] = null;
  tok.textContent = '___';
  tok.classList.remove('bt-filled');
  const chip = [...document.querySelectorAll('#q-wb .wchip')].find(c => c.dataset.word === word);
  if (chip) chip.classList.remove('used');
}

// ── CHECK CURRENT QUESTION ───────────────────────────────────────────────────
function getAnswer(q) {
  switch (q.type) {
    case 'single_choice': {
      const el = document.querySelector('input[name="sess-r"]:checked');
      return el ? el.value : null;
    }
    case 'multi_choice':
      return [...document.querySelectorAll('#q-opts input:checked')].map(i => i.value);
    case 'drag_drop':
      return q.drag_type === 'match'
        ? { ...SS.matchState }
        : [...document.querySelectorAll('.order-item')].map(el => el.dataset.text);
    case 'fill_blank':
      if (SS.fbMode === 'typed') {
        const vals = [...document.querySelectorAll('.blank-input')].map(i => i.value.trim());
        return Array.isArray(q.answer) ? vals : (vals[0] || '');
      }
      return Array.isArray(q.answer) ? [...SS.wbFilled] : (SS.wbFilled[0] || '');
  }
}

function checkCurrent() {
  if (SS.answeredCurrent) return;
  SS.answeredCurrent = true;
  const q   = SS.questions[SS.idx];
  const ans = getAnswer(q);
  const s   = score(q, ans);

  SS.results.push({ id: q.id, category: q.category, score: s });
  updateSessNav();
  lockInputs();
  showFeedback(q, ans, s);

  const type  = s >= 1 ? 'ok' : s > 0 ? 'warn' : 'err';
  const icons = { ok:'✓', warn:'~', err:'✗' };
  const labs  = { ok:'Correct!', warn:'Partial credit', err:'Wrong' };
  const sStr  = (s >= 0 ? '+' : '') + s.toFixed(2);

  const res = document.getElementById('q-res');
  res.className = 'mt-12';
  res.innerHTML = `
    <div class="rbanner ${type}">
      <span class="rscore">${icons[type]} ${sStr}</span>
      <span class="rlabel">${labs[type]}</span>
    </div>
    <div class="expl"><div class="expl-hd">Explanation</div>${q.explanation}</div>`;

  document.getElementById('chk-btn').style.display = 'none';
  document.getElementById('q-nxt').classList.remove('hidden');
}

function lockInputs() {
  document.querySelectorAll('#q-opts input').forEach(i => i.disabled = true);
  document.querySelectorAll('.blank-input').forEach(i => i.disabled = true);
  document.querySelectorAll('.wchip').forEach(c => { c.onclick = null; c.style.pointerEvents = 'none'; });
  document.querySelectorAll('.drag-item').forEach(i => i.draggable = false);
  document.querySelectorAll('.order-item').forEach(i => i.draggable = false);
  document.querySelectorAll('.blank-tok').forEach(t => { t.onclick = null; });
}

function showFeedback(q, ans, s) {
  if (q.type === 'single_choice') {
    document.querySelectorAll('#q-opts .opt').forEach(o => {
      const v = o.querySelector('input').value;
      if (v === q.answer) o.classList.add('opt-ok');
      else if (v === ans && v !== q.answer) o.classList.add('opt-err');
    });
  }
  else if (q.type === 'multi_choice') {
    const cs = new Set(q.answer);
    document.querySelectorAll('#q-opts .opt').forEach(o => {
      const v  = o.querySelector('input').value;
      const ch = o.querySelector('input').checked;
      if (cs.has(v) && ch)    o.classList.add('opt-ok');
      else if (!cs.has(v) && ch)  o.classList.add('opt-err');
      else if (cs.has(v) && !ch)  o.classList.add('opt-missed');
    });
  }
  else if (q.type === 'drag_drop' && q.drag_type === 'match') {
    document.querySelectorAll('.drop-zone').forEach(zone => {
      const item = zone.querySelector('.drag-item');
      if (!item) return;
      const ok = q.answer[item.dataset.item] === zone.dataset.target;
      zone.classList.add(ok ? 'dz-ok' : 'dz-err');
      item.classList.add(ok ? 'di-ok' : 'di-err');
    });
  }
  else if (q.type === 'drag_drop' && q.drag_type === 'order') {
    [...document.querySelectorAll('.order-item')].forEach((el, i) => {
      el.classList.add(el.dataset.text === q.answer[i] ? 'oi-ok' : 'oi-err');
    });
  }
  else if (q.type === 'fill_blank') {
    const answers = Array.isArray(q.answer) ? q.answer : [q.answer];
    if (SS.fbMode === 'typed') {
      document.querySelectorAll('.blank-input').forEach((inp, i) => {
        inp.classList.add(inp.value.trim().toLowerCase() === (answers[i]||'').toLowerCase().trim() ? 'bi-ok' : 'bi-err');
      });
    } else {
      document.querySelectorAll('.blank-tok').forEach((tok, i) => {
        tok.classList.remove('bt-filled');
        const ok = SS.wbFilled[i] != null && SS.wbFilled[i] === answers[i];
        tok.classList.add(ok ? 'bt-ok' : 'bt-err');
        if (!SS.wbFilled[i]) tok.textContent = answers[i];
      });
    }
  }
}

function nextQuestion() {
  const next = SS.idx + 1;
  if (next < SS.questions.length) {
    renderQuestion(next);
  } else {
    showComplete();
  }
}

// ── SESSION COMPLETE SCREEN ──────────────────────────────────────────────────
function showComplete() {
  document.getElementById('sess-q').classList.add('hidden');

  const n   = SS.results.length;
  const avg = n > 0 ? SS.results.reduce((s, r) => s + r.score, 0) / n : 0;
  const pct = avg * 100;

  const byCat = {};
  SS.results.forEach(r => {
    if (!byCat[r.category]) byCat[r.category] = { sum: 0, n: 0 };
    byCat[r.category].sum += r.score;
    byCat[r.category].n++;
  });

  const catRows = Object.entries(byCat).map(([cat, d]) => {
    const cp = (d.sum / d.n) * 100;
    return `<div class="catbar-row">
      <span class="catbar-label">${cat}</span>
      <div class="catbar-track"><div class="catbar-fill" style="width:${Math.max(0,cp)}%;background:${scoreColor(cp)}"></div></div>
      <span class="catbar-pct" style="color:${scoreColor(cp)}">${cp.toFixed(1)}%</span>
    </div>`;
  }).join('');

  const done = document.getElementById('sess-done');
  done.className = '';
  done.innerHTML = `
    <div class="card" style="max-width:520px;margin:0 auto">
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:36px;margin-bottom:10px">${pct>=75?'🏆':pct>=50?'📈':'📚'}</div>
        <h2 class="mb-4">Session Complete</h2>
        <p class="c-muted sm">Your results are being saved</p>
      </div>
      <div class="stat-grid mb-20" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat-card" style="text-align:center">
          <div class="stat-label">Score</div>
          <div class="stat-value" style="color:${scoreColor(pct)}">${pct.toFixed(1)}%</div>
        </div>
        <div class="stat-card" style="text-align:center">
          <div class="stat-label">Questions</div>
          <div class="stat-value">${n}</div>
        </div>
        <div class="stat-card" style="text-align:center">
          <div class="stat-label">Time</div>
          <div class="stat-value" style="font-size:18px;padding-top:4px">${fmtTime(SS.elapsed)}</div>
        </div>
      </div>
      ${catRows ? `<div class="mb-20">${catRows}</div>` : ''}
      <button class="btn btn-primary btn-full btn-lg" onclick="finishSession()">Save &amp; Return Home</button>
    </div>`;
}

// ── STOP / FINISH ────────────────────────────────────────────────────────────
function confirmStop() {
  const n = SS.results.length;
  if (n === 0) {
    if (!confirm('No questions answered yet. Discard session?')) return;
    abandonSession();
    return;
  }
  if (!confirm(`Stop session? ${n} answered question${n!==1?'s':''} will be saved.`)) return;
  finishSession();
}

function finishSession() {
  clearInterval(SS.timer);
  if (SS.results.length) {
    const data = ALSM.loadSafe();
    if (data) ALSM.stopSession(data, { id: SS.id, started: SS.started, categories: SS.categories }, SS.results);
  }
  SS.active = false;
  exitSessionMode();
}

function abandonSession() {
  clearInterval(SS.timer);
  SS.active = false;
  exitSessionMode();
}
