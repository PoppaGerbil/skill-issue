// Stats tab: headline numbers, ranked/cashout summaries, sessions, highlights and breakdown tables
import { PLACES, STAGES } from './constants.js';
import { state, save } from './store.js';
import { $, esc, toast, uid, clone, fmtDT, fmtDate, isMixed, mapName, winOf, kdTier, openSheet, confirmTap } from './util.js';
import { FFK, matches, summary, filterCount, filterSectionsHTML, bindFilterSections, SPOS } from './filters.js';
import { addLine } from './graph.js';
import { saveFile, toCsv, loadScript } from './files.js';
import { showTab } from './nav.js';

const MIN = 5; // games needed before something counts as a highlight
const S = () => state.stats;

/* ---------- math ---------- */
export function agg(games) {
  let wins = 0, losses = 0, k = 0, d = 0, pairs = 0, kdSum = 0, kdN = 0, rsNet = 0, rsGain = 0, rsLoss = 0, rsN = 0;
  for (const e of games) {
    const r = winOf(e);
    if (r === 'W') wins++; else if (r === 'L') losses++;
    if (e.kills != null && e.deaths != null) { k += e.kills; d += e.deaths; pairs++; }
    if (e.kd != null) { kdSum += e.kd; kdN++; }
    if (e.rs != null) { rsN++; rsNet += e.rs; if (e.rs > 0) rsGain += e.rs; else rsLoss += e.rs; }
  }
  const decided = wins + losses;
  return {
    n: games.length, wins, losses, winPct: decided ? wins / decided * 100 : null, kills: k, deaths: d,
    kdTotal: pairs ? +(d ? k / d : k).toFixed(2) : null,   // total kills ÷ total deaths
    kdAvg: kdN ? +(kdSum / kdN).toFixed(2) : null,          // average of each game's K/D
    rsNet, rsGain, rsLoss, rsN,
  };
}
const kdMain = a => a.kdTotal ?? a.kdAvg;
const pct = v => v == null ? '–' : Math.round(v) + '%';
const num = v => v == null ? '–' : v;
const signed = v => (v > 0 ? '+' : '') + v;
const kdSpan = v => `<span class="${kdTier(v)}">${num(v)}</span>`;

function streaks(games) {
  let cur = 0, curT = null, best = 0, run = 0;
  for (const e of games) {
    const r = winOf(e);
    if (!r) continue;
    run = r === 'W' ? run + 1 : 0;
    best = Math.max(best, run);
    if (r === curT) cur++; else { curT = r; cur = 1; }
  }
  return { cur, curT, best };
}

/* ---------- range ---------- */
function rangeLabel() {
  const r = S().range;
  if (r === 'live') return 'This session';
  if (typeof r === 'string') { const s = state.sessions.find(x => 'session:' + x.id === r); return s ? 'Session ' + fmtDT(s.start) : 'Session'; }
  return r ? `Last ${r} days` : 'All time';
}
function inRange(e) {
  const r = S().range;
  if (r === 'live') return !!state.activeSession && e.sessionId === state.activeSession.id;
  if (typeof r === 'string') return 'session:' + e.sessionId === r;
  return !r || e.ts >= Date.now() - r * 864e5;
}
const rangeGames = () => state.entries.filter(e => inRange(e) && matches(e, S().filters)).sort((a, b) => a.ts - b.ts);

function groupBy(games, key) {
  const m = new Map();
  for (const e of games) for (const v of new Set(FFK[key].g(e))) {
    if (v == null || v === '') continue;
    if (!m.has(v)) m.set(v, []);
    m.get(v).push(e);
  }
  return m;
}

/* ---------- breakdown tables ---------- */
// order: 'fixed' keeps the field's own option order, 'games' sorts most-played first
const BREAKDOWNS = [
  { key: 'mode', title: 'Game mode', order: 'fixed' },
  { key: 'map', title: 'Map', order: 'games' },
  { key: 'build', title: 'Build', order: 'fixed', note: 'A mixed-build game counts toward each of its builds.' },
  { key: 'weapon', title: 'Weapon type', order: 'fixed' },
  { key: 'wname', title: 'Top weapons', order: 'games', limit: 10 },
  { key: 'spec', title: 'Spec', order: 'games' },
  { key: 'squad', title: 'Solo / Party / friends', order: 'fixed' },
  { key: 'partySize', title: 'Party size', order: 'fixed' },
  { key: 'teammate', title: 'Teammate skill', order: 'fixed' },
  { key: 'lag', title: 'Lag', order: 'fixed' },
  { key: 'med', title: 'Medicated', order: 'fixed' },
  { key: 'mental', title: 'Mental + Physical', order: 'fixed' },
  { key: 'tod', title: 'Time of day', order: 'fixed' },
  { key: 'spos', title: 'Games into session', order: 'fixed', note: 'Sessions are detected automatically: an hour or more between games starts a new one.' },
];

function breakdownRows(games, b) {
  const groups = groupBy(games, b.key);
  let keys = [...groups.keys()];
  if (b.order === 'fixed') { const o = FFK[b.key].o(); keys.sort((x, y) => o.indexOf(x) - o.indexOf(y)); }
  else keys.sort((x, y) => groups.get(y).length - groups.get(x).length);
  if (b.limit) keys = keys.slice(0, b.limit);
  const rows = keys.map(v => ({ label: v, value: v, a: agg(groups.get(v)) }));
  if (b.key === 'build') { const mixed = games.filter(isMixed); if (mixed.length) rows.push({ label: 'Mixed builds', value: null, a: agg(mixed) }); }
  return rows;
}

const GRAPH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-5 4 3 5-7"/></svg>';

function tableHTML(rows, key) {
  return `<table class="bt"><thead><tr><th></th><th>G</th><th>W%</th><th>K/D</th><th></th></tr></thead><tbody>${rows.map(r => `
    <tr><td>${esc(r.label)}</td><td>${r.a.n}</td><td>${pct(r.a.winPct)}</td>
    <td>${kdSpan(r.a.kdTotal ?? r.a.kdAvg)}${r.a.kdTotal != null && r.a.kdAvg != null ? `<small>avg ${r.a.kdAvg}</small>` : ''}</td>
    <td>${r.value != null && key ? `<button class="gt" data-k="${key}" data-v="${esc(r.value)}" aria-label="Graph ${esc(r.label)}">${GRAPH_ICON}</button>` : ''}</td></tr>`).join('')}</tbody></table>`;
}

/* ---------- highlights ---------- */
function highlights(games) {
  const out = [];
  const big = key => [...groupBy(games, key)].map(([v, g]) => ({ v, a: agg(g) })).filter(x => x.a.n >= MIN && kdMain(x.a) != null).sort((x, y) => kdMain(y.a) - kdMain(x.a));
  const kdTxt = x => `${kdMain(x.a)} K/D, ${x.a.n} games`;
  const bestWorst = (key, label) => {
    const g = big(key);
    if (g.length >= 2) out.push(`Best ${label}: <b>${esc(g[0].v)}</b> (${kdTxt(g[0])}) · Worst: <b>${esc(g.at(-1).v)}</b> (${kdTxt(g.at(-1))})`);
    else if (g.length === 1) out.push(`Top ${label}: <b>${esc(g[0].v)}</b> (${kdTxt(g[0])})`);
  };
  bestWorst('map', 'map');
  bestWorst('build', 'build');
  bestWorst('wname', 'weapon');
  bestWorst('spec', 'spec');

  // loadout = builds + named weapons + specs
  const lo = new Map();
  games.forEach(e => {
    const parts = [e.builds.join('+'), ...Object.entries(e.weapons).map(([t, n]) => n || t), ...e.specs.map(s => s === 'Other' && e.specOther ? e.specOther : s)].filter(Boolean);
    if (!parts.length) return;
    const k = parts.join(' · ');
    if (!lo.has(k)) lo.set(k, []);
    lo.get(k).push(e);
  });
  const los = [...lo].map(([v, g]) => ({ v, a: agg(g) })).filter(x => x.a.n >= MIN && kdMain(x.a) != null).sort((x, y) => kdMain(y.a) - kdMain(x.a));
  if (los.length) out.push(`Best loadout: <b>${esc(los[0].v)}</b> (${kdTxt(los[0])})`);

  const compare = (key, label, name = v => v) => {
    const g = big(key);
    if (g.length >= 2) out.push(`${label}` + g.map(x => `<b>${esc(name(x.v))}</b> ${kdMain(x.a)} K/D${x.a.winPct != null ? ` · ${pct(x.a.winPct)} W` : ''}`).join(' vs '));
  };
  compare('mental', 'Mental: ');
  compare('med', '', v => v === 'Yes' ? 'Medicated' : 'Not medicated');

  const lag = big('lag'), L = lag.find(x => x.v === 'Lag'), N = lag.find(x => x.v === 'No lag');
  if (L && N) { const diff = +(kdMain(N.a) - kdMain(L.a)).toFixed(2); out.push(diff > 0 ? `Lag costs you about <b>${diff} K/D</b> (${kdMain(L.a)} with lag vs ${kdMain(N.a)} without)` : `Lag doesn’t seem to hurt you (${kdMain(L.a)} with lag vs ${kdMain(N.a)} without)`); }

  const sq = big('squad'), solo = sq.find(x => x.v === 'Solo'), party = sq.find(x => x.v === 'Party');
  if (solo && party && solo.a.winPct != null && party.a.winPct != null) out.push(`Solo: <b>${pct(solo.a.winPct)} W</b>, ${kdMain(solo.a)} K/D · Partied: <b>${pct(party.a.winPct)} W</b>, ${kdMain(party.a)} K/D`);

  const tod = big('tod');
  if (tod.length >= 2) out.push(`Best time to play: <b>${esc(tod[0].v.replace(/ \(.*\)/, ''))}</b> (${kdTxt(tod[0])})`);

  const sp = big('spos').sort((x, y) => SPOS.indexOf(x.v) - SPOS.indexOf(y.v));
  if (sp.length >= 2) {
    const a = sp[0], z = sp.at(-1), diff = +(kdMain(a.a) - kdMain(z.a)).toFixed(2);
    out.push(diff > 0.1 ? `You fall off late: <b>${kdMain(a.a)}</b> K/D in ${a.v.toLowerCase()} vs <b>${kdMain(z.a)}</b> in ${z.v.toLowerCase()}`
      : diff < -0.1 ? `You warm up: <b>${kdMain(a.a)}</b> K/D in ${a.v.toLowerCase()} vs <b>${kdMain(z.a)}</b> in ${z.v.toLowerCase()}`
      : `No late-session fall-off (${kdMain(a.a)} K/D early vs ${kdMain(z.a)} late)`);
  }
  return out;
}

/* ---------- sessions ---------- */
const dur = ms => { const m = Math.max(1, Math.round(ms / 6e4)); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`; };
const sessionGames = id => state.entries.filter(e => e.sessionId === id);

function statTiles(a, extra = '') {
  return `<div class="tiles">
    <div class="tile"><span>Games</span><b>${a.n}</b></div>
    <div class="tile"><span>W–L</span><b>${a.wins}–${a.losses}</b></div>
    <div class="tile"><span>K/D</span><b>${kdSpan(kdMain(a))}</b></div>
    <div class="tile"><span>Net RS</span><b class="${a.rsNet > 0 ? 'pos' : a.rsNet < 0 ? 'neg' : ''}">${a.rsN ? signed(a.rsNet) : '–'}</b></div>
  </div>${extra}`;
}

function sessionCardHTML() {
  const s = state.activeSession;
  if (!s) return `<div class="card sess"><div class="row" style="justify-content:space-between">
      <div><div class="lbl" style="margin:0">Session</div><div class="hint" style="margin:2px 0 0">Track just tonight’s games and RS.</div></div>
      <button class="btn primary" id="sess-start">Start session</button></div></div>`;
  const a = agg(sessionGames(s.id));
  return `<div class="card sess live">
    <div class="lbl"><span><i class="pulse"></i>Session live</span><span class="lbl-note">since ${fmtDT(s.start)} · ${dur(Date.now() - s.start)}</span></div>
    ${statTiles(a, a.rsN ? `<div class="hint">RS gained <b class="pos">+${a.rsGain}</b> · lost <b class="neg">${a.rsLoss}</b></div>` : '')}
    <div class="row" style="margin-top:10px"><button class="btn" id="sess-view">${S().range === 'live' ? 'Showing this session' : 'Show session stats'}</button><button class="btn" id="sess-end">End session</button></div>
  </div>`;
}

export function renderSessionBar() {
  const el = $('#sessbar'), s = state.activeSession;
  if (!s) { el.classList.add('hide'); return; }
  const a = agg(sessionGames(s.id));
  el.classList.remove('hide');
  el.innerHTML = `<i class="pulse"></i><span><b>Session</b> · ${a.n} game${a.n === 1 ? '' : 's'} · ${a.wins}–${a.losses}${a.rsN ? ` · <b class="${a.rsNet >= 0 ? 'pos' : 'neg'}">${signed(a.rsNet)} RS</b>` : ''}</span><span class="go">Stats ›</span>`;
  el.onclick = () => showTab('stats');
}

function startSession() {
  state.activeSession = { id: uid(), start: Date.now() };
  S().range = 'live';
  save('activeSession', 'stats');
  toast('Session started. Games you log now are tagged to it.');
  renderStats(); renderSessionBar();
}
function endSession() {
  const s = state.activeSession;
  const n = sessionGames(s.id).length;
  state.activeSession = null;
  if (n) { state.sessions.push({ ...s, end: Date.now() }); S().range = 'session:' + s.id; toast(`Session saved: ${n} game${n === 1 ? '' : 's'}`); }
  else { if (S().range === 'live') S().range = 0; toast('Session ended (no games logged)'); }
  save('activeSession', 'sessions', 'stats');
  renderStats(); renderSessionBar();
}

function pastSessionsHTML() {
  const list = [...state.sessions].sort((a, b) => b.start - a.start);
  if (!list.length) return '';
  return `<h2>Past sessions</h2>${list.map(s => {
    const a = agg(sessionGames(s.id));
    const on = S().range === 'session:' + s.id;
    return `<div class="ps ${on ? 'on' : ''}" data-id="${s.id}">
      <div><div class="name">${fmtDT(s.start)}</div><div class="muted">${dur(s.end - s.start)} · ${a.n} game${a.n === 1 ? '' : 's'} · ${a.wins}–${a.losses} · ${kdMain(a) ?? '–'} K/D</div></div>
      <b class="${a.rsNet > 0 ? 'pos' : a.rsNet < 0 ? 'neg' : ''}">${a.rsN ? signed(a.rsNet) + ' RS' : ''}</b></div>`;
  }).join('')}`;
}

/* ---------- main render ---------- */
function bars(items, total) {
  return items.map(([label, n]) => `<div class="bar"><span>${label}</span><div><i style="width:${total ? n / total * 100 : 0}%"></i></div><em>${n} · ${total ? Math.round(n / total * 100) : 0}%</em></div>`).join('');
}

export function renderStats() {
  if (S().range === 'live' && !state.activeSession) S().range = 0;
  const games = rangeGames(), a = agg(games), st = streaks(games);
  const fc = filterCount(S().filters);
  const ranges = [...(state.activeSession ? [{ v: 'live', l: 'Session' }] : []), { v: 7, l: '7D' }, { v: 30, l: '30D' }, { v: 90, l: '90D' }, { v: 0, l: 'All' }];
  const pastSel = typeof S().range === 'string' && S().range !== 'live';

  const best = games.filter(e => e.kd != null).sort((x, y) => y.kd - x.kd || (y.kills ?? 0) - (x.kills ?? 0))[0];
  const tiers = [['kd-bad', 'Under 1'], ['kd-ok', '1–1.99'], ['kd-good', '2–2.99'], ['kd-ruby', '3+']].map(([c, l]) => [c, l, games.filter(e => kdTier(e.kd) === c).length]);
  const tierTotal = tiers.reduce((s, t) => s + t[2], 0);

  const ranked = games.filter(e => e.mode === 'Ranked'), ra = agg(ranked);
  const rankedPlaced = ranked.filter(e => e.place != null);
  const cash = games.filter(e => e.mode === 'Cashout'), cashPlaced = cash.filter(e => e.place != null);
  const avgPlace = g => g.length ? +(g.reduce((s, e) => s + e.place, 0) / g.length).toFixed(1) : null;

  const hl = highlights(games);

  $('#stats-root').innerHTML = `
    ${sessionCardHTML()}
    <div class="gctl">
      <div class="seg" id="st-range">${ranges.map(r => `<button data-v="${r.v}" class="${S().range === r.v ? 'on' : ''}">${r.l}</button>`).join('')}</div>
      ${pastSel ? `<div class="chipbar"><span>${esc(rangeLabel())}</span><button id="st-range-clear" aria-label="Show all time">✕</button></div>` : ''}
      <div class="row">
        <button class="btn" id="st-filter" style="flex:1">Filters${fc ? ` (${fc})` : ''}</button>
        ${fc ? '<button class="btn" id="st-filter-clear">Clear</button>' : ''}
      </div>
      ${fc ? `<div class="hint" style="margin:0 2px">${esc(summary(S().filters))}</div>` : ''}
    </div>

    <div id="stats-body">
      <div class="export-only exp-title">Skill Issue stats · ${esc(rangeLabel())}${fc ? ' · ' + esc(summary(S().filters)) : ''}</div>
      ${!games.length ? `<div class="empty"><div class="big">No games here yet</div>${state.entries.length ? 'Nothing matches this time range and these filters.' : 'Log some games on the Entry tab and your stats show up here.'}</div>` : `

      <div class="card">
        <div class="tiles">
          <div class="tile"><span>Games</span><b>${a.n}</b></div>
          <div class="tile"><span>Win rate</span><b>${pct(a.winPct)}</b><small>${a.wins}–${a.losses}</small></div>
          <div class="tile"><span>K/D</span><b>${kdSpan(a.kdTotal ?? a.kdAvg)}</b><small>${a.kdTotal != null && a.kdAvg != null ? `per-game avg ${a.kdAvg}` : a.kdTotal != null ? 'kills ÷ deaths' : 'per-game avg'}</small></div>
          <div class="tile"><span>Kills / Deaths</span><b>${a.kills} / ${a.deaths}</b></div>
          <div class="tile"><span>Streak</span><b class="${st.curT === 'W' ? 'pos' : st.curT === 'L' ? 'neg' : ''}">${st.curT ? st.curT + st.cur : '–'}</b><small>best win streak ${st.best}</small></div>
          <div class="tile"><span>Best game</span><b>${best ? kdSpan(best.kd) : '–'}</b><small>${best ? `${fmtDate(best.ts)} · ${esc(mapName(best) || best.mode)}${best.kills != null ? ` · ${best.kills}/${best.deaths}` : ''}` : ''}</small></div>
        </div>
        ${tierTotal ? `<div class="sub sublbl">K/D colors</div>
        <div class="tierbar">${tiers.filter(t => t[2]).map(([c, l, n]) => `<i class="${c}-bg" style="flex:${n}" title="${l}: ${n}"></i>`).join('')}</div>
        <div class="tierlegend">${tiers.map(([c, l, n]) => `<span><i class="${c}-bg"></i>${l}: ${n}</span>`).join('')}</div>` : ''}
      </div>

      ${ranked.length ? `<h2>Ranked</h2><div class="card">
        <div class="tiles">
          <div class="tile"><span>Net RS</span><b class="${ra.rsNet > 0 ? 'pos' : ra.rsNet < 0 ? 'neg' : ''}">${ra.rsN ? signed(ra.rsNet) : '–'}</b></div>
          <div class="tile"><span>Avg RS / game</span><b>${ra.rsN ? signed(+(ra.rsNet / ra.rsN).toFixed(1)) : '–'}</b></div>
          <div class="tile"><span>RS gained</span><b class="pos">${ra.rsN ? '+' + ra.rsGain : '–'}</b></div>
          <div class="tile"><span>RS lost</span><b class="neg">${ra.rsN ? ra.rsLoss : '–'}</b></div>
          <div class="tile"><span>Win rate</span><b>${pct(ra.winPct)}</b><small>RS + = win</small></div>
          <div class="tile"><span>Avg placement</span><b>${num(avgPlace(rankedPlaced))}</b><small>${rankedPlaced.length} placed</small></div>
        </div>
        ${ranked.some(e => e.stage) ? `<div class="sub sublbl">How far you get</div>${bars(STAGES.map(s => [s, ranked.filter(e => e.stage === s).length]), ranked.filter(e => e.stage).length)}` : ''}
      </div>` : ''}

      ${cash.length ? `<h2>Cashout</h2><div class="card">
        <div class="tiles">
          <div class="tile"><span>Games</span><b>${cash.length}</b></div>
          <div class="tile"><span>1st place</span><b>${cashPlaced.length ? Math.round(cashPlaced.filter(e => e.place === 1).length / cashPlaced.length * 100) + '%' : '–'}</b></div>
          <div class="tile"><span>Avg placement</span><b>${num(avgPlace(cashPlaced))}</b></div>
        </div>
        ${cashPlaced.length ? `<div class="sub sublbl">Placements</div>${bars(PLACES.map(p => [p.l, cashPlaced.filter(e => e.place === p.v).length]), cashPlaced.length)}` : ''}
      </div>` : ''}

      <h2>Highlights</h2>
      <div class="card hl">${hl.length ? hl.map(h => `<div>${h}</div>`).join('') : `<div class="hint" style="margin:0">Highlights appear once a map, build, weapon and so on has at least ${MIN} games.</div>`}</div>

      <h2>Breakdowns</h2>
      <div class="hint" style="margin:-4px 2px 8px">Tap <span class="gt-inline">${GRAPH_ICON}</span> to add that row as a line on the Graph.</div>
      ${BREAKDOWNS.map(b => { const rows = breakdownRows(games, b); return rows.length ? `<details class="bd card"><summary><span>${b.title}</span><em>${rows.length}</em></summary>${b.note ? `<div class="hint" style="margin:0 14px 6px">${b.note}</div>` : ''}${tableHTML(rows, b.key)}</details>` : ''; }).join('')}
      `}
    </div>

    ${pastSessionsHTML()}

    <div class="row" style="margin:14px 0 20px;justify-content:flex-end"><button class="btn sm" id="st-png">Export PNG</button><button class="btn sm" id="st-csv">Export .csv</button></div>`;

  bind(games);
}

function bind(games) {
  const root = $('#stats-root');
  $('#sess-start')?.addEventListener('click', startSession);
  $('#sess-view')?.addEventListener('click', () => { S().range = 'live'; save('stats'); renderStats(); });
  $('#sess-end')?.addEventListener('click', e => confirmTap(e.target, 'Tap again to end', endSession));
  root.querySelectorAll('#st-range button').forEach(b => b.onclick = () => { const v = b.dataset.v; S().range = v === 'live' ? v : +v; save('stats'); renderStats(); });
  $('#st-range-clear')?.addEventListener('click', () => { S().range = 0; save('stats'); renderStats(); });
  $('#st-filter').onclick = openFilters;
  $('#st-filter-clear')?.addEventListener('click', () => { S().filters = {}; save('stats'); renderStats(); });
  root.querySelectorAll('.ps').forEach(el => el.onclick = () => {
    const v = 'session:' + el.dataset.id;
    S().range = S().range === v ? 0 : v; save('stats'); renderStats(); window.scrollTo(0, 0);
  });
  root.querySelectorAll('.gt').forEach(b => b.onclick = e => {
    e.preventDefault(); e.stopPropagation();
    const { k, v } = b.dataset;
    const filters = { ...clone(S().filters), [k]: [v] };
    addLine(v, filters);
    toast(`Added “${v}” to the Graph`);
  });
  $('#st-png').onclick = () => exportPng().catch(e => toast(e.message));
  $('#st-csv').onclick = () => exportCsv(games);
}

function openFilters() {
  const draft = clone(S().filters);
  openSheet((sh, close) => {
    const render = () => {
      const n = state.entries.filter(e => inRange(e) && matches(e, draft)).length;
      sh.innerHTML = `<div class="grab"></div>
        <div class="sheethead"><button class="btn" id="sf-cancel">Cancel</button><b>Stats filters</b><button class="btn primary" id="sf-done">Done</button></div>
        <div class="row" style="justify-content:space-between;margin:6px 2px"><span class="hint" style="margin:0">Matches <b style="color:var(--text)">${n}</b> game${n === 1 ? '' : 's'} in ${esc(rangeLabel().toLowerCase())}. Blank field = all.</span><button class="btn sm" id="sf-clear">Clear</button></div>
        ${filterSectionsHTML(draft)}`;
      const keep = fn => () => { const y = sh.scrollTop; fn(); render(); sh.scrollTop = y; };
      bindFilterSections(sh, draft, keep(() => {}));
      $('#sf-clear').onclick = keep(() => { for (const k in draft) delete draft[k]; });
      $('#sf-cancel').onclick = close;
      $('#sf-done').onclick = () => { S().filters = draft; save('stats'); close(); renderStats(); };
    };
    render();
  });
}

/* ---------- exports ---------- */
async function exportPng() {
  if (!window.html2canvas) await loadScript('vendor/html2canvas.min.js');
  const el = $('#stats-body');
  const canvas = await window.html2canvas(el, {
    backgroundColor: '#0c0d11', scale: Math.min(2, window.devicePixelRatio || 1), logging: false,
    onclone: doc => {
      doc.querySelectorAll('#stats-body details').forEach(d => { d.open = true; });
      doc.querySelectorAll('#stats-body .export-only').forEach(d => { d.style.display = 'block'; });
      doc.querySelectorAll('#stats-body .gt, #stats-body .gt-inline').forEach(d => { d.style.visibility = 'hidden'; });
      doc.getElementById('stats-body').style.padding = '12px';
    },
  });
  canvas.toBlob(b => saveFile(`skill-issue-stats-${new Date().toISOString().slice(0, 10)}.png`, b), 'image/png');
}

function exportCsv(games) {
  if (!games.length) return toast('No stats to export');
  const head = ['Section', 'Item', 'Games', 'Wins', 'Losses', 'Win %', 'K/D (kills ÷ deaths)', 'K/D (avg per game)', 'Kills', 'Deaths', 'Net RS'];
  const row = (sec, item, a) => [sec, item, a.n, a.wins, a.losses, a.winPct == null ? '' : +a.winPct.toFixed(1), a.kdTotal ?? '', a.kdAvg ?? '', a.kills, a.deaths, a.rsN ? a.rsNet : ''];
  const rows = [['Range', rangeLabel()], ['Filters', summary(S().filters)], [], head, row('Overall', 'All games', agg(games))];
  const ranked = games.filter(e => e.mode === 'Ranked');
  STAGES.forEach(s => { const g = ranked.filter(e => e.stage === s); if (g.length) rows.push(row('Ranked stage', s, agg(g))); });
  BREAKDOWNS.forEach(b => breakdownRows(games, b).forEach(r => rows.push(row(b.title, r.label, r.a))));
  saveFile(`skill-issue-stats-${new Date().toISOString().slice(0, 10)}.csv`, new Blob([toCsv(rows)], { type: 'text/csv' }));
}

export function initStatsTab() {
  renderSessionBar();
  // keep the live session timer fresh while the Stats tab is open
  setInterval(() => { if (state.activeSession && $('#tab-stats').classList.contains('active') && !document.hidden) renderStats(); }, 60000);
}
