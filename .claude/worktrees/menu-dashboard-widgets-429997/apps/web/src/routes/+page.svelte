<script lang="ts">
  import { untrack } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { AppShell, Banner } from '$lib/ui';
  import SyncFooter from '$modules/sync/SyncFooter.svelte';
  import MetricsDashboard from '$modules/metrics-dashboard/MetricsDashboard.svelte';
  import ConditionCard from '$modules/insights/ConditionCard.svelte';
  import TimelineView from '$modules/timeline/TimelineView.svelte';
  import ConsentPanel from '$modules/consent/ConsentPanel.svelte';
  import BaseHome from '$modules/base-home/BaseHome.svelte';
  import Landing from '$modules/landing/Landing.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Silently re-load data on this cadence while the tab is visible. Its only consumer is
  // MetricsDashboard (spec 021 moved connection/MCP cards to /settings), so it feeds exactly two
  // things: the "Zaktualizowano HH:MM" label and the in-place busy dimming.
  const AUTO_REFRESH_MS = 60_000;

  let busy = $state(false); // any reload in flight — dims the dashboard in place
  let lastUpdated = $state<Date | null>(null);

  const updatedLabel = $derived(
    lastUpdated
      ? `Zaktualizowano ${lastUpdated.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`
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

  // Passed to child components (setup, consent) as the reload hook.
  function refresh(): void {
    void reload();
  }

  // The trend window used to be picked here via `?trend=` (spec 028). It is now the app-wide range in
  // the topbar (spec 047), owned by `RangeSwitch` inside `AppShell` — this page just renders what the
  // loader resolved for `?range=`.

  // Auto-refresh: tick on an interval, skip while hidden, catch up on re-focus, tear down on unmount.
  // Only active where a live dashboard is actually rendered: Advanced tier with Garmin connected.
  // Base tier shows no processed data, so nothing there needs polling.
  $effect(() => {
    if (!data.authed || data.tier !== 'advanced' || !data.health.connected) return;

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
  <title
    >{data.authed
      ? data.tier === 'advanced'
        ? 'Pulpit · Vagus'
        : 'Start · Vagus'
      : 'Vagus — Twoje dane z Garmina, połączone z AI'}</title
  >
</svelte:head>

{#if !data.authed}
  <Landing />
{:else if data.tier === 'base'}
  <!-- Base tier processes and displays NO health data, so there is nothing here for a range to
       narrow — the switch would be a control with no effect (spec 047). -->
  <AppShell title="Start" tier="base" range="off">
    {#snippet footer()}
      <SyncFooter />
    {/snippet}

    <BaseHome
      health={data.health}
      advancedFeature={data.advancedFeature}
      onConnected={refresh}
      onUpdated={refresh}
    />
  </AppShell>
{:else}
  <AppShell title="Pulpit" tier="advanced" advanced>
    {#snippet footer()}
      <SyncFooter />
    {/snippet}

    {#if !data.health.connected}
      <div class="reconnect">
        <Banner tone="warning" title="Konto Garmin nie jest połączone">
          {#snippet actions()}
            <a class="banner-cta" href="/settings">Połącz w Ustawieniach →</a>
          {/snippet}
          Tryb zaawansowany jest włączony, ale nie widzimy połączenia z Garminem. Połącz konto ponownie w Ustawieniach.
        </Banner>
      </div>
    {:else}
      <div class="stack">
        {#if !data.health.reachable}
          <div class="banner-slot">
            <Banner tone="danger" title="Usługa Garmin jest chwilowo niedostępna">
              {#snippet actions()}
                <a class="banner-cta" href="/settings">Sprawdź połączenie →</a>
              {/snippet}
              Nie udało się połączyć z usługą Garmin, więc odczyty mogą być nieaktualne. Twoje dane są bezpieczne
              — połączymy się ponownie automatycznie.
            </Banner>
          </div>
        {/if}
        <!--
          Reading order (spec 022): alerts → how am I right now → what just happened / what's
          coming → today's numbers. `ConditionCard` ABSORBS the old `ReadinessCard` here, so the
          page carries one condition block rather than two overlapping ones.
        -->
        <ConditionCard
          condition={data.readiness.condition}
          connected={data.readiness.connected}
          enabled={data.readiness.enabled}
        >
          {#snippet consent()}
            {#if data.advancedFeature}
              <ConsentPanel feature={data.advancedFeature} onUpdated={refresh} />
            {/if}
          {/snippet}
        </ConditionCard>
        <TimelineView
          data={data.timeline}
          connected={data.readiness.connected}
          enabled={data.readiness.enabled}
        />
        <MetricsDashboard
          data={data.dashboard}
          analyticsFeature={data.advancedFeature}
          onConsentChange={refresh}
          {updatedLabel}
          {busy}
        />
      </div>
    {/if}
  </AppShell>
{/if}

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
