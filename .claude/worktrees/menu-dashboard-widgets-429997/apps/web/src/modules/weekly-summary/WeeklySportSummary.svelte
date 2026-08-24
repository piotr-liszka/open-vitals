<script lang="ts">
  /**
   * Per-sport weekly training summary (spec 056) — the card that answers "how much have I done this
   * week in MY sport, and is that normal for me?" before the page starts talking about CTL.
   *
   * Presentational: the handler computed every family already, so a chip switch is local state and
   * costs no round-trip. Two decisions live here because they are what the card MEANS:
   *
   *  - There is **no "Wszystkie" chip.** Adding a ride's kilometres to a run's produces a number with
   *    no meaning; a per-sport card that offers a meaningless total is worse than one that does not.
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
  import type { WeeklySummaryData, WeeklySummarySport } from './weekly-summary.types';

  let { data }: { data: WeeklySummaryData } = $props();

  /**
   * The chip the reader picked. `null` means "whatever the payload says is busiest" — deriving the
   * default instead of copying `data.defaultGroup` into state keeps the card correct when a reload
   * brings a different busiest family, without an effect to re-sync it.
   */
  let picked = $state<string | null>(null);

  /** The family on screen. Falls back to the busiest when a stale pick is no longer in the payload. */
  const active = $derived<WeeklySummarySport | undefined>(
    data.sports.find((s) => s.group === picked) ?? data.sports[0]
  );

  const options = $derived<FilterChipOption[]>(data.sports.map((s) => ({ value: s.group, label: s.label })));

  const nf1 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 });
  const nf0 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });

  /** Kilometres, one decimal — the resolution an athlete reads a week's distance at. */
  const km = (metres: number): string => nf1.format(Math.round(metres / 100) / 10);
  /** `Xh Ym`, the same shape the training overview prints, so two cards never spell time differently. */
  const hours = (totalS: number): string => {
    const h = Math.floor(totalS / 3600);
    const m = Math.round((totalS % 3600) / 60);
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
  };

  const weeklyKm = $derived(
    active ? active.weekly.map((w) => Math.round(w.distanceM / 100) / 10) : ([] as number[])
  );

  /**
   * The point the card is about: the week in progress. Derived from the data's own `partial` flag
   * rather than "the last index", so it is still right if a window ever ends on a finished week.
   */
  const emphasisIndex = $derived(active ? active.weekly.findIndex((w) => w.partial) : -1);
  const currentKm = $derived(emphasisIndex >= 0 ? (weeklyKm[emphasisIndex] ?? 0) : 0);

  const weekStartLabel = $derived(formatDay(data.currentWeekStart, 'short'));
</script>

<Card
  title="Podsumowanie tygodnia"
  subtitle="Stałe okno 12 tygodni — niezależne od zakresu wybranego u góry strony"
>
  {#if active}
    <div class="chips">
      <FilterChips
        {options}
        value={active.group}
        onSelect={(value) => {
          if (value !== null) picked = value;
        }}
        ariaLabel="Sport"
        allLabel={null}
        maxVisible={6}
      />
    </div>

    <section class="block" aria-labelledby="weekly-summary-now">
      <div class="head">
        <h4 class="heading" id="weekly-summary-now">Ten tydzień</h4>
        <p class="caption">
          od poniedziałku {weekStartLabel} · {data.currentWeekDays} z 7 dni · {active.label}
        </p>
      </div>
      <div class="tiles">
        <StatTile label="Dystans" value={km(active.thisWeek.distanceM)} unit="km" accent="green" />
        <StatTile
          label="Przewyższenie"
          value={nf0.format(active.thisWeek.elevationGainM)}
          unit="m"
          accent="violet"
        />
        <StatTile label="Czas" value={hours(active.thisWeek.durationS)} accent="cyan" />
      </div>
    </section>

    <section class="block" aria-labelledby="weekly-summary-trend">
      <h4 class="heading" id="weekly-summary-trend">Ostatnie {data.weeks} tygodni</h4>
      <TrendChart
        values={weeklyKm}
        labels={[...data.monthLabels]}
        color={active.color}
        height={200}
        showArea
        label="Dystans"
        unit="km"
        {emphasisIndex}
        emphasisLabel="bieżący tydzień (w toku)"
        formatValue={(n) => `${nf1.format(n)} km`}
      />
      <p class="caption">
        <span class="dot" style="background: {active.color}" aria-hidden="true"></span>
        Ostatni punkt to bieżący, niepełny tydzień: {nf1.format(currentKm)} km po {data.currentWeekDays}
        {data.currentWeekDays === 1 ? 'dniu' : 'dniach'}.
      </p>
    </section>

    <p class="more">
      <a href="/training/objetosc">Pełny widok objętości →</a>
    </p>
  {:else}
    <p class="empty">
      Brak treningów z ostatnich {data.weeks} tygodni. Uruchom synchronizację w zakładce
      <a href="/data">Dane</a>, a rower, bieg i marsz pojawią się tutaj automatycznie.
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
