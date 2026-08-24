<script lang="ts">
  import { Card, Skeleton } from '$lib/ui';
  import ReadinessGauge from './ReadinessGauge.svelte';
  import type { Readiness } from './insights.types';

  interface Props {
    readiness: Readiness | null;
    connected: boolean;
    /** Show skeletons instead of content. */
    loading?: boolean;
  }

  let { readiness, connected, loading = false }: Props = $props();
</script>

<Card title="Gotowość" subtitle="Jak bardzo jesteś dziś gotowy w porównaniu z Twoją ostatnią bazą">
  {#if loading}
    <div class="loading">
      <Skeleton width="var(--space-16)" height="var(--space-12)" radius="md" />
      <Skeleton width="60%" height="var(--space-4)" />
      <Skeleton width="80%" height="var(--space-4)" />
    </div>
  {:else if !connected}
    <p class="note">Połącz konto Garmin, aby zobaczyć swoją gotowość.</p>
    <a class="link" href="/">Połącz na pulpicie →</a>
  {:else if readiness === null}
    <p class="note">Za mało danych — synchronizuj zegarek i wróć za kilka dni.</p>
  {:else}
    <ReadinessGauge {readiness} />
  {/if}
</Card>

<style>
  .loading {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .note {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
  }

  .link {
    color: var(--color-accent);
    text-decoration: none;
    font-weight: var(--font-medium);
    font-size: var(--text-sm);
  }
  .link:hover {
    text-decoration: underline;
  }
</style>
