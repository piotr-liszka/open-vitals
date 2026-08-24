<script lang="ts">
  import { page } from '$app/stores';
  import { AppShell, SubNav } from '$lib/ui';
  import { getI18n } from '$lib/i18n';
  import SyncFooter from '$modules/sync/SyncFooter.svelte';
  import ActivitiesView from '$modules/activities/ActivitiesView.svelte';
  import { activitiesTabs, activitiesTitle } from '$modules/activities/activities-nav';
  import type { PageData } from './$types';

  const i18n = getI18n();

  let { data }: { data: PageData } = $props();

  const title = $derived(activitiesTitle(i18n.t, $page.url.pathname));
</script>

<svelte:head><title>{title} · OpenVitals</title></svelte:head>

<AppShell {title}>
  {#snippet footer()}
    <SyncFooter />
  {/snippet}

  <div class="section">
    <SubNav
      items={[...activitiesTabs(i18n.t)]}
      current={$page.url.pathname}
      ariaLabel={i18n.t('activities.sectionAriaLabel')}
    />
    <ActivitiesView data={data.activities} />
  </div>
</AppShell>

<style>
  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
</style>
