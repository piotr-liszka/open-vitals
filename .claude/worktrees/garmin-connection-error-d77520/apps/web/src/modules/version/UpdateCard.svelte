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

  let status = $state<UpdateStatus | null>(null);
  let checking = $state(false);
  let failed = $state(false);

  // Match AppShell: render in the fixed app zone first so SSR and hydration agree, then switch to
  // the browser's own zone once mounted (spec 018).
  let zone = $state<string | undefined>(undefined);
  $effect(() => {
    zone = resolveBrowserTimeZone();
  });

  const buildStamp = $derived(formatInstant(__BUILD_TIME__, 'dateTime', zone));

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

<Card title="Wersja" subtitle="Czy ta instalacja działa na najnowszym kodzie">
  {#snippet actions()}
    <Button size="sm" variant="ghost" onclick={check} disabled={checking}>
      {checking ? 'Sprawdzanie…' : 'Sprawdź aktualizacje'}
    </Button>
  {/snippet}

  <dl class="rows">
    <div class="row">
      <dt>Uruchomiona wersja</dt>
      <dd>
        <time datetime={__BUILD_TIME__}>{buildStamp}</time>
        {#if __BUILD_SHA__}<code class="sha">{__BUILD_SHA__}</code>{/if}
      </dd>
    </div>

    {#if checking}
      <div class="row">
        <dt>Status</dt>
        <dd class="muted"><Spinner /> Pytam GitHuba…</dd>
      </div>
    {:else if failed}
      <div class="row">
        <dt>Status</dt>
        <dd><Badge tone="danger">Nie udało się sprawdzić</Badge></dd>
      </div>
    {:else if status?.state === 'not-configured'}
      <div class="row">
        <dt>Status</dt>
        <dd>
          <Badge tone="neutral">Sprawdzanie nieskonfigurowane</Badge>
          <p class="hint">
            Ustaw <code>GITHUB_TOKEN</code> w <code>.env</code> — repozytorium jest prywatne.
          </p>
        </dd>
      </div>
    {:else if status?.state === 'unreachable'}
      <div class="row">
        <dt>Status</dt>
        <dd>
          <Badge tone="warning">GitHub nieosiągalny</Badge>
          <p class="hint">Spróbuj ponownie za chwilę.</p>
        </dd>
      </div>
    {:else if status?.state === 'ok' && status.latest}
      <div class="row">
        <dt>Status</dt>
        <dd>
          {#if status.behind}
            <Badge tone="warning">Dostępna nowsza wersja</Badge>
          {:else}
            <Badge tone="success">Aktualna</Badge>
          {/if}
        </dd>
      </div>
      <div class="row">
        <dt>Najnowszy commit</dt>
        <dd>
          <a href={status.latest.url} target="_blank" rel="noreferrer noopener">
            <code class="sha">{status.latest.sha}</code>
          </a>
          <span class="subject">{status.latest.subject}</span>
          <span class="muted">{formatInstant(status.latest.committedAt, 'dateTime', zone)}</span>
        </dd>
      </div>
      {#if status.behind}
        <div class="row">
          <dt>Co dalej</dt>
          <dd class="hint">
            Wdrożenie jest ręczne: zaktualizuj kod na NAS-ie i uruchom stack ponownie. Ta karta tylko
            informuje — aplikacja celowo nie aktualizuje sama siebie.
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
