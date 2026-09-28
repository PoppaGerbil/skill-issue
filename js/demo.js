// Sample data for previewing the app (open with ?demo). Never saved.
import { MAPS, LAGGY, SKILL, BUILDS, stageFor, FIXED_FRIEND } from './constants.js';
import { uid } from './util.js';

function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function demoData() {
  const R = rng(7), pick = a => a[Math.floor(R() * a.length)], ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const POOL = {
    Light: { w: { Automatic: ['M11', 'XP-54'], Poke: ['LH1'], Melee: ['Dagger'] }, s: ['Invis', 'Grapple', 'Dash'] },
    Medium: { w: { Automatic: ['FCAR', 'AKM'], Burst: ['FAMAS'], Poke: ['Pike-556'] }, s: ['HealBeam', 'Turret', 'Demat'] },
    Heavy: { w: { Automatic: ['M60', 'Lewis Gun'], Poke: ['KS-23'], Melee: ['Sledgehammer'], Sustain: ['Flamethrower'] }, s: ['C+S', 'GooGun', 'Shield', 'Winch'] },
  };
  const entries = [], sessions = [];
  const now = Date.now(), DAY = 864e5;
  let id = 1;
  for (let d = 40; d >= 0; d--) {
    if (R() < .4) continue;
    const n = ri(2, 9);
    let t = now - d * DAY - ri(1, 10) * 36e5 - 2 * 36e5;
    const sid = R() < .5 ? uid() : null, start = t;
    for (let i = 0; i < n; i++) {
      t += ri(18, 35) * 6e4;
      if (t > now) break;
      const primary = R() < .2 ? 'Light' : R() < .6 ? 'Medium' : 'Heavy';
      const builds = [primary];
      if (R() < .12) builds.push(pick(BUILDS.filter(b => b !== primary)));
      const weapons = {}, specs = [];
      builds.forEach(b => { const ty = pick(Object.keys(POOL[b].w)); weapons[ty] = pick(POOL[b].w[ty]); const s = pick(POOL[b].s); if (!specs.includes(s)) specs.push(s); });
      const mental = R() < .5 ? 'Locked' : R() < .5 ? 'Crashing Out' : 'Distracted/Tired/Over It';
      const lag = R() < .6 ? 'None' : R() < .3 ? 'Great Connection' : pick(['Some', 'A lot', 'Unplayable', 'Glitch/Bug']);
      const r = R(), squad = r < .45 ? ['Solo'] : r < .7 ? [FIXED_FRIEND] : r < .85 ? ['Party'] : ['Party', FIXED_FRIEND];
      const bias = (mental === 'Locked' ? 3 : mental === 'Crashing Out' ? -2 : -1) + (LAGGY.has(lag) ? -2 : 0) + (primary === 'Heavy' ? 1 : 0) - (i > 5 ? 2 : 0);
      const kills = Math.max(0, ri(5, 14) + Math.round(bias)), deaths = Math.max(1, ri(6, 12) - Math.round(bias / 2));
      const kd = +(kills / deaths).toFixed(2);
      const mode = R() < .4 ? 'Ranked' : R() < .6 ? 'Cashout' : 'Pointbreak';
      const win = R() < Math.min(.85, Math.max(.1, kd * .4));
      let place = null, stage = null, rs = null;
      if (mode !== 'Pointbreak') {
        place = win ? 1 : pick([2, 3, 4, 5.5, 7.5]);
        if (mode === 'Ranked') {
          stage = stageFor(place);
          rs = place === 1 ? ri(40, 60) : place === 2 ? ri(15, 35) : place <= 4 ? (R() < .5 ? ri(3, 15) : -ri(3, 12)) : -ri(10, 32);
        }
      }
      const party = squad.includes('Party');
      entries.push({
        id: id++, ts: t, mode, modeOther: '', result: win ? 'W' : 'L', place, stage, rs, kills, deaths, kd, kdManual: false,
        squad, partySize: party ? ri(3, 4) : null, teammate: party ? pick(SKILL) : null, med: R() < .6 ? 'Yes' : 'No', mental, lag,
        builds, weapons, specs, specOther: '', map: pick(MAPS), mapOther: '', notes: '', sessionId: sid,
      });
    }
    if (sid && entries.some(e => e.sessionId === sid)) sessions.push({ id: sid, start, end: t + 20 * 6e4 });
  }
  return { entries, sessions };
}
