'use strict';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateMinus1(d) {
  const dt = new Date(d + 'T12:00:00');
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}

function fmtDate(iso) {
  const normalized = iso.includes('T') ? iso : iso + 'T12:00:00';
  return new Date(normalized).toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

function scoreColor(p) {
  if (p == null) return 'var(--dim)';
  return p >= 75 ? 'var(--ok)' : p >= 50 ? 'var(--warn)' : 'var(--err)';
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
