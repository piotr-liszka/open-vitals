<script lang="ts">
  /**
   * Connect / sync / disconnect Strava + Withings (spec 017). Presentational — status comes from the
   * loader; actions hit the `/api/integrations/*` routes and refresh. Connect is a full navigation
   * (OAuth redirect); sync/disconnect are fetches.
   */
  import { invalidateAll } from '$app/navigation';
  import Card from '$lib/ui/Card.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import InfoPopover from '$lib/ui/InfoPopover.svelte';
  import { getI18n } from '$lib/i18n';
  import type { IntegrationsStatus } from './integrations.types';

  const i18n = getI18n();

  let { status }: { status: IntegrationsStatus } = $props();

  let busy = $state<string | null>(null);
  let message = $state<string | null>(null);

  async function sync(provider: 'strava' | 'withings'): Promise<void> {
    busy = `${provider}:sync`;
    message = null;
    try {
      const res = await fetch(`/api/integrations/${provider}/sync`, { method: 'POST' });
      const data = await res.json();
      if (provider === 'withings')
        message = i18n.t('integrations.weightImported', { count: data.imported ?? 0 });
      else
        message = i18n.t('integrations.activitiesScanned', {
          scanned: data.scanned ?? 0,
          matched: data.matched ?? 0
        });
      await invalidateAll();
    } catch {
      message = i18n.t('integrations.syncFailed');
    } finally {
      busy = null;
    }
  }

  async function disconnect(provider: 'strava' | 'withings'): Promise<void> {
    busy = `${provider}:disc`;
    try {
      await fetch(`/api/integrations/${provider}/disconnect`, { method: 'POST' });
      await invalidateAll();
    } finally {
      busy = null;
    }
  }
</script>

<div class="stack">
  {#if message}<p class="msg">{message}</p>{/if}

  <Card title={i18n.t('integrations.stravaTitle')} subtitle={i18n.t('integrations.stravaSubtitle')}>
    <div class="row">
      <div class="status">
        {#if status.strava.connected}
          <Badge tone="success">{i18n.t('integrations.connected')}</Badge>
          <span class="detail"
            >{i18n.t('integrations.linkedActivities', { count: status.strava.linkedCount })}</span
          >
        {:else}
          <Badge tone="neutral">{i18n.t('integrations.notConnected')}</Badge>
        {/if}
      </div>
      <div class="actions">
        {#if status.strava.connected}
          <Button
            size="sm"
            variant="secondary"
            loading={busy === 'strava:sync'}
            onclick={() => sync('strava')}>{i18n.t('integrations.linkActivities')}</Button
          >
          <Button
            size="sm"
            variant="ghost"
            loading={busy === 'strava:disc'}
            onclick={() => disconnect('strava')}>{i18n.t('integrations.disconnect')}</Button
          >
        {:else}
          <a class="connect" href="/api/integrations/strava/connect">{i18n.t('integrations.connectStrava')}</a
          >
        {/if}
      </div>
    </div>
  </Card>

  <Card title={i18n.t('integrations.withingsTitle')} subtitle={i18n.t('integrations.withingsSubtitle')}>
    <div class="row">
      <div class="status">
        {#if status.withings.connected}
          <Badge tone="success">{i18n.t('integrations.connected')}</Badge>
          <span class="detail">
            {i18n.t('integrations.weightReadings', { count: status.withings.weightCount })}
            {#if status.withings.firstDay}· {status.withings.firstDay}–{status.withings.lastDay}{/if}
          </span>
        {:else}
          <Badge tone="neutral">{i18n.t('integrations.notConnected')}</Badge>
        {/if}
      </div>
      <div class="actions">
        {#if status.withings.connected}
          <Button
            size="sm"
            variant="secondary"
            loading={busy === 'withings:sync'}
            onclick={() => sync('withings')}>{i18n.t('integrations.importWeight')}</Button
          >
          <Button
            size="sm"
            variant="ghost"
            loading={busy === 'withings:disc'}
            onclick={() => disconnect('withings')}>{i18n.t('integrations.disconnect')}</Button
          >
        {:else}
          <a class="connect" href="/api/integrations/withings/connect"
            >{i18n.t('integrations.connectWithings')}</a
          >
        {/if}
      </div>
    </div>
  </Card>

  <p class="note">
    <InfoPopover label={i18n.t('integrations.demoLabel')}>
      <p>{i18n.t('integrations.demoNote')}</p>
    </InfoPopover>
  </p>
</div>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    max-width: 720px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-4);
    flex-wrap: wrap;
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
  }
  .detail {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }
  .actions {
    display: inline-flex;
    gap: var(--space-2);
    align-items: center;
    flex-wrap: wrap;
  }
  .connect {
    display: inline-flex;
    align-items: center;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--color-accent);
    color: var(--color-text-on-accent, #fff);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    text-decoration: none;
  }
  .connect:hover {
    filter: brightness(1.05);
  }
  .msg {
    font-size: var(--text-sm);
    color: var(--color-accent);
  }
  .note {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }
</style>
