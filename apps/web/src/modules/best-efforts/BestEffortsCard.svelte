<script lang="ts">
  /**
   * All-time best efforts (spec 054) — the leaderboard that replaced the even-pace "Rekordy życiowe"
   * projections on the running page.
   *
   * Presentational: the handler already ranked everything. Two decisions live in the markup because
   * they are what the card MEANS, not how it looks: the record is the loud row and the others are
   * visibly behind it (podium, not a table), and each row links to the session it came from — a
   * record you cannot open is a claim you cannot check.
   *
   * Formatting helpers are inlined rather than imported: the shared ones live in another module's
   * folder, and reaching across module folders is exactly what AGENTS.md §5 forbids.
   */
  import Card from '$lib/ui/Card.svelte';
  import RankMedal from '$lib/ui/RankMedal.svelte';
  import InfoPopover from '$lib/ui/InfoPopover.svelte';
  import { formatDay } from '$lib/date';
  import type { BestEffortsData } from './best-efforts.types';
  import { getI18n } from '$lib/i18n';

  const i18n = getI18n();

  let { data }: { data: BestEffortsData } = $props();

  /** `h:mm:ss` or `mm:ss` — a marathon effort needs the hour, a 400 m must not carry a leading zero. */
  const fmtTime = (totalS: number): string => {
    if (!Number.isFinite(totalS)) return '—';
    const s = Math.round(totalS);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  };

  /** `mm:ss` per kilometre. Rounded to whole seconds FIRST so 59.6 s rolls over instead of "1:60". */
  const fmtPace = (secPerKm: number): string => {
    if (!Number.isFinite(secPerKm)) return '—';
    const t = Math.round(secPerKm);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  };
</script>

<Card title={i18n.t('records.title')} subtitle={i18n.t('records.subtitle')}>
  {#snippet actions()}
    {#if data.hasData}
      <InfoPopover label={i18n.t('records.explainLabel')}>
        <p>{i18n.t('records.explain', { topN: data.topN })}</p>
      </InfoPopover>
    {/if}
  {/snippet}

  {#if data.hasData}
    <div class="grid">
      {#each data.distances as distance (distance.key)}
        <section class="dist">
          <h4 class="dist-name">{distance.label}</h4>
          <ol class="rows">
            {#each distance.entries as entry (entry.activityId + entry.key)}
              <li>
                <a class="row" class:top={entry.rank === 1} href={`/activities/${entry.activityId}`}>
                  <span class="rank">
                    <RankMedal
                      rank={entry.rank}
                      label={entry.rank === 1 ? i18n.t('records.pr') : undefined}
                      ariaLabel={entry.rank === 1
                        ? i18n.t('records.prAriaLabel')
                        : i18n.t('records.rankAriaLabel', { rank: entry.rank })}
                    />
                  </span>
                  <span class="time">{fmtTime(entry.durationS)}</span>
                  <span class="pace">{fmtPace(entry.paceSecPerKm)}<small>/km</small></span>
                  <span class="day">{formatDay(i18n.locale, entry.day, 'shortYear')}</span>
                </a>
              </li>
            {/each}
          </ol>
        </section>
      {/each}
    </div>
  {:else}
    <p class="empty">
      {i18n.t('records.empty')}
      <a href="/data">{i18n.t('nav.data')}</a>).
    </p>
  {/if}
</Card>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--space-5);
  }

  .dist {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  .dist-name {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
  }

  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-areas:
      'medal time pace'
      'medal day  day';
    align-items: center;
    column-gap: var(--space-3);
    padding: var(--space-2);
    margin: 0 calc(-1 * var(--space-2));
    border-radius: var(--radius-md);
    text-decoration: none;
    color: var(--color-text-muted);
    transition: background var(--transition-fast);
  }

  .row:hover {
    background: var(--color-surface-hover);
  }

  .row:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .rank {
    grid-area: medal;
    display: inline-flex;
  }

  .time {
    grid-area: time;
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    font-feature-settings: var(--numeric);
    color: var(--color-text-on-surface);
  }

  /* The record is the point of the card: it gets the size and the full-strength ink; the two behind
     it stay legible but plainly secondary. */
  .row.top {
    color: var(--color-text);
  }

  .row.top .time {
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text);
  }

  .pace {
    grid-area: pace;
    font-size: var(--text-xs);
    font-feature-settings: var(--numeric);
    white-space: nowrap;
  }

  .pace small {
    margin-left: 0.2ch;
    color: var(--color-text-subtle);
  }

  .day {
    grid-area: day;
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
  }

  .empty {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
</style>
