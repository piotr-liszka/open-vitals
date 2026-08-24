<script lang="ts">
  /**
   * One activity in the list. Presentational: all data comes from the module's `ActivityListItem`.
   * The thumbnail is a non-interactive route map when GPS is present, otherwise a sport glyph. Tags
   * summarise power/HR. Built from `lib/ui` (Badge) + design tokens; the frame styling is local.
   */
  import LeafletMap from '$lib/ui/LeafletMap.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import { sportLabel } from '$lib/sport-labels';
  import { formatDay, isDayKey } from '$lib/date';
  import type { ActivityListItem, ViewMode } from './activities.types';
  import { formatInteger, formatNumber, getI18n } from '$lib/i18n';

  const i18n = getI18n();

  let { item, view = 'grid' }: { item: ActivityListItem; view?: ViewMode } = $props();

  const km = (m: number | null): string =>
    m == null ? '—' : `${formatNumber(i18n.locale, m / 1000, { maximumFractionDigits: 1 })} km`;
  const meters = (m: number | null): string => (m == null ? '—' : `${formatInteger(i18n.locale, m)} m`);
  function hms(s: number | null): string {
    if (s == null) return '—';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  }
  // `startTimeLocal` is already the wearer's wall clock — take the day as written (spec 018).
  function dateLabel(local: string): string {
    const head = local.slice(0, 10);
    return isDayKey(head) ? formatDay(i18n.locale, head, 'shortYear') : head;
  }

  const polylines = $derived(item.gps ? [{ points: item.gps, weight: 3, opacity: 0.95 }] : []);
  const power = $derived(item.normPower ?? item.avgPower);
</script>

<a class="card {view}" href={`/activities/${item.id}`}>
  <div class="thumb">
    {#if item.gps}
      <LeafletMap
        {polylines}
        interactive={false}
        height="100%"
        ariaLabel={i18n.t('activities.routeOf', { name: item.name ?? sportLabel(i18n.t, item.sport) })}
      />
    {:else}
      <div class="glyph" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="34"
          height="34"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M4 17l5-9 4 6 3-4 4 7" />
          <circle cx="4" cy="17" r="1" />
          <circle cx="20" cy="17" r="1" />
        </svg>
      </div>
    {/if}
    <span class="sport"><Badge tone="neutral" dot={false}>{sportLabel(i18n.t, item.sport)}</Badge></span>
  </div>

  <div class="body">
    <div class="head">
      <h3 class="name">{item.name ?? sportLabel(i18n.t, item.sport)}</h3>
      <span class="date">{dateLabel(item.startTimeLocal)}</span>
    </div>

    <dl class="stats">
      <div>
        <dt>{i18n.t('activities.card.distance')}</dt>
        <dd>{km(item.distanceM)}</dd>
      </div>
      <div>
        <dt>{i18n.t('activities.card.time')}</dt>
        <dd>{hms(item.movingS ?? item.durationS)}</dd>
      </div>
      <div>
        <dt>{i18n.t('timeline.stat.elevation')}</dt>
        <dd>{meters(item.elevationGainM)}</dd>
      </div>
    </dl>

    {#if power != null || item.avgHr != null}
      <div class="tags">
        {#if power != null}<Badge tone="warning" dot={false}>{Math.round(power)} W</Badge>{/if}
        {#if item.avgHr != null}<Badge tone="danger" dot={false}>{Math.round(item.avgHr)} bpm</Badge>{/if}
      </div>
    {/if}
  </div>
</a>

<style>
  .card {
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    text-decoration: none;
    color: inherit;
    transition:
      border-color var(--transition-fast),
      box-shadow var(--transition-fast),
      transform var(--transition-fast);
  }
  .card:hover {
    border-color: var(--color-border-strong);
    box-shadow: var(--shadow-md, var(--shadow-sm));
    transform: translateY(-2px);
  }
  .card:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .thumb {
    position: relative;
    height: 150px;
    background: var(--color-surface-2);
  }
  /* The bundled map paints into a nested .map div; force it to fill the thumb. */
  .thumb :global(.map) {
    height: 100% !important;
    border: none;
    border-radius: 0;
  }
  .glyph {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-text-subtle);
  }
  .sport {
    position: absolute;
    top: var(--space-2);
    left: var(--space-2);
    /* Was 400 — high enough to clear Leaflet's own panes, which is the bug seen from the inside.
       The map now isolates its own stacking context (spec 034), so one layer above it is enough. */
    z-index: var(--z-content);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
  }
  .head {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .name {
    font-size: var(--text-md);
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .date {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .stats {
    display: grid;
    /* Sized off the longest label rather than pinned to three columns: "PRZEWYŻSZENIE" is one
       unbreakable word ~7rem wide, so a fixed third of a card clipped it at the card border — on a
       phone badly, on the desktop grid by a few pixels (spec 034). Three across where that fits,
       two where it doesn't. */
    grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
    gap: var(--space-2);
    margin: 0;
  }
  .stats div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .stats dt {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }
  .stats dd {
    margin: 0;
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    font-feature-settings: var(--numeric);
    color: var(--color-text);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  /* List variant: thumbnail beside the body. */
  .card.list {
    flex-direction: row;
  }
  .card.list .thumb {
    width: 200px;
    min-width: 200px;
    height: auto;
  }
  @media (max-width: 640px) {
    .card.list {
      flex-direction: column;
    }
    .card.list .thumb {
      width: auto;
      height: 150px;
    }
    /* Two tracks on a phone (the grid above works that out on its own); give the wrapped row air. */
    .stats {
      gap: var(--space-3) var(--space-2);
    }
  }
</style>
