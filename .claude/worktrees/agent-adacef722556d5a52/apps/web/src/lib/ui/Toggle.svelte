<script lang="ts">
  /**
   * A controlled accessible switch (design system). Reports the *requested* next value via
   * `onchange` — it does not flip itself, so the parent stays the source of truth (e.g. to run an
   * async confirm/consent flow before the state actually changes). Tokens only; light + dark.
   */
  import Spinner from './Spinner.svelte';

  type Size = 'sm' | 'md';

  interface Props {
    /** Current on/off state — reflects the real backing value, not an optimistic guess. */
    checked?: boolean;
    disabled?: boolean;
    /** Shows a spinner in the thumb and blocks interaction while a change is in flight. */
    loading?: boolean;
    size?: Size;
    /** Accessible name; use when there is no visible <label> wired via `id`. */
    label?: string;
    /** id of the switch, so a visible label can point at it with `for`. */
    id?: string;
    /** Called with the value the user is asking for (always `!checked`). */
    onchange?: (next: boolean) => void;
  }

  let {
    checked = false,
    disabled = false,
    loading = false,
    size = 'md',
    label,
    id,
    onchange
  }: Props = $props();

  function activate(): void {
    if (disabled || loading) return;
    onchange?.(!checked);
  }
</script>

<button
  {id}
  type="button"
  role="switch"
  class="toggle {size}"
  class:on={checked}
  aria-checked={checked}
  aria-label={label}
  aria-busy={loading}
  disabled={disabled || loading}
  onclick={activate}
>
  <span class="track" aria-hidden="true">
    <span class="thumb">
      {#if loading}<Spinner size="sm" label="" />{/if}
    </span>
  </span>
</button>

<style>
  .toggle {
    --track-w: 44px;
    --track-h: 26px;
    --thumb: 20px;
    --pad: 3px;

    display: inline-flex;
    align-items: center;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .toggle.sm {
    --track-w: 36px;
    --track-h: 22px;
    --thumb: 16px;
    --pad: 3px;
  }

  .track {
    position: relative;
    display: inline-block;
    width: var(--track-w);
    height: var(--track-h);
    border-radius: var(--radius-full);
    background: var(--color-border-strong);
    transition: background var(--transition-fast);
  }
  .toggle.on .track {
    background: var(--color-accent);
  }

  .thumb {
    position: absolute;
    top: var(--pad);
    left: var(--pad);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--thumb);
    height: var(--thumb);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
    transition: transform var(--transition-fast);
  }
  .toggle.on .thumb {
    transform: translateX(calc(var(--track-w) - var(--thumb) - (var(--pad) * 2)));
  }

  .toggle:focus-visible {
    outline: none;
  }
  .toggle:focus-visible .track {
    box-shadow: var(--focus-ring);
  }

  .toggle:hover:not(:disabled) .track {
    filter: brightness(0.97);
  }

  .toggle:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .toggle[aria-busy='true'] {
    cursor: progress;
  }

  @media (prefers-reduced-motion: reduce) {
    .track,
    .thumb {
      transition: none;
    }
  }
</style>
