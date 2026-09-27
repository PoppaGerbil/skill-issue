import { MODES, MAPS, MENTAL, LAG, SKILL, BUILDS, WTYPES, SPECS, PLACES, STAGES, stageFor } from './constants.js';
import { state, save, nextId } from './store.js';
import { $, esc, toast, chips, toLocalInput, kdTier } from './util.js';
import { showTab } from './nav.js';

const DRAFT_KEY = 'si-draft';
let f, editingId = null, rsSign = null;

function blankForm() {
  const c = state.carry || {};
  return {
    ts: Date.now(), tsManual: false, mode: null, modeOther: '', result: null, place: null, stage: null, rs: '',
    kills: '', deaths: '', kd: '', kdManual: false,
    squad: c.squad ? [...c.squad] : [], partySize: c.partySize ?? null, teammate: c.teammate ?? null, med: c.med ?? null,
    mental: null, lag: null, builds: [], weapons: {}, specs: [], specOther: '', map: '', mapOther: '', notes: '',
  };
}

// The in-progress entry is kept in this device's browser storage so closing the app mid-entry doesn't lose it
function saveDraft() {
  if (editingId) return;
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...f, rsSign })); } catch {}
}
function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
    if (!d) return null;
    rsSign = d.rsSign ?? null; delete d.rsSign;
    return d;
  } catch { return null; }
}
function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch {} }

const ranked = () => f.mode === 'Ranked';
const placed = () => f.mode === 'Cashout' || f.mode === 'Ranked';

function mountResult() {
  chips($('#c-result'), [{ v: 'W', l: 'Win' }, { v: 'L', l: 'Loss' }], () => f.result, v => { f.result = v; refresh(); }, false, v => v === 'W' ? 'w' : 'l');
}
function mountStage() { chips($('#c-stage'), STAGES, () => f.stage, v => { f.stage = v; refresh(); }); }

function mountSquad() {
  const el = $('#c-squad');
  // Solo is exclusive; Party, MommaGerbil and added names can be combined
  chips(el, ['Solo', 'Party', ...state.friends], () => f.squad, v => {
    const added = v.find(x => !f.squad.includes(x));
    f.squad = added === 'Solo' ? ['Solo'] : added ? v.filter(x => x !== 'Solo') : v;
    mountSquad(); refresh();
  }, true);
  const add = document.createElement('button');
  add.type = 'button'; add.className = 'chip ghost'; add.textContent = '+ Add name';
  add.onclick = () => { $('#friend-add').classList.toggle('hide'); $('#friend-name').focus(); };
  el.appendChild(add);
}
export { mountSquad };

function mountSaved() {
  const el = $('#c-saved');
  el.innerHTML = '';
  const mk = (txt, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip ' + cls; b.textContent = txt; b.onclick = fn; el.appendChild(b); };
  mk('↺ Same as last game', '', () => {
    const last = [...state.entries].sort((a, b) => b.ts - a.ts)[0];
    if (!last) return toast('No previous game yet');
    applyLoadout(last); toast('Loaded last game’s loadout');
  });
  state.loadouts.forEach(s => mk('★ ' + s.name, '', () => { applyLoadout(s); toast(`Loaded “${s.name}”`); }));
  mk('+ Save current', 'ghost', () => {
    if (!f.builds.length && !f.specs.length && !Object.keys(f.weapons).length) return toast('Pick a loadout first');
    $('#saveload').classList.toggle('hide'); $('#saveload-name').focus();
  });
}
export { mountSaved };

function applyLoadout(s) {
  f.builds = [...s.builds]; f.weapons = { ...s.weapons }; f.specs = [...s.specs]; f.specOther = s.specOther || '';
  $('#f-specOther').value = f.specOther;
  mountLoadout(); refresh();
}

const weaponHistory = t => [...new Set(state.entries.map(e => e.weapons[t]).filter(Boolean))].sort((a, b) => a.localeCompare(b));

function mountLoadout() {
  chips($('#c-build'), BUILDS, () => f.builds, v => { f.builds = v; refresh(); }, true);
  chips($('#c-spec'), SPECS, () => f.specs, v => { f.specs = v; refresh(); }, true);
  const w = $('#weapons');
  w.innerHTML = '';
  WTYPES.forEach(t => {
    const on = t in f.weapons, hist = weaponHistory(t);
    const row = document.createElement('div');
    row.className = 'wrow';
    row.innerHTML = `<button type="button" class="chip ${on ? 'on' : ''}">${t}</button>
      <input class="txt ${on ? '' : 'hide'}" list="dl-${t}" autocomplete="off" autocapitalize="characters" placeholder="${t} weapon${hist[0] ? ', e.g. ' + esc(hist[0]) : ''}" value="${esc(f.weapons[t] || '')}">
      <datalist id="dl-${t}">${hist.map(x => `<option value="${esc(x)}">`).join('')}</datalist>`;
    const btn = row.querySelector('button'), inp = row.querySelector('input');
    btn.onclick = () => {
      if (t in f.weapons) delete f.weapons[t]; else f.weapons[t] = '';
      mountLoadout(); refresh();
      if (t in f.weapons) w.querySelector(`input[list="dl-${t}"]`).focus();
    };
    inp.oninput = () => { f.weapons[t] = inp.value; saveDraft(); };
    w.appendChild(row);
  });
  if (!Object.keys(f.weapons).length) {
    const h = document.createElement('div');
    h.className = 'hint'; h.style.marginTop = '0';
    h.textContent = 'Tap one or more weapon types. Names autocomplete from your past games.';
    w.appendChild(h);
  }
}

function setSign(s) {
  rsSign = s;
  $('#rs-plus').classList.toggle('on', s === 1);
  $('#rs-minus').classList.toggle('on', s === -1);
}

function paintKD() {
  const i = $('#f-kd');
  i.classList.remove('kd-bad', 'kd-ok', 'kd-good', 'kd-ruby');
  const t = kdTier(i.value === '' ? '' : +i.value);
  if (t) i.classList.add(t);
}

function refresh() {
  $('#f-modeOther').classList.toggle('hide', f.mode !== 'Other');
  $('#place-wrap').classList.toggle('hide', !placed());
  $('#rs-wrap').classList.toggle('hide', !ranked());
  $('#stage-wrap').classList.toggle('hide', !ranked());
  $('#party-wrap').classList.toggle('hide', !f.squad.includes('Party'));
  $('#f-specOther').classList.toggle('hide', !f.specs.includes('Other'));
  const m = f.map;
  $('#f-mapOther').classList.toggle('hide', !(m === 'LTM' || m === 'Other'));
  $('#f-mapOther').placeholder = m === 'LTM' ? 'Which LTM?' : 'Which map?';
  if (!f.kdManual) {
    const k = parseFloat(f.kills), d = parseFloat(f.deaths);
    const auto = !isNaN(k) && !isNaN(d) ? (d > 0 ? (k / d).toFixed(2) : k.toFixed(2)) : '';
    f.kd = auto; $('#f-kd').value = auto;
    $('#kd-stat').classList.toggle('auto', auto !== '');
  } else $('#kd-stat').classList.remove('auto');
  paintKD();
  saveDraft();
}

export function mountEntry() {
  if (!f.tsManual && !editingId) f.ts = Date.now();
  $('#f-ts').value = toLocalInput(f.ts);
  chips($('#c-mode'), MODES, () => f.mode, v => { f.mode = v; refresh(); });
  mountResult();
  chips($('#c-place'), PLACES, () => f.place, v => {
    f.place = v;
    if (v) { f.result = v === 1 ? 'W' : 'L'; f.stage = stageFor(v); mountResult(); mountStage(); }
    refresh();
  });
  mountStage();
  mountSquad();
  chips($('#c-psize'), [2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => ({ v: n, l: String(n) })), () => f.partySize, v => { f.partySize = v; refresh(); });
  $('#f-teammate').innerHTML = '<option value="">Select…</option>' + SKILL.map(s => `<option ${f.teammate === s ? 'selected' : ''}>${s}</option>`).join('');
  chips($('#c-med'), ['Yes', 'No'], () => f.med, v => { f.med = v; refresh(); });
  chips($('#c-mental'), MENTAL, () => f.mental, v => { f.mental = v; refresh(); });
  chips($('#c-lag'), LAG, () => f.lag, v => { f.lag = v; refresh(); });
  mountSaved();
  mountLoadout();
  $('#f-map').innerHTML = '<option value="">Select map…</option>' + MAPS.map(m => `<option>${m}</option>`).join('') + '<option disabled>──────────</option><option>LTM</option><option>Other</option>';
  $('#f-map').value = f.map;
  ['modeOther', 'specOther', 'mapOther', 'notes'].forEach(k => { $('#f-' + k).value = f[k]; });
  $('#f-rs').value = f.rs === '' ? '' : Math.abs(f.rs);
  if (editingId) setSign(f.rs === '' ? null : f.rs < 0 ? -1 : 1); else setSign(rsSign);
  $('#f-k').value = f.kills; $('#f-d').value = f.deaths; $('#f-kd').value = f.kd;
  $('#editbar').classList.toggle('hide', !editingId);
  $('#save').textContent = editingId ? 'Update entry' : 'Save game';
  refresh();
}

// Called whenever the Entry tab is shown: keep the auto time current
export function onShowEntry() {
  if (!f.tsManual && !editingId) { f.ts = Date.now(); $('#f-ts').value = toLocalInput(f.ts); }
}

function resetForm() {
  editingId = null; rsSign = null;
  f = blankForm();
  clearDraft();
  mountEntry();
}

function saveEntry() {
  if (!f.mode) return toast('Pick a game mode');
  if (f.kd === '' && f.kills === '') return toast('Enter kills/deaths or a K/D');
  if (f.kd !== '' && isNaN(+f.kd)) return toast('K/D needs to be a number');
  const rsv = $('#f-rs').value.trim();
  if (ranked() && rsv !== '' && !rsSign) return toast('Pick + or − for RS');
  if (ranked() && rsv !== '' && isNaN(parseInt(rsv))) return toast('RS needs to be a number');
  const party = f.squad.includes('Party');
  const e = {
    id: editingId ?? nextId(),
    ts: f.tsManual || editingId ? f.ts : Date.now(),
    mode: f.mode, modeOther: f.mode === 'Other' ? f.modeOther.trim() : '',
    result: f.result,
    place: placed() ? f.place : null,
    stage: ranked() ? f.stage : null,
    rs: ranked() && rsv !== '' ? rsSign * Math.abs(parseInt(rsv)) : null,
    kills: f.kills === '' ? null : +f.kills,
    deaths: f.deaths === '' ? null : +f.deaths,
    kd: f.kd === '' ? null : +(+f.kd).toFixed(2),
    kdManual: f.kdManual,
    squad: f.squad.length ? [...f.squad] : ['Solo'],
    partySize: party ? f.partySize : null,
    teammate: party ? f.teammate : null,
    med: f.med, mental: f.mental, lag: f.lag || 'None',
    builds: [...f.builds],
    weapons: Object.fromEntries(Object.entries(f.weapons).map(([k, v]) => [k, v.trim()])),
    specs: [...f.specs], specOther: f.specs.includes('Other') ? f.specOther.trim() : '',
    map: f.map, mapOther: (f.map === 'LTM' || f.map === 'Other') ? f.mapOther.trim() : '',
    notes: f.notes.trim(),
  };
  if (editingId) {
    state.entries = state.entries.map(x => x.id === editingId ? e : x);
    toast('Entry updated');
  } else {
    state.entries.push(e);
    state.carry = { squad: e.squad, partySize: e.partySize, teammate: e.teammate, med: e.med };
    toast('Game saved ✓');
  }
  save('entries', 'carry');
  resetForm();
  showTab('record');
}

export function editEntry(id) {
  const e = state.entries.find(x => x.id === id);
  if (!e) return;
  editingId = id;
  f = {
    ...e, tsManual: true, rs: e.rs ?? '', kills: e.kills ?? '', deaths: e.deaths ?? '', kd: e.kd ?? '',
    weapons: { ...e.weapons }, builds: [...e.builds], specs: [...e.specs], squad: [...e.squad],
    modeOther: e.modeOther || '', specOther: e.specOther || '', mapOther: e.mapOther || '', notes: e.notes || '', map: e.map || '',
  };
  showTab('entry');
  mountEntry();
}

export function initEntry() {
  f = loadDraft() || blankForm();
  $('#rs-plus').onclick = () => { setSign(rsSign === 1 ? null : 1); if (rsSign === 1) { f.result = 'W'; mountResult(); } saveDraft(); };
  $('#rs-minus').onclick = () => { setSign(rsSign === -1 ? null : -1); if (rsSign === -1) { f.result = 'L'; mountResult(); } saveDraft(); };
  $('#f-ts').oninput = e => { const t = new Date(e.target.value).getTime(); if (!isNaN(t)) { f.ts = t; f.tsManual = true; saveDraft(); } };
  $('#f-k').oninput = e => { f.kills = e.target.value.replace(/\D/g, ''); e.target.value = f.kills; refresh(); };
  $('#f-d').oninput = e => { f.deaths = e.target.value.replace(/\D/g, ''); e.target.value = f.deaths; refresh(); };
  $('#f-kd').oninput = e => {
    f.kd = e.target.value.replace(',', '.'); f.kdManual = f.kd !== '';
    if (!f.kdManual) refresh(); else { $('#kd-stat').classList.remove('auto'); paintKD(); saveDraft(); }
  };
  $('#f-rs').oninput = e => { e.target.value = e.target.value.replace(/\D/g, ''); f.rs = e.target.value === '' ? '' : (rsSign || 1) * +e.target.value; saveDraft(); };
  $('#f-teammate').onchange = e => { f.teammate = e.target.value || null; saveDraft(); };
  $('#f-map').onchange = e => { f.map = e.target.value; refresh(); };
  ['modeOther', 'specOther', 'mapOther', 'notes'].forEach(k => { $('#f-' + k).oninput = e => { f[k] = e.target.value; saveDraft(); }; });

  $('#friend-ok').onclick = () => {
    const n = $('#friend-name').value.trim();
    if (!n) return;
    if (['solo', 'party'].includes(n.toLowerCase())) return toast('Pick a different name');
    if (!state.friends.includes(n)) { state.friends.push(n); save('friends'); }
    f.squad = [...f.squad.filter(x => x !== 'Solo' && x !== n), n];
    $('#friend-name').value = ''; $('#friend-add').classList.add('hide');
    mountSquad(); refresh(); toast(`Added ${n}`);
  };
  $('#friend-name').onkeydown = e => { if (e.key === 'Enter') $('#friend-ok').click(); };
  $('#saveload-ok').onclick = () => {
    const n = $('#saveload-name').value.trim();
    if (!n) return;
    state.loadouts = state.loadouts.filter(l => l.name !== n);
    state.loadouts.push({ name: n, builds: [...f.builds], weapons: { ...f.weapons }, specs: [...f.specs], specOther: f.specOther });
    save('loadouts');
    $('#saveload-name').value = ''; $('#saveload').classList.add('hide');
    mountSaved(); toast(`Saved “${n}”`);
  };
  $('#saveload-name').onkeydown = e => { if (e.key === 'Enter') $('#saveload-ok').click(); };
  $('#save').onclick = saveEntry;
  $('#cancel-edit').onclick = resetForm;
  $('#clear-form').onclick = () => { resetForm(); toast('Form cleared'); window.scrollTo(0, 0); };
  mountEntry();
}

