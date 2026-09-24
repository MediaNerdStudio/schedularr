# Schedularr

Comprehensive music scheduling application for radio stations, inspired by Powergold and MusicMaster.

## Stack

- Backend: Node.js + Express 5, ESM, Mongoose ODM
- Frontend: Vite 8 + React 19 + Tailwind CSS 4 + DaisyUI 5 + AG Grid 36 + lucide-react
- Database: MongoDB 7 (remote at 192.168.88.10:27017, database: Schedularr)
- Reference docs: `Development/MusicMaster_en/` and `Development/Powergold/` (decompiled CHM help files)

## Setup

```
npm install
cd ui && npm install
```

Create `.env` in the project root (see `.env.example`):

```
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb://192.168.88.10:27017/Schedularr
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
JWT_SECRET=...
ADMIN_PASSWORD=...
```

## Run

Development (backend + Vite HMR, API on :3001, UI on :3000):

```
npm run dev
```

Production build & start (serves everything from one port):

```
npm run build
npm start
```

## Verification

```
npm run lint
npm run build
```

## Architecture

### Data Models (server/models/)

- **Station** — radio stations and sub-channels; all share the same song database. Supports parent/child hierarchy (e.g., Radio 538 → 538 Nonstop, 538 Dance Department).
- **Artist** — separate collection for artist separation logic. Links to Spotify data. Supports aliases and separation groups.
- **Song** — extended metadata: core fields, multiple artist refs, album data, audio properties (intro/outro/cue/hook), classification (genre/mood/energy/tempo/era), rotation labels (Hit, TOTH, A/B/C rotation, Gold, etc.), chart history, Spotify audio features, custom key/value properties, keywords, dayparting grid, weight. External IDs for: Spotify, YouTube, OmniPlayer (ItemCode + TitleId), Propfrexx, RadioDJ, mAirList, generic automation.
- **Category** — groups of songs by rotation type. Contains folders (sub-groups with exposure %). Category-level rules (separation, search depth, max plays). Types: music, non-music, imaging, jingle, liner, promo, news, traffic, other.
- **Clock** — hour template with ordered elements. Element types: fixed, migrating, block, note, command, artist-block, flow-list, traffic, time-marker, imaging, special-set. Supports Fixed Position and Natural Flow (pinned/unpinned) modes.
- **AssignmentGrid** — 168-cell weekly grid (7 days × 24 hours) mapping each hour to a clock.
- **FormatCalendar** — grid rotation schedule and date-specific overrides per station.
- **Rule** — scheduling rules: song/artist/title/CD separation, max plays, dayparting, property constraints, mood/energy/tempo flow, keyword separation. Breakable vs unbreakable severity with priority.
- **Block** — mini-format: self-contained sequence of elements (e.g., "20 min dance block").
- **Chart** — in-house chart with weekly entries, rank tracking, movement indicators.
- **ScheduleHour** — generated schedule per station/date/hour with items, rule violations, reconciliation status.
- **PlayHistory** — play log for scheduling lookups and reconciliation.

### API Routes (server/routes/)

All routes under `/api/`:

| Route | Resource |
|-------|----------|
| `/api/stations` | Station CRUD |
| `/api/artists` | Artist CRUD + search |
| `/api/songs` | Song CRUD + search/filter + bulk update |
| `/api/categories` | Category CRUD + song assignment |
| `/api/clocks` | Clock CRUD + duplicate |
| `/api/grids` | Assignment Grid CRUD + hour assignment + Format Calendar |
| `/api/charts` | Chart CRUD + sync to songs |
| `/api/blocks` | Block CRUD |
| `/api/rules` | Rule CRUD |
| `/api/schedules` | Schedule CRUD + play history |
| `/api/health` | Health check |

### Frontend Pages (ui/src/pages/)

- **StationsPage** — manage stations with parent/child grouping
- **LibraryPage** — AG Grid song library with search, category/rotation filters
- **SongDetailPage** — tabbed song editor: General, Audio, Classification, Artists, Album, Charts, External IDs, Spotify Features, Scheduling
- **CategoriesPage** — category management grouped by type, with separation rules
- **ClocksPage** — clock list per station
- **ClockEditorPage** — visual clock builder with element list + pie chart view
- **GridsPage** — 7×24 assignment grid editor
- **BlocksPage** — mini-format block editor
- **ChartsPage** — chart management with entry table
- **RulesPage** — rule management with type groups and severity
- **SchedulePage** — daily schedule view per station with expandable hours

### Scheduling Engine (server/lib/scheduler.js)

The core scheduling engine evaluates clocks, categories, and rules to fill each hour:

1. Looks up the assignment grid to find which clock applies to each hour
2. Walks through clock elements and picks songs from the assigned category
3. Evaluates rules (song separation, artist separation, title separation, max plays, dayparting)
4. Scores candidates using Optimum Goal Scheduling (weighted tie-breaking: rest time, weight, artist spread)
5. Picks the best candidate that doesn't violate unbreakable rules
6. Builds a running play log across hours to enforce cross-hour separation

API endpoints:
- `POST /api/schedules/run` — run the scheduler for a station/date/hour range
- `POST /api/schedules/clear` — clear scheduled hours

### Data Import (server/import-tsv.js)

Bulk import from OmniPlayer TSV export. Maps columns to Song model fields including:
- Title, artist, album, duration, year, BPM, category
- Rotation labels (HIT, TOTH, Album Track, A/B/C-Rotation)
- Chart tags (Top40, Tipparade)
- External IDs (OmniPlayer titleId, itemCode, Spotify ID, ISRC)
- Custom properties (quality, version, remarks)

Usage: `node server/import-tsv.js [--file <path>] [--skip-existing] [--batch-size 500]`

## Feature Roadmap

### Next — Scheduling Improvements
- Manual-assist mode (schedule one position at a time with candidate list)
- Auto Editor (multi-pass violation optimizer)
- Schedule recap and analysis
- Natural Flow scheduling (Powergold-style)
- Migrating elements with FlexRules

### Phase 3 — Integration
- Reconciliation API (live playout reconciliation)
- Automation system export (OmniPlayer, Propfrexx, RadioDJ, mAirList)
- Spotify API integration for metadata + audio features enrichment
- Radio imaging category integration
- Traffic merge support

### Phase 4 — Advanced
- Natural Flow scheduling (Powergold-style)
- Migrating elements with FlexRules
- Special Sets (two-fers, artist blocks)
- Policies and daypart rule groups
- Block Programming (isolated schedule zones)
- Analysis tools (layout analysis, turnover, coding analysis)
- Format Calendar with grid rotation

## Notes

- Express 5 uses path-to-regexp v8; catch-all routes must use `{*path}` instead of `*`.
- The Song model's `language` field conflicts with MongoDB text index's reserved `language` field. Resolved with `language_override: 'searchLanguage'` on the text index.
- Multi-station design: all stations share the same Song/Artist/Category collections. Clocks, Grids, Schedules, and Rules are scoped per station.
