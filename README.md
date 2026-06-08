# World Cup 2026 Sticker Album Tracker ⚽

A local-first Vue 3 + TypeScript app for tracking your **Panini FIFA World Cup 2026 sticker collection** (980 stickers). Models the album's page structure, lets you click slots to mark what you own, quickly log codes off the sticker backs, find swaps against a friend's collection, and export a paste-ready "needs" list. (Unofficial; not affiliated with FIFA or Panini.)

Everything is stored **locally in your browser** (`localStorage`) - no backend, no account.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check + production build into dist/
npm run typecheck  # vue-tsc --noEmit
npm run preview    # serve the production build
```

## The views

| View | Route | What it's for |
|------|-------|---------------|
| **📖 Album** | `/` | The visual book. Navigate section-by-section; each team has a two-page spread (page 1: foil badge + players 2–12; page 2: team photo + players 14–20, 4-column grid). Click a slot to toggle ownership; use +/– to track spares. |
| **⌨️ Quick Add** | `/add` | Rapidly log codes off the sticker backs. Type or paste a batch (`ARG5`, `ARG 5`, `arg 5, arg6`); each is flagged new / spare / unknown, with undo. |
| **✅ Checklist** | `/checklist` | The fast data view. Search/filter/sort all 48 teams, see completion at a glance, expand a team to tick stickers off in a dense list. |
| **📝 Needs & Swaps** | `/needs` | Generate a paste-ready text list of the stickers you still need and your spares, plus JSON backup import/export. |
| **🔁 Trade** | `/trade` | Load a friend's exported collection and match it against yours: the spares you can give them, and the ones they can give you. |

A header **Export** button downloads your collection as JSON from any view.

## The album data

- **Publisher:** Panini.
- **980 base stickers:** 20 intro/special (Panini logo `00`, emblem, hosts, FIFA Museum legends - all foil) + **48 teams × 20**.
- **Per team (20):** 1 foil team badge (`#1`) + 18 players + 1 team photo (`#13`).
- **Order:** by tournament group A→L. Numbering uses country codes (`BRA1`…`BRA20`).

### Player names

Each team's 18 player slots use **player names in Panini's printed checklist order**, so sticker numbers line up with the checklist (e.g. Alexis Vega is `MEX18`). Each player carries a **position** (shown as a coloured GK/DEF/MID/FWD badge). A **club** is also stored in the data but is **not shown in the UI**.

Squad data lives in [`src/data/squad-rosters/`](src/data/squad-rosters/) as one JSON file per group. To correct a name/club or swap a player, edit the relevant `group-*.json` - the album rebuilds from it automatically.

### Caveats / what you may want to tweak

- Player **names and order** follow the published Panini checklist; **clubs** are editable metadata and are not shown in the UI.
- The intro section labels live in `src/data/album.ts`.
- Pixel-level album matching would require page scans; the current layout is a structural model.

## Project structure

```
src/
  data/album.ts          # catalogue types + generator
  data/squads.ts         # merges the per-group rosters into SQUADS
  data/squad-rosters/    # group-a.json … group-l.json - 18-player squads
  stores/collection.ts   # Pinia store: counts, stats, localStorage, parse/import/export
  router/index.ts        # routes for the five views (hash history)
  components/StickerSlot.vue   # one clickable sticker slot (owned/empty/foil + spares)
  components/album/             # AlbumRail, TeamSpread, SpecialPage (album view pieces)
  components/base/              # BaseButton, BaseChip (design-system wrappers)
  views/AlbumView.vue          # visual two-page-spread book
  views/QuickAddView.vue       # rapid code entry
  views/ChecklistView.vue      # searchable team checklist
  views/NeedsView.vue          # text export + swaps + JSON backup
  views/SwapView.vue           # compare a friend's collection (Trade)
  styles/theme.css       # design tokens (palette, semantic colours, gold foil)
  styles/album-page.css  # shared album-page primitives (spread, team header, grid)
```

To change the catalogue, edit the data layer: player names/clubs live in **`src/data/squad-rosters/group-*.json`**, and the album structure (sections, slots, intro/specials) lives in **`src/data/album.ts`**. Every view and the store derive from these. Your saved collection is keyed by sticker code, so edits that keep codes stable won't lose your progress.

## Backups

Your collection lives in `localStorage` under `wc2026-collection-v1`. Use the header **Export** button (or **Needs & Swaps → Export backup**) to download a JSON file, and **Needs & Swaps → Import backup** to restore it (e.g. on another device/browser). The same file format is what the **Trade** view reads to compare a friend's collection.
