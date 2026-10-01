# Skill Issue

An installable web app (PWA) for logging and graphing THE FINALS games. Plain HTML, CSS and JavaScript with no build step.

## Run it locally

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173. Offline caching is turned off on localhost so edits show up right away (add `?sw` to the URL to test it). Add `?demo` to preview with sample games; nothing is saved in demo mode.

## Personal copy (`me/`)

`me/index.html` is a second install of the same app (PoppaGerbil's), served at `…/skill-issue/me/`. It reads `js/config.js` to pick its own storage, offline cache, mode list and icon, so it never shares data with the public copy. `me/index.html` is generated: after editing `index.html`, run `python3 tools/build_personal.py`.

Personal data (backups, Finals.id exports, `personal-data/`) is git-ignored and must never be committed: this repository is public.

## Put it on your phone

Service workers and "Add to Home Screen" need the app served over **https**, so host this folder on any static host (GitHub Pages, Netlify, Cloudflare Pages, Vercel). Upload the whole folder. `mockup/` can be left out.

On iPhone: open the URL in Safari → Share → **Add to Home Screen**.

## Shipping an update

1. Edit the files.
2. Bump `VERSION` in `sw.js` (and `APP_VERSION` in `js/constants.js`). If `index.html` changed, run `python3 tools/build_personal.py`.
3. Re-upload. Phones pick up the new version the next time the app is opened, then use it on the launch after that.

If you skip step 2, installed copies keep serving the old cached files.

## Data

- Everything is stored in IndexedDB **on the device**. Nothing is sent anywhere.
- Gear icon → **Save backup** writes a `.json` file with every game, name, loadout and preset. **Restore from backup** replaces everything with a backup's contents.
- Record tab exports `.xlsx` and `.csv`; Graph tab exports a `.png` of the chart and a `.csv` of the plotted points.

## Files

| Path | What |
|---|---|
| `index.html` | Page layout for all four tabs |
| `css/app.css` | Styles |
| `js/config.js` | Public vs personal copy settings |
| `me/` | Personal copy (generated page + manifest) |
| `tools/build_personal.py` | Regenerates `me/index.html` |
| `js/main.js` | Startup, tab wiring, service worker registration |
| `js/constants.js` | Modes, maps, specs, placements and other option lists |
| `js/store.js` | IndexedDB storage, defaults, backup/restore |
| `js/entry.js` | Entry form |
| `js/record.js` | Record list, edit/delete |
| `js/graph.js` | Line builder, chart, graph exports |
| `js/stats.js` | Stats tab: totals, ranked/cashout, sessions, highlights, breakdowns |
| `js/filters.js` | Filter fields shared by Graph and Stats |
| `js/demo.js` | Sample data for previewing (`?demo`, never saved) |
| `js/settings.js` | Gear menu (backup, names, loadouts, presets) |
| `js/files.js` | xlsx/csv/json export and the save/share step |
| `sw.js` | Offline cache |
| `vendor/` | Chart.js 4.4.1, SheetJS 0.20.3, html2canvas 1.4.1 |
| `mockup/` | The original clickable mockup (sample data, not used by the app) |

To add a map, spec or mode, edit the lists in `js/constants.js`.
