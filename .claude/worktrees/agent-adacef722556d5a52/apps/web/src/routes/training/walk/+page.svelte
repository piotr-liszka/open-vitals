<script lang="ts">
  import WalkingView from '$modules/walking/WalkingView.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<WalkingView data={data.walking} />
