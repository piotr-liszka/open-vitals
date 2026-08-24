<script lang="ts">
  /**
   * The MCP integration card (spec 071): the personal URL, its copy/rotate controls, and MCP's own
   * on/off switch in the `settings` slot — the same shape as the Garmin card, because "one card per
   * integration, holding everything about it" is the whole organising idea of Settings now.
   */
  import type { Snippet } from 'svelte';
  import { Card, Button, Badge, toasts } from '$lib/ui';

  interface Props {
    url: string;
    /** Whether the Garmin account is connected — affects the hint shown. */
    connected?: boolean;
    /**
     * Whether the MCP endpoint is switched on. Off dims the URL row: the address is still yours and
     * still secret, but nothing answers at it, and a live-looking URL would be a lie.
     */
    enabled?: boolean;
    /** This integration's own switches (spec 071). */
    settings?: Snippet;
  }
  let { url, connected = false, enabled = true, settings }: Props = $props();

  let copied = $state(false);
  let rotating = $state(false);
  // After a rotation the loader hasn't re-run yet, so show the freshly issued URL locally.
  let rotatedUrl = $state<string | null>(null);
  const displayUrl = $derived(rotatedUrl ?? url);

  const badge = $derived(
    !enabled
      ? { tone: 'neutral' as const, label: 'Wyłączony' }
      : connected
        ? { tone: 'success' as const, label: 'Gotowe' }
        : { tone: 'neutral' as const, label: 'Najpierw połącz Garmina' }
  );

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

<Card title="MCP" subtitle="Twój osobisty adres dla klientów AI — Claude, ChatGPT">
  {#snippet actions()}
    <Badge tone={badge.tone}>{badge.label}</Badge>
  {/snippet}

  <div class="body">
    <div class="url" class:off={!enabled} role="group" aria-label="Adres MCP">
      <code>{displayUrl}</code>
      <Button size="sm" variant="secondary" onclick={copy}>{copied ? 'Skopiowano' : 'Kopiuj'}</Button>
      <Button size="sm" variant="ghost" loading={rotating} onclick={rotate}>Wymień</Button>
    </div>
    <p class="hint">
      Ten adres jest przypisany tylko do Twojego konta i zawiera sekretny token — traktuj go jak hasło. Każdy,
      kto go ma, może przez tę usługę czytać Twoje dane z Garmina. Użyj przycisku
      <strong>Wymień</strong>, aby wygenerować nowy token; poprzedni adres przestaje działać natychmiast.
    </p>

    {#if settings}
      <hr class="rule" />
      <div class="settings">{@render settings()}</div>
    {/if}
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
  /* Dimmed, not hidden: the address is still the user's and still worth copying ahead of turning
     the endpoint back on — it just is not answering right now. */
  .url.off code {
    color: var(--color-text-muted);
    text-decoration: line-through;
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
  .rule {
    border: none;
    border-top: 1px solid var(--color-border);
    margin: var(--space-2) 0 0;
    width: 100%;
  }
  .settings {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
</style>
