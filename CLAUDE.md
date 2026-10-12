# Shrine Process — Claude Code guide

Mobile-first PWA for coordinating the daily shrine process at the 11 shrines. One
Brahmachari covers all 11 shrines for a 3-day slot; four slots make a 12-day batch. The
coordinator uses the app to track confirmation, kit collection and completion, copy
pre-filled messages, and share a self-booking link.

The owner works almost entirely from the Claude mobile app. Keep replies short, finish
work end to end, and push when done.

## Specs — the source of truth

All requirements live in `docs/specs/`. Read them in order; **later documents override
earlier ones** where they conflict, and each CR lists what it supersedes.

| File | Covers | Status |
|---|---|---|
| `00-spec-v1.md` | Original build spec: data model, slot arithmetic, derived state, templates | Built |
| `CR01.md` | Status model, never-done seed, write-queue fixes, tap-to-expand, dark fire design system | Built |
| `CR02.md` | State-oscillation fix, writes persisting, Schedule Yourself card states, templates in the sheet | Built (CR-118 to CR-133 finished with CR03–05) |
| `CR03.md` | Icon-only link button, inline roster count, duplicate audit, availability updates | Built — roster fixes run from `apps-script/Maintenance.gs`, see `docs/cr03-report.md` |
| `CR04.md` | Remove person, slot notes, "Schedule change" section, Availability request template | Built |
| `CR05.md` | Request tracking on the List tab, Mark confirmed, auto-resolution, requested line on TBD cards | Built |

When a CR is implemented, update its status in this table in the same commit.

Requirement IDs (`CR-n`) are referenced across documents — cite them in commit messages.

## Architecture

- **Frontend:** React 19 + TypeScript + Vite, Tailwind v4, Zustand, `lucide-react`,
  `vite-plugin-pwa`. Routes: `/` coordinator app, `/book` self-booking (no nav).
- **Backend:** Google Apps Script web app over a Google Sheet (`apps-script/`). Sheet is
  the datastore; templates live in its `Templates` tab.
- **Hosting:** Vercel. `public/sop.html` is the coordinator SOP, served at `/sop`.

Key files: `src/store/` (state + write queue), `src/lib/applyWrite.ts` (optimistic
writes, mirrored by `apps-script/Code.gs`), `src/lib/derived.ts` (slot and status
logic), `src/lib/requests.ts` (CR05 request rules), `src/lib/slots.ts` (date
arithmetic), `src/lib/templates.ts`, `src/config/` (constants), `src/api/client.ts`.

Every write action exists twice — `applyWrite` on the client and a handler in `Code.gs` —
and must behave the same in both. Add new actions to `mutationKey` and
`mutationFieldKey` too.

## Rules that must not regress

- **Never roll back an optimistic coordinator write** (CR-14). Queued mutations are
  authoritative for their field until the server acknowledges (CR-100 to CR-110). The one
  exception: Mark confirmed rejected with `reason: "filled"` (CR-183).
- **No background polling in the coordinator app** — only `/book` polls (CR-102).
- **Apps Script POSTs use `Content-Type: text/plain;charset=utf-8`** with JSON in the
  body. `application/json` triggers a CORS preflight that Apps Script rejects (CR-18).
- **Never import `lastDone`** from any CSV or sheet (CR-116).
- Nothing coordinator-only may be reachable from `/book`.
- Stable React keys (person id, slot index) and memoised sorts — no re-sort on render
  (CR-107).

## Two sheets

- **Backend sheet** ("Shrine process (pwa backend)") — the app's datastore, every field.
- **BR Process 2026** — the original sheet others read. `mirrorToBrSheet` in `Code.gs`
  writes only the person's name into its Shrine Process column whenever a slot's person
  changes, by any route. It never fails the app's write.
- Until the app was connected, the schedule lived only in the coordinator's phone. On first
  connect the app sends it up with `seedFromApp`, which the server accepts only while the
  Slots tab is empty.

## Apps Script changes

Edits to `apps-script/*.gs` do nothing until deployed. Claude cannot deploy them. After
changing a `.gs` file, tell the owner plainly: paste the file into the Apps Script
editor, then **Deploy → Manage deployments → Edit → New version**. Re-deploying as a new
version keeps the same URL; a fresh deployment changes it and breaks the app.

## Working here

```bash
npm install
npm test          # vitest
npm run lint      # oxlint
npm run build     # tsc + vite build
```

Run tests and build before every push. Work on `main` unless asked otherwise; Vercel
deploys from it.

## Other docs

- `docs/handover.md` — one-page coordinator handover note
- `public/sop.html` — full illustrated SOP (live at `/sop`)
