<script lang="ts" module>
  /** One day in the grid. `value` 0 (or absent) renders as an empty cell. */
  export interface YearGridDay {
    /** `YYYY-MM-DD`. */
    day: string;
    /** Magnitude for the shade — km, minutes, whatever the caller is showing. */
    value: number;
    /** Pre-formatted tooltip line, e.g. "12,4 km · Bieg". Falls back to the value. */
    title?: string | undefined;
  }
</script>

<script lang="ts">
  /**
   * A calendar year as one grid of days — seven rows (Monday at the top), one column per ISO week
   * (spec 046). The shape people know from contribution graphs, and the clearest possible answer to
   * "how consistent was I?": streaks, gaps and seasonal patterns are all visible at once, which no bar
   * chart of weekly totals can show.
   *
   * Presentational and DOM-cheap: 366 spans, no SVG, no interaction beyond the native `title`.
   *
   * ## Two things worth knowing about the design
   *
   * Shading is by QUANTILE, not by a linear share of the maximum. One 40 km long run would otherwise
   * push every ordinary 8 km day into the palest shade and make a consistent year look empty. Quantiles
   * mean "darker than most of your days" rather than "close to your biggest day".
   *
   * A day with no activity is a visibly EMPTY cell rather than the lightest shade, because a rest day and
   * a very short session are different things and the whole point of the grid is spotting the gaps.
   */
  import { addDays, compareDays, dayOfWeek, formatDay, isDayKey, type DayKey } from '$lib/date';
  import { formatNumber, getI18n } from '$lib/i18n';

  const i18n = getI18n();

  interface Props {
    /** Days to draw. Only days inside the drawn span are used; order does not matter. */
    days: readonly YearGridDay[];
    /**
     * First day of the span. With `to`, this draws ANY range — a rolling twelve months as readily as
     * a calendar year (spec 070). Omit both and the grid draws the whole of `year`, which is what
     * every caller wanted while the grid was pinned to the current year.
     */
    from?: string;
    /** Last day of the span, inclusive. */
    to?: string;
    /** The calendar year to draw when `from`/`to` are omitted; also names the span for assistive tech. */
    year: number;
    /** How the span reads in the accessible name, e.g. `2025` or `ostatnie 12 miesięcy`. */
    spanLabel?: string;
    /** Any CSS colour for the darkest shade. Lighter steps are mixed towards the surface. */
    color?: string;
    /** Accessible name for the grid as a whole. */
    ariaLabel?: string;
    /** Unit appended to the default tooltip when a day has no `title`. */
    unit?: string;
  }

  let {
    days,
    from,
    to,
    year,
    spanLabel,
    color = 'var(--color-accent)',
    ariaLabel = 'Aktywność w ciągu roku',
    unit = ''
  }: Props = $props();

  /** The resolved span. A malformed or inverted pair falls back to the whole of `year`. */
  const span = $derived.by(() => {
    const start = from !== undefined && isDayKey(from) ? (from as DayKey) : null;
    const end = to !== undefined && isDayKey(to) ? (to as DayKey) : null;
    if (start === null || end === null || compareDays(start, end) > 0) {
      return { start: `${year}-01-01` as DayKey, end: `${year}-12-31` as DayKey };
    }
    return { start, end };
  });

  const spanName = $derived(spanLabel ?? String(year));

  /** Shades above "empty". Four is enough to read and few enough to stay distinguishable. */
  const STEPS = 4;

  const byDay = $derived(new Map(days.filter((d) => isDayKey(d.day)).map((d) => [d.day, d])));

  /** Every day of the drawn span, oldest first — a real reading or a zero. */
  const drawn = $derived.by(() => {
    const { start, end } = span;
    if (!isDayKey(start) || !isDayKey(end)) return [] as YearGridDay[];
    const out: YearGridDay[] = [];
    for (let key = start; compareDays(key, end) <= 0; key = addDays(key, 1)) {
      out.push(byDay.get(key) ?? { day: key, value: 0 });
    }
    return out;
  });

  /**
   * Quantile cut-points over the non-zero values. With fewer distinct values than steps the cuts simply
   * repeat, which collapses the palette gracefully rather than throwing.
   *
   * Taken over the DRAWN span, not over everything the caller passed. Since spec 070 the volume page
   * ships four years of days so the period switch costs no round trip; shading 2023 against four
   * years of quantiles would recolour a year according to seasons it does not contain.
   */
  const cuts = $derived.by(() => {
    const values = drawn
      .map((d) => d.value)
      .filter((v) => Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b);
    if (values.length === 0) return [];
    return Array.from(
      { length: STEPS - 1 },
      (_, i) => values[Math.floor(((i + 1) / STEPS) * (values.length - 1))] ?? 0
    );
  });

  function levelOf(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return 0;
    let level = 1;
    for (const cut of cuts) if (value > cut) level++;
    return Math.min(STEPS, level);
  }

  /** Columns of seven cells, Monday first. Leading blanks align the first day to its weekday. */
  const columns = $derived.by(() => {
    if (drawn.length === 0) return [];
    const offset = dayOfWeek(drawn[0]!.day as DayKey);
    const cells: (YearGridDay | null)[] = [...new Array<null>(offset).fill(null), ...drawn];

    const out: (YearGridDay | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  });

  const activeDays = $derived(drawn.filter((d) => d.value > 0).length);

  function tooltip(cell: YearGridDay): string {
    const when = isDayKey(cell.day) ? formatDay(i18n.locale, cell.day as DayKey, 'shortYear') : cell.day;
    if (cell.value <= 0) return `${when}: brak aktywności`;
    return cell.title ?? `${when}: ${cell.value}${unit ? ` ${unit}` : ''}`;
  }
</script>

<div class="grid-block" style="--peak: {color}">
  <div
    class="grid"
    role="img"
    aria-label={`${ariaLabel}: ${activeDays} dni z aktywnością — ${spanName}`}
    style="--cols: {columns.length}"
  >
    {#each columns as week, w (w)}
      <div class="week">
        {#each week as cell, d (d)}
          {#if cell}
            <span class="cell" data-level={levelOf(cell.value)} title={tooltip(cell)}></span>
          {:else}
            <span class="cell pad" aria-hidden="true"></span>
          {/if}
        {/each}
      </div>
    {/each}
  </div>

  <div class="legend">
    <span class="legend-label">{i18n.t('yearGrid.less')}</span>
    {#each [0, 1, 2, 3, 4] as level (level)}
      <span class="cell" data-level={level} aria-hidden="true"></span>
    {/each}
    <span class="legend-label">{i18n.t('yearGrid.more')}</span>
  </div>
</div>

<style>
  .grid-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  /* A year is wider than a phone: scroll inside the block, never push the page sideways. */
  .grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: 2px;
    overflow-x: auto;
    padding-bottom: var(--space-1);
  }

  .week {
    display: grid;
    grid-template-rows: repeat(7, 1fr);
    gap: 2px;
  }

  .cell {
    width: 100%;
    aspect-ratio: 1;
    min-width: 6px;
    border-radius: 2px;
    /* A rest day is an EMPTY cell, not the palest shade — that distinction is the point of the grid. */
    background: var(--color-surface-2);
    border: 1px solid transparent;
  }

  .cell[data-level='1'] {
    background: color-mix(in srgb, var(--peak) 25%, var(--color-surface-2));
  }
  .cell[data-level='2'] {
    background: color-mix(in srgb, var(--peak) 50%, var(--color-surface-2));
  }
  .cell[data-level='3'] {
    background: color-mix(in srgb, var(--peak) 75%, var(--color-surface-2));
  }
  .cell[data-level='4'] {
    background: var(--peak);
  }

  .pad {
    background: transparent;
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .legend .cell {
    width: var(--space-3);
    min-width: var(--space-3);
  }

  .legend-label {
    margin: 0 var(--space-2);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }
</style>
