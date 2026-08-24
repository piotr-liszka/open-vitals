<script lang="ts">
  /**
   * The admin user list (spec 094) — `lib/ui`'s `Table`, one row per user. Never renders a password
   * hash (the API never sends one either); "auth methods" is two small badges so a reader can tell
   * apart a Google-only, password-only, or dual-method account at a glance.
   */
  import { Badge, IconButton, Table } from '$lib/ui';
  import { getI18n } from '$lib/i18n';
  import { formatInstant } from '$lib/date';
  import type { AdminUserSummary } from './admin-users.types';

  interface Props {
    users: readonly AdminUserSummary[];
    /** The signed-in admin's own id — their row hides the delete action (never let an admin lock
     *  themselves out of the only account that can undo it). */
    currentUserId: string;
    onedit: (user: AdminUserSummary) => void;
    ondelete: (user: AdminUserSummary) => void;
  }

  let { users, currentUserId, onedit, ondelete }: Props = $props();

  const i18n = getI18n();
</script>

<Table caption={i18n.t('admin.users.tableCaption')}>
  {#snippet head()}
    <th>{i18n.t('admin.users.colUsername')}</th>
    <th>{i18n.t('admin.users.colEmail')}</th>
    <th>{i18n.t('admin.users.colName')}</th>
    <th>{i18n.t('admin.users.colAdmin')}</th>
    <th>{i18n.t('admin.users.colMethods')}</th>
    <th>{i18n.t('admin.users.colCreated')}</th>
    <th><span class="visually-hidden">{i18n.t('admin.users.colActions')}</span></th>
  {/snippet}

  {#each users as user (user.id)}
    <tr>
      <td>{user.username}</td>
      <td>{user.email}</td>
      <td>{user.name ?? '—'}</td>
      <td>
        {#if user.isAdmin}
          <Badge tone="success">{i18n.t('admin.users.adminBadge')}</Badge>
        {:else}
          <Badge tone="neutral">{i18n.t('admin.users.memberBadge')}</Badge>
        {/if}
      </td>
      <td>
        <div class="methods">
          {#if user.hasPassword}<Badge tone="info" dot={false}>{i18n.t('admin.users.passwordBadge')}</Badge
            >{/if}
          {#if user.hasGoogle}<Badge tone="info" dot={false}>{i18n.t('admin.users.googleBadge')}</Badge>{/if}
        </div>
      </td>
      <td>{formatInstant(i18n.locale, new Date(user.createdAt), 'date')}</td>
      <td>
        <div class="actions">
          <IconButton icon="edit" label={i18n.t('common.edit')} size="sm" onclick={() => onedit(user)} />
          {#if user.id !== currentUserId}
            <IconButton
              icon="trash"
              label={i18n.t('common.delete')}
              size="sm"
              onclick={() => ondelete(user)}
            />
          {/if}
        </div>
      </td>
    </tr>
  {/each}
</Table>

<style>
  .methods {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .actions {
    display: flex;
    gap: var(--space-1);
    justify-content: flex-end;
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
