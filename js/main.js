import { load, state, setDemo } from './store.js';
import { demoData } from './demo.js';
import { $, $$, toast } from './util.js';
import { showTab, onTabShow } from './nav.js';
import { initEntry, onShowEntry } from './entry.js';
import { initRecord, renderRecord } from './record.js';
import { initGraph, renderGraph } from './graph.js';
import { openSettings } from './settings.js';
import { initStatsTab, renderStats } from './stats.js';

async function start() {
  try { await load(); }
  catch (e) { toast('Storage unavailable: games won’t be saved'); console.error(e); }
  if (new URLSearchParams(location.search).has('demo')) {
    setDemo();
    Object.assign(state, demoData());
    document.body.classList.add('demo');
  }

  onTabShow('entry', onShowEntry);
  onTabShow('record', renderRecord);
  onTabShow('stats', renderStats);
  onTabShow('graph', renderGraph);
  $$('nav.bottom button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
  $('#settings').onclick = openSettings;

  initEntry();
  initRecord();
  initGraph();
  initStatsTab();
  showTab('entry');

  // Keep the auto date/time fresh when coming back to the app
  document.addEventListener('visibilitychange', () => { if (!document.hidden && $('#tab-entry').classList.contains('active')) onShowEntry(); });
}

start();

// Offline caching is skipped on localhost so edits show up immediately while developing
const isDev = ['localhost', '127.0.0.1'].includes(location.hostname) && !location.search.includes('sw');
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !isDev) {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW registration failed', e));
}
