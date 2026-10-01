import { state, save } from './store.js';
import { $, $$, esc, toast, fmtDT, placeLabel, isMixed, isLaggy, modeName, mapName, squadName, kdTier, confirmTap } from './util.js';
import { editEntry } from './entry.js';
import { exportCsv, exportXlsx } from './files.js';
import { agg } from './stats.js';

let sort = 'new', openId = null;

function card(e) {
  const weapons = Object.entries(e.weapons).map(([t, n]) => `${t}${n.length ? ': ' + n.map(esc).join(' + ') : ''}`).join(', ') || '—';
  const specs = e.specs.map(s => s === 'Other' && e.specOther ? esc(e.specOther) : s).join(', ') || '—';
  return `<div class="rec" data-id="${e.id}">
    <div class="r1"><span>${fmtDT(e.ts)}</span>${e.result ? `<span class="badge ${e.result}">${e.result === 'W' ? 'WIN' : 'LOSS'}${e.place ? ' · ' + placeLabel(e.place) : ''}</span>` : ''}</div>
    <div class="r2">
      <div>
        <div class="title">${esc(modeName(e))}${e.rs != null ? ` <span class="rsv ${e.rs >= 0 ? 'pos' : 'neg'}">${e.rs >= 0 ? '+' : ''}${e.rs} RS</span>` : ''}${e.rsTotal != null ? ` <span class="rsv muted">→ ${e.rsTotal.toLocaleString()}</span>` : ''}</div>
        <div class="muted">${esc(mapName(e) || 'No map')} · ${e.builds.join('+') || 'No build'}</div>
      </div>
      <div class="kd"><span class="${kdTier(e.kd)}">${e.kd ?? '–'}</span><small>${e.kills ?? '–'} / ${e.deaths ?? '–'}</small></div>
    </div>
    <div class="tags"><span>${esc(squadName(e))}</span>${e.stage ? `<span>${e.stage}</span>` : ''}${isLaggy(e) ? `<span class="warn">Lag: ${e.lag}</span>` : ''}${e.med === 'Yes' ? '<span>Medicated</span>' : ''}${e.mental ? `<span>${e.mental}</span>` : ''}${isMixed(e) ? '<span>■ mixed build</span>' : ''}</div>
    ${openId === e.id ? `<div class="detail">
      <div><b>Weapons:</b> ${weapons}</div>
      <div><b>Spec:</b> ${specs}</div>
      ${e.squad.includes('Party') ? `<div><b>Teammates:</b> ${e.teammate || '—'}</div>` : ''}
      <div><b>Lag:</b> ${e.lag}</div>
      ${e.damage != null ? `<div><b>Damage:</b> ${e.damage.toLocaleString()}${e.revives != null ? ` · <b>Revives:</b> ${e.revives}` : ''}</div>` : ''}
      ${e.gadgets?.length ? `<div><b>Gadgets:</b> ${e.gadgets.map(esc).join(', ')}</div>` : ''}
      ${e.rounds?.length > 1 ? `<div><b>Rounds:</b> ${e.rounds.map(r => `${esc(r.place)} ${r.kills}/${r.deaths}`).join(' · ')}</div>` : ''}
      ${e.source && e.source !== 'manual' ? `<div><b>Source:</b> ${esc(e.source)}</div>` : ''}
      ${e.notes ? `<div><b>Notes:</b> ${esc(e.notes)}</div>` : ''}
      <div class="row" style="margin-top:10px"><button class="btn sm" data-act="edit">Edit</button><button class="btn sm" data-act="del">Delete</button></div>
    </div>` : ''}
  </div>`;
}

export function renderRecord() {
  const list = [...state.entries].sort((a, b) => sort === 'new' ? b.ts - a.ts : a.ts - b.ts);
  $('#rec-count').textContent = `Record · ${list.length} game${list.length === 1 ? '' : 's'}`;
  const a = agg(list), kd = a.kdTotal ?? a.kdAvg;
  $('#rec-summary').innerHTML = list.length ? `${a.winPct == null ? '' : Math.round(a.winPct) + '% W · '}<span class="${kdTier(kd)}">${kd ?? '–'}</span> K/D${a.rsN ? ` · <span class="${a.rsNet >= 0 ? 'pos' : 'neg'}">${a.rsNet > 0 ? '+' : ''}${a.rsNet}</span> RS` : ''}` : '';
  $('#rec-list').innerHTML = list.length ? list.map(card).join('')
    : `<div class="empty"><div class="big">No games yet</div>Log your first game on the Entry tab and it’ll show up here.</div>`;
  $$('.rec').forEach(el => el.onclick = ev => {
    const id = +el.dataset.id, act = ev.target.dataset?.act;
    if (act === 'edit') return editEntry(id);
    if (act === 'del') return confirmTap(ev.target, 'Tap again to delete', () => {
      state.entries = state.entries.filter(x => x.id !== id);
      save('entries'); openId = null; toast('Deleted'); renderRecord();
    });
    openId = openId === id ? null : id;
    renderRecord();
  });
}

export function initRecord() {
  $$('#rec-sort button').forEach(b => b.onclick = () => {
    sort = b.dataset.v;
    $$('#rec-sort button').forEach(x => x.classList.toggle('on', x === b));
    renderRecord();
  });
  $('#exp-csv').onclick = exportCsv;
  $('#exp-xlsx').onclick = () => exportXlsx().catch(e => toast(e.message));
}
