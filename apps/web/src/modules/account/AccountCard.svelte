<script lang="ts">
  /**
   * "My Account" — signed-in status (spec 094): whether a password is set, whether Google is linked
   * (and to which email/avatar, read-only — no "disconnect"/"link now" action, see spec), plus the
   * password form itself: a bare "set a password" form when there is none yet, a "change password"
   * form (current + new + confirm) once there is.
   */
  import { Badge, Button, Card, Field, Input, toasts } from '$lib/ui';
  import { getI18n } from '$lib/i18n';
  import type { AccountInfo } from './account.types';

  interface Props {
    account: AccountInfo;
  }

  let { account }: Props = $props();

  const i18n = getI18n();

  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let error = $state<string | null>(null);
  let saving = $state(false);

  const hasPassword = $derived(account.hasPassword);

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    error = null;
    saving = true;
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...(hasPassword ? { currentPassword } : {}),
          newPassword,
          confirmPassword
        })
      });
      if (res.ok) {
        toasts.success(i18n.t('account.password.saved'));
        currentPassword = '';
        newPassword = '';
        confirmPassword = '';
        account = { ...account, hasPassword: true };
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (body.error === 'invalid_current_password') error = i18n.t('account.password.error.wrongCurrent');
      else if (body.error === 'mismatch') error = i18n.t('account.password.error.mismatch');
      else error = i18n.t('account.password.error.invalid');
    } catch {
      error = i18n.t('account.password.error.network');
    } finally {
      saving = false;
    }
  }
</script>

<Card title={i18n.t('account.title')} subtitle={i18n.t('account.subtitle')}>
  <div class="stack">
    <div class="status">
      <div class="row">
        <span class="label">{i18n.t('account.usernameLabel')}</span>
        <span class="value">{account.username}</span>
      </div>
      <div class="row">
        <span class="label">{i18n.t('account.emailLabel')}</span>
        <span class="value">{account.email}</span>
      </div>
      <div class="row">
        <span class="label">{i18n.t('account.passwordStatusLabel')}</span>
        <Badge tone={hasPassword ? 'success' : 'neutral'} dot={false}>
          {hasPassword ? i18n.t('account.passwordSet') : i18n.t('account.passwordNotSet')}
        </Badge>
      </div>
      <div class="row">
        <span class="label">{i18n.t('account.googleStatusLabel')}</span>
        {#if account.hasGoogle}
          <Badge tone="info" dot={false}>{account.googleEmail ?? i18n.t('account.googleLinked')}</Badge>
        {:else}
          <Badge tone="neutral" dot={false}>{i18n.t('account.googleNotLinked')}</Badge>
        {/if}
      </div>
    </div>

    <form class="form" onsubmit={submit} novalidate>
      <h3 class="form-title">
        {hasPassword ? i18n.t('account.changePasswordTitle') : i18n.t('account.setPasswordTitle')}
      </h3>

      {#if hasPassword}
        <Field label={i18n.t('account.currentPasswordLabel')}>
          {#snippet children(control)}
            <Input
              id={control.id}
              type="password"
              autocomplete="current-password"
              bind:value={currentPassword}
              disabled={saving}
              required
            />
          {/snippet}
        </Field>
      {/if}

      <Field label={i18n.t('account.newPasswordLabel')}>
        {#snippet children(control)}
          <Input
            id={control.id}
            type="password"
            autocomplete="new-password"
            bind:value={newPassword}
            disabled={saving}
            required
          />
        {/snippet}
      </Field>

      <Field label={i18n.t('account.confirmPasswordLabel')} error={error ?? undefined}>
        {#snippet children(control)}
          <Input
            id={control.id}
            type="password"
            autocomplete="new-password"
            bind:value={confirmPassword}
            invalid={control.invalid}
            aria-describedby={control.describedBy}
            disabled={saving}
            required
          />
        {/snippet}
      </Field>

      <div class="actions">
        <Button type="submit" size="sm" variant="primary" loading={saving}>{i18n.t('common.save')}</Button>
      </div>
    </form>
  </div>
</Card>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .status {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .label {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }
  .value {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }
  .form-title {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
