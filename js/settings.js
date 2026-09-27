// Gear menu: backup/restore and managing names, saved loadouts and presets
import { APP_VERSION, FIXED_FRIEND } from './constants.js';
import { state, save, snapshot, restore } from './store.js';
import { $, esc, toast, openSheet, confirmTap } from './util.js';
import { exportBackup, pickFile } from './files.js';
import { mountSquad, mountSaved } from './entry.js';

function list(items, empty) {
  return items.length
    ? items.map((it, i) => `<div class="mrow"><span>${esc(it)}</span><button class="btn sm" data-i="${i}">Delete</button></div>`).join('')
    : `<div class="hint" style="margin:0">${empty}</div>`;
}

export function openSettings() {
  openSheet((sh, close) => {
    const render = () => {
      const others = state.friends.filter(n => n !== FIXED_FRIEND);
      sh.innerHTML = `<div class="grab"></div>
        <div class="sheethead"><span></span><b>Settings & data</b><button class="btn primary" id="st-close">Done</button></div>

        <div class="card">
          <div class="lbl">Backup</div>
          <div class="hint" style="margin:0 0 10px">Your games are stored only on this device. Save a backup now and then (Files, iCloud Drive, email to yourself), and use it to move your data to a new phone.</div>
          <div class="row"><button class="btn primary" id="st-backup">Save backup</button><button class="btn" id="st-restore">Restore from backup</button></div>
          <div class="hint">${state.entries.length} game${state.entries.length === 1 ? '' : 's'} on this device.</div>
        </div>

        <div class="card">
          <div class="lbl">Names</div>
          <div class="mrow"><span>${FIXED_FRIEND}</span><span class="hint" style="margin:0">always there</span></div>
          <div id="st-friends">${list(others, 'Names you add with “+ Add name” show up here.')}</div>
          <div class="hint">Deleting a name only removes it from the picker. Past games keep it.</div>
        </div>

        <div class="card">
          <div class="lbl">Saved loadouts</div>
          <div id="st-loadouts">${list(state.loadouts.map(l => l.name), 'Save a loadout from the Entry tab with “+ Save current”.')}</div>
        </div>

        <div class="card">
          <div class="lbl">Graph presets</div>
          <div id="st-presets">${list(state.presets.map(p => p.name), 'No presets.')}</div>
        </div>

        <div class="hint" style="text-align:center">Skill Issue v${APP_VERSION}</div>`;

      $('#st-close').onclick = close;
      $('#st-backup').onclick = () => exportBackup(snapshot());
      $('#st-restore').onclick = async () => {
        const file = await pickFile('application/json,.json');
        if (!file) return;
        let obj;
        try { obj = JSON.parse(await file.text()); } catch { return toast('That file isn’t a Skill Issue backup'); }
        const n = obj?.entries?.length ?? 0;
        const btn = $('#st-restore');
        btn.textContent = `Replace everything with ${n} games from backup?`;
        btn.classList.add('danger');
        btn.onclick = async () => {
          try { await restore(obj); } catch (e) { return toast(e.message); }
          toast(`Restored ${n} games`); close(); location.reload();
        };
      };
      sh.querySelectorAll('#st-friends [data-i]').forEach(b => b.onclick = () => confirmTap(b, 'Sure?', () => {
        const name = others[+b.dataset.i];
        state.friends = state.friends.filter(n => n !== name);
        save('friends'); mountSquad(); render();
      }));
      sh.querySelectorAll('#st-loadouts [data-i]').forEach(b => b.onclick = () => confirmTap(b, 'Sure?', () => {
        state.loadouts.splice(+b.dataset.i, 1); save('loadouts'); mountSaved(); render();
      }));
      sh.querySelectorAll('#st-presets [data-i]').forEach(b => b.onclick = () => confirmTap(b, 'Sure?', () => {
        state.presets.splice(+b.dataset.i, 1); save('presets'); render();
      }));
    };
    render();
  });
}

