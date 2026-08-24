<script lang="ts">
  import { Card, Button, Badge, toasts } from '$lib/ui';

  interface Props {
    url: string;
    /** Whether the Garmin account is connected — affects the hint shown. */
    connected?: boolean;
  }
  let { url, connected = false }: Props = $props();

  let copied = $state(false);
  let rotating = $state(false);
  // After a rotation the loader hasn't re-run yet, so show the freshly issued URL locally.
  let rotatedUrl = $state<string | null>(null);
  const displayUrl = $derived(rotatedUrl ?? url);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(displayUrl);
      copied = true;
      toasts.success('Skopiowano adres MCP do schowka.');
      setTimeout(() => (copied = false), 1500);
    } catch {
      toasts.error('Nie udało się skopiować — zaznacz i skopiuj ręcznie.');
    }
  }

  async function rotate(): Promise<void> {
    rotating = true;
    try {
      const res = await fetch('/api/settings/mcp-token/rotate', { method: 'POST' });
      const body = (await res.json().catch(() => null)) as { url?: string } | null;
      if (res.ok && body?.url) {
        rotatedUrl = body.url;
        toasts.success('Token wymieniony — stary adres już nie działa.');
      } else {
        toasts.error('Nie udało się wymienić tokenu. Spróbuj ponownie.');
      }
    } catch {
      toasts.error('Nie udało się połączyć z serwerem. Spróbuj ponownie.');
    } finally {
      rotating = false;
    }
  }
</script>

<Card title="Twój adres MCP" subtitle="Dodaj go jako konektor w Claude lub ChatGPT">
  {#snippet actions()}
    <Badge tone={connected ? 'success' : 'neutral'}>{connected ? 'Gotowe' : 'Najpierw połącz Garmina'}</Badge>
  {/snippet}

  <div class="body">
    <div class="url" role="group" aria-label="Adres MCP">
      <code>{displayUrl}</code>
      <Button size="sm" variant="secondary" onclick={copy}>{copied ? 'Skopiowano' : 'Kopiuj'}</Button>
      <Button size="sm" variant="ghost" loading={rotating} onclick={rotate}>Wymień</Button>
    </div>
    <p class="hint">
      Ten adres jest przypisany tylko do Twojego konta i zawiera sekretny token — traktuj go jak hasło. Każdy,
      kto go ma, może przez tę usługę czytać Twoje dane z Garmina. Użyj przycisku
      <strong>Wymień</strong>, aby wygenerować nowy token; poprzedni adres przestaje działać natychmiast.
    </p>
  </div>
</Card>

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .url {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }
  .url code {
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    white-space: nowrap;
    color: var(--color-text-on-surface);
  }
  .hint {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
  }
</style>
