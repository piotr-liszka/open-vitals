<script lang="ts">
  import { untrack } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { AppShell, Banner } from '$lib/ui';
  import SyncFooter from '$modules/sync/SyncFooter.svelte';
  import MetricsDashboard from '$modules/metrics-dashboard/MetricsDashboard.svelte';
  import ConditionCard from '$modules/insights/ConditionCard.svelte';
  import TimelineView from '$modules/timeline/TimelineView.svelte';
  import CheckInCard from '$modules/journal/CheckInCard.svelte';
  import { formatInstant, resolveBrowserTimeZone } from '$lib/date';
  import { getI18n } from '$lib/i18n';
  import type { PageData } from './$types';

  const i18n = getI18n();

  let { data }: { data: PageData } = $props();

  // Silently re-load data on this cadence while the tab is visible. Its only consumer is
  // MetricsDashboard (spec 021 moved connection/MCP cards to /settings), so it feeds exactly two
  // things: the "Zaktualizowano HH:MM" label and the in-place busy dimming.
  const AUTO_REFRESH_MS = 60_000;

  let busy = $state(false); // any reload in flight — dims the dashboard in place
  let lastUpdated = $state<Date | null>(null);

  const updatedLabel = $derived(
    lastUpdated
      ? i18n.t('page.updatedLabel', {
          time: formatInstant(i18n.locale, lastUpdated, 'time', resolveBrowserTimeZone())
        })
      : undefined
  );

  async function reload(): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      await invalidateAll();
      lastUpdated = new Date();
    } finally {
      busy = false;
    }
  }

  // The trend window used to be picked here via `?trend=` (spec 028). It is now the app-wide range in
  // the topbar (spec 047), owned by `RangeSwitch` inside `AppShell` — this page just renders what the
  // loader resolved for `?range=`.

  // Auto-refresh: tick on an interval, skip while hidden, catch up on re-focus, tear down on unmount.
  // Only active where a live dashboard is actually rendered: Garmin connected.
  $effect(() => {
    if (!data.health.connected) return;

    untrack(() => {
      lastUpdated ??= new Date();
    });

    const tick = (): void => {
      if (!document.hidden) void reload();
    };
    const onVisibility = (): void => {
      if (!document.hidden) void reload();
    };

    const timer = setInterval(tick, AUTO_REFRESH_MS);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  });
</script>

<svelte:head>
  <title>{i18n.t('page.dashboardTitle')} · OpenVitals</title>
</svelte:head>

<AppShell title={i18n.t('page.dashboardTitle')}>
  {#snippet footer()}
    <SyncFooter />
  {/snippet}

  {#if !data.health.connected}
    <div class="reconnect">
      <Banner tone="warning" title={i18n.t('page.notConnectedTitle')}>
        {#snippet actions()}
          <a class="banner-cta" href="/settings">{i18n.t('page.notConnectedCta')}</a>
        {/snippet}
        {i18n.t('page.garminNotConnectedBody')}
      </Banner>
    </div>
  {:else}
    <div class="stack">
      {#if !data.health.reachable}
        <div class="banner-slot">
          <Banner tone="danger" title={i18n.t('page.garminDownTitle')}>
            {#snippet actions()}
              <a class="banner-cta" href="/settings">{i18n.t('page.garminDownCta')}</a>
            {/snippet}
            {i18n.t('page.garminDownBody')}
          </Banner>
        </div>
      {/if}
      <!--
        Reading order (spec 022): alerts → how am I right now → what just happened / what's
        coming → today's numbers. `ConditionCard` ABSORBS the old `ReadinessCard` here, so the
        page carries one condition block rather than two overlapping ones.
      -->
      <ConditionCard condition={data.readiness.condition} connected={data.readiness.connected} />
      <!--
        The check-in sits right under the condition block (spec 062): the device's account of how
        today is going, then the athlete's. Reading them together is the whole point, and the
        card asks for nothing the athlete has already told us.
      -->
      <CheckInCard
        today={data.journal.today}
        entry={data.journal.entries.find((e) => e.day === data.journal.today && e.activityId === null) ??
          null}
      />
      <TimelineView data={data.timeline} connected={data.readiness.connected} />
      <MetricsDashboard data={data.dashboard} {updatedLabel} {busy} />
    </div>
  {/if}
</AppShell>

<style>
  .stack,
  .reconnect {
    margin-bottom: var(--space-8);
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .banner-slot {
    margin: 0;
  }
  .banner-cta {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: currentColor;
    text-decoration: none;
    white-space: nowrap;
  }
  .banner-cta:hover {
    text-decoration: underline;
  }
  .banner-cta:focus-visible {
    outline: none;
    border-radius: var(--radius-sm);
    box-shadow: var(--focus-ring);
  }
</style>
