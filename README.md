# ipad-ajanda — Apple Pencil notebook & planner for iPad

A browser-based notebook and planner for iPad Safari. You write with Apple Pencil on planner templates, decorate pages with stickers and photos, and sync your notebooks across devices.

## What it does

- **Library:** notebooks live in colored folders. You can search, multi-select, move notebooks and design covers.
- **Pencil-first editor:** pressure-sensitive ink with six pen styles (fountain, ballpoint, brush, pencil, marker, dashed), a highlighter, stroke and partial erasers, lasso select with move/scale, straight-line snapping, text boxes, emoji and image items, undo/redo.
- **Planner templates:** 21 page templates drawn on canvas (yearly, monthly, weekly, daily, trackers, grid/dots/lines and more), in portrait or landscape, plus custom templates.
- **Stickers & photos:** built-in SVG decor (tapes, pins, notes, widgets). The image editor crops photos and removes white backgrounds. A sticker-sheet slicer cuts one photographed sheet into separate transparent stickers. You can import sticker packs and custom fonts (single files or ZIP).
- **Notebook navigation:** a page curl that follows your finger, plus slide and scroll transitions, a two-page spread view, a page grid, colored tabs with sub-categories, swipe and edge-tap gestures, and a movable or hideable toolbar.
- **Export:** PNG download per page and print-to-PDF for a whole notebook.
- **Themes:** 7 presets. Each theme is built from 4 base colors, and the other tones are derived from them.

## Tech stack

Next.js 16 (App Router, React 19) · TypeScript · Tailwind CSS v4 · HTML Canvas 2D · IndexedDB · Supabase (Auth, Postgres with RLS, Realtime) · lucide-react · qrcode · JSZip · Node's built-in test runner

## Architecture overview

```
app/            Next.js shell, theme tokens, manifest (home-screen install), error boundary
components/
  App.tsx       Screen stack: back gesture / browser back, resume where you left off
  library/      Folders, notebook cards, theme + sync dialogs
  notebook/     NotebookView, page turn, spread & pages modes, tabs, page studio
  editor/       Editor.tsx (pointer/ink engine), Dock.tsx (toolbar + panels), image editor
  ui/           Shared Modal, TopBar, Menu, Popover, styles
lib/
  store.tsx     App state, IndexedDB persistence, cloud sync (merge, push, realtime)
  pageSync.ts   Per-stroke / per-item merge of concurrent page edits
  backup.ts     Local snapshots + cloud version history (thinned over time)
  render.ts     Canvas renderer for templates and pages
  ink.ts        Eraser, lasso hit-testing, stroke transforms
  pageCurl.ts   Page-curl rendering
  supabase.ts   Client setup, session storage, QR session transfer
supabase/schema.sql   Tables + row-level-security policies
```

The app is **local-first**. All data is stored in IndexedDB on the device, and the app works with no account. Cloud sync is optional. It stores one state document per user plus a version history and an asset table (sticker packs and fonts) in Supabase. Every table is protected by row-level security (`auth.uid() = user_id`).

## Notable engineering points

- **Conflict-tolerant sync.** Each notebook, folder and page is merged by ID. Deletions are kept as tombstones so deleted items don't come back. Within a page, every stroke and item gets its own content clock. Two offline devices can therefore draw on the same page and both drawings are kept (covered by tests).
- **Clock-skew protection.** Edit stamps only ever increase: every new edit is stamped above the newest stamp seen so far. Stamps more than 30 days in the future are clamped.
- **Compare-and-swap writes.** The app fetches the remote state, merges it with local data, then updates the row only if `updated_at` hasn't changed since the fetch. Realtime changes from other devices are merged in.
- **Data-loss safety net.** The app saves an automatic local snapshot before any risky operation (merge, push, restore). It also keeps a cloud version history, thinned to roughly every snapshot for 3 hours, hourly for 2 days and daily for 45 days. If a merge would shrink the data, both sides are backed up immediately. A restore UI lists device copies and cloud versions.
- **Apple Pencil handling.** The editor reads pressure, with an adjustable sensitivity curve. The pencil style also reads tilt (altitude), so strokes get wider as the Pencil leans over. Coalesced pointer events keep strokes smooth. A Pencil-only mode leaves fingers for pan, zoom and gestures. iOS Scribble and text selection are suppressed on the canvas.
- **Device pairing by QR.** A signed-in device shows a QR code that carries its session to another device. The receiving device asks for explicit confirmation before signing in.

## Getting started

Requirements: Node.js 20+.

```bash
npm install
cp .env.example .env.local   # optional, only needed for cloud sync
npm run dev                  # http://localhost:3000
```

Environment variables (both optional):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL of your Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key of that project |

Without them the app runs local-only. You can also enter a Supabase URL and anon key at runtime in the **Cloud** dialog. To enable sync, run `supabase/schema.sql` once in your project's SQL editor.

Other scripts:

```bash
npm run lint       # ESLint (next/core-web-vitals + typescript)
npm run typecheck  # next typegen + tsc --noEmit
npm test           # node --test (sync merge + page-curl tests)
npm run build      # production build
```

To get the real experience, open the app in Safari on an iPad and use **Share → Add to Home Screen**.

## Project status

This is a personal project in active use. It is built for iPad Safari first, and desktop browsers work for viewing and basic editing. There is no offline service worker: an earlier caching worker was retired because it served stale builds. Data persistence does not depend on one, since everything is stored in IndexedDB. Automated tests cover the sync merge logic and the page-curl renderer (5 tests). UI behavior is checked manually on device.

## How it was built

I built this with AI-assisted development (Claude Code and Codex). I set the product direction, UX and design decisions, and tested on a real iPad. The AI tools did much of the implementation under my direction.

## License

MIT. See [LICENSE](LICENSE). The bundled Poppins and Lora fonts are under the SIL Open Font License (see `public/fonts/*-OFL.txt`).
