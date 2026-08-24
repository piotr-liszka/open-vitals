<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { Field, Input, Button, toasts } from '$lib/ui';
  import type { SetupResponse } from './setup.types';
  import { getI18n } from '$lib/i18n';

  const i18n = getI18n();

  interface Props {
    /** Called after a successful connection (e.g. to refresh the dashboard). */
    onConnected?: () => void;
  }
  let { onConnected }: Props = $props();

  let email = $state('');
  let password = $state('');
  let mfaCode = $state('');
  let mfaRequired = $state(false);
  let error = $state<string | undefined>(undefined);
  let submitting = $state(false);

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    error = undefined;
    submitting = true;
    try {
      const res = await fetch('/api/garmin/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, ...(mfaRequired && mfaCode ? { mfaCode } : {}) })
      });
      const data = (await res.json().catch(() => ({}))) as SetupResponse;

      if (res.status === 200 && 'outcome' in data && data.outcome === 'success') {
        toasts.success(i18n.t('setup.connected'));
        password = '';
        mfaCode = '';
        mfaRequired = false;
        await invalidateAll();
        onConnected?.();
        return;
      }
      if (res.status === 202 && 'outcome' in data && data.outcome === 'mfa_required') {
        mfaRequired = true;
        error = i18n.t('setup.mfaPrompt');
        return;
      }
      if (res.status === 401) {
        error = i18n.t(mfaRequired ? 'setup.rejectedWithCode' : 'setup.rejected');
        return;
      }
      error = 'error' in data ? data.error : i18n.t('setup.failed');
    } catch {
      error = i18n.t('setup.networkError');
    } finally {
      submitting = false;
    }
  }
</script>

<form onsubmit={submit} novalidate>
  <Field label={i18n.t('setup.emailLabel')}>
    {#snippet children(control)}
      <Input
        id={control.id}
        type="email"
        autocomplete="username"
        placeholder="ty@example.com"
        bind:value={email}
        disabled={submitting || mfaRequired}
      />
    {/snippet}
  </Field>

  <Field label={i18n.t('setup.passwordLabel')}>
    {#snippet children(control)}
      <Input
        id={control.id}
        type="password"
        autocomplete="current-password"
        placeholder={i18n.t('setup.passwordPlaceholder')}
        bind:value={password}
        disabled={submitting || mfaRequired}
      />
    {/snippet}
  </Field>

  {#if mfaRequired}
    <Field label={i18n.t('setup.mfaLabel')} {error} help={i18n.t('setup.mfaHelp')}>
      {#snippet children(control)}
        <Input
          id={control.id}
          aria-describedby={control.describedBy}
          invalid={control.invalid}
          inputmode="numeric"
          autocomplete="one-time-code"
          placeholder="123456"
          bind:value={mfaCode}
          disabled={submitting}
        />
      {/snippet}
    </Field>
  {:else if error}
    <p class="form-error" role="alert">{error}</p>
  {/if}

  <div class="row">
    {#if mfaRequired}
      <Button
        type="button"
        variant="ghost"
        disabled={submitting}
        onclick={() => {
          mfaRequired = false;
          mfaCode = '';
          error = undefined;
        }}
      >
        {i18n.t('setup.startOver')}
      </Button>
    {/if}
    <Button
      type="submit"
      variant="primary"
      loading={submitting}
      disabled={submitting ||
        email.length === 0 ||
        password.length === 0 ||
        (mfaRequired && mfaCode.length === 0)}
    >
      {i18n.t(mfaRequired ? 'setup.verifyAndConnect' : 'setup.connect')}
    </Button>
  </div>
</form>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .row {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  .form-error {
    font-size: var(--text-sm);
    color: var(--color-danger);
  }
</style>
