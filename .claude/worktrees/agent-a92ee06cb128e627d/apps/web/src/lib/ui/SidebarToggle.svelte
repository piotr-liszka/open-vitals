<script lang="ts">
  /**
   * The sidebar collapse control (spec 063). Presentational: it is told the current state and emits
   * the next one, so the same component serves the copy in the sidebar brand row and the copy that
   * appears in the topbar once the sidebar is gone.
   *
   * Its glyph is `panel-left` — a frame with its left column filled — so the button depicts the thing
   * it operates on. An abstract chevron would need the sidebar visible to be legible, which is
   * exactly the case where the button matters least.
   */
  import Icon from './Icon.svelte';
  import { nextSidebarState, toggleLabel, type SidebarState } from './sidebar-state';

  interface Props {
    state: SidebarState;
    onchange: (next: SidebarState) => void;
  }

  let { state, onchange }: Props = $props();

  const label = $derived(toggleLabel(state));
</script>

<button
  type="button"
  class="sidebar-toggle"
  aria-label={label}
  title={label}
  onclick={() => onchange(nextSidebarState(state))}
>
  <Icon name="panel-left" size={20} />
</button>

<style>
  /*
    Padded exactly like a nav item (`--space-2 / --space-3`), so when its container is padded like
    `.nav` is (`--space-3`) the glyph lands on `--nav-inset` from the sidebar edge — the same vertical
    line every nav icon below it sits on, in both visible states. That alignment is the whole reason
    the toggle lives in the brand row rather than the topbar.
  */
  .sidebar-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-2) var(--space-3);
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background var(--transition-fast);
  }

  .sidebar-toggle:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }

  .sidebar-toggle:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
</style>
