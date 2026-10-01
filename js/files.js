// Exports (xlsx, csv, png, backup json) and the "save or share" step.
import { WTYPES } from './constants.js';
import { state } from './store.js';
import { toast, modeName, mapName, placeLabel } from './util.js';

// On phones (especially an installed iPhone app) a plain download link is unreliable,
// so use the share sheet ("Save to Files", AirDrop, Mail…) when it's available.
export async function saveFile(name, blob) {
  const file = new File([blob], name, { type: blob.type });
  const touch = matchMedia('(pointer:coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export const COLS = [
  ['Date', e => new Date(e.ts)],
  ['Mode', modeName],
  ['Result', e => e.result === 'W' ? 'Win' : e.result === 'L' ? 'Loss' : ''],
  ['Placement', e => placeLabel(e.place)],
  ['Ranked stage', e => e.stage ?? ''],
  ['RS', e => e.rs ?? ''],
  ['RS after game', e => e.rsTotal ?? ''],
  ['Kills', e => e.kills ?? ''],
  ['Deaths', e => e.deaths ?? ''],
  ['K/D', e => e.kd ?? ''],
  ['Squad', e => e.squad.join(' + ')],
  ['Party size', e => e.partySize ?? ''],
  ['Teammate skill', e => e.teammate ?? ''],
  ['Medicated', e => e.med ?? ''],
  ['Mental + Physical', e => e.mental ?? ''],
  ['Lag', e => e.lag ?? ''],
  ['Build', e => e.builds.join(' + ')],
  ...WTYPES.map(t => [t, e => t in e.weapons ? (e.weapons[t].join(' + ') || '✓') : '']),
  ['Spec', e => e.specs.map(s => s === 'Other' && e.specOther ? e.specOther : s).join(' + ')],
  ['Map', e => mapName(e) ?? ''],
  ['Damage', e => e.damage ?? ''],
  ['Revives', e => e.revives ?? ''],
  ['Gadgets', e => (e.gadgets || []).join(' + ')],
  ['Notes', e => e.notes ?? ''],
  ['Source', e => e.source ?? 'manual'],
  ['Session', e => { const s = e.sessionId && (state.sessions.find(x => x.id === e.sessionId) || (state.activeSession?.id === e.sessionId && state.activeSession)); return s ? new Date(s.start) : ''; }],
];
const sorted = () => [...state.entries].sort((a, b) => a.ts - b.ts);

export const csvCell = v => {
  if (v instanceof Date) v = v.toLocaleString();
  v = String(v ?? '');
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};
export const toCsv = rows => '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');

export function exportCsv() {
  if (!state.entries.length) return toast('No games to export yet');
  const rows = [COLS.map(c => c[0]), ...sorted().map(e => COLS.map(c => c[1](e)))];
  saveFile(`skill-issue-${stamp()}.csv`, new Blob([toCsv(rows)], { type: 'text/csv' }));
}

export function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Couldn’t load ' + src)); document.head.appendChild(s); });
}

export async function exportXlsx() {
  if (!state.entries.length) return toast('No games to export yet');
  if (!window.XLSX) await loadScript('vendor/xlsx.full.min.js');
  const XLSX = window.XLSX;
  const rows = [COLS.map(c => c[0]), ...sorted().map(e => COLS.map(c => c[1](e)))];
  const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: true, dateNF: 'yyyy-mm-dd h:mm' });
  ws['!cols'] = COLS.map(([h]) => ({ wch: h === 'Notes' ? 40 : h === 'Date' ? 17 : Math.max(10, h.length + 2) }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Games');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  saveFile(`skill-issue-${stamp()}.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

export function exportBackup(snapshot) {
  saveFile(`skill-issue-backup-${stamp()}.json`, new Blob([JSON.stringify(snapshot, null, 1)], { type: 'application/json' }));
}

export function pickFile(accept) {
  return new Promise(res => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept;
    i.onchange = () => res(i.files[0] || null);
    i.click();
  });
}
