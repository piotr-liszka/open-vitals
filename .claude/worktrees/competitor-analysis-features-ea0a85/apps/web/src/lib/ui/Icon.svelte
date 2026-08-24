<script lang="ts">
  /**
   * The shared icon renderer (spec 022). Draws one glyph from `$lib/ui/icons` at a consistent
   * stroke weight, inheriting `currentColor` so callers tint it with a lane/state token.
   *
   * Decorative by default (`aria-hidden`), because a timeline row's icon repeats the label next to
   * it. Pass `label` only when the icon is the *only* carrier of meaning — then it becomes
   * `role="img"` with an accessible name.
   */
  import { ICONS, type IconName } from './icons';

  interface Props {
    name: IconName;
    /** Rendered box in px (the glyph grid is 24×24). */
    size?: number;
    /** Accessible name. Omit for decorative icons (default). */
    label?: string;
    /** Stroke weight on the 24-grid; matches the app's inline SVGs. */
    strokeWidth?: number;
  }

  let { name, size = 20, label, strokeWidth = 1.6 }: Props = $props();

  const glyph = $derived(ICONS[name]);
</script>

<svg
  class="icon"
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
  focusable="false"
  data-icon={name}
>
  {#each glyph.rects ?? [] as r, i (i)}
    <rect x={r[0]} y={r[1]} width={r[2]} height={r[3]} rx={r[4]} />
  {/each}
  {#each glyph.circles ?? [] as c, i (i)}
    <circle cx={c[0]} cy={c[1]} r={c[2]} />
  {/each}
  {#each glyph.paths as d, i (i)}
    <path {d} />
  {/each}
</svg>

<style>
  .icon {
    display: block;
    flex-shrink: 0;
    /* Optical alignment with adjacent text; the glyph grid is centred in its box. */
    overflow: visible;
  }
</style>
