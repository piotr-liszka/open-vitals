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
  import InfoPopover from '$lib/ui/InfoPopover.svelte';
  import { formatDay, isDayKey } from '$lib/date';
  import { DASH, fmtDuration, fmtKm, fmtNum, fmtPace } from './activity-format';
  import type { MatchedRoute } from './activity-detail.types';
  import { formatNumber, getI18n } from '$lib/i18n';

  const i18n = getI18n();

  let { route }: { route: MatchedRoute | null } = $props();

  const nf = (n: number): string => formatNumber(i18n.locale, n, { maximumFractionDigits: 0 });

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
        label: i18n.t('matchedRoute.fastestEver.label'),
        text: i18n.t('matchedRoute.fastestEver.text')
      };
    }
    return {
      tone: 'info' as const,
      label: i18n.t('matchedRoute.rankLabel', { rank: route.currentRank }),
      text:
        gapToBest === null
          ? i18n.t('matchedRoute.withinRange')
          : i18n.t('matchedRoute.gapToBest', { gap: fmtPace(gapToBest) })
    };
  });

  const dayLabel = (day: string): string => (isDayKey(day) ? formatDay(i18n.locale, day, 'shortYear') : day);

  const foundLine = $derived(
    route === null ? '' : i18n.t('matchedRoute.found', { count: route.previousCount })
  );
</script>

{#if route && route.previousCount > 0}
  <div class="matched">
    <div class="lead">
      <div class="lead-text">
        <p class="found">{foundLine}</p>
        {#if verdict}<Badge tone={verdict.tone}>{verdict.label}</Badge>{/if}
      </div>
      <InfoPopover label={i18n.t('matchedRoute.explainLabel')}>
        <p>{i18n.t('matchedRoute.explain', { count: nf(route.comparedCount) })}</p>
      </InfoPopover>
    </div>

    {#if verdict}<p class="verdict">{verdict.text}</p>{/if}

    <div class="table-wrap">
      <table class="runs">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">{i18n.t('matchedRoute.col.date')}</th>
            <th scope="col" class="num">{i18n.t('matchedRoute.col.pace')}</th>
            <th scope="col" class="num">{i18n.t('matchedRoute.col.time')}</th>
            <th scope="col" class="num">{i18n.t('matchedRoute.col.distance')}</th>
            <th scope="col" class="num">{i18n.t('matchedRoute.col.hr')}</th>
            <th scope="col" class="num">{i18n.t('matchedRoute.col.overlap')}</th>
          </tr>
        </thead>
        <tbody>
          {#each route.entries as e (e.activityId)}
            <tr class:current={e.isCurrent}>
              <td class="num rank">{e.rank}</td>
              <th scope="row">
                {#if e.isCurrent}
                  {dayLabel(e.day)} <span class="tag">{i18n.t('matchedRoute.thisActivity')}</span>
                {:else}
                  <a href={`/activities/${e.activityId}`}>{dayLabel(e.day)}</a>
                {/if}
              </th>
              <td class="num strong">
                {e.paceSecPerKm === null ? DASH : fmtPace(e.paceSecPerKm)}
              </td>
              <td class="num">{fmtDuration(e.durationS)}</td>
              <td class="num muted">{fmtKm(e.distanceM, 2, i18n.locale)}</td>
              <td class="num muted">{e.avgHr === null ? DASH : fmtNum(e.avgHr, 0, i18n.locale)}</td>
              <td class="num muted">{nf(e.similarity * 100)}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
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
      {i18n.t('matchedRoute.emptyNoGps', { similarTab: i18n.t('similar.tab.effort') })}
    {:else}
      {i18n.t('matchedRoute.emptyNoMatch')}
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
  .lead-text {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
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
</style>
