<script lang="ts">
  /**
   * Sign out. One button, one place — it used to be ten copies of the same four-line handler and the
   * same `<Button>`, one per page that mounts the shell.
   *
   * It lives in `lib/ui` beside `ThemeToggle` (which writes a preference) and `RangeSwitch` (which
   * rewrites the URL) rather than in a feature module, because `AppShell` renders it as the topbar's
   * default action cluster and `lib/` may never import a module (AGENTS.md §5).
   *
   * A full page load rather than `goto`: signing out invalidates the session cookie, and every load
   * function on the current page was resolved against it. Throwing the whole client state away is the
   * only way to be sure nothing signed-in survives the transition.
   */
  import Button from './Button.svelte';

  async function logout(): Promise<void> {
    await fetch('/auth/logout', { method: 'POST' });
    location.href = '/login';
  }
</script>

<Button size="sm" variant="ghost" onclick={logout}>Wyloguj</Button>
