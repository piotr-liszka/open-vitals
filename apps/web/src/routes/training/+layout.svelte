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
  // not the window. `withRange` leaves `/training/ride` and the plan pages alone — they have no
  // range to keep. `SubNav` compares PATHS, so the appended query does not unmark the current tab.
  const tabs = $derived(data.tabs.map((t) => ({ ...t, href: withRange(t.href, $page.url) })));
</script>

<svelte:head><title>{title} · OpenVitals</title></svelte:head>

<AppShell {title}>
  {#snippet footer()}
    <SyncFooter />
  {/snippet}

  <div class="section">
    {#if tabs.length > 1}
      <SubNav items={tabs} current={$page.url.pathname} ariaLabel={i18n.t('training.sectionAriaLabel')} />
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
