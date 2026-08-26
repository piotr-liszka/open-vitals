/**
 * Authored icon set (spec 022) — the app's ONE icon vocabulary.
 *
 * Every glyph is drawn on the same 24×24 grid with the same construction rules as the inline SVGs
 * already in the app (`fill: none`, `stroke: currentColor`, 1.6 stroke, round caps/joins), so a row
 * of mixed icons reads as one family. Unicode/emoji are deliberately NOT an icon system here: they
 * render differently per platform, ignore `currentColor`, and cannot be sized on the type scale.
 *
 * Data-only (no markup strings) so `Icon.svelte` can render real `<path>`/`<circle>`/`<rect>`
 * elements — no `{@html}`, nothing for the CSP to forgive — and so the set is unit-testable.
 */

/** Every glyph name. Adding an icon = one entry here + one in `ICONS`. */
export const ICON_NAMES = [
  'run',
  'ride',
  'swim',
  'walk',
  'strength',
  'activity',
  'moon',
  'bed',
  'sunrise',
  'heart',
  'pulse',
  'battery',
  'alert',
  'trophy',
  'sparkle',
  'flame',
  'calendar',
  'clock',
  'refresh',
  'chevron-down',
  'chevron-left',
  'chevron-right',
  'arrow-down',
  'arrow-up',
  'help',
  'home',
  'grid',
  'list',
  'database',
  'settings',
  'panel-left',
  'plus',
  'edit',
  'trash',
  'x',
  'users',
  'check'
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/** `[cx, cy, r]`. */
export type IconCircle = readonly [number, number, number];
/** `[x, y, width, height, rx]`. */
export type IconRect = readonly [number, number, number, number, number];

export interface IconGlyph {
  /** `d` attributes, drawn in order. */
  readonly paths: readonly string[];
  readonly circles?: readonly IconCircle[];
  readonly rects?: readonly IconRect[];
}

export const ICONS: Readonly<Record<IconName, IconGlyph>> = {
  /* ---- sport families ---- */
  run: {
    circles: [[14.2, 4.8, 1.9]],
    paths: [
      'M6.6 20.6 9.6 15.1 12.4 13.5 11.3 9.1',
      'M11.3 9.1 15.2 7.2 17.3 10 20.4 10.9',
      'M11.3 9.1 7.3 10.2 5.9 13.7',
      'M12.4 13.5 14.7 15.6 15.7 19.4'
    ]
  },
  ride: {
    circles: [
      [18.5, 17.5, 3.5],
      [5.5, 17.5, 3.5],
      [15, 5, 1]
    ],
    paths: ['M12 17.5V14l-3-3 4-3 2 3h2']
  },
  swim: {
    paths: [
      'M2 7c.6.5 1.2 1 2.5 1C7 8 7 6 9.5 6c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1',
      'M2 13c.6.5 1.2 1 2.5 1C7 14 7 12 9.5 12c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1',
      'M2 19c.6.5 1.2 1 2.5 1C7 20 7 18 9.5 18c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1'
    ]
  },
  walk: {
    circles: [[13.2, 4.6, 1.9]],
    paths: [
      'M13.2 8.6 10.3 10.5 9.3 14',
      'M13.2 8.6 15.6 10.6 16.2 13.9',
      'M9.9 13.6 8 20.4',
      'M15.9 13.5 17.9 20.4'
    ]
  },
  strength: {
    paths: ['M4 9.5v5', 'M7.5 6.5v11', 'M16.5 6.5v11', 'M20 9.5v5', 'M7.5 12h9']
  },
  activity: {
    paths: ['M22 12h-4l-3 9L9 3l-3 9H2']
  },

  /* ---- recovery / health ---- */
  moon: {
    paths: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z']
  },
  bed: {
    paths: ['M2 4v16', 'M2 9h16a3 3 0 0 1 3 3v8', 'M2 17h19', 'M6 9v8']
  },
  sunrise: {
    paths: [
      'M12 2v5',
      'M4.9 9.9l1.4 1.4',
      'M2 17h2',
      'M20 17h2',
      'M17.7 11.3l1.4-1.4',
      'M22 21H2',
      'M16 17a4 4 0 0 0-8 0'
    ]
  },
  heart: {
    paths: [
      'M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z'
    ]
  },
  pulse: {
    paths: ['M2 12h3.6l2-6.4 3.1 12.8 2.9-8.6 1.9 2.2H22']
  },
  battery: {
    rects: [[2, 7, 16, 10, 2]],
    paths: ['M22 11v2', 'M5.5 10.5v3']
  },
  alert: {
    paths: [
      'M21.7 18 13.7 4a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z',
      'M12 9.5v4',
      'M12 17.2h.01'
    ]
  },

  /* ---- milestones ---- */
  trophy: {
    paths: [
      'M6 9H4.5a2.5 2.5 0 0 1 0-5H6',
      'M18 9h1.5a2.5 2.5 0 0 0 0-5H18',
      'M4 22h16',
      'M10 14.7V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22',
      'M14 14.7V17c0 .6.5 1 1 1.2 1.1.6 2 2 2 3.8',
      'M18 2H6v7a6 6 0 0 0 12 0V2Z'
    ]
  },
  sparkle: {
    paths: [
      'M11 3 12.9 8.1 18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9Z',
      'M18.5 15.2l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z'
    ]
  },
  flame: {
    paths: [
      'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5Z'
    ]
  },

  /* ---- chrome ---- */
  calendar: {
    rects: [[3, 4.5, 18, 17, 2]],
    paths: ['M8 2.5v4', 'M16 2.5v4', 'M3 10.5h18']
  },
  clock: {
    circles: [[12, 12, 9]],
    paths: ['M12 7v5l3 2']
  },
  /* A circular arrow — the sync/refresh action (spec 027). Two arcs with one arrowhead, so it still
     reads as "again" at 14px in the sidebar footer. */
  refresh: {
    paths: ['M20 12a8 8 0 0 1-13.3 6', 'M4 12a8 8 0 0 1 13.3-6', 'M17.3 2.6v3.4h-3.4', 'M6.7 21.4V18h3.4']
  },
  'chevron-down': {
    paths: ['M6 9.5 12 15.5 18 9.5']
  },
  /* Prev/next paging (e.g. the workout planner's month nav) — the same bare chevron as
     `chevron-down`, just turned to face sideways, so paging controls read as siblings of the
     expand/collapse affordance rather than a different glyph family. */
  'chevron-left': {
    paths: ['M14.5 6 8.5 12 14.5 18']
  },
  'chevron-right': {
    paths: ['M9.5 6 15.5 12 9.5 18']
  },
  /* Direction of change (spec 057). A full shaft, not a bare chevron: at 14 px inside a delta badge
     the arrow has to read as "which way did this move" on its own, without colour. */
  'arrow-down': {
    paths: ['M12 4v16', 'M5.5 13.5 12 20l6.5-6.5']
  },
  'arrow-up': {
    paths: ['M12 20V4', 'M5.5 10.5 12 4l6.5 6.5']
  },
  /* "Explain this" (spec 059) — a question mark in a ring, the one affordance that opens an
     InfoPopover. Drawn on the same grid as `alert` so the two read as siblings. */
  help: {
    circles: [[12, 12, 9]],
    paths: ['M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.1-2.5 3.9', 'M12 17.2h.01']
  },

  /* ---- navigation (spec 063) ----
     One glyph per primary destination. These exist so that "has an icon" can be the visual predicate
     for "is a link" in the sidebar: the group headings deliberately have none, which is what stops
     them reading as targets. Drawn on the same grid and stroke as everything above so the column
     reads as one family rather than a ransom note. */
  home: {
    paths: ['M3.5 10.2 12 3.5l8.5 6.7V20a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 20Z', 'M9.5 21.5v-7h5v7']
  },
  /* Four panes — a dashboard of widgets, and the mark the "Panele" group uses (spec 064). */
  grid: {
    rects: [
      [3.5, 3.5, 7, 7, 1.5],
      [13.5, 3.5, 7, 7, 1.5],
      [3.5, 13.5, 7, 7, 1.5],
      [13.5, 13.5, 7, 7, 1.5]
    ],
    paths: []
  },
  list: {
    paths: ['M9 6.5h11', 'M9 12h11', 'M9 17.5h11', 'M4.5 6.5h.01', 'M4.5 12h.01', 'M4.5 17.5h.01']
  },
  /* Stacked discs — the local synced store, not a generic cloud: the whole point of `Dane` is that
     the data is HERE. */
  database: {
    paths: [
      'M12 3c4.4 0 8 1.1 8 2.5S16.4 8 12 8 4 6.9 4 5.5 7.6 3 12 3Z',
      'M4 5.5v13C4 19.9 7.6 21 12 21s8-1.1 8-2.5v-13',
      'M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5'
    ]
  },
  settings: {
    circles: [[12, 12, 3]],
    paths: [
      'M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z'
    ]
  },
  /* The sidebar collapse control (spec 063): a frame with its left column filled in, so the glyph
     depicts the thing it operates on rather than an abstract arrow. */
  'panel-left': {
    rects: [[3, 4, 18, 16, 2]],
    paths: ['M9 4v16']
  },
  plus: {
    paths: ['M12 5v14', 'M5 12h14']
  },

  /* ---- row actions (spec 094: admin user management) ---- */
  /* A pencil over a line — "edit this row's fields". */
  edit: {
    paths: ['M4 20h4.2L20 8.2a2 2 0 0 0 0-2.8l-1.4-1.4a2 2 0 0 0-2.8 0L4 15.8Z', 'M14 6l4 4']
  },
  /* A lidded bin — "delete this row", destructive by convention (paired with a ConfirmDialog). */
  trash: {
    paths: [
      'M4.5 7h15',
      'M9 7V4.5h6V7',
      'M6.5 7 7.4 20a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7',
      'M10 11v6',
      'M14 11v6'
    ]
  },
  /* A plain cross — "close/cancel", the dialog dismiss glyph. */
  x: {
    paths: ['M6 6l12 12', 'M18 6 6 18']
  },
  /* Two overlapping people — the "Admin" nav entry (spec 094: managing OTHER people's accounts). */
  users: {
    circles: [
      [9, 8, 3],
      [17, 9.5, 2.2]
    ],
    paths: ['M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6', 'M15.5 14.2c2.5.4 4.5 2.5 4.5 5.3']
  },
  /* A single tick — "this is selected", used inside checkbox/option rows (e.g. MultiSelect). */
  check: {
    paths: ['M5 12.5l4.5 4.5L19 7']
  }
};

/** Type guard for untrusted icon names (e.g. a value that crossed a JSON boundary). */
export function isIconName(value: unknown): value is IconName {
  return typeof value === 'string' && (ICON_NAMES as readonly string[]).includes(value);
}
