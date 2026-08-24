<script module lang="ts">
  export interface UserEditSubmission {
    email: string;
    username: string;
    /** Empty string = "no change" (edit) / "no password" (create) — the caller strips it. */
    password: string;
    isAdmin: boolean;
  }
</script>

<script lang="ts">
  /**
   * Create/edit form for one user (spec 094) — built from `Field`/`Input`/`Toggle`, on the native
   * `<dialog>` element (same platform mechanics as `ConfirmDialog`: focus trap, Escape-to-close, the
   * inert backdrop). A `password` field doubles as "reset this user's password" in edit mode — the
   * parent posts it to the DEDICATED reset endpoint, never bundled into the identity PATCH, per the
   * API contract.
   */
  import { Button, Field, Input, Toggle } from '$lib/ui';
  import { getI18n, type MessageKey } from '$lib/i18n';
  import type { AdminUserFieldErrors, AdminUserSummary } from './admin-users.types';
  interface Props {
    open: boolean;
    mode: 'create' | 'edit';
    user?: AdminUserSummary | null;
    fields?: AdminUserFieldErrors;
    saving?: boolean;
    onsave: (submission: UserEditSubmission) => void;
    oncancel: () => void;
  }

  let { open, mode, user = null, fields = {}, saving = false, onsave, oncancel }: Props = $props();

  const i18n = getI18n();

  let email = $state('');
  let username = $state('');
  let password = $state('');
  let isAdmin = $state(false);

  // Reset the form contents whenever the dialog is (re)opened for a (possibly different) user.
  $effect(() => {
    if (!open) return;
    email = user?.email ?? '';
    username = user?.username ?? '';
    password = '';
    isAdmin = user?.isAdmin ?? false;
  });

  let el: HTMLDialogElement | undefined = $state();
  $effect(() => {
    const dialog = el;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });

  const ERROR_KEYS: Record<string, MessageKey> = {
    invalid_email: 'admin.users.error.invalid_email',
    email_taken: 'admin.users.error.email_taken',
    invalid_username: 'admin.users.error.invalid_username',
    username_taken: 'admin.users.error.username_taken',
    invalid_password: 'admin.users.error.invalid_password'
  };
  function fieldError(code: string | undefined): string | undefined {
    if (!code) return undefined;
    const key = ERROR_KEYS[code];
    return key ? i18n.t(key) : code;
  }

  function submit(e: SubmitEvent): void {
    e.preventDefault();
    onsave({ email, username, password, isAdmin });
  }
</script>

<dialog bind:this={el} class="edit-dialog" {oncancel} onclose={oncancel} aria-labelledby="user-edit-title">
  <h2 class="title" id="user-edit-title">
    {mode === 'create' ? i18n.t('admin.users.createTitle') : i18n.t('admin.users.editTitle')}
  </h2>

  <form class="form" onsubmit={submit}>
    <Field label={i18n.t('admin.users.emailLabel')} error={fieldError(fields.email)}>
      {#snippet children(control)}
        <Input
          id={control.id}
          type="email"
          bind:value={email}
          invalid={control.invalid}
          aria-describedby={control.describedBy}
          required
        />
      {/snippet}
    </Field>

    <Field label={i18n.t('admin.users.usernameLabel')} error={fieldError(fields.username)}>
      {#snippet children(control)}
        <Input
          id={control.id}
          type="text"
          bind:value={username}
          invalid={control.invalid}
          aria-describedby={control.describedBy}
          required
        />
      {/snippet}
    </Field>

    <Field
      label={mode === 'create'
        ? i18n.t('admin.users.initialPasswordLabel')
        : i18n.t('admin.users.resetPasswordLabel')}
      help={mode === 'edit' ? i18n.t('admin.users.resetPasswordHelp') : undefined}
      error={fieldError(fields.password)}
    >
      {#snippet children(control)}
        <Input
          id={control.id}
          type="password"
          autocomplete="new-password"
          bind:value={password}
          invalid={control.invalid}
          aria-describedby={control.describedBy}
        />
      {/snippet}
    </Field>

    <div class="toggle-row">
      <Toggle id="user-edit-admin" checked={isAdmin} onchange={(next) => (isAdmin = next)} />
      <label for="user-edit-admin">{i18n.t('admin.users.isAdminLabel')}</label>
    </div>

    <div class="actions">
      <Button type="button" size="sm" variant="secondary" onclick={oncancel}>{i18n.t('common.cancel')}</Button
      >
      <Button type="submit" size="sm" variant="primary" loading={saving} disabled={saving}>
        {i18n.t('common.save')}
      </Button>
    </div>
  </form>
</dialog>

<style>
  .edit-dialog {
    width: min(28rem, calc(100vw - var(--space-8)));
    margin: auto;
    padding: var(--space-6);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: var(--shadow-lg);
  }
  .edit-dialog::backdrop {
    background: var(--color-overlay);
  }
  .title {
    margin: 0 0 var(--space-4);
    font-size: var(--text-md);
    font-weight: var(--font-bold);
    letter-spacing: var(--tracking-tight);
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .toggle-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .toggle-row label {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
</style>
