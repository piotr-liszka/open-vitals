/**
 * Readout sizing for `StatTile` (spec 029, revised spec 040).
 *
 * The hero readout is `--readout-xl` (up to 48px) and never wraps, which is right for `11 238` and
 * wrong for `6 h 52 min`: the same tile that fits a step count spills a duration past its own border.
 * The step therefore follows the LENGTH of the rendered string, so a long value shrinks instead of
 * escaping the tile.
 *
 * This is deliberately the ONLY sizing input StatTile derives per-value. An earlier revision (spec 031)
 * paired it with a continuous, per-glyph "fit scale" driven by the tile's own container width — which
 * meant two values of the same length could render at visibly different sizes in the same grid, because
 * their exact characters (e.g. digits vs punctuation) advanced by different amounts. That read as broken,
 * not "fitted" (spec 040), so it was removed: the tile's own narrow-column fallback now lives in
 * `StatTile.svelte`'s CSS as fixed, width-only container-query steps, not JS-computed per-value scales.
 *
 * Kept DOM-free so the rule is unit-tested once rather than eyeballed per page, and so it produces the
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
