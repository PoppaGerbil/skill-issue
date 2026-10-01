// Filter fields shared by Graph lines and the Stats tab.
// Within a field options are OR'd, across fields they're AND'd. A blank field means "all".
import { MODES, MAPS, MENTAL, SKILL, BUILDS, WTYPES, SPECS, STAGES } from './constants.js';
import { state } from './store.js';
import { isLaggy, isSolo, winOf, chips, weaponList } from './util.js';


export const TOD = ['Morning (5am–12pm)', 'Afternoon (12–5pm)', 'Evening (5–10pm)', 'Late night (10pm–5am)'];
export const todOf = e => {
  const h = new Date(e.ts).getHours();
  return h >= 5 && h < 12 ? TOD[0] : h >= 12 && h < 17 ? TOD[1] : h >= 17 && h < 22 ? TOD[2] : TOD[3];
};

// "Games into session" is detected automatically: a gap of an hour or more starts a new session
const SESSION_GAP = 60 * 60 * 1000;
export const SPOS = ['Games 1–3', 'Games 4–6', 'Games 7–9', 'Game 10+'];
let posCache = { ref: null, len: -1, map: null };
export function sessionPos(e) {
  const es = state.entries;
  if (posCache.ref !== es || posCache.len !== es.length) {
    const map = new Map();
    let prev = null, n = 0;
    [...es].sort((a, b) => a.ts - b.ts).forEach(x => { n = prev != null && x.ts - prev <= SESSION_GAP ? n + 1 : 1; prev = x.ts; map.set(x.id, n); });
    posCache = { ref: es, len: es.length, map };
  }
  return posCache.map.get(e.id) || 1;
}
export const sposOf = e => { const p = sessionPos(e); return p <= 3 ? SPOS[0] : p <= 6 ? SPOS[1] : p <= 9 ? SPOS[2] : SPOS[3]; };

export const weaponNames = () => [...new Set(state.entries.flatMap(weaponList))].sort((a, b) => a.localeCompare(b));

export const FF = [
  { k: 'mode', l: 'Game mode', o: () => MODES, g: e => [e.mode] },
  { k: 'result', l: 'Result', note: 'Ranked uses RS +/−', o: () => ['Win', 'Loss'], g: e => [winOf(e) === 'W' ? 'Win' : winOf(e) === 'L' ? 'Loss' : null] },
  { k: 'stage', l: 'Ranked stage', o: () => STAGES, g: e => [e.stage] },
  { k: 'build', l: 'Build', o: () => BUILDS, g: e => e.builds },
  { k: 'weapon', l: 'Weapon type', o: () => WTYPES, g: e => Object.keys(e.weapons) },
  { k: 'wname', l: 'Weapon name', o: weaponNames, g: weaponList },
  { k: 'spec', l: 'Spec', o: () => SPECS, g: e => e.specs },
  { k: 'map', l: 'Map', o: () => [...MAPS, 'LTM', 'Other'], g: e => [e.map] },
  { k: 'squad', l: 'Party, Solo, or friend', note: 'Party = any game with Party or a named friend', o: () => ['Solo', 'Party', ...state.friends], g: e => !e.squad.length ? [] : isSolo(e) ? ['Solo'] : ['Party', ...e.squad.filter(x => x !== 'Party')] },
  { k: 'partySize', l: 'Party size', note: 'party games only', o: () => ['2', '3', '4', '5', '6', '7', '8', '9', '10'], g: e => [e.partySize == null ? null : String(e.partySize)] },
  { k: 'teammate', l: 'Teammate skill', note: 'party games only', o: () => SKILL, g: e => [e.teammate] },
  { k: 'lag', l: 'Lag', o: () => ['Lag', 'No lag'], g: e => [isLaggy(e) ? 'Lag' : 'No lag'] },
  { k: 'med', l: 'Medicated', o: () => ['Yes', 'No'], g: e => [e.med] },
  { k: 'mental', l: 'Mental + Physical', o: () => MENTAL, g: e => [e.mental] },
  { k: 'tod', l: 'Time of day', o: () => TOD, g: e => [todOf(e)] },
  { k: 'spos', l: 'Games into session', note: '1h+ gap starts a new session', o: () => SPOS, g: e => [sposOf(e)] },
];
export const FFK = Object.fromEntries(FF.map(f => [f.k, f]));

export const matches = (e, fl) => FF.every(ff => { const s = fl[ff.k]; return !s || !s.length || ff.g(e).some(v => s.includes(v)); });
export const summary = fl => { const p = FF.filter(ff => fl[ff.k]?.length).map(ff => fl[ff.k].join(' or ')); return p.length ? p.join(' · ') : 'All games'; };
export const filterCount = fl => FF.filter(ff => fl[ff.k]?.length).length;

export const filterSectionsHTML = filters => FF.map(ff => `<div class="fsec"><div class="sublbl"><span>${ff.l}${ff.note ? ` <span style="opacity:.7">(${ff.note})</span>` : ''}</span><em>${filters[ff.k]?.length ? filters[ff.k].length + ' selected' : 'all'}</em></div><div class="chips" data-k="${ff.k}"></div></div>`).join('');

export function bindFilterSections(root, filters, onChange) {
  FF.forEach(ff => {
    const el = root.querySelector(`[data-k="${ff.k}"]`);
    const opts = ff.o();
    if (!opts.length) { el.innerHTML = '<span class="hint" style="margin:0">None logged yet</span>'; return; }
    chips(el, opts, () => filters[ff.k] || [], v => { filters[ff.k] = v; onChange(); }, true);
  });
}
