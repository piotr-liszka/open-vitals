<script lang="ts">
  /**
   * The current week of the training block (spec 073).
   *
   * The order answers the questions in the order they are asked: which week is this, what was it
   * supposed to be, how much of it is done, what is left to run, and — last, because they are
   * reference rather than news — the paces and the standing rules.
   *
   * Presentational. Every `null` is a real "not set" from the handler, rendered as an honest absence
   * rather than a zero: a week with no volume target has no target, it does not have a target of 0.
   */
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import Banner from '$lib/ui/Banner.svelte';
  import StatTile from '$lib/ui/StatTile.svelte';
  import ProgressBar from '$lib/ui/ProgressBar.svelte';
  import { formatDay } from '$lib/date';
  import type { BlockWeek } from './block.types';

  let { week }: { week: BlockWeek | null } = $props();

  const nf1 = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  /** Seconds per km as `m:ss` — the way a pace is written and read. */
  function mmss(seconds: number): string {
    const total = Math.round(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  const PACE_LABELS: Record<string, string> = {
    easy: 'Spokojne',
    long: 'Długie',
    threshold: 'Próg',
    interval: 'Interwały',
    goal: 'Docelowe'
  };

  const paceRows = $derived(
    Object.entries(week?.paces ?? {})
      .filter(([, range]) => range)
      .map(([key, range]) => ({
        label: PACE_LABELS[key] ?? key,
        value: `${mmss(range!.lowS)}–${mmss(range!.highS)}/km`
      }))
  );

  const subtitle = $derived(week ? `${formatDay(week.weekStart)} – ${formatDay(week.weekEnd)}` : undefined);

  /** Progress against the target, or null when there is no target to be against. */
  const progress = $derived(
    week && week.volumeTargetKm && week.volumeTargetKm > 0 ? week.volumeActualKm / week.volumeTargetKm : null
  );

  const remainingKm = $derived(
    week && week.volumeTargetKm !== null
      ? Math.round((week.volumeTargetKm - week.volumeActualKm) * 10) / 10
      : null
  );

  const PUSH_LABEL: Record<string, string> = {
    pushed: 'na zegarku',
    pending: 'czeka na wysyłkę',
    failed: 'wysyłka nieudana',
    unsupported: 'Garmin nie przyjmie'
  };

  const PUSH_TONE: Record<string, 'success' | 'neutral' | 'danger' | 'warning'> = {
    pushed: 'success',
    pending: 'neutral',
    failed: 'danger',
    unsupported: 'warning'
  };

  const km = (m: number | null): string | null => (m === null ? null : `${nf1.format(m / 1000)} km`);

  function minutes(s: number | null): string | null {
    return s === null ? null : `${Math.round(s / 60)} min`;
  }

  /** Distance if the session has one, otherwise duration — never both, never neither silently. */
  function sessionSize(distanceM: number | null, durationS: number | null): string | null {
    return km(distanceM) ?? minutes(durationS);
  }
</script>

<Card title="Bieżący tydzień" {...subtitle ? { subtitle } : {}}>
  {#if !week}
    <p class="empty">
      Żaden blok treningowy nie obejmuje dzisiejszego dnia. Blok to nazwany ciąg tygodni z celami objętości,
      tempami i stałymi zasadami — dzięki niemu asystent nie musi co rozmowę wyprowadzać od nowa, na jakim
      jesteś etapie.
    </p>
  {:else}
    <div class="head">
      <div class="who">
        <span class="block-name">{week.blockName}</span>
        <span class="week-of">tydzień {week.weekNumber} z {week.weeks}</span>
      </div>
      <Badge tone="info">{week.phaseLabel}</Badge>
    </div>

    {#if week.focus}
      <p class="focus">{week.focus}</p>
    {/if}

    <!--
      Spec 062. Above the numbers on purpose: soreness is the one thing here that should change what
      the athlete does today, and a number sitting under three volume tiles gets read last.
    -->
    {#if week.soreness}
      <div class="banner-slot">
        <Banner tone="warning" title="Zgłoszony ból w ostatnim tygodniu">
          {week.soreness.soreness}/10{week.soreness.location ? ` — ${week.soreness.location}` : ''}, {formatDay(
            week.soreness.day
          )}. Przy takim sygnale ostrożniejszym wyborem jest ściąć objętość, nie dokładać.
        </Banner>
      </div>
    {/if}

    <div class="tiles">
      <StatTile
        label="Objętość w tygodniu"
        value={nf1.format(week.volumeActualKm)}
        unit="km"
        accent="orange"
      />
      <StatTile
        label="Cel tygodnia"
        value={week.volumeTargetKm === null ? '—' : nf1.format(week.volumeTargetKm)}
        {...week.volumeTargetKm === null ? {} : { unit: 'km' }}
        muted={week.volumeTargetKm === null}
      />
      <StatTile
        label="Zostało"
        value={remainingKm === null ? '—' : nf1.format(Math.max(remainingKm, 0))}
        {...remainingKm === null ? {} : { unit: 'km' }}
        muted={remainingKm === null}
      />
    </div>

    {#if progress !== null}
      <ProgressBar value={progress} label="Realizacja celu objętości" />
    {/if}

    <h4 class="section">Sesje w tym tygodniu</h4>
    {#if week.sessions.length === 0}
      <p class="empty">Nie zaplanowano jeszcze żadnej sesji na ten tydzień.</p>
    {:else}
      <ul class="sessions">
        {#each week.sessions as session (session.id)}
          <li>
            <div class="session-main">
              <span class="session-day">{formatDay(session.day)}</span>
              <span class="session-title">{session.title}</span>
            </div>
            <div class="session-meta">
              {#if sessionSize(session.estimatedDistanceM, session.estimatedDurationS)}
                <span class="session-size"
                  >{sessionSize(session.estimatedDistanceM, session.estimatedDurationS)}</span
                >
              {/if}
              <Badge tone={PUSH_TONE[session.pushState] ?? 'neutral'} dot={false}>
                {PUSH_LABEL[session.pushState] ?? session.pushState}
              </Badge>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    {#if paceRows.length > 0}
      <h4 class="section">Tempa bloku</h4>
      <dl class="paces">
        {#each paceRows as row (row.label)}
          <div class="pace">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        {/each}
      </dl>
    {/if}

    {#if week.constraints.length > 0}
      <h4 class="section">Stałe zasady</h4>
      <ul class="constraints">
        {#each week.constraints as rule (rule)}
          <li>{rule}</li>
        {/each}
      </ul>
    {/if}

    {#if week.goal}
      <p class="goal">
        Cel: <strong>{week.goal.title}</strong>
        · {formatDay(week.goal.day)}
        · {week.goal.daysOut > 0 ? `za ${week.goal.daysOut} dni` : 'już za nami'}
      </p>
    {/if}
  {/if}
</Card>

<style>
  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .who {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .block-name {
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }

  .week-of {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .focus {
    margin: var(--space-3) 0 0;
    color: var(--color-text);
  }

  .banner-slot {
    margin-top: var(--space-4);
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: var(--space-3);
    margin: var(--space-4) 0;
  }

  .section {
    margin: var(--space-5) 0 var(--space-2);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text-muted);
  }

  .empty {
    margin: 0;
    color: var(--color-text-muted);
  }

  .sessions,
  .constraints {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .sessions li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .session-main {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    min-width: 0;
  }

  .session-day {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .session-title {
    font-weight: var(--font-medium);
  }

  .session-meta {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .session-size {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .paces {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: var(--space-2) var(--space-4);
    margin: 0;
  }

  .pace {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    padding-bottom: var(--space-1);
    border-bottom: 1px solid var(--color-border);
  }

  .pace dt {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .pace dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }

  .constraints li {
    display: inline-flex;
    align-self: flex-start;
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .goal {
    margin: var(--space-5) 0 0;
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-border);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }
</style>
