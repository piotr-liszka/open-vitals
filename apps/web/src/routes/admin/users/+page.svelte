<script lang="ts">
  /**
   * `/admin/users` (spec 094) — a top-level, admin-only area rather than a `/settings` tab: this is
   * about OTHER people's accounts, a different audience from `/settings`'s per-account surface.
   */
  import { invalidateAll } from '$app/navigation';
  import { AppShell, Banner, Button, ConfirmDialog } from '$lib/ui';
  import { getI18n } from '$lib/i18n';
  import UserTable from '$modules/admin-users/UserTable.svelte';
  import UserEditDialog, { type UserEditSubmission } from '$modules/admin-users/UserEditDialog.svelte';
  import type { AdminUserFieldErrors, AdminUserSummary } from '$modules/admin-users/admin-users.types';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const i18n = getI18n();

  let dialogOpen = $state(false);
  let dialogMode = $state<'create' | 'edit'>('create');
  let editing = $state<AdminUserSummary | null>(null);
  let dialogFields = $state<AdminUserFieldErrors>({});
  let saving = $state(false);
  let banner = $state<string | null>(null);

  let deleteTarget = $state<AdminUserSummary | null>(null);
  let lastAdminNoticeFor = $state<AdminUserSummary | null>(null);

  function openCreate(): void {
    dialogMode = 'create';
    editing = null;
    dialogFields = {};
    dialogOpen = true;
  }

  function openEdit(user: AdminUserSummary): void {
    dialogMode = 'edit';
    editing = user;
    dialogFields = {};
    dialogOpen = true;
  }

  function closeDialog(): void {
    dialogOpen = false;
  }

  async function save(submission: UserEditSubmission): Promise<void> {
    saving = true;
    banner = null;
    try {
      if (dialogMode === 'create') {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: submission.email,
            username: submission.username,
            password: submission.password || undefined,
            isAdmin: submission.isAdmin
          })
        });
        const body = await res.json();
        if (!res.ok) {
          dialogFields = body.fields ?? {};
          if (!body.fields) banner = i18n.t('admin.users.saveErrorBanner');
          return;
        }
      } else if (editing) {
        const res = await fetch(`/api/admin/users/${editing.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: submission.email,
            username: submission.username,
            isAdmin: submission.isAdmin
          })
        });
        const body = await res.json();
        if (!res.ok) {
          if (res.status === 409 && body.error === 'last_admin') {
            lastAdminNoticeFor = editing;
            return;
          }
          dialogFields = body.fields ?? {};
          if (!body.fields) banner = i18n.t('admin.users.saveErrorBanner');
          return;
        }
        if (submission.password) {
          const pwRes = await fetch(`/api/admin/users/${editing.id}/password`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ password: submission.password })
          });
          if (!pwRes.ok) {
            const pwBody = await pwRes.json();
            dialogFields = pwBody.error === 'invalid_password' ? { password: 'invalid_password' } : {};
            if (pwBody.error !== 'invalid_password') banner = i18n.t('admin.users.saveErrorBanner');
            return;
          }
        }
      }
      dialogOpen = false;
      await invalidateAll();
    } finally {
      saving = false;
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 409 && body.error === 'last_admin') {
        lastAdminNoticeFor = deleteTarget;
      } else {
        banner = i18n.t('admin.users.saveErrorBanner');
      }
      deleteTarget = null;
      return;
    }
    deleteTarget = null;
    await invalidateAll();
  }
</script>

<svelte:head><title>{i18n.t('admin.users.pageTitle')} · OpenVitals</title></svelte:head>

<AppShell title={i18n.t('admin.users.pageTitle')}>
  <div class="stack">
    {#if banner}
      <Banner tone="danger">{banner}</Banner>
    {/if}

    <div class="head">
      <Button size="sm" variant="primary" onclick={openCreate}>{i18n.t('admin.users.newUserButton')}</Button>
    </div>

    <UserTable
      users={data.users}
      currentUserId={data.currentUserId}
      onedit={openEdit}
      ondelete={(user) => (deleteTarget = user)}
    />
  </div>
</AppShell>

<UserEditDialog
  open={dialogOpen}
  mode={dialogMode}
  user={editing}
  fields={dialogFields}
  {saving}
  onsave={save}
  oncancel={closeDialog}
/>

<ConfirmDialog
  open={deleteTarget !== null}
  title={i18n.t('admin.users.deleteConfirmTitle')}
  body={deleteTarget ? i18n.t('admin.users.deleteConfirmBody', { username: deleteTarget.username }) : ''}
  confirmLabel={i18n.t('common.delete')}
  cancelLabel={i18n.t('common.cancel')}
  onconfirm={confirmDelete}
  oncancel={() => (deleteTarget = null)}
/>

<ConfirmDialog
  open={lastAdminNoticeFor !== null}
  title={i18n.t('admin.users.lastAdminTitle')}
  body={i18n.t('admin.users.lastAdminBody')}
  confirmLabel={i18n.t('common.close')}
  cancelLabel={i18n.t('common.close')}
  onconfirm={() => (lastAdminNoticeFor = null)}
  oncancel={() => (lastAdminNoticeFor = null)}
/>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .head {
    display: flex;
    justify-content: flex-end;
  }
</style>
