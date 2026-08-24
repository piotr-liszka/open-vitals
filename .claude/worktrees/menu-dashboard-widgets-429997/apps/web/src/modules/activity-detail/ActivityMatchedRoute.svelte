<script lang="ts">
  /**
   * "You have run this route 14 times; today was your third fastest" (spec 041).
   *
   * Presentational. The handler did the matching, so this only ranks and explains. Two things it must
   * NOT do: imply the match is certain (cell-set matching gives a probable same route, so the overlap is
   * shown per row), and imply a placing where none exists (an outing with no comparable pace is listed
   * but never ranked as fastest by default).
   */
  import Badge from '$lib/ui/Badge.svelte';
  import { formatDay, isDayKey } from '$lib/date';
  import { DASH, fmtDuration, fmtKm, fmtNum, fmtPace } from './activity-format';
  import type { MatchedRoute } from './activity-detail.types';

  let { route }: { route: MatchedRoute | null } = $props();

  const nf = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });

  const current = $derived(route?.entries.find((e) => e.isCurrent) ?? null);

  /** Seconds off the route's best. `null` when either side has no comparable pace. */
  const gapToBest = $derived(
    current?.paceSecPerKm != null && route?.bestPaceSecPerKm != null
      ? current.paceSecPerKm - route.bestPaceSecPerKm
      : null
  );

  const verdict = $derived.by(() => {
    if (!route || route.currentRank === null) return null;
    if (route.currentRank === 1) {
      return {
        tone: 'success' as const,
        label: 'Najszybszy raz',
        text: 'To najszybsze przejście tej trasy z tych, które udało się dopasować.'
      };
    }
    return {
      tone: 'info' as const,
      label: `${route.currentRank}. najszybszy raz`,
      text:
        gapToBest === null
          ? 'Tempo tego przejścia mieści się wśród pozostałych.'
          : `Do najlepszego przejścia brakuje ${fmtPace(gapToBest)} na kilometrze.`
    };
  });

  const dayLabel = (day: string): string => (isDayKey(day) ? formatDay(day, 'shortYear') : day);

  /* Built here, not interpolated across template lines: Svelte keeps the source newlines in the text
     node, and "1\n  wcześniejsze przejście" is not the string anyone reads or asserts on. */
  const foundLine = $derived(
    route === null
      ? ''
      : `Znaleziono ${nf.format(route.previousCount)} ${
          route.previousCount === 1 ? 'wcześniejsze przejście' : 'wcześniejszych przejść'
        } tej trasy`
  );
</script>

{#if route && route.previousCount > 0}
  <div class="matched">
    <div class="lead">
      <p class="found">{foundLine}</p>
      {#if verdict}<Badge tone={verdict.tone}>{verdict.label}</Badge>{/if}
    </div>

    {#if verdict}<p class="verdict">{verdict.text}</p>{/if}

    <div class="table-wrap">
      <table class="runs">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Data</th>
            <th scope="col" class="num">Tempo</th>
            <th scope="col" class="num">Czas</th>
            <th scope="col" class="num">Dystans</th>
            <th scope="col" class="num">Tętno</th>
            <th scope="col" class="num">Zgodność</th>
          </tr>
        </thead>
        <tbody>
          {#each route.entries as e (e.activityId)}
            <tr class:current={e.isCurrent}>
              <td class="num rank">{e.rank}</td>
              <th scope="row">
                {#if e.isCurrent}
                  {dayLabel(e.day)} <span class="tag">ta aktywność</span>
                {:else}
                  <a href={`/activities/${e.activityId}`}>{dayLabel(e.day)}</a>
                {/if}
              </th>
              <td class="num strong">
                {e.paceSecPerKm === null ? DASH : fmtPace(e.paceSecPerKm)}
              </td>
              <td class="num">{fmtDuration(e.durationS)}</td>
              <td class="num muted">{fmtKm(e.distanceM, 2)}</td>
              <td class="num muted">{e.avgHr === null ? DASH : fmtNum(e.avgHr)}</td>
              <td class="num muted">{nf.format(e.similarity * 100)}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <p class="note">
      Trasy dopasowujemy po pokryciu siatką około 50-metrowych komórek, przy zbliżonej długości — to
      <em>prawdopodobnie</em> ta sama trasa, nie dowód. Kolumna „zgodność” pokazuje, jak duże jest pokrycie.
      Kierunek nie ma znaczenia, więc ta sama trasa przebiegnięta na odwrót też się dopasuje. Porównano {nf.format(
        route.comparedCount
      )} zapisanych tras tego samego sportu.
    </p>
  </div>
{:else}
  <!--
    An explicit empty state, added with spec 065. This used to render literally nothing, which was
    fine when it was a whole card that could simply be absent from the page — but it is a TAB now, and
    a tab you can select and be shown nothing is a bug. The two reasons are separated because they are
    different facts: no track recorded at all, versus a track that matched nothing you have ridden.
  -->
  <p class="empty">
    {#if route === null}
      Ten trening nie ma zapisanej trasy GPS, więc nie da się go dopasować do wcześniejszych przejść. Spróbuj
      zakładki <strong>Podobny wysiłek</strong>.
    {:else}
      Nie znaleziono wcześniejszych przejść tej trasy. Trasa jest dopasowywana po nakładaniu się zapisu GPS,
      więc pierwszy przejazd nową drogą nigdy nie ma z czym się równać.
    {/if}
  </p>
{/if}

<style>
  /* Tab content since spec 065, so the heading and subtitle the Card used to draw live here. */
  .lead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
    margin-bottom: var(--space-2);
  }
  .found {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }
  .empty {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
  }

  .verdict {
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
    line-height: var(--leading-snug);
    color: var(--color-text);
    max-width: 78ch;
  }

  /* A seven-column table must scroll inside its own box, never push the page sideways. */
  .table-wrap {
    overflow-x: auto;
  }

  .runs {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  .runs th,
  .runs td {
    padding: var(--space-2) var(--space-3);
    text-align: left;
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
  }

  .runs thead th {
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }

  .runs tbody th {
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }

  /* The row the reader is already on gets a lane rule rather than a colour swap, so the table stays
     readable and the current outing is still findable at a glance. */
  .runs tr.current {
    background: var(--color-surface-2);
    box-shadow: inset 3px 0 0 var(--color-accent);
  }

  .num {
    text-align: right;
    font-feature-settings: var(--numeric);
  }

  .rank {
    width: 3ch;
    color: var(--color-text-muted);
  }

  .strong {
    font-weight: var(--font-bold);
    color: var(--color-text);
  }

  .muted {
    color: var(--color-text-muted);
  }

  .tag {
    margin-left: var(--space-1);
    padding: 0 var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }

  .note {
    margin: var(--space-3) 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    max-width: 82ch;
  }
</style>
