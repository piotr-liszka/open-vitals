<script lang="ts">
  import { page } from '$app/stores';
  import { Card, Button, ThemeToggle } from '$lib/ui';

  // A callback failure sends the athlete back here with a friendly, non-sensitive message.
  const error = $derived($page.url.searchParams.get('error'));

  function signIn(): void {
    // Full-page navigation so the server can 302 to Google (or straight to a dev session in mock mode).
    location.href = '/auth/login';
  }
</script>

<svelte:head><title>Zaloguj się · OpenVitals</title></svelte:head>

<div class="page">
  <div class="corner"><ThemeToggle /></div>
  <div class="panel">
    <div class="brand">
      <span class="dot" aria-hidden="true"></span>
      <span class="name">OpenVitals</span>
    </div>
    <Card title="Zaloguj się" subtitle="Podłącz swoje dane z Garmina do narzędzi AI">
      <div class="body">
        {#if error}
          <p class="error" role="alert">{error}</p>
        {/if}

        <Button variant="primary" onclick={signIn}>Kontynuuj z Google</Button>

        <p class="hint">
          Nie potrzebujesz konta — logowanie przez Google rejestruje Cię i tworzy Twoją prywatną przestrzeń.
        </p>
      </div>
    </Card>
  </div>
</div>

<style>
  .page {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: var(--space-6);
    background: radial-gradient(1200px 600px at 50% -10%, var(--color-accent-soft), transparent 60%);
  }
  .corner {
    position: fixed;
    top: var(--space-4);
    right: var(--space-4);
  }
  .panel {
    width: 100%;
    max-width: 380px;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: var(--radius-full);
    background: var(--color-accent);
    box-shadow: 0 0 0 4px var(--color-accent-soft);
  }
  .name {
    font-size: var(--text-md);
    font-weight: var(--font-semibold);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .hint {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
  }
  .error {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-danger);
  }
</style>
