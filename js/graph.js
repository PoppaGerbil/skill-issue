import { COLORS } from './constants.js';
import { state, save, line } from './store.js';
import { $, $$, esc, toast, clone, uid, fmtDate, fmtDT, placeLabel, isMixed, isLaggy, isSolo, modeName, mapName, squadName, winOf, openSheet } from './util.js';
import { matches, summary, filterSectionsHTML, bindFilterSections } from './filters.js';
import { saveFile, toCsv } from './files.js';

const METRICS = [{ v: 'kd', l: 'K/D' }, { v: 'kills', l: 'Kills' }, { v: 'deaths', l: 'Deaths' }, { v: 'win', l: 'Win %' }, { v: 'place', l: 'Placement' }, { v: 'rs', l: 'RS' }];
const RANGES = [{ v: 7, l: '7D' }, { v: 30, l: '30D' }, { v: 90, l: '90D' }, { v: 0, l: 'All' }];
const VIEWS = [{ v: 'game', l: 'Per game' }, { v: 'day', l: 'Daily' }, { v: 'week', l: 'Weekly' }];
const Y_TITLES = { kd: 'K/D', kills: 'Kills', deaths: 'Deaths', win: 'Win rate (%)', place: 'Placement (1st at top)', rs: 'RS (running total)' };
const X_TITLES = { game: 'Date (one point per game)', day: 'Date (daily average)', week: 'Week' };
const NOTES = { kd: '', kills: '', deaths: '', win: 'Ranked: RS gained = win, RS lost = loss', place: 'Cashout & Ranked only · 5th/6th = 5.5, 7th/8th = 7.5', rs: 'Running RS total · Ranked only' };

const G = () => state.graph;
let chart;
const persist = () => save('graph');

const inRange = e => !G().range || e.ts >= Date.now() - G().range * 864e5;
const metricOf = e => ({ kd: e.kd, kills: e.kills, deaths: e.deaths, place: e.place })[G().metric];

function series(ln) {
  const { metric, view } = G();
  const games = state.entries.filter(e => inRange(e) && matches(e, ln.filters)).sort((a, b) => a.ts - b.ts);
  if (view === 'game') {
    let w = 0, n = 0, rs = 0;
    return games.map(e => {
      let y;
      if (metric === 'win') { const r = winOf(e); if (!r) return null; n++; if (r === 'W') w++; y = +(w / n * 100).toFixed(1); }
      else if (metric === 'rs') { if (e.rs == null) return null; rs += e.rs; y = rs; }
      else y = metricOf(e);
      return y == null ? null : { x: e.ts, y, games: [e] };
    }).filter(Boolean);
  }
  const key = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); if (view === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
  const buckets = new Map();
  games.forEach(e => { const k = key(e.ts); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(e); });
  let rs = 0;
  return [...buckets.entries()].map(([x, g]) => {
    let y;
    if (metric === 'win') { const d = g.filter(winOf); y = d.length ? +(d.filter(e => winOf(e) === 'W').length / d.length * 100).toFixed(1) : null; }
    else if (metric === 'rs') { const r = g.filter(e => e.rs != null); if (!r.length) return null; rs += r.reduce((s, e) => s + e.rs, 0); y = rs; }
    else { const v = g.map(metricOf).filter(v => v != null); y = v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null; }
    return y == null ? null : { x, y, games: g };
  }).filter(Boolean);
}

function seg(el, opts, key) {
  el.innerHTML = opts.map(o => `<button data-v="${o.v}" class="${G()[key] == o.v ? 'on' : ''}">${o.l}</button>`).join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => {
    G()[key] = opts.find(o => String(o.v) === b.dataset.v).v;
    persist(); seg(el, opts, key); drawChart();
  });
}

function drawChart() {
  const { metric, view } = G();
  $('#metric-note').textContent = NOTES[metric];
  const perGame = view === 'game';
  const mixed = c => c.raw && perGame && isMixed(c.raw.games[0]);
  const ds = G().lines.filter(l => !l.hidden).map(l => ({
    label: l.name, data: series(l), borderColor: l.color, backgroundColor: l.color, borderWidth: 2, tension: .25,
    pointStyle: c => mixed(c) ? 'rect' : 'circle', pointRadius: c => mixed(c) ? 4.5 : 3, pointHoverRadius: 7,
  }));
  const hasData = ds.some(d => d.data.length);
  $('#chart-empty').classList.toggle('hide', hasData);
  $('#chart-empty').textContent = state.entries.length ? 'No games match these lines in this time range.' : 'Log some games and your graph shows up here.';
  if (chart) chart.destroy();
  const axisTitle = text => ({ display: true, text, color: '#8a90a0', font: { weight: '600' } });
  chart = new Chart($('#chart'), {
    type: 'line',
    data: { datasets: ds },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
      interaction: { mode: 'nearest', intersect: false, axis: 'xy' },
      scales: {
        x: { type: 'linear', grid: { color: '#1f222a' }, ticks: { color: '#8a90a0', maxTicksLimit: 5, callback: v => fmtDate(v) }, title: axisTitle(X_TITLES[view]) },
        y: {
          grid: { color: '#1f222a' }, ticks: { color: '#8a90a0' }, reverse: metric === 'place', title: axisTitle(Y_TITLES[metric]),
          ...(metric === 'win' ? { min: 0, max: 100 } : {}), ...(metric === 'place' ? { min: 1, max: 8 } : {}), ...(['kd', 'kills', 'deaths'].includes(metric) ? { beginAtZero: true } : {}),
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e2129', borderColor: '#2a2e39', borderWidth: 1, padding: 10,
          callbacks: {
            title: it => perGame ? fmtDT(it[0].raw.x) : (view === 'week' ? 'Week of ' : '') + fmtDate(it[0].raw.x),
            label: c => ` ${c.dataset.label}: ${c.raw.y}${metric === 'win' ? '%' : ''}`,
            afterLabel: c => {
              const g = c.raw.games;
              if (!perGame) {
                const lag = g.filter(isLaggy).length, sq = g.filter(e => !isSolo(e)).length;
                return [`   ${g.length} game${g.length > 1 ? 's' : ''}`, lag ? `   ⚠ ${lag} with lag` : null, sq ? `   👥 ${sq} partied` : null].filter(Boolean);
              }
              const e = g[0];
              return [
                `   ${modeName(e)} · ${mapName(e) || '—'} · ${e.builds.join('+') || '—'}${isMixed(e) ? ' (mixed)' : ''}`,
                isLaggy(e) ? `   ⚠ Lag: ${e.lag}` : null,
                e.stage ? `   ${placeLabel(e.place)} · ${e.stage}${e.rs != null ? ` · ${e.rs > 0 ? '+' : ''}${e.rs} RS` : ''}${e.rsTotal != null ? ` → ${e.rsTotal.toLocaleString()}` : ''}` : null,
                !isSolo(e) ? `   👥 ${squadName(e)}${e.teammate ? ' · ' + e.teammate : ''}` : null,
              ].filter(Boolean);
            },
          },
        },
      },
    },
  });
  renderLines();
}

const ICONS = {
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.9 17.9A10 10 0 0 1 12 20c-7 0-11-8-11-8a18 18 0 0 1 5-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.2 3.2M1 1l22 22"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  bin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
};

function renderLines() {
  const lines = G().lines;
  $('#g-lines').innerHTML = lines.map(l => {
    const n = state.entries.filter(e => inRange(e) && matches(e, l.filters)).length;
    return `<div class="ln ${l.hidden ? 'off' : ''}" data-id="${l.id}"><span class="dot" style="background:${l.color}"></span>
      <div class="meta"><div class="name">${esc(l.name)} <span class="count">· ${n} game${n === 1 ? '' : 's'}</span></div><div class="sum">${esc(summary(l.filters))}</div></div>
      <button class="ib" data-a="hide" aria-label="Show or hide">${l.hidden ? ICONS.eyeOff : ICONS.eye}</button>
      <button class="ib" data-a="edit" aria-label="Edit">${ICONS.pen}</button>
      <button class="ib" data-a="del" aria-label="Delete">${ICONS.bin}</button></div>`;
  }).join('') || '<div class="hint" style="margin:0 2px 8px">No lines. Add one below.</div>';
  $$('.ln').forEach(el => el.querySelectorAll('.ib').forEach(b => b.onclick = () => {
    const l = lines.find(x => x.id === el.dataset.id);
    if (b.dataset.a === 'hide') { l.hidden = !l.hidden; persist(); drawChart(); }
    if (b.dataset.a === 'del') { G().lines = lines.filter(x => x !== l); persist(); drawChart(); }
    if (b.dataset.a === 'edit') openEditor(l);
  }));
  $('#g-preset').innerHTML = '<option value="">Load preset…</option>' + state.presets.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join('');
}

function openEditor(ln, isNew) {
  const draft = clone(ln);
  openSheet((sh, close) => {
    const render = () => {
      const n = state.entries.filter(e => inRange(e) && matches(e, draft.filters)).length;
      sh.innerHTML = `<div class="grab"></div>
        <div class="sheethead"><button class="btn" id="ed-cancel">Cancel</button><b>${isNew ? 'New line' : 'Edit line'}</b><button class="btn primary" id="ed-done">Done</button></div>
        <div class="card"><div class="lbl">Name</div><input id="ed-name" class="txt" value="${esc(draft.name)}">
          <div class="sub lbl">Color</div><div class="swatches">${COLORS.map(c => `<span class="sw ${c === draft.color ? 'on' : ''}" data-c="${c}" style="background:${c}"></span>`).join('')}</div></div>
        <div class="row" style="justify-content:space-between;margin:6px 2px"><span class="hint" style="margin:0">Matches <b style="color:var(--text)">${n}</b> game${n === 1 ? '' : 's'}. Blank field = all.</span><button class="btn sm" id="ed-clear">Clear filters</button></div>
        ${filterSectionsHTML(draft.filters)}`;
      const keep = fn => () => { draft.name = $('#ed-name').value; const y = sh.scrollTop; fn(); render(); sh.scrollTop = y; };
      bindFilterSections(sh, draft.filters, keep(() => {}));
      sh.querySelectorAll('.sw').forEach(s => s.onclick = keep(() => { draft.color = s.dataset.c; }));
      $('#ed-clear').onclick = keep(() => { draft.filters = {}; });
      $('#ed-cancel').onclick = close;
      $('#ed-done').onclick = () => {
        draft.name = $('#ed-name').value.trim() || 'Untitled';
        if (isNew) G().lines.push(draft); else Object.assign(ln, draft);
        persist(); close(); drawChart();
      };
    };
    render();
  });
}

function exportPng() {
  if (!chart) return;
  const src = $('#chart'), dpr = src.width / src.clientWidth;
  const visible = G().lines.filter(l => !l.hidden);
  const pad = 16 * dpr, head = (46 + visible.length * 20) * dpr;
  const o = document.createElement('canvas');
  o.width = src.width + pad * 2; o.height = src.height + head + pad;
  const x = o.getContext('2d');
  x.fillStyle = '#16181f'; x.fillRect(0, 0, o.width, o.height);
  x.fillStyle = '#eceef3'; x.font = `800 ${17 * dpr}px -apple-system, sans-serif`;
  const range = RANGES.find(r => r.v === G().range).l, view = VIEWS.find(v => v.v === G().view).l;
  x.fillText(`Skill Issue: ${METRICS.find(m => m.v === G().metric).l}  ·  ${range}  ·  ${view}`, pad, pad + 14 * dpr);
  x.font = `500 ${13 * dpr}px -apple-system, sans-serif`;
  visible.forEach((l, i) => {
    const y = pad + (40 + i * 20) * dpr;
    x.fillStyle = l.color; x.beginPath(); x.arc(pad + 5 * dpr, y - 4 * dpr, 5 * dpr, 0, 7); x.fill();
    x.fillStyle = '#c5c9d4'; x.fillText(`${l.name}  (${summary(l.filters)})`, pad + 16 * dpr, y);
  });
  x.drawImage(src, pad, head);
  o.toBlob(b => saveFile(`skill-issue-graph-${new Date().toISOString().slice(0, 10)}.png`, b), 'image/png');
}

function exportGraphCsv() {
  const rows = [['Line', 'Filters', 'Date', METRICS.find(m => m.v === G().metric).l, 'Games']];
  G().lines.filter(l => !l.hidden).forEach(l => series(l).forEach(p => rows.push([l.name, summary(l.filters), new Date(p.x), p.y, p.games.length])));
  if (rows.length === 1) return toast('Nothing on the graph to export');
  saveFile(`skill-issue-graph-data-${new Date().toISOString().slice(0, 10)}.csv`, new Blob([toCsv(rows)], { type: 'text/csv' }));
}

// Used by Stats "Graph this": adds a line and saves it
export function addLine(name, filters) {
  const n = G().lines.length;
  G().lines.push(line(name, COLORS[n % COLORS.length], filters));
  persist();
}

export function renderGraph() {
  seg($('#g-metric'), METRICS, 'metric');
  seg($('#g-range'), RANGES, 'range');
  seg($('#g-view'), VIEWS, 'view');
  drawChart();
}

export function initGraph() {
  $('#g-preset').onchange = e => {
    if (e.target.value === '') return;
    const p = state.presets[+e.target.value];
    G().lines = clone(p.lines).map(l => ({ ...l, id: uid() }));
    persist(); drawChart(); toast(`Loaded “${p.name}”`);
  };
  $('#g-savepreset').onclick = () => { $('#presetsave').classList.toggle('hide'); $('#preset-name').focus(); };
  $('#preset-ok').onclick = () => {
    const n = $('#preset-name').value.trim();
    if (!n) return;
    state.presets = state.presets.filter(p => p.name !== n);
    state.presets.push({ name: n, lines: clone(G().lines) });
    save('presets');
    $('#preset-name').value = ''; $('#presetsave').classList.add('hide');
    renderLines(); toast(`Preset “${n}” saved`);
  };
  $('#preset-name').onkeydown = e => { if (e.key === 'Enter') $('#preset-ok').click(); };
  $('#g-add').onclick = () => openEditor(line(`Line ${G().lines.length + 1}`, COLORS[G().lines.length % COLORS.length]), true);
  $('#g-png').onclick = exportPng;
  $('#g-csv').onclick = exportGraphCsv;
}

