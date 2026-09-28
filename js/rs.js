// Tracks your actual rank score. You set it once ("anchor"), or it's set from an "RS after game"
// entry, and every Ranked game's +/− moves it from there.
import { state, save } from './store.js';

const sumRs = test => state.entries.reduce((s, g) => g.rs != null && test(g) ? s + g.rs : s, 0);

// RS just before time ts: every game logged before ts is counted, nothing at or after it
export function rsBefore(ts) {
  const a = state.rsAnchor;
  if (!a) return null;
  // the anchor already includes games at or before its own time
  return a.ts < ts ? a.value + sumRs(g => g.ts > a.ts && g.ts < ts) : a.value - sumRs(g => g.ts >= ts && g.ts <= a.ts);
}
export const currentRs = () => rsBefore(Infinity);

export function setRs(value, ts = Date.now()) {
  state.rsAnchor = { value, ts };
  return save('rsAnchor');
}

export const fmtRs = v => v == null ? '–' : v.toLocaleString();
