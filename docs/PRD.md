# R3p4irm4p — Product Requirements

**Status:** draft v1 · **Owner:** John Olenski · **Date:** September 17, 2026
**One line:** photograph what's broken, pin it to a floor plan, hand someone a report they can price.

---

## 1. The problem

A manager walks a building and photographs twenty things that need fixing. The photos are useless on their own — a close-up of cracked grout could be anywhere in the building. Today the fix is a manager writing "by the soda station, near the drain" into an email with 20 attachments, and a contractor showing up to re-walk the site because the email wasn't enough to quote from.

Three costs, in order of what people actually complain about:

1. **The quote takes two visits.** Nobody prices work off an email of loose photos.
2. **Nothing is tracked.** Six months later, no one can say whether spot 12 was repaired or is still open.
3. **The manager's evening.** Assembling a decent request by hand takes 2–4 hours, so it doesn't get done, so the floor stays broken.

**Evidence (the origin case, Sep 17 2026):** 39 phone photos of a restaurant kitchen floor → 18 pinned locations → a 23-page priced-scope package. Pinning took ~20 minutes. The document would have taken half a day by hand.

## 2. What the product is

Three steps, and nothing else on screen:

1. **Upload your floor plan.**
2. **Add your photos** — drop a folder, or shoot them on a phone.
3. **Generate the report.**

The map is how you get the data in. **The report is the product.** Every scoping decision defers to that sentence: if a feature doesn't make the report better, faster, or more trusted, it waits.

### Principles

- **Zero training.** If a GM needs to be told how to use it, it's wrong.
- **One-handed and greasy-thumbed.** Real use is standing in a kitchen, phone in one hand.
- **Never lose someone's walk.** A crashed tab, a dead battery, a closed laptop — the work survives.
- **Boring output.** The report must look like something a facilities director already approves, not like a startup's UI.
- **Their words.** "Spot 12", "dish area", "open / scheduled / done". No jargon the user didn't supply.

### Not building (and saying so out loud)

CMMS / work-order management · scheduling · invoicing or payments · a contractor marketplace · BIM or CAD · measuring from the plan (no scale) · chat/comments in v1 · offline-first sync in v1.

## 3. Who it's for

Four users, one product. The differences are the vocabulary and the report template, not the flow — so the app **asks at first run** instead of forking the codebase (see section 4).

| Persona | Walks with | Needs from the report | Template name |
|---|---|---|---|
| **Site manager** (restaurant, retail, multi-unit) | Phone, mid-shift | Approval from facilities; proof it was reported | Repair request |
| **Trade contractor** (tile, floor, roof) | Phone or tablet on a bid walk | A scope they can price and attach to a quote | Scope & bid worksheet |
| **Property / facility manager** | Phone, on turnovers and inspections | Documentation for owners, tenants, insurers | Condition report |
| **GC / project punch list** | Tablet, near the end of a job | Assignable defects with status | Punch list |

All four share: a plan, numbered locations, photos, condition, status, notes, a printable package.

## 4. First-run: the chip picker

Three questions, bubbles you tap, skippable. Each answer sets defaults — it never locks anything.

**Q1 — "What are you documenting?"** (single)
`A restaurant or store` · `A property or rental` · `A construction punch list` · `A job I'm bidding` · `Something else`

**Q2 — "What kind of problems?"** (multi, seeded by Q1)
`Floors & tile` · `Plumbing & leaks` · `Walls & ceilings` · `Equipment` · `Safety hazards` · `Damage / insurance` · `Finish work`

**Q3 — "Who's this report for?"** (single)
`My facilities team` · `A contractor who'll price it` · `An owner or landlord` · `Insurance` · `Just my records`

**What the answers set:**

| Answer drives | Example |
|---|---|
| Issue list on a pin | Floors → grout, cracked tile, loose tile, trip hazard |
| Report template + cover fields | Contractor → blank Area/Price columns, sign-off page |
| Status words | Punch list → open / in progress / ready to verify / accepted |
| Area-name suggestions | Restaurant → dish, cook line, walk-in, soda station, expo |
| Report tone | Insurance → dates and conditions foregrounded, no pricing columns |

**Rules:** every screen has **Skip — I'll set it up myself**; answers are editable later in project settings; a returning user is never asked again; nothing is inferred beyond these three answers.

## 5. Phases

Phase 1 is the only one specified to build-level detail. Later phases list intent and entry criteria, not screens — they'll be re-specced when reached.

### Phase 0 — what exists today ✅

Python CLI + a self-contained HTML map + a 23-page PDF generator. Proven on one real site. Not usable by a stranger.

### Phase 1 — Desktop web prototype ("a stranger can do the whole thing")

**Goal:** someone who has never seen it uploads a plan, adds photos, pins them and downloads a report — on a laptop, with no account, no server, no help.

**In scope**

- **Projects** — create, rename, list, delete. Stored in the browser (IndexedDB). Export/import a `.rmap` project file (zip: `project.json` + photos) so work moves between machines and can be emailed.
- **Plan upload** — PNG/JPG/WEBP, and **PDF** (first page rendered). Replace-plan keeps pins at their relative positions, with a warning.
- **Photos** — drag a folder, drop files, or pick. Resize client-side, keep EXIF date/time, strip GPS unless the user opts in. 200 photos per project without choking.
- **Pinning** — drag a photo (or a group) onto the plan; drag pins; click for the panel; keyboard nudge. Carried over from the prototype, cleaned up.
- **A pin holds** — stable number, position, area name, issue (from Q2), status, note, photos, created/updated timestamps.
- **Onboarding chips** — section 4, shown once on first project.
- **Report** — generated **in the browser** (no server) as a PDF: cover with counts and areas, marked plan, worksheet with blank columns, one page per location, sign-off. Template chosen by Q3; user can switch template and re-generate.
- **Report settings** — site name, prepared-by, date, logo upload, optional accent colour.
- **Autosave** — every change; "all changes saved" state visible; nothing lost on a tab close.
- **Empty and error states** — no plan yet, no photos yet, unreadable image, a PDF that won't render, storage full.

**Out of scope:** accounts, sharing links, multi-user, mobile capture, photo annotation, multi-floor, offline sync.

**Acceptance — Phase 1 is done when:**

1. A person who has never used it, given a plan image and 20 photos and no instructions, produces a report in **under 15 minutes**.
2. Closing the tab mid-walk and reopening loses **nothing**.
3. 200 photos in one project stays responsive (pin drag at 30fps on a 4-year-old laptop).
4. The generated PDF is **visually equal or better** than the current Python one, checked side by side on the #605 data.
5. Every string a user sees comes from the copy deck — no placeholder text, no lorem, no developer wording.
6. The whole flow works in Chrome, Edge, Safari and Firefox, current versions.

### Phase 2 — Accounts and sharing

**Entry criteria:** Phase 1 shipped, and at least 5 people outside the building have generated a report from it.

Sign-in, cloud projects, a **share link** (view-only, no account needed to open — this is how the contractor sees it), report history, team members on one site, server-side PDF for big projects. Storage moves behind an adapter so local and cloud use one interface — write that interface in Phase 1.

### Phase 3 — Mobile

**Entry criteria:** people ask for it unprompted, having already used the desktop version on a real job.

**Navigation call (the thing to decide once, now):** ship a **PWA first**, not a native app. Installable to a home screen, opens the camera, takes photos straight into a pin, works with no signal (queue and sync), one codebase with the desktop app, no app-store review. Go native (Capacitor wrapper first, React Native only if forced) when one of these is true and not before: a customer needs push notifications, an app-store listing is a purchasing requirement, or background upload becomes the top complaint.

**Mobile-first flows:** capture-then-pin (shoot 10 photos, pin them at the end), pin-then-capture (tap the plan, camera opens), and a "walk mode" that keeps the plan zoomed to where you are.

### Phase 4 — Business

**Entry criteria:** repeat use without prompting from at least 10 sites.

Pricing experiments (see section 8), per-persona template packs, company branding on reports, export to CSV / email the report, and integration with whatever the design partners already use.

## 6. Technical decisions

Written as decisions with reasons, so they can be argued with later.

| Decision | Choice | Why |
|---|---|---|
| App | React + TypeScript + Vite, single page | Boring, fast, one codebase to mobile later |
| State | Zustand + immer | Small, no ceremony |
| Local storage | IndexedDB (`idb`), photos as Blobs | Handles hundreds of MB; base64-in-HTML does not |
| Storage layer | One `ProjectStore` interface, local implementation first | Phase 2 swaps in cloud without touching the UI |
| Plan PDF import | pdf.js → canvas → image | Nobody has a PNG of their plan; everybody has a PDF |
| Report generation | pdf-lib + fontkit, in the browser | No server, no upload of someone's photos, instant |
| Photo processing | Canvas/OffscreenCanvas in a worker | Keeps the UI alive while 200 photos resize |
| Fonts | Two embedded subsets | The report must look identical everywhere |
| Hosting | Static (Cloudflare Pages or Netlify) | Phase 1 has no backend to host |
| Phase 2 backend | Decide at entry; Supabase is the default assumption | Auth + Postgres + object storage in one, cheap to start |

**Carrying over from the prototype:** the pin/drag interaction model, the walk-order page sequencing, the report layout, and the stable-numbering rule. These are proven — port them, don't redesign them.

**The current Python tools** stay in the repo as the reference implementation and the batch path. Phase 1's PDF is verified against them.

## 7. Data model (v1)

```jsonc
{
  "id": "uuid", "name": "Kitchen floor", "site": "North Site — Main St",
  "template": "contractor",            // from Q3
  "issueSet": ["floors", "plumbing"],  // from Q2
  "plan": { "blobId": "...", "w": 2000, "h": 1400, "source": "pdf:page1" },
  "pins": [{
    "id": "k1", "no": 1,               // assigned once, never reused, never renumbered
    "x": 0.42, "y": 0.68,              // fraction of the plan
    "area": "Dish area",
    "issue": "grout", "status": "open",
    "note": "", "photoIds": ["p1"],
    "createdAt": "...", "updatedAt": "..."
  }],
  "photos": [{ "id": "p1", "blobId": "...", "name": "dish_01", "takenAt": "...", "w": 1100, "h": 825 }],
  "report": { "preparedBy": "", "date": "", "logoBlobId": null, "accent": "#22235B" },
  "schemaVersion": 1
}
```

**Rules that don't bend:** pin numbers are permanent; report page order is walk order, never number order; both numbers print on every page; deleting a pin returns its photos to the tray rather than deleting them.

## 8. Money — deferred on purpose

Free while we learn. Revisit at Phase 4 entry with real usage in hand. Options on the table, in the order I'd test them:

1. **Free to map, pay per report** — the value is the document; charge where the value is.
2. **Per-site subscription** — matches how facilities budgets are actually written.
3. **Per-seat SaaS** — familiar to buyers, needs teams to make sense.

Deciding early is the risk, not deciding late: the price depends on whether the buyer is a $15/month GM or a $400/month regional facilities group, and we don't know yet.

## 9. Success measures

**Phase 1 (learning, not revenue):**

- 10 people outside the building generate a report.
- Median time from "opened the app" to "downloaded a report" under 15 minutes.
- ≥60% of created projects reach a generated report (the funnel's real question: do people finish?).
- ≥3 users come back within 30 days without being asked.
- At least one contractor quotes from a report **without a second site visit**. This is the whole thesis; one clean instance is worth more than the other four numbers.

**Counter-metric:** how many reports get hand-edited after download. High means the template is wrong.

## 10. Risks

| Risk | Reality | Response |
|---|---|---|
| Photo-app incumbents already pin photos to plans | Real, and some are well funded | Compete on the output document, not on pinning. Verify the landscape before Phase 2. |
| Browser memory with 200 photos | Likely the first real bug | Blobs not base64, thumbnails for the tray, full-size only on demand |
| In-browser PDF fidelity vs the Python version | Fonts and image compression will fight us | Side-by-side check on #605 data as an acceptance gate |
| No scale on the plan | Contractors want square footage | Blank measurement column, contractor fills it. Revisit only if it blocks quotes. |
| Single builder with a full-time job | The actual constraint | Phases sized to evenings; every phase ships something usable alone |
| Customer data in a browser | Losing someone's walk kills trust | Autosave, export file, "saved" indicator, no silent failures |
| Using company floor plans | Plans may be the chain's property | Never bundle a real plan in the repo or marketing; users supply their own |

## 11. Open questions

1. Name and domain — "R3p4irm4p" is a repo name, not a product name.
2. Should the contractor fill prices **in the app** (sharable link, Phase 2), or stay on paper? Ask a contractor before building either.
3. Multi-floor buildings: multiple plans per project, or a project per floor?
4. Photo annotation (circle the crack) — how often is it actually needed?
5. Does anyone want to see all sites at once — a portfolio view — or is one site at a time enough?

## 12. Next actions

| # | Action | Owner | Notes |
|---|---|---|---|
| 1 | Send the #605 package to the tile contractor; note whether they quote without re-walking | John | Phase 1's whole premise, tested for free |
| 2 | Hand the map to one other GM cold, watch where they stick | John | 20 minutes, no coaching |
| 3 | Scaffold the Phase 1 app (Vite + TS + store interface + project shell) | Claude | Starts on your go |
| 4 | Port pin/drag and the report generator into the app | Claude | Report checked against the Python output |
| 5 | Competitive scan before Phase 2 | Claude | Who's out there, what they charge |
| 6 | Pick a product name and domain | John | Blocks anything public-facing |
