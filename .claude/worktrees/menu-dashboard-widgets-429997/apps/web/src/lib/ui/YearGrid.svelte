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
  import { dayOfWeek, formatDay, isDayKey, type DayKey } from '$lib/date';

  interface Props {
    /** Days to draw. Only days inside `year` are used; order does not matter. */
    days: readonly YearGridDay[];
    year: number;
    /** Any CSS colour for the darkest shade. Lighter steps are mixed towards the surface. */
    color?: string;
    /** Accessible name for the grid as a whole. */
    ariaLabel?: string;
    /** Unit appended to the default tooltip when a day has no `title`. */
    unit?: string;
  }

  let {
    days,
    year,
    color = 'var(--color-accent)',
    ariaLabel = 'Aktywność w ciągu roku',
    unit = ''
  }: Props = $props();

  /** Shades above "empty". Four is enough to read and few enough to stay distinguishable. */
  const STEPS = 4;

  const byDay = $derived(new Map(days.filter((d) => isDayKey(d.day)).map((d) => [d.day, d])));

  /**
   * Quantile cut-points over the non-zero values. With fewer distinct values than steps the cuts simply
   * repeat, which collapses the palette gracefully rather than throwing.
   */
  const cuts = $derived.by(() => {
    const values = [...byDay.values()]
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

  /** Columns of seven cells, Monday first. Leading blanks align 1 January to its weekday. */
  const columns = $derived.by(() => {
    const first = `${year}-01-01`;
    if (!isDayKey(first)) return [];
    const offset = dayOfWeek(first as DayKey);
    const cells: (YearGridDay | null)[] = new Array<null>(offset).fill(null);

    for (let month = 1; month <= 12; month++) {
      for (let day = 1; day <= 31; day++) {
        const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        // `isDayKey` rejects 31 February and friends, so no month-length table is needed here.
        if (!isDayKey(key)) continue;
        cells.push(byDay.get(key) ?? { day: key, value: 0 });
      }
    }

    const out: (YearGridDay | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  });

  const activeDays = $derived([...byDay.values()].filter((d) => d.value > 0).length);

  function tooltip(cell: YearGridDay): string {
    const when = isDayKey(cell.day) ? formatDay(cell.day as DayKey, 'shortYear') : cell.day;
    if (cell.value <= 0) return `${when}: brak aktywności`;
    return cell.title ?? `${when}: ${cell.value}${unit ? ` ${unit}` : ''}`;
  }
</script>

<div class="grid-block" style="--peak: {color}">
  <div
    class="grid"
    role="img"
    aria-label={`${ariaLabel}: ${activeDays} dni z aktywnością w ${year}`}
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
    <span class="legend-label">mniej</span>
    {#each [0, 1, 2, 3, 4] as level (level)}
      <span class="cell" data-level={level} aria-hidden="true"></span>
    {/each}
    <span class="legend-label">więcej</span>
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
