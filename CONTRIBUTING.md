# Contributing to Tyndale

Tyndale separates **committed registry config** from **built content** and **runtime state**. You edit a flat JSON file in `registry/`; deploy runs `sync-content` to fetch only new or changed entries.

## Directory layout

| Path | Committed? | Purpose |
|------|------------|---------|
| `registry/*.json` | Yes | Content catalog (id, name, source URL or URI) |
| `content/` | No (gitignored) | Built indexes produced by `sync-content` |
| `STATE_DIR` (default `~/.tyndale`) | No | Guild/user preferences, analytics, devotional schedules |

Environment variables (see `.env.example`):

- `CONTENT_DIR` — where built content is written (default: `./content`)
- `STATE_DIR` — where runtime preference files live (default: `~/.tyndale`; use e.g. `/var/tyndale` in production)

## First-time setup

```bash
npm install
npm run sync-content -- --full   # or: npm run build-data
cp .env.example .env
npm run dev
```

If you have an older checkout with files under `data/`, `sync-content` migrates built content into `content/` automatically. Preference files in `data/` are copied to `STATE_DIR` on bot startup.

## Deploy workflow

```bash
npm run sync-content    # diff registry vs content; fetch only new/changed
npm start
```

Use `sync-content --full` (alias: `npm run build-data`) to rebuild everything locally. Use `--prune` to remove built files for registry entries that were deleted.

## Add a church history person

Edit [`registry/people.json`](registry/people.json). Add one object:

```json
{
  "id": "john-calvin",
  "name": "John Calvin",
  "aliases": ["Calvin"],
  "categories": ["reformer"],
  "source": "wikipedia:John Calvin"
}
```

- `id` — stable slug used in URLs and file names
- `categories` — one or more of `reformer`, `puritan`, `martyr`
- `source` — `wikipedia:{title}` for the English Wikipedia article title

Open a PR. After merge, deploy runs `sync-content` and fetches only that person.

## Add a Bible translation

Edit [`registry/translations.json`](registry/translations.json):

```json
{
  "id": "web",
  "name": "World English Bible",
  "source": "https://…/complete-bible.json",
  "poetrySource": "https://ebible.org/Scriptures/engwebp_usfm.zip"
}
```

- `source` — JSON bible file (WEB format or scrollmapper format)
- `poetrySource` — ebible.org USFM zip for literary layout

Deploy syncs one new translation plus its poetry file.

## Add a confession

Edit [`registry/confessions.json`](registry/confessions.json):

```json
{
  "id": "wcf",
  "name": "Westminster Confession of Faith",
  "abbrev": "WCF",
  "source": "ccel:westminster3"
}
```

Confession sources use the `ccel:` prefix for [Christian Classics Ethereal Library](https://www.ccel.org/) texts:

- `ccel:westminster3` — Westminster Confession (CCEL westminster3 reader). Sync maps CCEL pages to standard 1646 chapter numbers (1–33) and uses Creeds.json for chapter 24 (marriage), since CCEL’s PCUSA edition replaces that chapter.
- `ccel:lbcf` — 1689 London Baptist Confession (`creeds/bcf/bcfc*.htm`)

Legacy Creeds.json URLs (`https://…/*.json`) are still supported if needed.

## Add a devotional

Edit [`registry/devotionals.json`](registry/devotionals.json) with `id`, `name`, and `source` URL.

## Auditing people summaries

After syncing people content:

```bash
npx tsx scripts/audit-church-people-summaries.ts
```

## Tests

```bash
npm test
npm run typecheck
npm run lint
```
