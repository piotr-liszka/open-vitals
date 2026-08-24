<script lang="ts">
  import TrainingOverview from '$modules/training/TrainingOverview.svelte';
  import WeeklySportSummary from '$modules/weekly-summary/WeeklySportSummary.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<!-- The weekly card leads: "what have I done this week" is the question this page is opened with,
     and it is the one thing here that does not need a model explained to be read (spec 056). -->
<div class="page">
  <WeeklySportSummary data={data.weekly} />
  <TrainingOverview data={data.overview} />
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
</style>
