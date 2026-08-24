<script lang="ts">
  import SeasonView from '$modules/season/SeasonView.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<SeasonView data={data.season} />
