// All data lives in IndexedDB on this device. Everything is loaded into `state` at startup
// and each key is written back whenever it changes.
import { COLORS, FIXED_FRIEND } from './constants.js';
import { toast, uid } from './util.js';

const DB_NAME = 'skill-issue', STORE = 'kv', SCHEMA = 1;
let dbp;
function openDb() {
  return dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function dbGet(k) {
  const db = await openDb();
  return new Promise((res, rej) => { const r = db.transaction(STORE).objectStore(STORE).get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function dbSet(k, v) {
  const db = await openDb();
  return new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}

export const line = (name, color, filters = {}) => ({ id: uid(), name, color, hidden: false, filters });

const defaults = () => ({
  entries: [],
  friends: [FIXED_FRIEND],
  loadouts: [],
  presets: [
    { name: 'Everything', lines: [line('All games', COLORS[0])] },
    { name: 'Medium vs Heavy', lines: [line('Medium', COLORS[1], { build: ['Medium'] }), line('Heavy', COLORS[0], { build: ['Heavy'] })] },
    { name: 'Weapon compare', lines: [line('Medium + Auto', COLORS[1], { build: ['Medium'], weapon: ['Automatic'] }), line('Medium + Poke', COLORS[2], { build: ['Medium'], weapon: ['Poke'] }), line('Heavy Kyoto/Seoul Ranked', COLORS[0], { build: ['Heavy'], map: ['Kyoto', 'Seoul'], mode: ['Ranked'] })] },
    { name: `Solo vs ${FIXED_FRIEND} vs Party`, lines: [line('Solo', COLORS[4], { squad: ['Solo'] }), line(FIXED_FRIEND, COLORS[6], { squad: [FIXED_FRIEND] }), line('Party', COLORS[2], { squad: ['Party'] })] },
  ],
  graph: { metric: 'kd', range: 0, view: 'game', lines: [line('All games', COLORS[0])] },
  carry: null,   // squad / party size / teammate skill / medicated carried to the next entry
});

export const KEYS = Object.keys(defaults());
export const state = defaults();

export async function load() {
  for (const k of KEYS) {
    const v = await dbGet(k);
    if (v !== undefined) state[k] = v;
  }
  if (!state.friends.includes(FIXED_FRIEND)) state.friends.unshift(FIXED_FRIEND);
  await dbSet('schema', SCHEMA);
  // Ask the browser not to evict our data under storage pressure
  navigator.storage?.persist?.().catch(() => {});
}

export function save(...keys) {
  return Promise.all(keys.map(k => dbSet(k, state[k]))).catch(e => toast('Couldn’t save: ' + e.message));
}

export const nextId = () => state.entries.reduce((m, e) => Math.max(m, e.id), 0) + 1;

// Backup / restore of everything as one JSON object
export const snapshot = () => ({ app: 'skill-issue', schema: SCHEMA, exportedAt: new Date().toISOString(), ...Object.fromEntries(KEYS.map(k => [k, state[k]])) });
export async function restore(obj) {
  if (obj?.app !== 'skill-issue' || !Array.isArray(obj.entries)) throw new Error('That file isn’t a Skill Issue backup');
  const d = defaults();
  for (const k of KEYS) state[k] = obj[k] ?? d[k];
  if (!state.friends.includes(FIXED_FRIEND)) state.friends.unshift(FIXED_FRIEND);
  await save(...KEYS);
}
