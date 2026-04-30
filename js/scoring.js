'use strict';

// ── SCORING ENGINE  (per schema spec) ───────────────────────────────────────
function score(q, answer) {
  const clamp = v => Math.max(0, v);
  switch (q.type) {

    case 'single_choice':
      return answer === q.answer ? 1.0 : 0;

    case 'multi_choice': {
      const cs = new Set(q.answer);
      const total = q.answer.length;
      if (!answer || !answer.length) return 0;
      let c = 0, w = 0;
      answer.forEach(v => cs.has(v) ? c++ : w++);
      return clamp((c - w) / total);
    }

    case 'drag_drop':
      if (q.drag_type === 'match') {
        const total = q.items.length;
        let c = 0, w = 0;
        for (const [tgt, item] of Object.entries(answer || {}))
          q.answer[item] === tgt ? c++ : w++;
        return clamp((c - w) / total);
      } else {
        const total = q.answer.length;
        let c = 0;
        (answer || []).forEach((item, i) => { if (item === q.answer[i]) c++; });
        return clamp((c - (total - c)) / total);
      }

    case 'fill_blank':
      if (Array.isArray(q.answer)) {
        const total = q.answer.length;
        let c = 0, w = 0;
        q.answer.forEach((ans, i) => {
          const ua = String((answer && answer[i]) ?? '').toLowerCase().trim();
          ua === ans.toLowerCase().trim() ? c++ : w++;
        });
        return clamp((c - w) / total);
      } else {
        const ua = String(answer ?? '').toLowerCase().trim();
        return ua === q.answer.toLowerCase().trim() ? 1.0 : 0;
      }

    default: return 0;
  }
}
