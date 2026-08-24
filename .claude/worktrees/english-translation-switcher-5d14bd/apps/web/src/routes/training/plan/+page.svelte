<script lang="ts">
  import PlannerView from '$modules/workouts/PlannerView.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<PlannerView data={data.planner} month={data.month} today={data.today} selected={data.selected} />
