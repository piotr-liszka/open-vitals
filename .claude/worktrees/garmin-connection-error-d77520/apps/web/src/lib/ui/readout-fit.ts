/**
 * Readout sizing for `StatTile` (specs 029 + 031).
 *
 * The hero readout is `--readout-xl` (up to 48px) and never wraps, which is right for `11 238` and
 * wrong for `6 h 52 min`: the same tile that fits a step count spills a duration past its own border.
 * The step therefore follows the LENGTH of the rendered string, so a long value shrinks instead of
 * escaping the tile.
 *
 * Length alone is not enough, though, because the same string is roomy in a 250px dashboard tile and
 * impossible in a 118px activity-detail tile — the readout tokens scale with the VIEWPORT while
 * `auto-fit` grids spend extra width on more columns. So the step above is paired with a *fit scale*
 * (spec 031): the reciprocal of the readout's width in em, which lets the component's CSS size the type
 * against the tile's own width in `cqw`. `min(token, 100cqw × scale)` then means "hero size unless the
 * tile is too narrow for it".
 *
 * Kept DOM-free so the rules are unit-tested once rather than eyeballed per page, and so they produce the
 * same result on the server and in the browser (no measurement, no hydration mismatch).
 */

/** Readout size steps, mapping 1:1 onto the `--readout-*` tokens. */
export type ReadoutStep = 'xl' | 'lg' | 'md' | 'sm';

/**
 * Widest character count each step may carry. Derived from the narrowest tile column in the app
 * (`minmax(160px, 1fr)` minus `--space-5` padding ≈ 145px) against the token's upper clamp, with the
 * heavy `--font-black` digit advance (~0.55em) in mind.
 */
const MAX_CHARS: ReadonlyArray<readonly [ReadoutStep, number]> = [
  ['xl', 5],
  ['lg', 7],
  ['md', 9]
];

/**
 * A unit sits on the same line as the value but renders at roughly 40% of its size, so it costs less
 * than a value character. Weighted rather than ignored: `1 234 km` overflows where `1 234` fits.
 */
const UNIT_WEIGHT = 0.45;

/**
 * The size step a readout should render at, given the value and any unit shown beside it.
 * `value` is the RENDERED string (already `Intl`-formatted), because that is what has to fit.
 */
export function readoutStep(value: string | number, unit?: string): ReadoutStep {
  const length = String(value).length + Math.ceil((unit?.length ?? 0) * UNIT_WEIGHT);
  for (const [step, max] of MAX_CHARS) {
    if (length <= max) return step;
  }
  return 'sm';
}

/*
  Advance widths as a fraction of the font size. Measured in the browser against the shipped stack
  (Inter → system-ui) at the weights and tracking the tile actually uses, then rounded up a little: the
  model has to stay on the conservative side, with `.readout { overflow: hidden }` as the hard boundary.
*/

/** One `--font-black` readout glyph — tabular digits and caps measure ~0.65em at `--tracking-tight`. */
const VALUE_CHAR_EM = 0.67;
/** Punctuation and spaces inside a readout ("6,11", "1:34:50", "1 234") are barely half that. */
const NARROW_CHAR_EM = 0.3;
// Escaped on purpose: the spaces are the no-break (U+00A0) and thin (U+2009/U+202F) ones `Intl`
// puts in grouped numbers, and an invisible literal in a source file is a trap.
const NARROW_CHARS = new Set([
  ' ',
  '\u00a0',
  '\u2009',
  '\u202f',
  ',',
  '.',
  ':',
  '/',
  '-',
  "'",
  '\u2019',
  '|'
]);
/** One `--font-semibold` unit glyph at the unit's own size ("bpm" measures 0.68em, "W" 0.95em). */
const UNIT_CHAR_EM = 0.72;
/** The unit renders at this fraction of the value's size — see `.unit` in `StatTile`. */
const UNIT_SIZE_RATIO = 0.45;
/** One uppercase micro-caps label glyph, `--tracking-widest` included (measured ~0.82em). */
const LABEL_CHAR_EM = 0.84;

/** Width of a string in em at the given per-glyph advance, with narrow glyphs charged less. */
function advanceEm(text: string, charEm: number): number {
  let em = 0;
  for (const char of text) em += NARROW_CHARS.has(char) ? NARROW_CHAR_EM : charEm;
  return em;
}

/** Scales are only ever consumed as `calc(100cqw * scale)`; four decimals is well past pixel-accurate. */
function scaleFor(widthEm: number): number {
  return widthEm > 0 ? Math.round((1 / widthEm) * 10_000) / 10_000 : 1;
}

/**
 * Reciprocal of the width, in em, that a readout needs for its value and unit side by side — i.e. the
 * font size at which the pair exactly fills one em of available width. CSS multiplies it by the tile's
 * width (`100cqw`) to get the largest size that still fits, and caps that with the step token.
 */
export function readoutFitScale(value: string | number, unit?: string): number {
  const valueEm = advanceEm(String(value), VALUE_CHAR_EM);
  const unitEm = advanceEm(unit ?? '', UNIT_CHAR_EM) * UNIT_SIZE_RATIO;
  return scaleFor(valueEm + unitEm);
}

/**
 * Same idea for the tile's micro-caps label, sized off its LONGEST WORD: a label with spaces already has
 * wrap opportunities and keeps its size, while a single unbreakable word (`PRZEWYŻSZENIE`) is the case
 * that used to run past the tile border.
 */
export function labelFitScale(label: string): number {
  let longest = 0;
  for (const word of String(label).split(/\s+/)) {
    if (word.length > longest) longest = word.length;
  }
  return scaleFor(longest * LABEL_CHAR_EM);
}
