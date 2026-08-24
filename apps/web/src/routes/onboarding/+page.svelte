<script lang="ts">
  /**
   * First-run admin creation (spec 094). Reuses the same page chrome as `/login` (LangSwitch,
   * ThemeToggle, centered panel) for visual consistency on the one screen a fresh install shows.
   */
  import { enhance } from '$app/forms';
  import { Card, Button, Field, Input, LangSwitch, ThemeToggle } from '$lib/ui';
  import { getI18n, type MessageKey } from '$lib/i18n';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();

  const i18n = getI18n();
  let submitting = $state(false);

  const ERROR_KEYS: Record<string, MessageKey> = {
    invalid_email: 'onboarding.error.invalid_email',
    email_taken: 'onboarding.error.email_taken',
    invalid_username: 'onboarding.error.invalid_username',
    username_taken: 'onboarding.error.username_taken',
    invalid_password: 'onboarding.error.invalid_password',
    password_mismatch: 'onboarding.error.password_mismatch'
  };

  function fieldError(code: string | undefined): string | undefined {
    if (!code) return undefined;
    const key = ERROR_KEYS[code];
    return key ? i18n.t(key) : code;
  }

  const fields = $derived(form?.fields ?? {});
</script>

<svelte:head><title>{i18n.t('onboarding.title')} · OpenVitals</title></svelte:head>

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
    <Card title={i18n.t('onboarding.title')} subtitle={i18n.t('onboarding.subtitle')}>
      <form
        class="body"
        method="POST"
        use:enhance={() => {
          submitting = true;
          return async ({ update }) => {
            await update();
            submitting = false;
          };
        }}
      >
        <Field label={i18n.t('onboarding.emailLabel')} error={fieldError(fields.email)}>
          {#snippet children(control)}
            <Input
              id={control.id}
              name="email"
              type="email"
              autocomplete="email"
              invalid={control.invalid}
              aria-describedby={control.describedBy}
              required
            />
          {/snippet}
        </Field>

        <Field label={i18n.t('onboarding.usernameLabel')} error={fieldError(fields.username)}>
          {#snippet children(control)}
            <Input
              id={control.id}
              name="username"
              type="text"
              autocomplete="username"
              invalid={control.invalid}
              aria-describedby={control.describedBy}
              required
            />
          {/snippet}
        </Field>

        <Field label={i18n.t('onboarding.passwordLabel')} error={fieldError(fields.password)}>
          {#snippet children(control)}
            <Input
              id={control.id}
              name="password"
              type="password"
              autocomplete="new-password"
              invalid={control.invalid}
              aria-describedby={control.describedBy}
              required
            />
          {/snippet}
        </Field>

        <Field label={i18n.t('onboarding.confirmPasswordLabel')} error={fieldError(fields.confirmPassword)}>
          {#snippet children(control)}
            <Input
              id={control.id}
              name="confirmPassword"
              type="password"
              autocomplete="new-password"
              invalid={control.invalid}
              aria-describedby={control.describedBy}
              required
            />
          {/snippet}
        </Field>

        <Button type="submit" variant="primary" loading={submitting} disabled={submitting}>
          {i18n.t('onboarding.submit')}
        </Button>
      </form>
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
    max-width: 420px;
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
</style>
