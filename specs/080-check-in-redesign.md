# Spec 080 — the daily check-in, redesigned

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/journal/` + `apps/web/src/lib/ui/`
- **Owner agent:** ui-designer
- **Depends on:** 062 (the journal itself)

## Context

The check-in card shipped in spec 062 asks the right questions and asks them badly. Three defects
make it worse than no card at all:

1. **The two 1–10 rows are the same control with opposite polarity and no anchors.** On soreness 10
   is the worst day of the month; on mood 10 is the best. Nothing on screen says so, so the series
   the correlation engine reads is partly people scoring the wrong end.
2. **The flags render as two unlabelled switches.** `Toggle` puts its `label` in `aria-label` only,
   so a sighted user sees two naked tracks and cannot know one means illness and the other injury.
3. **On a desktop card each score row stretches to the full content width** — ten ~190px buttons,
   twice — so the ten-second form reads as a wall and needs vertical scrolling to finish.

Smaller ones: the note is a single-line `<input maxlength=1000>`, the save button never says why it
is disabled, and a card revisited after saving looks identical to one never filled in.

This spec redesigns the card and lifts the score picker into `lib/ui`, because the same control is
currently drawn a second, different way in `SessionRpe` (AGENTS.md §6: one pattern, one component).

## Requirements (acceptance criteria)

- [x] `lib/ui/ScoreScale.svelte`: a labelled 1–10 picker — ARIA radiogroup, roving tabindex,
      arrows/Home/End move and select, Backspace/Delete clears, re-selecting the current value clears
      it (the only way back to "did not say").
- [x] The scale shows **what the number means**: a per-score word as a live readout, and the two poles
      under the track, so polarity is legible without picking anything.
- [x] A `warnFrom` threshold recolours the selected value to the warning tone (soreness ≥ 4) instead of
      the accent, and the caller can render a follow-up field on the same signal.
- [x] `lib/ui/Textarea.svelte`: multi-line input matching `Input`'s styling, with an optional
      character counter that appears only near the limit.
- [x] `CheckInCard` uses both, and lays out as two columns from 900px (scales | flags + note),
      one column below, with the save row on a hairline footer.
- [x] The flags carry **visible** labels tied to their switch by `for`/`id`.
- [x] The footer states the truth: "nothing saved yet" / "unsaved changes" / "saved", and the save
      button is enabled exactly when there is a change worth writing.
- [x] `SessionRpe` renders its RPE row through `ScoreScale` (same control, same keyboard, one vocabulary).
- [x] Both components appear in the styleguide (`/styleguide`).
- [x] Unit + API-integration tests pass (no e2e) — `pnpm run verify` green (2335 passed, 0 check errors).
- [x] Built only from `lib/ui` components + design tokens (if UI)
- [x] No secrets logged or committed

## API contract

Unchanged. The card still writes the spec 062 contract:

```
PUT /api/journal   req: { day, soreness|null, mood|null, location|null, note|null, illness, injury }
                   res: { entry }   errors: 400 → { error } (validated by journal.validate.ts)
```

Absent keys leave a column alone and explicit `null` clears it — which is what lets the redesigned
card send a cleared score as `null` rather than silently keeping the old one.

## UI

- **New:** `ScoreScale`, `Textarea` (both `lib/ui`, tokens only, light + dark).
- **Used:** `Card`, `Badge`, `Button`, `Field`, `Input`, `Toggle`, `toasts`.
- **States:** nothing picked (thumb hidden, numbers muted) · picked (accent thumb, ink-on-accent
  numeral, readout word) · warn (amber thumb + "gdzie boli?" revealed) · saving (button busy) ·
  saved (footer badge) · dirty (footer hint) · disabled.
- **Motion:** one authored moment — the thumb slides between values (`--transition-base`), suppressed
  under `prefers-reduced-motion`.

## Design / implementation notes

- `ScoreScale` is presentational and controlled: `value` in, `onchange(next|null)` out. It takes
  `min`/`max` as props (default 1–10) rather than importing the journal's `SCORE_*` constants —
  `lib/ui` never reaches into a module.
- Selection uses `role="radio"` + `aria-checked`, and clearing by re-selection is documented on the
  component: it is not standard radio behaviour, and it is the affordance a *voluntary* form needs.
- The card keeps spec 062's seeded-once working copy (`untrack`) and adds a persisted snapshot so
  "dirty" is a comparison rather than a flag that stays true forever after the first save.
- No nag state, still. A day not logged says nothing about the athlete.

## Test plan

- **Unit (jsdom, `*.svelte.test.ts`):** `ScoreScale` — renders a radiogroup of `max-min+1` radios,
  marks the selected one, reports the value on click, reports `null` on re-click, moves with arrow
  keys, clears with Delete, shows the hint word and both poles, applies the warn tone at the
  threshold, blocks interaction when disabled. `Textarea` — binds, honours `maxlength`, shows the
  counter only inside the threshold.
- **API integration:** unchanged and still green (`journal.api.test.ts`) — the contract did not move.

## Closeout

- Commits: <pending — the branch is not committed yet>
- Verified in the dev stack (`docker compose -f docker-compose.dev.yml`, mock adapters) on the real
  dashboard: dark, light and 375px; pick → warn tone → "gdzie boli?" reveal → save → "Zapisano" badge
  and the footer flipping to "wpis na dziś jest zapisany". Score targets are 36px tall on a mouse and
  44px under `pointer: coarse`.
- Notes / follow-ups:
  - The card's copy is still hardcoded Polish, like most of `modules/`; routing it through the spec
    076 catalogs is deliberately out of scope here.
  - **Token-level contrast, app-wide:** `--color-warning` is `amber-500` on a white surface in the
    light theme (~2.1:1), and Badge, Banner, TrainingVerdict and now this readout all use it as small
    text. This spec stays consistent with that system rather than special-casing one component, but
    the light theme wants a darker warning *text* grade (the accent already has one — see the two-job
    comment in `tokens.css`). Worth its own spec.
