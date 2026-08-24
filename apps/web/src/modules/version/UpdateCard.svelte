<script lang="ts">
  /**
   * "Czy ta instalacja jest aktualna?" (spec 068).
   *
   * The running build stamp is a Vite literal, so it is free and always shown. The upstream side
   * costs a GitHub API call, so it happens only when the user asks — no background traffic, and the
   * button is the honest UI for an answer that can be slow or fail.
   */
  import { Badge, Button, Card, Spinner } from '$lib/ui';
  import { formatInstant, resolveBrowserTimeZone } from '$lib/date';
  import type { UpdateStatus } from './version.types';
  import { getI18n } from '$lib/i18n';

  const i18n = getI18n();

  let status = $state<UpdateStatus | null>(null);
  let checking = $state(false);
  let failed = $state(false);

  // Match AppShell: render in the fixed app zone first so SSR and hydration agree, then switch to
  // the browser's own zone once mounted (spec 018).
  let zone = $state<string | undefined>(undefined);
  $effect(() => {
    zone = resolveBrowserTimeZone();
  });

  const buildStamp = $derived(formatInstant(i18n.locale, __BUILD_TIME__, 'dateTime', zone));

  async function check(): Promise<void> {
    checking = true;
    failed = false;
    try {
      const res = await fetch('/api/version');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      status = (await res.json()) as UpdateStatus;
    } catch {
      // The endpoint itself failing is different from GitHub being unreachable, which comes back
      // as a normal 200 with state 'unreachable'.
      failed = true;
      status = null;
    } finally {
      checking = false;
    }
  }
</script>

<Card title={i18n.t('shell.version')} subtitle={i18n.t('version.subtitle')}>
  {#snippet actions()}
    <Button size="sm" variant="ghost" onclick={check} disabled={checking}>
      {checking ? i18n.t('version.checking') : i18n.t('version.checkNow')}
    </Button>
  {/snippet}

  <dl class="rows">
    <div class="row">
      <dt>{i18n.t('version.runningLabel')}</dt>
      <dd>
        <time datetime={__BUILD_TIME__}>{buildStamp}</time>
        {#if __BUILD_SHA__}<code class="sha">{__BUILD_SHA__}</code>{/if}
      </dd>
    </div>

    {#if checking}
      <div class="row">
        <dt>{i18n.t('version.status')}</dt>
        <dd class="muted"><Spinner /> {i18n.t('version.asking')}</dd>
      </div>
    {:else if failed}
      <div class="row">
        <dt>{i18n.t('version.status')}</dt>
        <dd><Badge tone="danger">{i18n.t('version.checkFailed')}</Badge></dd>
      </div>
    {:else if status?.state === 'not-configured'}
      <div class="row">
        <dt>{i18n.t('version.status')}</dt>
        <dd>
          <Badge tone="neutral">{i18n.t('version.notConfigured')}</Badge>
          <p class="hint">
            {i18n.t('version.notConfiguredHintLead')} <code>GITHUB_TOKEN</code>
            {i18n.t('version.notConfiguredHintMid')} <code>.env</code>
            {i18n.t('version.notConfiguredHintTail')}
          </p>
        </dd>
      </div>
    {:else if status?.state === 'unreachable'}
      <div class="row">
        <dt>{i18n.t('version.status')}</dt>
        <dd>
          <Badge tone="warning">{i18n.t('version.unreachable')}</Badge>
          <p class="hint">{i18n.t('version.retryLater')}</p>
        </dd>
      </div>
    {:else if status?.state === 'ok' && status.latest}
      <div class="row">
        <dt>{i18n.t('version.status')}</dt>
        <dd>
          {#if status.behind}
            <Badge tone="warning">{i18n.t('version.behindBadge')}</Badge>
          {:else}
            <Badge tone="success">{i18n.t('version.upToDate')}</Badge>
          {/if}
        </dd>
      </div>
      <div class="row">
        <dt>{i18n.t('version.latestCommit')}</dt>
        <dd>
          <a href={status.latest.url} target="_blank" rel="noreferrer noopener">
            <code class="sha">{status.latest.sha}</code>
          </a>
          <span class="subject">{status.latest.subject}</span>
          <span class="muted">{formatInstant(i18n.locale, status.latest.committedAt, 'dateTime', zone)}</span>
        </dd>
      </div>
      {#if status.behind}
        <div class="row">
          <dt>{i18n.t('version.whatNext')}</dt>
          <dd class="hint">
            {i18n.t('version.manualDeployHint')}
          </dd>
        </div>
      {/if}
    {/if}
  </dl>
</Card>

<style>
  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin: 0;
  }

  .row {
    display: grid;
    grid-template-columns: minmax(0, 12rem) minmax(0, 1fr);
    gap: var(--space-3);
    align-items: baseline;
  }

  dt {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  dd {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .sha {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .subject {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .muted {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .hint {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  @media (max-width: 640px) {
    .row {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-1);
    }
  }
</style>
