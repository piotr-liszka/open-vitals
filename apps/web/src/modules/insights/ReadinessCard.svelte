<script lang="ts">
  import { Card, InfoPopover, Skeleton } from '$lib/ui';
  import ReadinessGauge from './ReadinessGauge.svelte';
  import type { Readiness } from './insights.types';
  import { getI18n } from '$lib/i18n';

  const i18n = getI18n();

  interface Props {
    readiness: Readiness | null;
    connected: boolean;
    /** Show skeletons instead of content. */
    loading?: boolean;
  }

  let { readiness, connected, loading = false }: Props = $props();
</script>

<Card title={i18n.t('readiness.title')} subtitle={i18n.t('readiness.subtitle')} overflowVisible>
  {#if loading}
    <div class="loading">
      <Skeleton width="var(--space-16)" height="var(--space-12)" radius="md" />
      <Skeleton width="60%" height="var(--space-4)" />
      <Skeleton width="80%" height="var(--space-4)" />
    </div>
  {:else if !connected}
    <p class="note">{i18n.t('readiness.notConnected')}</p>
    <a class="link" href="/">{i18n.t('readiness.connectCta')}</a>
  {:else if readiness === null}
    <p class="note">{i18n.t('readiness.notEnoughData')}</p>
  {:else}
    <!-- The trigger sits right beside the score itself (see `ReadinessGauge`'s `popover` prop),
         rather than up in the card header where it used to be a whole layout away from the number
         it explains. -->
    {#snippet popover()}
      <InfoPopover label={i18n.t('readiness.explainLabel')} title={i18n.t('readiness.explainTitle')}>
        <p>{i18n.t('readiness.explainBody')}</p>
        <p>{i18n.t('readiness.explainLimits')}</p>
        <p>{i18n.t('readiness.explainGarmin')}</p>
        <p>{i18n.t('readiness.explainBands')}</p>
        <p>{i18n.t('readiness.explainDisclaimer')}</p>
      </InfoPopover>
    {/snippet}
    <ReadinessGauge {readiness} {popover} />
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
