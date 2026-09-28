import { PLACES, LAGGY } from './constants.js';

export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Math.random().toString(36).slice(2, 10);
export const clone = o => JSON.parse(JSON.stringify(o));

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2000);
}

// Renders a row of tappable chips. opts: strings or {v,l}. set() receives the new value.
export function chips(el, opts, get, set, multi, cls) {
  el.innerHTML = '';
  opts.forEach(o => {
    const v = typeof o === 'object' ? o.v : o, l = typeof o === 'object' ? o.l : o;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (cls ? ' ' + cls(v) : '');
    b.textContent = l;
    const cur = get();
    if (multi ? cur.includes(v) : cur === v) b.classList.add('on');
    b.onclick = () => {
      const c = get();
      if (multi) set(c.includes(v) ? c.filter(x => x !== v) : [...c, v]);
      else set(c === v ? null : v);
      chips(el, opts, get, set, multi, cls);
    };
    el.appendChild(b);
  });
}

const pad = n => String(n).padStart(2, '0');
export const toLocalInput = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const fmtDate = ts => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
export const fmtDT = ts => new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const placeLabel = v => PLACES.find(p => p.v === v)?.l ?? '';
export const isMixed = e => e.builds.length > 1;
// Weapons are stored as { Automatic: ['ShAK-50', 'Lewis Gun'], Melee: [] }. Older data used one string per type.
export const normalizeWeapons = w => Object.fromEntries(Object.entries(w || {}).map(([t, v]) => [t, Array.isArray(v) ? v : v ? [v] : []]));
export const copyWeapons = w => Object.fromEntries(Object.entries(normalizeWeapons(w)).map(([t, v]) => [t, [...v]]));
export const weaponList = e => Object.values(e.weapons).flat().filter(Boolean);
export const isLaggy = e => LAGGY.has(e.lag);
export const modeName = e => e.mode === 'Other' ? (e.modeOther || 'Other') : e.mode;
export const mapName = e => (e.map === 'LTM' || e.map === 'Other') && e.mapOther ? `${e.map}: ${e.mapOther}` : e.map;
export const isSolo = e => !e.squad.length || e.squad.includes('Solo');
export const squadName = e => isSolo(e) ? 'Solo' : e.squad.map(s => s === 'Party' ? (e.partySize ? `Party of ${e.partySize}` : 'Party') : s).join(' + ');
// Ranked: RS gained = win, RS lost = loss (for graphing). Falls back to the entered result.
export const winOf = e => e.mode === 'Ranked' && e.rs ? (e.rs > 0 ? 'W' : 'L') : e.result;
export const kdTier = v => v === '' || v == null || isNaN(v) ? '' : v < 1 ? 'kd-bad' : v < 2 ? 'kd-ok' : v < 3 ? 'kd-good' : 'kd-ruby';

// Bottom sheet shared by the line editor and settings
export function openSheet(render) {
  const sh = $('#sheet'), scrim = $('#scrim');
  const close = () => { sh.classList.remove('open'); scrim.classList.remove('open'); document.body.classList.remove('locked'); };
  scrim.onclick = close;
  render(sh, close);
  sh.classList.add('open'); scrim.classList.add('open'); document.body.classList.add('locked');
  sh.scrollTop = 0;
  return close;
}

// Two-tap confirm for destructive buttons
export function confirmTap(btn, label, action) {
  if (btn.dataset.armed) { action(); return; }
  const orig = btn.textContent;
  btn.dataset.armed = '1'; btn.textContent = label; btn.classList.add('danger');
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = orig; btn.classList.remove('danger'); } }, 3000);
}
