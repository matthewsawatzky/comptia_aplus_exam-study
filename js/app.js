'use strict';

window.addEventListener('DOMContentLoaded', () => {
  const data = ALSM.load();
  if (!data) {
    show('setup');
  } else {
    ALSM.updateStreak(data);
    renderHome();
    show('home');
  }
});
