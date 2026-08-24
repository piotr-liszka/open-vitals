<script lang="ts">
  import { page } from '$app/stores';
  import { AppShell, SubNav } from '$lib/ui';
  import SyncFooter from '$modules/sync/SyncFooter.svelte';
  import { withRange } from '$lib/range';
  import { trainingTitle } from '$modules/training/training-nav';
  import { getI18n } from '$lib/i18n';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

  const i18n = getI18n();

  const title = $derived(trainingTitle(i18n.t, $page.url.pathname));

  // Sport tabs keep the chosen range (spec 047): moving from Bieg to Marsz should change the sport,
  // not the window. `withRange` leaves `/training/ride` alone — it has no range to keep.
  const tabs = $derived(data.tabs.map((t) => ({ ...t, href: withRange(t.href, $page.url) })));
</script>

<svelte:head><title>{title} · OpenVitals</title></svelte:head>

<AppShell {title}>
  {#snippet footer()}
    <SyncFooter />
  {/snippet}

  <div class="section">
    {#if data.tabs.length > 1}
      <SubNav items={data.tabs} current={$page.url.pathname} ariaLabel="Sekcja treningu" />
    {/if}
    {@render children()}
  </div>
</AppShell>

<style>
  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
</style>
