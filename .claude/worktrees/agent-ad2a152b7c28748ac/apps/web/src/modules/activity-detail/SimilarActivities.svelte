<script lang="ts">
  /**
   * "What should I compare this session to?" (spec 065) — one card, two answers.
   *
   * `Podobny wysiłek` is new: same sport family, distance AND duration within ±15%, ranked by
   * closeness. `Ta sama trasa` is the spec-041 matched-route table, which lives here rather than in a
   * card of its own because a page that asks the same question twice, in two places, gets read once.
   *
   * `SegmentedControl` and not `SubNav`: switching tabs is client state that must not change the URL,
   * because the URL of this page already means "this activity" (spec 025 draws that line).
   *
   * Presentational. The handler did the matching; this only formats and explains — including the two
   * empty states, which say DIFFERENT things and must not be collapsed into one: "nothing was similar"
   * is a fact about the athlete's history, "this cannot be compared" is a fact about the session.
   */
  import Card from '$lib/ui/Card.svelte';
  import SegmentedControl from '$lib/ui/SegmentedControl.svelte';
  import DeltaBadge from '$lib/ui/DeltaBadge.svelte';
  import ActivityMatchedRoute from './ActivityMatchedRoute.svelte';
  import { formatDay, isDayKey } from '$lib/date';
  import {
    DASH,
    SIMILAR_METRICS,
    fmtDuration,
    fmtKm,
    fmtNum,
    fmtPace,
    similarDeltaBadge
  } from './activity-format';
  import type { MatchedRoute, SimilarActivities, SimilarEntry } from './activity-detail.types';
  import { getI18n } from '$lib/i18n';

  const i18n = getI18n();

  interface Props {
    similar: SimilarActivities | null;
    route: MatchedRoute | null;
  }
  let { similar, route }: Props = $props();

  let tab = $state('effort');

  const dayLabel = (day: string): string => (isDayKey(day) ? formatDay(i18n.locale, day, 'shortYear') : day);

  const options = [
    { value: 'effort', label: 'Podobny wysiłek' },
    { value: 'route', label: 'Ta sama trasa' }
  ];

  /**
   * The badges for one row, in metric order, with the incomparable ones already dropped.
   *
   * The mapping itself — point of view, "better" versus "down" — is `similarDeltaBadge` in
   * `activity-format.ts`, where it can be unit-tested. Both of those inversions are the kind that look
   * perfectly fine on screen while saying the opposite of the truth.
   */
  const badgesFor = (
    e: SimilarEntry
  ): { key: string; badge: NonNullable<ReturnType<typeof similarDeltaBadge>> }[] =>
    SIMILAR_METRICS.flatMap((m) => {
      const badge = similarDeltaBadge(e[m.key], m);
      return badge ? [{ key: m.key, badge }] : [];
    });
</script>

<Card>
  <div class="head">
    <div>
      <h2 class="title">Porównaj z innymi treningami</h2>
      <p class="sub">Dwa sposoby: podobny wysiłek albo dokładnie ta sama trasa.</p>
    </div>
    <SegmentedControl {options} bind:value={tab} ariaLabel="Sposób porównania" size="sm" />
  </div>

  {#if tab === 'effort'}
    {#if similar === null}
      <!-- Not the same as "nothing matched": this session has no distance or duration to match ON. -->
      <p class="empty">
        Ten trening nie ma dystansu ani czasu, więc nie da się go porównać z innymi wysiłkami. Spróbuj
        zakładki <strong>Ta sama trasa</strong>.
      </p>
    {:else if similar.entries.length === 0}
      <p class="empty">
        Brak podobnych treningów. Szukaliśmy sesji tego samego sportu z dystansem i czasem w zakresie ±{similar.tolerancePct}%
        — wśród {fmtNum(similar.comparedCount)}
        {similar.comparedCount === 1 ? 'porównywalnej sesji' : 'porównywalnych sesji'} nie było żadnej. Ten trening
        był dla Ciebie nietypowy.
      </p>
    {:else}
      <p class="scope">
        {fmtNum(similar.entries.length)}
        {similar.entries.length === 1 ? 'dopasowanie' : 'dopasowań'} w zakresie ±{similar.tolerancePct}% ·
        porównano {fmtNum(similar.comparedCount)}
        {similar.comparedCount === 1 ? 'sesję' : 'sesji'}{similar.coversAllHistory ? '' : ' (najnowsze)'}
      </p>

      <div class="scroller">
        <table class="tbl">
          <thead>
            <tr>
              <th scope="col">Data</th>
              <!-- Units live in the header, not in every cell: `fmtKm` is deliberately unit-free so a
                   column of numbers stays a column of numbers. -->
              <th scope="col" class="num">Dystans<span class="unit">km</span></th>
              <th scope="col" class="num">Czas</th>
              <th scope="col" class="num">Tempo<span class="unit">/km</span></th>
              <th scope="col">Dziś vs wtedy</th>
            </tr>
          </thead>
          <tbody>
            {#each similar.entries as e (e.activityId)}
              {@const badges = badgesFor(e)}
              <tr>
                <th scope="row" class="day">
                  <a href="/activities/{e.activityId}">{dayLabel(e.day)}</a>
                  {#if e.name}<span class="name">{e.name}</span>{/if}
                </th>
                <td class="num">{fmtKm(e.distanceM, 1)}</td>
                <td class="num">{fmtDuration(e.durationS)}</td>
                <td class="num">{e.paceSecPerKm === null ? DASH : fmtPace(e.paceSecPerKm)}</td>
                <td>
                  <div class="badges">
                    {#each badges as b (b.key)}
                      <DeltaBadge {...b.badge} />
                    {:else}
                      <span class="none">{DASH}</span>
                    {/each}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {:else}
    <ActivityMatchedRoute {route} />
  {/if}
</Card>

<style>
  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
    margin-bottom: var(--space-4);
  }
  .title {
    margin: 0;
    font-size: var(--text-md);
    font-weight: var(--font-bold);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text);
  }
  .sub {
    margin: var(--space-1) 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }
  .scope {
    margin: 0 0 var(--space-3);
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    font-feature-settings: var(--numeric);
  }
  .empty {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
  }
  /* The delta column is wide and must not squeeze the numbers; scroll the table rather than wrap it. */
  .scroller {
    overflow-x: auto;
  }
  .tbl {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }
  .tbl th,
  .tbl td {
    padding: var(--space-2) var(--space-3);
    text-align: left;
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
  }
  .tbl thead th {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-subtle);
  }
  .tbl tbody tr:last-child th,
  .tbl tbody tr:last-child td {
    border-bottom: none;
  }
  .num {
    text-align: right;
    font-feature-settings: var(--numeric);
  }
  .unit {
    margin-left: var(--space-1);
    font-weight: var(--font-normal);
    text-transform: none;
    letter-spacing: 0;
    opacity: 0.7;
  }
  .day {
    font-weight: var(--font-medium);
  }
  .day a {
    color: var(--color-accent);
    text-decoration: none;
  }
  .day a:hover {
    text-decoration: underline;
  }
  .day a:focus-visible {
    outline: none;
    border-radius: var(--radius-sm);
    box-shadow: var(--focus-ring);
  }
  .name {
    display: block;
    font-weight: var(--font-normal);
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    max-width: 18ch;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .badges {
    display: flex;
    gap: var(--space-1);
    flex-wrap: wrap;
  }
  .none {
    color: var(--color-text-subtle);
  }
</style>
