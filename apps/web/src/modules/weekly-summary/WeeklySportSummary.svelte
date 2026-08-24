<script lang="ts">
  /**
   * Weekly training summary (specs 056, 089) — the card that answers "how big was my week, and is
   * that normal for me?" before the page starts talking about CTL.
   *
   * Presentational: the handler computed every family already, so a chip switch is local state and
   * costs no round-trip. Three decisions live here because they are what the card MEANS:
   *
   *  - The card leads with **Wszystko** and adds every sport up — but that section shows time, climb
   *    and sessions, and **never distance**. Adding a ride's kilometres to a run's still produces a
   *    number with no meaning; that objection was always about DISTANCE ALONE, and hours, metres
   *    climbed and sessions done are exactly what "how big was my week" asks. The section says so in
   *    one line rather than silently showing one tile fewer.
   *  - The Wszystko chip is **absent** for an athlete with a single sport family: a "Wszystko" that
   *    can only ever mean "Bieg" is a second name for the same tab.
   *  - The last point is **the week in progress**, and it is said three ways: the decorative emphasis
   *    on the chart, a caption naming it in words, and the chart's own accessible summary. A partial
   *    week that merely looks like a dip is the single most misleading thing this card could do.
   *
   * Formatting helpers are inlined rather than imported: the shared ones live in `$lib/server` (which
   * a component may not import) or in another module's folder (AGENTS.md §5 forbids reaching in).
   */
  import Card from '$lib/ui/Card.svelte';
  import FilterChips, { type FilterChipOption } from '$lib/ui/FilterChips.svelte';
  import StatTile from '$lib/ui/StatTile.svelte';
  import TrendChart from '$lib/ui/TrendChart.svelte';
  import { formatDay } from '$lib/date';
  import {
    ALL_SPORTS,
    type WeeklySummaryData,
    type WeeklySummarySelection,
    type WeeklySummaryTotals,
    type WeeklySummaryWeek
  } from './weekly-summary.types';
  import { formatNumber, getI18n } from '$lib/i18n';

  const i18n = getI18n();

  let { data }: { data: WeeklySummaryData } = $props();

  /**
   * The chip the reader picked. `null` means "whatever the payload opens on" — deriving the default
   * instead of copying `data.defaultGroup` into state keeps the card correct when a reload brings a
   * different busiest family (or a second sport, which turns Wszystko on), without an effect to
   * re-sync it.
   */
  let picked = $state<WeeklySummarySelection | null>(null);

  /** Can this payload actually render that selection? A stale pick must not blank the card. */
  function renderable(value: WeeklySummarySelection | null): boolean {
    if (value === null) return false;
    if (value === ALL_SPORTS) return data.combined !== null;
    return data.sports.some((s) => s.group === value);
  }

  /** What is on screen: the pick, else what the payload opens on, else the busiest family. */
  const selection = $derived.by<WeeklySummarySelection | null>(() => {
    if (renderable(picked)) return picked;
    if (renderable(data.defaultGroup)) return data.defaultGroup;
    return data.sports[0]?.group ?? null;
  });

  const showingAll = $derived(selection === ALL_SPORTS);

  /** What the section renders — one family, or every family folded together. */
  interface SummaryView {
    readonly label: string;
    readonly color: string;
    readonly thisWeek: WeeklySummaryTotals;
    readonly weekly: readonly WeeklySummaryWeek[];
  }

  const view = $derived.by<SummaryView | null>(() => {
    const combined = data.combined;
    if (showingAll && combined !== null) {
      return {
        label: i18n.t('weeklySummary.all.subject'),
        /*
         * The accent, not a lane token: a lane colour is one sport's identity everywhere else in the
         * app, so painting the total of every sport in it would claim the line belongs to that sport.
         */
        color: 'var(--color-accent)',
        thisWeek: combined.thisWeek,
        weekly: combined.weekly
      };
    }
    const sport = data.sports.find((s) => s.group === selection);
    return sport
      ? { label: sport.label, color: sport.color, thisWeek: sport.thisWeek, weekly: sport.weekly }
      : null;
  });

  const options = $derived<FilterChipOption[]>(data.sports.map((s) => ({ value: s.group, label: s.label })));

  /**
   * Chip → selection. `null` is `FilterChips`' "all" chip; a named value is matched against the
   * payload rather than cast, so a chip value the data no longer carries changes nothing.
   */
  function pick(value: string | null): void {
    if (value === null) {
      if (data.combined !== null) picked = ALL_SPORTS;
      return;
    }
    const sport = data.sports.find((s) => s.group === value);
    if (sport !== undefined) picked = sport.group;
  }

  const nf1 = (n: number): string => formatNumber(i18n.locale, n, { maximumFractionDigits: 1 });
  const nf0 = (n: number): string => formatNumber(i18n.locale, n, { maximumFractionDigits: 0 });

  /** Kilometres, one decimal — the resolution an athlete reads a week's distance at. */
  const km = (metres: number): string => nf1(Math.round(metres / 100) / 10);
  /** `Xh Ym`, the same shape the training overview prints, so two cards never spell time differently. */
  const hours = (totalS: number): string => {
    const h = Math.floor(totalS / 3600);
    const m = Math.round((totalS % 3600) / 60);
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
  };

  /**
   * What the chart plots: kilometres for one sport, HOURS for Wszystko. Distance is the one measure
   * that does not survive being added across sports, and time is the one that answers the same
   * question for all of them at once.
   */
  const chartValues = $derived.by<number[]>(() => {
    if (view === null) return [];
    return showingAll
      ? view.weekly.map((w) => Math.round(w.durationS / 360) / 10)
      : view.weekly.map((w) => Math.round(w.distanceM / 100) / 10);
  });

  const chartUnit = $derived(showingAll ? i18n.t('training.volume.unit') : 'km');
  const chartLabel = $derived(showingAll ? i18n.t('timeline.stat.time') : i18n.t('timeline.stat.distance'));
  const point = (n: number): string => `${nf1(n)} ${chartUnit}`;

  /**
   * The point the card is about: the week in progress. Derived from the data's own `partial` flag
   * rather than "the last index", so it is still right if a window ever ends on a finished week.
   */
  const emphasisIndex = $derived(view ? view.weekly.findIndex((w) => w.partial) : -1);
  const currentValue = $derived(emphasisIndex >= 0 ? (chartValues[emphasisIndex] ?? 0) : 0);

  const weekStartLabel = $derived(formatDay(i18n.locale, data.currentWeekStart, 'short'));

  const currentWeekDayWord = $derived(
    i18n.t('weeklySummary.currentWeekDayWord', { count: data.currentWeekDays })
  );
</script>

<Card title={i18n.t('weeklySummary.title')} subtitle={i18n.t('weeklySummary.subtitle')}>
  {#if view}
    <div class="chips">
      <FilterChips
        {options}
        value={showingAll ? null : (selection ?? null)}
        onSelect={pick}
        ariaLabel={i18n.t('weeklySummary.sportAriaLabel')}
        allLabel={data.combined ? i18n.t('weeklySummary.all.chip') : null}
        maxVisible={6}
      />
    </div>

    <section class="block" aria-labelledby="weekly-summary-now">
      <div class="head">
        <h4 class="heading" id="weekly-summary-now">{i18n.t('weeklySummary.thisWeekHeading')}</h4>
        <p class="caption">
          {i18n.t('weeklySummary.thisWeekCaption', {
            weekStart: weekStartLabel,
            days: data.currentWeekDays,
            label: view.label
          })}
        </p>
      </div>
      <div class="tiles">
        {#if showingAll}
          <!-- Time, climb and sessions add up across sports. Distance does not, so it is not here. -->
          <StatTile
            label={i18n.t('timeline.stat.time')}
            value={hours(view.thisWeek.durationS)}
            accent="cyan"
          />
          <StatTile
            label={i18n.t('timeline.stat.elevation')}
            value={nf0(view.thisWeek.elevationGainM)}
            unit="m"
            accent="violet"
          />
          <StatTile
            label={i18n.t('weeklySummary.all.sessions')}
            value={nf0(view.thisWeek.activities)}
            accent="orange"
          />
        {:else}
          <StatTile
            label={i18n.t('timeline.stat.distance')}
            value={km(view.thisWeek.distanceM)}
            unit="km"
            accent="green"
          />
          <StatTile
            label={i18n.t('timeline.stat.elevation')}
            value={nf0(view.thisWeek.elevationGainM)}
            unit="m"
            accent="violet"
          />
          <StatTile
            label={i18n.t('timeline.stat.time')}
            value={hours(view.thisWeek.durationS)}
            accent="cyan"
          />
        {/if}
      </div>
      {#if showingAll}
        <p class="note">{i18n.t('weeklySummary.all.noDistance')}</p>
      {/if}
    </section>

    <section class="block" aria-labelledby="weekly-summary-trend">
      <h4 class="heading" id="weekly-summary-trend">
        {i18n.t('weeklySummary.trendHeading', { weeks: data.weeks })}
      </h4>
      <TrendChart
        values={chartValues}
        labels={[...data.monthLabels]}
        color={view.color}
        height={200}
        showArea
        label={chartLabel}
        unit={chartUnit}
        {emphasisIndex}
        emphasisLabel={i18n.t('weeklySummary.emphasisLabel')}
        formatValue={point}
      />
      <p class="caption">
        <span class="dot" style="background: {view.color}" aria-hidden="true"></span>
        {i18n.t('weeklySummary.trendCaption', {
          value: point(currentValue),
          days: data.currentWeekDays,
          dayWord: currentWeekDayWord
        })}
      </p>
    </section>

    <p class="more">
      <a href="/training/volume">{i18n.t('weeklySummary.moreLink')}</a>
    </p>
  {:else}
    <p class="empty">
      {i18n.t('weeklySummary.emptyBody', { weeks: data.weeks })}
      <a href="/data">{i18n.t('nav.data')}</a>{i18n.t('weeklySummary.emptyBodyTail')}
    </p>
  {/if}
</Card>

<style>
  .chips {
    margin-bottom: var(--space-5);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .block + .block {
    margin-top: var(--space-6);
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .heading {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-subtle);
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
  }

  @media (max-width: 520px) {
    .tiles {
      grid-template-columns: 1fr;
    }
  }

  .caption {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    font-feature-settings: var(--numeric);
  }

  .note {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    line-height: var(--leading-normal);
  }

  .dot {
    display: inline-block;
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    margin-right: var(--space-1);
  }

  .more {
    margin: var(--space-6) 0 0;
    font-size: var(--text-sm);
  }

  .more a,
  .empty a {
    color: var(--color-accent);
    text-decoration: none;
  }

  .more a:hover,
  .empty a:hover {
    text-decoration: underline;
  }

  .more a:focus-visible,
  .empty a:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
    border-radius: var(--radius-sm);
  }

  .empty {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }
</style>
