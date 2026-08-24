<script lang="ts">
  /**
   * The caller's own active sessions (spec 094) — never any other user's, by construction of the API
   * this calls. A per-row "Sign out" and a top-level "Sign out other sessions" (behind a
   * `ConfirmDialog`, since it touches more than one row at once).
   */
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { Badge, Button, Card, ConfirmDialog, IconButton, Table, toasts } from '$lib/ui';
  import { getI18n } from '$lib/i18n';
  import { formatInstant } from '$lib/date';
  import { describeUserAgent } from './account.ua';
  import type { OwnSessionView } from './account.types';

  interface Props {
    sessions: readonly OwnSessionView[];
  }

  let { sessions: initial }: Props = $props();

  const i18n = getI18n();

  // Seeded once from the server-loaded prop; the reader owns the list from here (revoking a row
  // updates local state directly), same pattern as `ProfileCard`'s `saved`.
  let sessions = $state<readonly OwnSessionView[]>(untrack(() => initial));
  let confirmingRevokeOthers = $state(false);
  let busyId = $state<string | null>(null);

  async function revokeOne(session: OwnSessionView): Promise<void> {
    busyId = session.id;
    try {
      const res = await fetch(`/api/account/sessions/${session.id}`, { method: 'DELETE' });
      if (!res.ok) {
        toasts.error(i18n.t('account.sessions.revokeFailed'));
        return;
      }
      const body = (await res.json()) as { wasCurrent: boolean };
      if (body.wasCurrent) {
        await goto('/login');
        return;
      }
      sessions = sessions.filter((s) => s.id !== session.id);
    } finally {
      busyId = null;
    }
  }

  async function revokeOthers(): Promise<void> {
    confirmingRevokeOthers = false;
    const res = await fetch('/api/account/sessions/revoke-others', { method: 'POST' });
    if (!res.ok) {
      toasts.error(i18n.t('account.sessions.revokeFailed'));
      return;
    }
    const body = (await res.json()) as { revoked: number };
    sessions = sessions.filter((s) => s.isCurrent);
    toasts.success(i18n.t('account.sessions.revokedOthers', { count: body.revoked }));
  }
</script>

<Card title={i18n.t('account.sessions.title')} subtitle={i18n.t('account.sessions.subtitle')}>
  {#snippet actions()}
    {#if sessions.some((s) => !s.isCurrent)}
      <Button size="sm" variant="secondary" onclick={() => (confirmingRevokeOthers = true)}>
        {i18n.t('account.sessions.revokeOthersButton')}
      </Button>
    {/if}
  {/snippet}

  <Table caption={i18n.t('account.sessions.tableCaption')}>
    {#snippet head()}
      <th>{i18n.t('account.sessions.colDevice')}</th>
      <th>{i18n.t('account.sessions.colIp')}</th>
      <th>{i18n.t('account.sessions.colCreated')}</th>
      <th>{i18n.t('account.sessions.colExpires')}</th>
      <th><span class="visually-hidden">{i18n.t('account.sessions.colActions')}</span></th>
    {/snippet}

    {#each sessions as session (session.id)}
      <tr>
        <td>
          <div class="device">
            {describeUserAgent(session.userAgent)}
            {#if session.isCurrent}<Badge tone="info" dot={false}
                >{i18n.t('account.sessions.thisDevice')}</Badge
              >{/if}
          </div>
        </td>
        <td>{session.ipAddress ?? '—'}</td>
        <td>{formatInstant(i18n.locale, new Date(session.createdAt), 'date')}</td>
        <td>{formatInstant(i18n.locale, new Date(session.expiresAt), 'date')}</td>
        <td>
          <IconButton
            icon="trash"
            label={i18n.t('account.sessions.revokeButton')}
            size="sm"
            loading={busyId === session.id}
            onclick={() => revokeOne(session)}
          />
        </td>
      </tr>
    {/each}
  </Table>
</Card>

<ConfirmDialog
  open={confirmingRevokeOthers}
  title={i18n.t('account.sessions.revokeOthersConfirmTitle')}
  body={i18n.t('account.sessions.revokeOthersConfirmBody')}
  confirmLabel={i18n.t('account.sessions.revokeOthersButton')}
  cancelLabel={i18n.t('common.cancel')}
  onconfirm={revokeOthers}
  oncancel={() => (confirmingRevokeOthers = false)}
/>

<style>
  .device {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
</style>
