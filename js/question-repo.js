'use strict';

const QRepo = (() => {
  const cache   = {};  // categoryKey -> question[]
  const idIndex = {};  // id -> question

  async function loadCategory(key) {
    if (cache[key]) return cache[key];
    const res = await fetch(`data/questions/${key}.json`);
    if (!res.ok) throw new Error(`Failed to load category "${key}": HTTP ${res.status}`);
    const payload = await res.json();
    cache[key] = payload.questions;
    payload.questions.forEach(q => { idIndex[q.id] = q; });
    return cache[key];
  }

  async function loadAll() {
    await Promise.all(CAT_KEYS.map(loadCategory));
  }

  async function getQuestionsByCategories(keys) {
    const arrays = await Promise.all(keys.map(loadCategory));
    return arrays.flat();
  }

  function getQuestionById(id) {
    return idIndex[id] || null;
  }

  function getCategoryCount(key) {
    return cache[key] ? cache[key].length : null;
  }

  return { loadCategory, loadAll, getQuestionsByCategories, getQuestionById, getCategoryCount };
})();
