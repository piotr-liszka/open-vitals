<script lang="ts">
  import { onMount } from 'svelte';

  type Theme = 'light' | 'dark';
  const STORAGE_KEY = 'gb-theme';

  let theme = $state<Theme>('light');

  onMount(() => {
    // app.html already applied the correct theme before paint — read it back.
    const current = document.documentElement.dataset.theme;
    theme = current === 'dark' ? 'dark' : 'light';
  });

  function apply(next: Theme): void {
    theme = next;
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (private mode / SSR) — dataset still applied.
    }
  }

  function toggle(): void {
    apply(theme === 'dark' ? 'light' : 'dark');
  }

  const isDark = $derived(theme === 'dark');
</script>

<button
  type="button"
  class="theme-toggle"
  role="switch"
  aria-checked={isDark}
  aria-label="Toggle dark mode"
  title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
  onclick={toggle}
>
  <span class="glyph" aria-hidden="true">{isDark ? '☾' : '☀'}</span>
</button>

<style>
  .theme-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--space-8);
    height: var(--space-8);
    padding: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-on-surface);
    cursor: pointer;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast);
  }

  .theme-toggle:hover {
    background: var(--color-surface-hover);
    border-color: var(--color-border-strong);
  }

  .glyph {
    font-size: var(--text-md);
    line-height: 1;
  }
</style>
