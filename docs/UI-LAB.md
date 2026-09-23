# Repair Map UI lab

An isolated design experiment based on main at 5123e6b. The existing report generators and export format remain unchanged.

## Try it

From `web`, run `npm ci`, then `npm run dev -- --host 127.0.0.1 --port 5188 --strictPort`. Open http://127.0.0.1:5188/ and choose **Explore a sample walk**. The sample plan and images are fictional illustrations, explicitly labelled as such.

This branch uses a separate IndexedDB database and last-opened key. Its Worker name is `r3p4irm4p-ui-lab` to prevent accidental replacement of production. It has not been deployed. Import an .rmap backup to try your own walk; existing browser-local sites are not copied automatically.

## Design direction

Keep the map, photos, and excellent reports as the product's center. Use a restrained navy/green palette, clearer type hierarchy, larger touch targets, and more space between controls.

- Site cards show the floor plan so returning to a restaurant is visual. Search helps as the collection grows.
- The workspace highlights photo coverage for repairs and checked spots for validations. Missing or incorrect validation results count as checked, not verified.
- Mobile details open as a collapsible sheet. Camera and gallery actions sit directly below the area name. Previous/next controls follow walking order.
- Repair search covers area, issue, notes, and number. Filtering retains the actual walking-order position.
- Backup and report actions remain prominent. Site management actions are grouped in each card's menu.

## Verification

TypeScript and production build passed. Browser checks covered desktop (1440 x 1000), mobile viewport (390 x 844), sample creation, selecting and navigating pins, mobile camera-action placement, saving a note through reload, repair PDF download, and backup download/reimport with the note retained. Rollout and placement PDFs generated and parsed successfully, each with 11 pages from the synthetic fixture.

This is not a physical-phone camera test, a full accessibility audit, or a fresh visual audit of every PDF page. Existing report-generation modules were not edited. Camera, gallery, touch gestures, and safe-area behavior still need real-device validation.

## What I would prioritize next

Test this direction on an actual restaurant walk before expanding the feature set. Then consider undo for destructive edits, clearer backup reminders, and an in-app report preview. Director tools can be a separate project once the everyday capture workflow feels effortless.


## Chili's-inspired revision

Applied John's supplied styleguide.md and chilis-style-SKILL.md as visual references: navy structure, red primary actions, warm neutral surfaces, gold on navy, Roboto Slab headings and Montserrat controls. Operational copy remains plain.

Unattached photos can now be explicitly classified as references, individually through selection or in bulk. Reference photos remain viewable, can be returned to placement, and survive .rmap backup round trips. Existing files default to ordinary evidence photos. Attached pin photos cannot be reclassified by this action. Report layouts and inclusion rules are unchanged; references are retained in the editable project and backup, not newly appended to PDFs.

Verified with an isolated in-memory fictional fixture: unplaced count 1 -> 0 on reference classification, .rmap round trip retains role and zero count, restoring evidence restores placement eligibility. Production build passed. Actual user photos were not reclassified automatically.
