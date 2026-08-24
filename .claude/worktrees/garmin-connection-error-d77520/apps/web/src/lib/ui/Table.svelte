<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Contents of the header row (`<th>` cells). */
    head?: Snippet;
    /** Body rows (`<tr><td>…`). */
    children?: Snippet;
    /** Alternating row background. */
    zebra?: boolean;
    /** Visually-hidden-friendly caption for screen readers. */
    caption?: string;
  }

  let { head, children, zebra = false, caption }: Props = $props();
</script>

<div class="table-wrap">
  <table class="table" class:zebra>
    {#if caption}<caption>{caption}</caption>{/if}
    {#if head}
      <thead>
        <tr>{@render head()}</tr>
      </thead>
    {/if}
    <tbody>
      {@render children?.()}
    </tbody>
  </table>
</div>

<style>
  .table-wrap {
    width: 100%;
    overflow-x: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }

  .table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  caption {
    text-align: left;
    padding: var(--space-3) var(--space-4);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
  }

  .table :global(th) {
    text-align: left;
    font-weight: var(--font-semibold);
    color: var(--color-text-muted);
    background: var(--color-surface-2);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
  }

  .table :global(td) {
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-on-surface);
  }

  .table :global(tbody tr:last-child td) {
    border-bottom: none;
  }

  .table.zebra :global(tbody tr:nth-child(even) td) {
    background: var(--color-surface-2);
  }

  .table :global(tbody tr:hover td) {
    background: var(--color-surface-hover);
  }
</style>
