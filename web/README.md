# web — Phase 1 desktop app

The Phase 1 app from [docs/PRD.md](../docs/PRD.md): upload a plan, add photos, pin
them, download a report. No account, no server, no help needed.

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # static output in dist/
npm run typecheck
```

Nothing leaves the browser. Projects live in IndexedDB, photos as Blobs, and the
report PDF is built client-side — a site's photos are never uploaded anywhere.

## How it is put together

```
src/lib/types.ts       the v1 data model — mirrors PRD §7
src/lib/catalog.ts     the vocabulary: issue sets, statuses, area names, templates
src/lib/copy.ts        the copy deck — every string a user can read
src/lib/store.ts       the ProjectStore interface (the Phase 2 seam)
src/lib/localStore.ts  IndexedDB implementation of it
src/lib/state.ts       the Zustand store; every mutation autosaves
src/lib/drag.ts        the pointer drag model, ported from the prototype
src/lib/plan.ts        plan intake, PDF page 1 via pdf.js
src/lib/images.ts      photo resize + EXIF, off the main thread
src/lib/exif.ts        just enough EXIF: taken-at, GPS, orientation
src/lib/rmap.ts        .rmap project file (zip of project.json + blobs)
src/report/            the PDF: page.ts primitives, generate.ts pages, planRender.ts canvases
src/ui/                the screens
```

**The storage seam.** The UI only ever calls a `ProjectStore`. Phase 2 swaps in a
cloud implementation without touching a component — that interface is the whole
point of writing it now.

**The report** is a port of `tools/build_pdf.py`, which stays in the repo as the
reference implementation. Page order, layout and the walk-order rule come from
there; the templates (Q3) vary which blocks print. Fonts fall back to Helvetica
exactly as the Python version does without `--fonts`. To use the real faces, drop
`Montserrat-Regular.ttf`, `Montserrat-Bold.ttf`, `Montserrat-ExtraBold.ttf` and
`RobotoSlab-ExtraBold.ttf` into `public/fonts/` and they are embedded and
subsetted automatically.

**Rules that do not bend** (PRD §7): pin numbers are permanent, report pages run
in walk order rather than number order, both numbers print on every page, and
deleting a pin returns its photos to the tray instead of deleting them.

## Capturing photos

Two ways, and they mix freely:

- **Photos first.** Drop a folder on the tray. Photos group by the start of their file name; drag a photo or a whole group onto the plan. Tapping photos adds them to a selection across groups — tap the plan and they become one pin.
- **Pin first.** *Drop a pin*, tap the plan, name the area. *Take photo* opens the rear camera on a phone (a file picker on a laptop); *Add photos* opens the gallery. Photos go straight onto the pin.

A pinned photo is labelled for its area — *Dish area 3* — everywhere: the pin panel, the photo viewer and the report. The label is derived from the pin rather than stored, so renaming the area relabels every photo; the original file name is kept on the photo.

## Validation walks

Choosing *A rollout I need to validate* or *Sticker or product placement* at setup turns the site into a validation walk: spots are set up before the walk, each with a free-text item, and each is marked with one of four results. The report (`rollout-validation` / `placement-validation` in `src/report/theme.ts`) leads with coverage, lists what needs fixing, gives each missing or wrong spot a full page, and shows every confirmed spot in a proof grid. *Reuse for another site* on the site list copies the plan and spots with every result reset.

Validation statuses share fixed ids (`pending`, `verified`, `missing`, `wrong`) so coverage counts the same way for both jobs; only the words differ (`src/lib/catalog.ts`).

## Measured so far

On a 2024 laptop, Chromium:

| | |
|---|---|
| Import 200 photos | 7.8 s, ~39 ms each, UI stays live |
| Pin drag with 200 photos loaded | median 5 ms/move, p95 7 ms (30fps needs 33 ms) |
| JS heap with 200 photos | 23 MB — photos are Blobs, not base64 |
| 18-location report on the real #605 plan | 23 pages, 8.2 MB, 2.2 s |
| Reload mid-walk | reopens the same site with nothing lost |
| First outside tester, no instructions | a 9-page report in under 10 minutes |

The tester's five findings are fixed and were re-checked on the tester's own inputs: cover text running off the page, the condition running into the status column, the site name split between the workspace and the report, photos of one spot split across filename groups, and run-together labels in the repair list.

## Still open

- **Gate 5** — about ten user-visible strings are still hard-coded rather than in `copy.ts`.
- **Gate 6** — only Chromium has been exercised; Safari, Firefox and Edge are untested.
- **Gate 3** — not yet measured on a four-year-old laptop.
- **Gate 4** — the side-by-side against the #605 package needs the owner's eyes.
- **Not yet run for real:** EXIF dates from real phone photos, the phone camera itself, opening a `.rmap` back up, PDF plan upload, replace-plan, keyboard nudge, logo and accent, the storage-full path, and four of the five report templates.
- **Not yet:** one validation check sent to many stores and viewed together — needs Phase 2's accounts.
