# Maurseth Gallery — Plan (DRAFT, bootstrapped from code by the repo agent)

> Status: **draft for owner review.** Written by the cardmem Init (Branch C) from the
> code and git history — nothing here is decided until the owner edits/approves it.

## Purpose

Portfolio site for Grethe Mariann Maurseth, visual artist in Aalborg. Replaces the
former WordPress site (maurseth.dk): her works, exhibitions, news and CV, editable by
her (or WebHouse) in @webhouse/cms.

## Current state (shipped)

- **Static site generator** — `build.ts` renders 800+ HTML pages to `dist/`, inline CSS,
  Danish, Cormorant Garamond + Inter, parallax hero, hover effects on the gallery.
- **CMS schema** — `cms.config.ts`: globals, pages (blocks), posts (34), exhibitions (60,
  2005–2026), gallery (760 works).
- **Blocks** — hero, statement, text-section, profile, contact-info, artwork-grid,
  exhibition-list, cv-section, image-gallery.
- **Cross-cutting pages** — tags (incl. æøå), tag detail pages, site index (/siteoversigt/).
- **WordPress migration** — `scripts/migrate.ts` (content + 912 media files, not in git).
- **Post-migration clean-up** — broken images/links, HTML entities, https links, redirects.
- **CI** — fleet secret-gate + security workflows.

## Surface areas

| Area | Routes / files |
|---|---|
| Home | `/` (hero, statement, artwork grid) |
| Gallery | category grids + artwork detail pages |
| Exhibitions | list by year + detail pages |
| News | posts list + detail |
| Profile / CV / Contact / Atelier | block pages |
| Tags + Oversigt | `/tags/`, `/tags/<tag>/`, `/siteoversigt/` |

## What's next (proposals — owner decides)

1. **Hosting & deploy** — where does `dist/` live in production, and how is it deployed?
   No deploy config is in the repo (`deploy/` is gitignored). Make the deploy a scripted,
   verifiable step.
2. **Mail templates owed to cardmem** — enduser + internal (cards `mail.1`, `mail.2`).
3. **Terms/GDPR** — legal pages + ProductFacts (card `init.6`), likely via `@broberg/legal`.
4. **Lens readiness** — `data-testid` on nav, gallery filters, tag pills, contact links,
   so Lens can verify the site (see `TESTID-CONVENTION.md`).
5. **Mobile check** — verify no sideways scroll at 393px across all page types.
6. **Error monitoring** — enroll in Upmetrics (client-side errors on the static site).

## Open questions for the owner

1. Is maurseth.dk already served from this build, or is the cut-over from WordPress still pending?
2. Who edits content day to day — Grethe herself in the CMS admin, or WebHouse?
3. Is anything new planned for the site (e.g. shop/sale of works, newsletter, English version)?
