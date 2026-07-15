# Jillie

A local-first installable web app (PWA) for tracking DIY projects — built per
`../diy-project-tracker-spec-v2.md`. All data lives on the phone in IndexedDB;
no accounts, no server, no runtime third-party calls.

> **Proprietary — all rights reserved.** This is not open-source software. The
> source is source-available for viewing only; no right to use, copy, modify, or
> distribute it is granted. See [LICENSE](./LICENSE).

## Run it locally

```bash
npm install
npm run dev        # development server
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

## Put it on Jillian's phone

1. Host the contents of `dist/` anywhere that serves static files over HTTPS
   (hosting choice is an ASK decision — GitHub Pages under an existing account
   is the zero-cost path). HTTPS is required for the service worker, share
   target, and Add to Home Screen.
2. On her Android phone, open the URL in Chrome → menu → **Add to Home screen**
   (or the "Install app" prompt). Chrome wraps it as a real app: launcher icon,
   full screen, offline, and it appears in the **share sheet**.
3. Test the share flow once: take a screenshot → Share → pick the app →
   choose a task.
4. Save a first backup from the help page (**Save a backup** → Save to Drive),
   and test **Restore from backup** once so the safety net is proven.

Note: the share target only works in the installed (home screen) app, not in a
plain browser tab — that's an Android platform rule.

## Where things live

- `src/db.ts` — Dexie schema (projects, tasks, updates/notes, photos, pending
  shares, shopping items; v2 adds `shopItems` + `physicalDemand` on tasks)
- `src/lib/` — numbering (computed 1 / 1.1 step labels), Today-feed ranking,
  date phrasing, image compression, backup/restore, undo-delete,
  `guide.ts` (energy-matched task picks), `encourage.ts` (milestone messages)
- `src/screens/` — Dashboard, Projects, ProjectView, TaskView, Shopping,
  GuideMe, SharePicker, ArchiveScreen, HelpScreen, Welcome
- `src/sw.ts` — service worker: offline precache + Android share-target handler
- `scripts/gen-icons.mjs` — regenerates the app icons (runs on every build)

## Design intent (don't lose these on future edits)

- 16px headings, 14px body, everything in rem so Android's system text size
  scales the whole app
- Warm palette: background #FAF7F2, ink #2E2A26, eight muted project colours
- Progress always in words ("7 of 12 things done"), never a bare percentage
- Step numbers are computed from position, never stored or typed
- Delete = confirm + 10-second undo; archive = always recoverable
- No nagging, no urgency framing, no gamification — encouragement is warm and
  milestone-based ("Halfway through Laundry reno"), never streaks or pressure
- Guide Me respects low-energy days: gentle tasks only, and rest is framed as
  a legitimate answer, never a failure

## Licence & ownership

Copyright (c) 2026 Andrea Lee Matthies. All rights reserved. This software is
proprietary — see [LICENSE](./LICENSE). It is source-available (you may read it)
but not open source: no permission is granted to use, copy, modify, or
distribute it without written consent.

A note on what this does and doesn't do: a proprietary licence establishes
ownership and legal recourse, but it does not technically prevent copying — a
PWA still ships its compiled code to every device it runs on. Genuine
commercial protection comes from the product, the brand, and any server-side
logic behind an account, not from the licence alone. For a real commercial
launch, have the terms reviewed by a qualified lawyer.
