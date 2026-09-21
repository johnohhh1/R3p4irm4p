/**
 * The copy deck. Every string a user can read lives here, so the wording can be
 * reviewed in one place without reading React. PRD acceptance criterion 5.
 */
import type { SubjectId, TemplateId } from './types'

export const copy = {
  app: {
    name: 'Repair Map',
    tagline: 'Photograph what is broken, pin it to a floor plan, hand someone a report they can price.',
  },

  projects: {
    title: 'Your sites',
    empty: 'Nothing here yet. Start with the floor plan of the building you are walking.',
    create: 'New site',
    createFirst: 'Start your first site',
    open: 'Open',
    rename: 'Rename',
    duplicate: 'Duplicate',
    remove: 'Delete',
    removeConfirm: 'Delete this site and everything in it?',
    removeConfirmYes: 'Yes, delete it',
    importFile: 'Open a .rmap file',
    exportFile: 'Save a .rmap file',
    namePrompt: 'What do you want to call this site?',
    renameHint: 'Click to rename',
    nameDefault: 'Untitled site',
    noPlan: 'No plan yet',
    counts: (pins: number, photos: number) =>
      `${pins} ${pins === 1 ? 'spot' : 'spots'} · ${photos} ${photos === 1 ? 'photo' : 'photos'}`,
    updated: (when: string) => `Saved ${when}`,
  },

  onboarding: {
    skip: 'Skip — I will set it up myself',
    back: 'Back',
    next: 'Next',
    done: 'Start walking',
    stepOf: (n: number, total: number) => `Question ${n} of ${total}`,
    q1: {
      title: 'What are you documenting?',
      help: 'This picks the words the app uses. You can change all of it later.',
      options: [
        { id: 'restaurant' as SubjectId, label: 'A restaurant or store' },
        { id: 'property' as SubjectId, label: 'A property or rental' },
        { id: 'punchlist' as SubjectId, label: 'A construction punch list' },
        { id: 'bid' as SubjectId, label: 'A job I am bidding' },
        { id: 'rollout' as SubjectId, label: 'A rollout I need to validate' },
        { id: 'placement' as SubjectId, label: 'Sticker or product placement' },
        { id: 'other' as SubjectId, label: 'Something else' },
      ],
    },
    q2: {
      title: 'What kind of problems?',
      help: 'Pick as many as apply. These become the choices on each pin.',
    },
    q3: {
      title: 'Who is this report for?',
      help: 'This picks the report template. You can switch templates before you generate.',
      options: [
        { id: 'repair-request' as TemplateId, label: 'My facilities team' },
        { id: 'scope-bid' as TemplateId, label: 'A contractor who will price it' },
        { id: 'condition-report' as TemplateId, label: 'An owner or landlord' },
        { id: 'insurance' as TemplateId, label: 'Insurance' },
        { id: 'record' as TemplateId, label: 'Just my records' },
      ],
    },
  },

  plan: {
    heading: 'Upload your floor plan',
    help: 'A picture or a PDF. The first page of a PDF is used.',
    choose: 'Choose a file',
    dropHere: 'Drop your floor plan here',
    replace: 'Replace plan',
    replaceWarning:
      'Pins keep their position relative to the plan. If the new plan is not the same drawing, they will land in the wrong places.',
    replaceConfirm: 'Replace the plan',
    rendering: 'Reading the plan…',
    pdfPage: (n: number) => `PDF, page ${n}`,
  },

  photos: {
    heading: 'Add your photos',
    tabLabel: 'Photos to place',
    drop: 'Add photos',
    dropHelp: 'Drop a folder or picture files here, or click to choose',
    empty: 'No photos yet. Drop a folder of pictures to get started.',
    allPlaced: 'Every photo is on the plan.',
    importing: (done: number, total: number) => `Adding photos… ${done} of ${total}`,
    placeAll: 'Place all',
    group: (n: number) => `${n} ${n === 1 ? 'photo' : 'photos'}`,
    keepLocation: 'Keep GPS location in photos',
    keepLocationHelp:
      'Off by default. Location data travels with a photo if you share the file.',
  },

  map: {
    hintView: 'Click a pin to see what is there.',
    hintEdit:
      'Drag a photo onto the plan to pin it. Drag a pin to move it. Drop a photo on a pin to add it there.',
    hintArmedPhoto: (n: number) =>
      n > 1
        ? `Click the plan to pin these ${n} photos, or click a pin to add them to it. Esc cancels.`
        : 'Click the plan to pin this photo, or click a pin to add it. Esc cancels.',
    hintArmedPin: 'Click the plan where the pin goes. Esc cancels.',
    dropPin: 'Drop a pin',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Fit',
    noPlan: 'Upload a floor plan and this is where it appears.',
  },

  pins: {
    tabLabel: 'Repair list',
    empty: 'No spots yet. Drag a photo onto the plan to mark the first one.',
    emptyFiltered: 'Nothing matches this filter.',
    all: 'All',
    area: 'Area',
    areaPlaceholder: 'Where is this?',
    issue: 'What is wrong',
    status: 'Status',
    note: 'Note',
    notePlaceholder: 'Anything the person fixing it needs to know',
    photos: 'Photos',
    noPhotos: 'No photos on this spot yet. Take one, or add some you already have.',
    takePhoto: 'Take photo',
    addPhotos: 'Add photos',
    unpin: 'Unpin',
    remove: 'Delete this spot',
    removeConfirm: 'Delete it',
    removeNote: 'Its photos go back to the tray.',
    back: 'Back to the list',
    created: (when: string) => `Marked ${when}`,
    spotNo: (n: number) => `Spot ${n}`,
    item: 'What should be here',
    itemPlaceholder: 'New allergen sticker',
    result: 'Result',
  },

  validation: {
    hintSetup:
      'Tap "Drop a pin" and tap the plan for every spot that should have it. Then walk, take a photo, and mark each one.',
    coverage: (done: number, total: number) => `${done} of ${total} checked`,
    duplicate: 'Reuse for another site',
    duplicateHelp: 'Same plan and spots, every result reset to Not checked, no photos.',
    duplicated: (name: string) => `${name} is ready to walk.`,
    copyName: (name: string) => `${name} — copy`,
  },

  report: {
    heading: 'Generate the report',
    open: 'Generate report',
    generating: 'Building the report…',
    download: 'Download the PDF',
    template: 'Template',
    site: 'Site name',
    sitePlaceholder: 'North Site — Main St',
    preparedBy: 'Prepared by',
    preparedByPlaceholder: 'Your name',
    date: 'Walkthrough date',
    surface: 'What was walked',
    surfacePlaceholder: 'kitchen and service floor',
    findings: 'What you found',
    findingsPlaceholder:
      'A sentence or two in your own words. Prints on the sign-off page.',
    link: 'Live map link',
    linkPlaceholder: 'Optional — prints on the cover',
    logo: 'Logo',
    logoAdd: 'Add a logo',
    logoRemove: 'Remove',
    accent: 'Accent colour',
    needPlan: 'Upload a floor plan before generating a report.',
    needPins: 'Mark at least one spot before generating a report.',
    ready: (pins: number, photos: number) =>
      `${pins} ${pins === 1 ? 'location' : 'locations'}, ${photos} ${photos === 1 ? 'photo' : 'photos'}.`,
    filename: 'The PDF downloads to your computer. Nothing is uploaded anywhere.',
  },

  save: {
    saved: 'All changes saved',
    saving: 'Saving…',
    failed: 'Could not save',
  },

  errors: {
    badImage: 'That file could not be read as a picture. Try a PNG, JPG or WEBP.',
    badPdf: 'That PDF could not be rendered. Try exporting the plan as a picture.',
    unsupported: (name: string) => `${name} is not a picture or a PDF, so it was skipped.`,
    storageFull:
      'Your browser is out of storage. Save a .rmap file to keep this work, then delete a site you have finished with.',
    loadFailed: 'That site could not be opened.',
    importFailed: 'That file is not a Repair Map project.',
    reportFailed: 'The report could not be built. Nothing was lost — try again.',
    reportFailedDetail: (detail: string) =>
      `The report could not be built (${detail}). Nothing was lost — try again, and pass this message on if it keeps happening.`,
  },

  toasts: {
    pinned: (n: number) => `${n} ${n === 1 ? 'photo' : 'photos'} pinned.`,
    unpinned: 'Photo returned to the tray.',
    pinRemoved: (n: number) => `Spot ${n} deleted. Its photos are back in the tray.`,
    planReplaced: 'Plan replaced. Check that the pins still land where you meant.',
    exported: 'Project file saved.',
    imported: (name: string) => `${name} opened.`,
    skippedGps: 'Location data was removed from the photos.',
  },
} as const

/** Report boilerplate — the paragraphs that print inside the PDF. */
export const reportCopy = {
  contentsHeading: "What's in this package",
  contents: [
    ['Marked floor plan', 'Every location numbered on the plan, in one picture.'],
    ['Scope worksheet', 'One line per location, with blank columns for measurements and pricing.'],
    ['Location pages', 'One page per spot: photos, a close-up of where it sits, and room to write.'],
    ['Sign-off page', 'Owner, date, and approval for the work that gets scheduled.'],
  ] as [string, string][],
  contentsNoPricing: [
    ['Marked floor plan', 'Every location numbered on the plan, in one picture.'],
    ['Condition summary', 'One line per location, with its condition and status.'],
    ['Location pages', 'One page per spot: photos and a close-up of where it sits.'],
    ['Sign-off page', 'Who documented it, and when.'],
  ] as [string, string][],
  liveMap: 'Live photo map (internal):',
  coverageOf: (done: number, total: number) => `${done} of ${total}`,
  percent: (pct: number) => `${pct}%`,
  needsFixing: 'What needs fixing',
  nothingToFix: 'Nothing to fix. Every spot that was checked is in place.',
  notChecked: (n: number) =>
    `${n} ${n === 1 ? 'spot was' : 'spots were'} not checked yet and ${n === 1 ? 'is' : 'are'} listed on the checklist.`,
  noPhoto: 'No photo taken',
  checklistNote: 'Every spot set up for this check, in walking order.',
  validationPlanNote: 'Each pin is a spot that was set up for this check; its colour is the result.',
  proofNote: (n: number) => `${n} confirmed ${n === 1 ? 'spot' : 'spots'}, one photo each.`,
  moreOnChecklist: (n: number) => `+${n} more on the checklist`,
  checkedOn: (date: string) => `Checked ${date}`,
  validationNumbers:
    'Pin numbers come from the live map and never change. Pages run in walking order through the building, so the numbers themselves are not in order. Missing and wrong spots get a full page each; confirmed spots are shown together as proof.',
  validationBody: (site: string, date: string, total: number, done: number, missing: number, wrong: number, pending: number) =>
    `This report validates ${total} ${total === 1 ? 'spot' : 'spots'} at ${site} as of ${date}. ` +
    `${done} ${done === 1 ? 'was' : 'were'} confirmed, ${missing} missing, ${wrong} ${wrong === 1 ? 'needs' : 'need'} fixing` +
    (pending ? `, and ${pending} ${pending === 1 ? 'was' : 'were'} not checked.` : '.') +
    ' Photographs are unedited.',
  oneCondition: (kind: string) => `Every location is ${kind.toLowerCase()}.`,
  manyConditions: (kinds: string) => `Conditions found: ${kinds}.`,
  numbersExplainer:
    'Pin numbers come from the live photo map and never change, so a pin number always points at ' +
    'the same spot. Pages run in walking order through the building, so the pin numbers themselves ' +
    'are not in order. Every page shows both.',
  numbersHeading: 'How to read the numbers',
  worksheetNote: 'Blank columns are for the contractor to complete during the walk.',
  planNote: 'Each pin sits on the failure; see that location page for how far it runs.',
  planSubtitle: (n: number) =>
    `${n} ${n === 1 ? 'location' : 'locations'} · numbers match the photo map and the pages that follow`,
  contractorUse: 'contractor use',
  whereWork: 'Where the work is',
  snapshot: (date: string) =>
    `Photos and pin numbers stay current on the live map; this PDF is a snapshot of ${date}.`,
  approvalBody: (surface: string, site: string, date: string, n: number) =>
    `This package documents the condition of the ${surface} at ${site} as of ${date}. ` +
    `It covers ${n} ${n === 1 ? 'location' : 'locations'}, photographed on the walk. Photographs are unedited.`,
}
