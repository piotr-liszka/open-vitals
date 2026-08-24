<script lang="ts">
  /**
   * The start page's timeline (spec 022): one stream of events on a single rail — **not a calendar**.
   * Backwards it covers the last 14 days grouped by day; forwards it carries whatever is scheduled
   * for the next 7.
   *
   * DIRECTION — an extension of the app's "Race Telemetry / Instrument" world, inherited whole.
   *  · THESIS: a life-of-the-body log read like a chart recorder's trace: one continuous rail, days
   *    as tick marks, events as nodes. Refuses the month-grid calendar (which spends most of its
   *    pixels on empty squares) and the "recent activities" table (which hides the health story).
   *  · WORLD: a hairline rail; lane-coloured nodes; a glyph tile per event; heavy tabular micro
   *    readouts. No nested cards, no coloured left borders.
   *
   * TWO GEOMETRIES, ONE STREAM (spec 032). The reader picks in the card header, and the choice is
   * remembered per device (`localStorage`, see `lib/ui/pref.ts`):
   *  · `vertical`  — spec 022's rail, newest-first: today at the top → back through the fortnight →
   *    the rule → what is planned. Best for reading detail.
   *  · `horizontal` — the same events on a real time AXIS, chronological left → right (oldest → dziś
   *    → planned), one day per column, scrolled horizontally and opened at today. Best for seeing
   *    span and shape.
   * Both layouts read from the SAME `groups` derivation, so they can never disagree about which
   * events are on screen — only about where they sit.
   */
  import { onMount } from 'svelte';
  import {
    Badge,
    Button,
    Card,
    Icon,
    SegmentedControl,
    readBoolPref,
    readEnumPref,
    writeBoolPref,
    writePref
  } from '$lib/ui';
  import { daysBetween, formatDay } from '$lib/date';
  import TimelineEventRow from './TimelineEventRow.svelte';
  import {
    TIMELINE_EXPANDED_KEY,
    TIMELINE_ORIENTATION_KEY,
    TIMELINE_ORIENTATIONS,
    type DayKey,
    type PlannedEvent,
    type TimelineData,
    type TimelineEvent,
    type TimelineOrientation
  } from './timeline.types';

  interface Props {
    data: TimelineData | null;
    /** Garmin connected? Drives the not-connected state. */
    connected?: boolean;
    /** detailed_analytics consent. */
    enabled?: boolean;
  }

  let { data, connected = true, enabled = true }: Props = $props();

  /**
   * Collapsed on SSR and the first client render; the stored choice is applied on mount, like the
   * orientation below, so hydration can never mismatch.
   */
  let expanded = $state(false);

  function toggleExpanded(): void {
    expanded = !expanded;
    writeBoolPref(TIMELINE_EXPANDED_KEY, expanded);
  }

  /**
   * SSR and the first client render are always `vertical`; the stored preference is applied on mount,
   * so a hydration mismatch is impossible.
   */
  let orientation = $state<TimelineOrientation>('vertical');
  let track = $state<HTMLDivElement | null>(null);

  const ORIENTATION_OPTIONS = [
    { value: 'vertical', label: 'Pion' },
    { value: 'horizontal', label: 'Poziom' }
  ];

  onMount(() => {
    orientation = readEnumPref(TIMELINE_ORIENTATION_KEY, TIMELINE_ORIENTATIONS, 'vertical');
    expanded = readBoolPref(TIMELINE_EXPANDED_KEY, false);
  });

  function rememberOrientation(next: string): void {
    writePref(TIMELINE_ORIENTATION_KEY, next);
  }

  const visible = $derived<TimelineEvent[]>(
    data === null ? [] : expanded ? [...data.past.events] : data.past.events.filter((e) => e.primary)
  );

  interface DayGroup {
    day: DayKey;
    label: string;
    events: TimelineEvent[];
  }

  /** "dziś" / "wczoraj" beat a date string for the two days a reader actually thinks in. */
  function dayLabel(day: DayKey, today: DayKey): string {
    const delta = daysBetween(day, today);
    if (delta === 0) return 'dziś';
    if (delta === 1) return 'wczoraj';
    return formatDay(day, 'weekday');
  }

  const groups = $derived<DayGroup[]>(
    data === null
      ? []
      : visible.reduce<DayGroup[]>((acc, event) => {
          const last = acc[acc.length - 1];
          if (last && last.day === event.day) {
            last.events.push(event);
            return acc;
          }
          acc.push({ day: event.day, label: dayLabel(event.day, data.today), events: [event] });
          return acc;
        }, [])
  );

  /** The axis reads left → right in real time order, inside the day as well as across days. */
  const axisGroups = $derived<DayGroup[]>(
    [...groups].reverse().map((g) => ({ ...g, events: [...g.events].reverse() }))
  );

  /**
   * Badge for a session the athlete authored here (spec 050). It answers the one question a planned
   * row cannot otherwise answer — "is this actually on my watch?" — so an unsent session is never
   * mistaken for one Garmin already has. Plans that came FROM Garmin get no badge: they are on the
   * watch by definition.
   */
  const PUSH_BADGE: Record<string, { tone: 'neutral' | 'success' | 'warning' | 'danger'; label: string }> = {
    pending: { tone: 'neutral', label: 'do wysłania' },
    pushed: { tone: 'success', label: 'w Garminie' },
    failed: { tone: 'warning', label: 'błąd wysyłki' },
    unsupported: { tone: 'danger', label: 'niewspierane' }
  };
  const pushBadge = (event: PlannedEvent) =>
    event.authored && event.push ? (PUSH_BADGE[event.push] ?? null) : null;

  const hiddenCount = $derived(data === null ? 0 : data.past.totalCount - data.past.primaryCount);
  const windowDays = $derived(data === null ? 14 : daysBetween(data.past.from, data.past.to) + 1);
  const plannedDays = $derived(data === null ? 7 : daysBetween(data.planned.from, data.planned.to) + 1);

  /**
   * Which edges of the axis have more track behind them. Drives the fades, so an edge is only faded
   * when something is actually hidden there — a permanent fade would eat the first day's label.
   */
  let moreBefore = $state(false);
  let moreAfter = $state(false);

  function measureEdges(el: HTMLDivElement): void {
    moreBefore = el.scrollLeft > 1;
    moreAfter = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
  }

  /**
   * Open the axis at *today* (its right end, where the planned column sits) rather than at the oldest
   * day two weeks back. Re-runs whenever the layout or the visible set changes, and is a harmless
   * no-op while the track is not overflowing.
   */
  $effect(() => {
    if (orientation !== 'horizontal') return;
    const el = track;
    const columns = axisGroups.length; // a dependency: new columns move where "today" sits
    if (!el || columns === 0) return;
    el.scrollLeft = el.scrollWidth;
    measureEdges(el);
  });
</script>

<Card title="Oś czasu" subtitle={`Ostatnie ${windowDays} dni i najbliższe ${plannedDays}`}>
  {#snippet actions()}
    {#if connected && enabled && data !== null}
      <SegmentedControl
        options={ORIENTATION_OPTIONS}
        bind:value={orientation}
        ariaLabel="Układ osi czasu"
        size="sm"
        onChange={rememberOrientation}
      />
    {/if}
  {/snippet}

  {#if !connected}
    <p class="note">Połącz konto Garmin, aby zobaczyć swoją oś czasu.</p>
    <a class="link" href="/settings">Połącz w Ustawieniach →</a>
  {:else if !enabled}
    <p class="note">
      Oś czasu korzysta z Twoich zsynchronizowanych danych. Włącz tryb zaawansowany, aby ją uruchomić.
    </p>
  {:else if data === null}
    <p class="note">Za mało danych — synchronizuj zegarek i wróć za chwilę.</p>
  {:else if orientation === 'horizontal'}
    <!-- ------------------------------------------------------------------ *
         Horizontal: one continuous axis, oldest → dziś → planned.
         * ------------------------------------------------------------------ -->
    <div class="timeline" data-orientation="horizontal">
      {#if axisGroups.length === 0 && data.planned.status !== 'ok'}
        <p class="note">
          Brak zdarzeń w ostatnich {windowDays} dniach. Kiedy zsynchronizujesz trening albo pojawi się nietypowy
          odczyt, zobaczysz je tutaj.
        </p>
      {:else}
        <!--
          A horizontally scrolling region must be reachable by keyboard, so it takes focus itself and
          arrow keys scroll it — the one legitimate case for `tabindex` on a non-interactive element.
        -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="axis"
          class:fade-start={moreBefore}
          class:fade-end={moreAfter}
          role="group"
          tabindex="0"
          aria-label={`Oś czasu — ostatnie ${windowDays} dni, przewijana w poziomie`}
          bind:this={track}
          onscroll={(e) => measureEdges(e.currentTarget)}
        >
          <ol class="track">
            {#each axisGroups as group (group.day)}
              <li class="col" class:is-today={group.day === data.today}>
                <div class="col-head">
                  <span class="col-label">{group.label}</span>
                  <span class="col-date">{formatDay(group.day, 'numeric')}</span>
                </div>
                <div class="rule" aria-hidden="true"><span class="tick"></span></div>
                <ul class="col-events">
                  {#each group.events as event (event.id)}
                    <TimelineEventRow {event} layout="column" />
                  {/each}
                </ul>
              </li>
            {/each}

            {#if data.planned.status === 'ok'}
              {#each data.planned.events as event (event.id)}
                <li class="col ahead">
                  <div class="col-head">
                    <span class="col-label">{formatDay(event.day, 'weekday')}</span>
                    <span class="col-date">{event.time ?? 'plan'}</span>
                  </div>
                  <div class="rule" aria-hidden="true"><span class="tick"></span></div>
                  <div class="col-events">
                    <div class="plan column">
                      <span class="glyph"><Icon name="calendar" size={18} /></span>
                      <div class="plan-body">
                        <span class="plan-title">{event.title}</span>
                        {#if pushBadge(event)}
                          <span class="plan-state">
                            <Badge tone={pushBadge(event)!.tone}>{pushBadge(event)!.label}</Badge>
                          </span>
                        {/if}
                        {#if event.description}<p class="detail">{event.description}</p>{/if}
                      </div>
                    </div>
                  </div>
                </li>
              {/each}
            {:else}
              <li class="col ahead">
                <div class="col-head">
                  <span class="col-label">Co dalej</span>
                  <span class="col-date">{plannedDays} dni</span>
                </div>
                <div class="rule" aria-hidden="true"><span class="tick"></span></div>
                <div class="col-events">
                  {#if data.planned.status === 'empty'}
                    <p class="empty-title">Brak zaplanowanych treningów</p>
                    <p class="note">Na najbliższe {plannedDays} dni nie masz nic w kalendarzu Garmina.</p>
                  {:else}
                    <p class="empty-title">Zaplanowane treningi nie są jeszcze synchronizowane</p>
                    <p class="note">
                      Nie pobieramy jeszcze kalendarza treningów z Garmina, więc nie pokazujemy tu nic —
                      zamiast zgadywać, co masz w planie.
                    </p>
                  {/if}
                </div>
              </li>
            {/if}
          </ol>
        </div>

        {#if hiddenCount > 0}
          <div class="expander">
            <Button size="sm" variant="ghost" aria-expanded={expanded} onclick={toggleExpanded}>
              {expanded ? 'Pokaż tylko najważniejsze' : `Pokaż wszystkie zdarzenia (${data.past.totalCount})`}
            </Button>
            {#if !expanded}
              <span class="expander-note">ukryto {hiddenCount} mniej istotnych</span>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  {:else}
    <!-- ------------------------------------------------------------------ *
         Vertical: the original rail, newest-first (spec 022).
         * ------------------------------------------------------------------ -->
    <div class="timeline" data-orientation="vertical">
      <section class="half" aria-labelledby="timeline-past">
        <h4 class="half-title" id="timeline-past">Co się wydarzyło</h4>

        {#if groups.length === 0}
          <p class="note">
            Brak zdarzeń w ostatnich {windowDays} dniach. Kiedy zsynchronizujesz trening albo pojawi się nietypowy
            odczyt, zobaczysz je tutaj.
          </p>
        {:else}
          <ol class="rail">
            {#each groups as group (group.day)}
              <li class="group">
                <div class="day">
                  <span class="day-node" aria-hidden="true"></span>
                  <span class="day-label">{group.label}</span>
                  <span class="day-date">{formatDay(group.day, 'numeric')}</span>
                </div>
                <ul class="events">
                  {#each group.events as event (event.id)}
                    <TimelineEventRow {event} />
                  {/each}
                </ul>
              </li>
            {/each}
          </ol>

          {#if hiddenCount > 0}
            <div class="expander">
              <Button size="sm" variant="ghost" aria-expanded={expanded} onclick={toggleExpanded}>
                {expanded
                  ? 'Pokaż tylko najważniejsze'
                  : `Pokaż wszystkie zdarzenia (${data.past.totalCount})`}
              </Button>
              {#if !expanded}
                <span class="expander-note">ukryto {hiddenCount} mniej istotnych</span>
              {/if}
            </div>
          {/if}
        {/if}
      </section>

      <section class="half planned" aria-labelledby="timeline-next">
        <h4 class="half-title" id="timeline-next">Co dalej</h4>

        {#if data.planned.status === 'ok'}
          <ol class="rail">
            {#each data.planned.events as event (event.id)}
              <li class="group">
                <div class="day">
                  <span class="day-node" aria-hidden="true"></span>
                  <span class="day-label">{formatDay(event.day, 'weekday')}</span>
                  {#if event.time}<span class="day-date">{event.time}</span>{/if}
                </div>
                <div class="plan">
                  <span class="glyph"><Icon name="calendar" size={18} /></span>
                  <div class="plan-body">
                    <span class="plan-title">{event.title}</span>
                    {#if pushBadge(event)}
                      <span class="plan-state">
                        <Badge tone={pushBadge(event)!.tone}>{pushBadge(event)!.label}</Badge>
                      </span>
                    {/if}
                    {#if event.description}<p class="detail">{event.description}</p>{/if}
                  </div>
                </div>
              </li>
            {/each}
          </ol>
        {:else}
          <div class="empty">
            <span class="empty-glyph"><Icon name="calendar" size={20} /></span>
            <div class="empty-body">
              {#if data.planned.status === 'empty'}
                <p class="empty-title">Brak zaplanowanych treningów</p>
                <p class="note">
                  Na najbliższe {plannedDays} dni nie masz nic w kalendarzu Garmina.
                </p>
              {:else}
                <p class="empty-title">Zaplanowane treningi nie są jeszcze synchronizowane</p>
                <p class="note">
                  Nie pobieramy jeszcze kalendarza treningów z Garmina, więc nie pokazujemy tu nic — zamiast
                  zgadywać, co masz w planie. Gdy synchronizacja planu ruszy, to miejsce wypełni się samo.
                </p>
              {/if}
            </div>
          </div>
        {/if}
      </section>
    </div>
  {/if}
</Card>

<style>
  .note {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
    max-width: 68ch;
  }

  .link {
    display: inline-block;
    margin-top: var(--space-2);
    color: var(--color-accent);
    text-decoration: none;
    font-weight: var(--font-medium);
    font-size: var(--text-sm);
  }
  .link:hover {
    text-decoration: underline;
  }

  .timeline {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .half {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }

  .half.planned {
    padding-top: var(--space-5);
    border-top: 1px solid var(--color-border);
  }

  .half-title {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
  }

  .rail,
  .events,
  .track,
  .col-events {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .rail {
    display: flex;
    flex-direction: column;
  }

  .group {
    position: relative;
    padding-left: var(--space-4);
  }

  /* The single continuous rail — one hairline the whole stream hangs off. */
  .group::before {
    content: '';
    position: absolute;
    left: var(--space-4);
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--color-grid);
  }

  .group:first-child::before {
    top: var(--space-2);
  }

  .group:last-child::before {
    bottom: auto;
    height: var(--space-6);
  }

  .day {
    position: relative;
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    padding: var(--space-2) 0 var(--space-1) var(--space-6);
  }

  .day-node {
    position: absolute;
    left: 0;
    top: 0.5rem;
    width: var(--space-3);
    height: 1px;
    background: var(--color-border-strong);
  }

  .day-label {
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text);
  }

  .day-date {
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    font-feature-settings: var(--numeric);
  }

  .events {
    display: flex;
    flex-direction: column;
  }

  .expander {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .expander-note {
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    letter-spacing: var(--tracking-wide);
    font-feature-settings: var(--numeric);
  }

  /* --- horizontal axis (spec 032) --- */
  .axis {
    /* Bleed to the card's edges so the axis reads as an instrument track, not a boxed widget. The
       inset lives on the track and is mirrored as `scroll-padding`, which is what keeps a snapped
       first column at `scrollLeft: 0` (plain padding would rest it at 20px and make "there is more
       to the left" permanently true). */
    margin: 0 calc(-1 * var(--space-5));
    scroll-padding-inline: var(--space-5);
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    scroll-snap-type: x proximity;
  }

  /* Fade only the edge that actually hides track, so the first/last day is never eaten by a
     decoration. `fade-*` is toggled from the scroll position. */
  .axis.fade-start {
    mask-image: linear-gradient(to right, transparent 0, #000 var(--space-6));
  }

  .axis.fade-end {
    mask-image: linear-gradient(to right, #000 calc(100% - var(--space-8)), transparent 100%);
  }

  .axis.fade-start.fade-end {
    mask-image: linear-gradient(
      to right,
      transparent 0,
      #000 var(--space-6),
      #000 calc(100% - var(--space-8)),
      transparent 100%
    );
  }

  .axis:focus-visible {
    outline: none;
    border-radius: var(--radius-md);
    box-shadow: var(--focus-ring);
  }

  /* One column per day. `subgrid` locks the day heads and the axis rule to the same two rows across
     every column, so the hairline is continuous however tall a column's events are. */
  .track {
    padding-inline: var(--space-5);
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 15.5rem;
    grid-template-rows: auto auto minmax(0, 1fr);
    align-items: start;
    min-width: min-content;
  }

  .col {
    display: grid;
    grid-row: 1 / -1;
    grid-template-rows: subgrid;
    min-width: 0;
    scroll-snap-align: start;
  }

  .col-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    padding: 0 var(--space-4) var(--space-2) 0;
  }

  .col-label {
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .col-date {
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    font-feature-settings: var(--numeric);
    white-space: nowrap;
  }

  /* The axis itself: each column contributes one segment, edge to edge, so they join up. */
  .rule {
    position: relative;
    height: var(--space-4);
    border-top: 1px solid var(--color-grid);
  }

  .tick {
    position: absolute;
    left: 0;
    top: -3px;
    width: 5px;
    height: 5px;
    border-radius: var(--radius-full);
    background: var(--color-surface);
    box-shadow: 0 0 0 1.5px var(--color-border-strong);
  }

  .col.is-today .col-label {
    color: var(--color-accent);
  }

  .col.is-today .rule {
    border-top-color: var(--color-accent-line);
  }

  .col.is-today .tick {
    background: var(--color-accent);
    box-shadow: 0 0 0 1.5px var(--color-accent);
  }

  /* Everything to the right of today is not-yet: dashed rule, muted head. */
  .col.ahead .rule {
    border-top-style: dashed;
  }

  .col.ahead .col-events {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .col-events {
    padding-right: var(--space-4);
    min-width: 0;
  }

  /* Two events on the same day are separated by a hairline. The rule lives here rather than in
     `TimelineEventRow` because only the column knows a row has a predecessor. */
  .col-events :global(.row + .row) {
    border-top: 1px solid var(--color-border);
  }

  .col + .col .col-head,
  .col + .col .col-events {
    padding-left: var(--space-4);
  }

  /* --- planned half --- */
  .plan {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    column-gap: var(--space-3);
    padding: var(--space-2) 0 var(--space-3) var(--space-6);
  }

  .plan.column {
    padding: var(--space-3) 0;
  }

  .glyph,
  .empty-glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--space-8);
    height: var(--space-8);
    border-radius: var(--radius-md);
    border: 1px dashed var(--color-border-strong);
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .plan-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  /* The push badge sits under the title, aligned left, so a row without one is unchanged. */
  .plan-state {
    display: inline-flex;
  }

  .plan-title {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }

  .detail {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    line-height: var(--leading-snug);
  }

  .empty {
    display: flex;
    align-items: flex-start;
    gap: var(--space-4);
  }

  .empty-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .empty-title {
    margin: 0;
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--color-text-on-surface);
  }

  .col .empty-title {
    font-size: var(--text-sm);
    padding-top: var(--space-3);
  }
</style>
