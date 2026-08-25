<script lang="ts">
  /**
   * The month grid (spec 066). Presentational: the parent resolved the month and the sessions, this
   * only draws them and reports which day was picked.
   *
   * A real `<table>` with `<th scope="col">` weekday headers, because that is what a calendar IS — a
   * grid of days indexed by weekday and week. A pile of `<div>`s would need a hand-built ARIA grid to
   * say the same thing, and would say it worse.
   */
  import { formatDay, formatMonth, addMonths, type DayKey, type MonthKey } from '$lib/date';
  import { monthWeeks } from './planner';
  import { getI18n, type MessageKey } from '$lib/i18n';
  import IconButton from '$lib/ui/IconButton.svelte';

  const i18n = getI18n();

  interface Props {
    month: MonthKey;
    today: DayKey;
    selected: DayKey | null;
    /** How many authored sessions each day holds. */
    authoredByDay: Map<DayKey, number>;
    /** How many synced Garmin events each day holds. */
    plannedByDay: Map<DayKey, number>;
    /**
     * How many of those authored sessions were actually DONE (spec 081). Drawn as a filled dot in
     * the success family — and nothing more: a shortened session, a session moved by a day and an
     * inferred pairing are all "done" here, with the caveats living in the day panel where there is
     * room to read them.
     */
    doneByDay?: Map<DayKey, number>;
    onselect: (day: DayKey) => void;
    onmonth: (month: MonthKey) => void;
    /**
     * True while a library workout is being dragged (spec 069). The cells only become drop targets
     * then — a calendar that accepts drops when nothing is being dragged would light up under any
     * stray drag from elsewhere on the page.
     */
    dropActive?: boolean;
    ondropday?: (day: DayKey) => void;
  }

  let {
    month,
    today,
    selected,
    authoredByDay,
    plannedByDay,
    doneByDay = new Map<DayKey, number>(),
    onselect,
    onmonth,
    dropActive = false,
    ondropday
  }: Props = $props();

  /** The cell the pointer is currently over during a drag. */
  let overDay = $state<DayKey | null>(null);

  function onDragOver(day: DayKey, event: DragEvent): void {
    if (!dropActive) return;
    // Without preventDefault the browser refuses the drop outright.
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    overDay = day;
  }

  function onDrop(day: DayKey, event: DragEvent): void {
    if (!dropActive) return;
    event.preventDefault();
    overDay = null;
    ondropday?.(day);
  }

  const weeks = $derived(monthWeeks(month));

  /** Monday-first, matching `dayOfWeek`. */
  const WEEKDAY_MESSAGE_KEYS: readonly { short: MessageKey; long: MessageKey }[] = [
    { short: 'workout.calendar.mon.short', long: 'workout.calendar.mon.long' },
    { short: 'workout.calendar.tue.short', long: 'workout.calendar.tue.long' },
    { short: 'workout.calendar.wed.short', long: 'workout.calendar.wed.long' },
    { short: 'workout.calendar.thu.short', long: 'workout.calendar.thu.long' },
    { short: 'workout.calendar.fri.short', long: 'workout.calendar.fri.long' },
    { short: 'workout.calendar.sat.short', long: 'workout.calendar.sat.long' },
    { short: 'workout.calendar.sun.short', long: 'workout.calendar.sun.long' }
  ];
  const WEEKDAYS = $derived(
    WEEKDAY_MESSAGE_KEYS.map((k) => ({ short: i18n.t(k.short), long: i18n.t(k.long) }))
  );

  const dayNumber = (day: DayKey): string => String(Number(day.slice(8, 10)));
</script>

<div class="cal">
  <div class="bar">
    <IconButton
      icon="chevron-left"
      size="sm"
      label={i18n.t('workout.calendar.prevMonth')}
      onclick={() => onmonth(addMonths(month, -1))}
    />
    <h3 class="month">{formatMonth(i18n.locale, month, 'longYear')}</h3>
    <IconButton
      icon="chevron-right"
      size="sm"
      label={i18n.t('workout.calendar.nextMonth')}
      onclick={() => onmonth(addMonths(month, 1))}
    />
  </div>

  <table class="grid">
    <thead>
      <tr>
        {#each WEEKDAYS as d (d.short)}
          <th scope="col"><abbr title={d.long}>{d.short}</abbr></th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each weeks as week (week[0]?.day)}
        <tr>
          {#each week as cell (cell.day)}
            {@const authored = authoredByDay.get(cell.day) ?? 0}
            {@const planned = plannedByDay.get(cell.day) ?? 0}
            {@const done = Math.min(doneByDay.get(cell.day) ?? 0, authored)}
            <td
              class:outside={!cell.inMonth}
              class:drop-target={dropActive}
              class:drop-over={overDay === cell.day}
              ondragover={(e) => onDragOver(cell.day, e)}
              ondragleave={() => (overDay = overDay === cell.day ? null : overDay)}
              ondrop={(e) => onDrop(cell.day, e)}
            >
              <button
                type="button"
                class="day"
                class:today={cell.day === today}
                class:selected={cell.day === selected}
                class:has={authored + planned > 0}
                aria-current={cell.day === today ? 'date' : undefined}
                aria-pressed={cell.day === selected}
                onclick={() => onselect(cell.day)}
              >
                <span class="n">{dayNumber(cell.day)}</span>
                <!--
                  Dots, not counts: at this size a number is unreadable, and "is there something on
                  this day, and is it mine or Garmin's" is the whole question a month view answers.
                  The accessible name carries the real count, so nothing is lost to a screen reader.
                -->
                <span class="dots" aria-hidden="true">
                  {#each { length: Math.min(done, 3) } as _, i (i)}<span class="dot mine done"></span>{/each}
                  {#each { length: Math.min(authored - done, 3) } as _, i (i)}<span class="dot mine"
                    ></span>{/each}
                  {#each { length: Math.min(planned, 3) } as _, i (i)}<span class="dot theirs"></span>{/each}
                </span>
                <span class="sr">
                  {formatDay(i18n.locale, cell.day, 'long')}{authored > 0
                    ? i18n.t('workout.calendar.srAuthored', { count: authored })
                    : ''}{done > 0 ? i18n.t('workout.calendar.srDone', { count: done }) : ''}{planned > 0
                    ? i18n.t('workout.calendar.srPlanned', { count: planned })
                    : ''}
                </span>
              </button>
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>

  <p class="legend">
    <span class="dot mine"></span>
    {i18n.t('workout.calendar.legendMine')}
    <span class="dot mine done"></span>
    {i18n.t('workout.calendar.legendDone')}
    <span class="dot theirs"></span>
    {i18n.t('workout.fromGarminBadge')}
  </p>
</div>

<style>
  .cal {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .month {
    margin: 0;
    font-size: var(--text-md);
    font-weight: var(--font-bold);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text);
    text-transform: capitalize;
  }
  .grid {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .grid th {
    padding-bottom: var(--space-2);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-subtle);
  }
  .grid th abbr {
    text-decoration: none;
  }
  .grid td {
    padding: 2px;
  }
  /* Only a live drag makes a cell look droppable — see `dropActive`. The outline goes on the TD so it
     does not fight the button's own today/selected marks inside it. */
  .grid td.drop-target {
    border-radius: var(--radius-md);
    outline: 1px dashed var(--color-border-strong);
    outline-offset: -2px;
  }
  .grid td.drop-over {
    outline: 2px dashed var(--color-accent);
    background: var(--color-accent-soft);
  }
  /* Days borrowed from the neighbouring months are context, not destinations — dimmed but still
     clickable, because a session on the 1st is a session you may want to open from here. */
  .outside .day {
    opacity: 0.4;
  }

  .day {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    width: 100%;
    aspect-ratio: 1;
    min-height: var(--space-10);
    padding: 0;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-feature-settings: var(--numeric);
    cursor: pointer;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast);
  }
  .day:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .day:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .day.has {
    color: var(--color-text);
    font-weight: var(--font-semibold);
  }
  /* Today is a ring; the selection is a fill. Two different questions, so two different marks —
     and they stack, because today can also be selected. */
  .day.today {
    border-color: var(--color-border-strong);
  }
  .day.selected {
    background: var(--color-accent-soft);
    border-color: transparent;
    color: var(--color-accent);
  }

  .dots {
    display: flex;
    gap: 2px;
    height: 5px;
  }
  .dot {
    width: 5px;
    height: 5px;
    border-radius: var(--radius-full);
    display: inline-block;
  }
  .dot.mine {
    background: var(--color-accent);
  }
  .dot.theirs {
    background: var(--color-text-subtle);
  }
  /* Spec 081: done. Same size and place as the planned dot — only the colour changes, so a day
     reads at a glance without the grid growing a second vocabulary. */
  .dot.mine.done {
    background: var(--color-success);
  }

  .legend {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
  }
  .legend .dot {
    margin-left: var(--space-2);
  }
  .legend .dot:first-child {
    margin-left: 0;
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
