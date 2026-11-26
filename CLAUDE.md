# Maurseth Gallery — Development Instructions

## Overview

Artist portfolio for **Grethe Mariann Maurseth**, billedkunstner (visual artist) in Aalborg, Denmark. Migrated from WordPress (maurseth.dk) to @webhouse/cms.

## Architecture

- **Static site** with `build.ts` — generates 810+ HTML pages
- **Storage:** Filesystem adapter (`content/` directory)
- **Language:** Danish (`lang="da"`)
- **Fonts:** Cormorant Garamond (headings) + Inter (body)
- **Effects:** Parallax hero, Elina Voss hover effects on gallery

## Collections

| Collection | Count | Description |
|---|---|---|
| globals | 1 | Site settings, contact info, social links |
| pages | 11 | Blocks-based pages (hero, text, gallery, contact, exhibitions, CV) |
| posts | 34 | Blog/news articles |
| exhibitions | 60 | Exhibition history 2005-2026 |
| gallery | 760 | Artwork items (paintings, graphics, collages) |

## Block Types

- `hero` — Parallax hero with background image
- `text-section` — Richtext content section
- `profile` — Bio + portrait image (2-column)
- `contact-info` — Address, email, phone
- `artwork-grid` — Gallery grid with hover effects (filterable by category)
- `exhibition-list` — Exhibitions grouped by year
- `cv-section` — CV content section
- `image-gallery` — Image gallery from image-gallery field

## Media

912 media files in `media/` (359 MB). NOT in git — re-run `npx tsx scripts/migrate.ts` to download.

## Commands

```bash
npx tsx scripts/migrate.ts  # Re-run WordPress migration
npx tsx build.ts            # Build static site → dist/
npx sirv dist --port 3011   # Preview locally
```

## Critical Rules

- **cms.config.ts is protected** — never remove fields from existing collections
- **All content is CMS-editable** — never hardcode content in build.ts
- **Inline CSS only** — no CDN scripts (Tailwind, Bootstrap, etc.)
- **BASE_PATH / BUILD_OUT_DIR** — always use env vars for paths

## Project layout

> **Fill this in for THIS repo.** Every cardmem-compatible repo MUST have a `## Project layout` section with the columns `Area | Path | Notes`. The cardmem Init flow (or the `feature` skill) populates it from the repo's actual structure — replace the example rows below.

| Area | Path | Notes |
|---|---|---|
| _(example — replace)_ App | `src/` | Main application code |
| _(example — replace)_ Tests | `tests/` | Test suites |

Replace the example rows above with this repo's real layout before relying on cardmem skills to scope changes.


## Fleet rules (cardmem-owned)

@.claude/fleet.md
@.claude/decisions-index.md

