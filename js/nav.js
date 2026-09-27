import { $$ } from './util.js';

const onShow = {};
export const onTabShow = (tab, fn) => { onShow[tab] = fn; };

export function showTab(t) {
  $$('nav.bottom button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $$('.tab').forEach(s => s.classList.toggle('active', s.id === 'tab-' + t));
  onShow[t]?.();
  window.scrollTo(0, 0);
}
