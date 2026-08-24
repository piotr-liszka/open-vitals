<script lang="ts">
  import { page } from '$app/stores';
  import { Card, Button, Field, Input, LangSwitch, ThemeToggle } from '$lib/ui';
  import { getI18n } from '$lib/i18n';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const i18n = getI18n();

  // A callback failure sends the athlete back here with a friendly, non-sensitive message.
  const queryError = $derived($page.url.searchParams.get('error'));

  let identifier = $state('');
  let password = $state('');
  let submitting = $state(false);
  let error = $state<string | null>(null);

  function signInWithGoogle(): void {
    // Full-page navigation so the server can 302 to Google (or straight to a dev session in mock mode).
    location.href = '/auth/login';
  }

  async function submitPassword(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    error = null;
    submitting = true;
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        location.href = '/';
        return;
      }
      error = typeof body.error === 'string' ? body.error : i18n.t('auth.invalidCredentials');
    } finally {
      submitting = false;
    }
  }

  const shownError = $derived(error ?? queryError);
</script>

<svelte:head><title>{i18n.t('login.title')} · OpenVitals</title></svelte:head>

<div class="page">
  <div class="corner">
    <LangSwitch />
    <ThemeToggle />
  </div>
  <div class="panel">
    <div class="brand">
      <span class="dot" aria-hidden="true"></span>
      <span class="name">OpenVitals</span>
    </div>
    <Card title={i18n.t('login.title')} subtitle={i18n.t('login.subtitle')}>
      <div class="body">
        {#if shownError}
          <p class="error" role="alert">{shownError}</p>
        {/if}

        <!-- Password form first (spec 094): the primary method for a self-hosted install with no
             Google configured at all; Google stays a secondary option when present. -->
        <form class="password-form" onsubmit={submitPassword} novalidate>
          <Field label={i18n.t('login.identifierLabel')}>
            {#snippet children(control)}
              <Input
                id={control.id}
                type="text"
                autocomplete="username"
                bind:value={identifier}
                disabled={submitting}
                required
              />
            {/snippet}
          </Field>
          <Field label={i18n.t('login.passwordLabel')}>
            {#snippet children(control)}
              <Input
                id={control.id}
                type="password"
                autocomplete="current-password"
                bind:value={password}
                disabled={submitting}
                required
              />
            {/snippet}
          </Field>
          <Button type="submit" variant="primary" loading={submitting} disabled={submitting}>
            {i18n.t('login.signInButton')}
          </Button>
        </form>

        {#if data.googleEnabled}
          <div class="divider" role="separator" aria-label={i18n.t('login.orDivider')}>
            <span>{i18n.t('login.orDivider')}</span>
          </div>
          <Button variant="secondary" onclick={signInWithGoogle}>
            {i18n.t('login.continueWithGoogle')}
          </Button>
        {/if}

        <p class="hint">{i18n.t('login.note')}</p>
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
    display: flex;
    align-items: center;
    gap: var(--space-2);
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
  .password-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .divider {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }
  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--color-border);
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
