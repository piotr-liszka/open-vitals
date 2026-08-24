<script lang="ts">
  import type { Snippet } from 'svelte';
  import RangeBadge from './RangeBadge.svelte';

  interface Props {
    title?: string;
    subtitle?: string;
    /** Optional header-right actions (buttons, badges…). */
    actions?: Snippet;
    /**
     * Set when this card's content follows the global range (spec 047) — pass the resolved label,
     * e.g. "30 dni". Renders a `RangeBadge` in the header. Leave unset for cards that ignore the
     * range: absence of the badge is what tells the reader a number is not windowed.
     */
    range?: string | undefined;
    /** What one point/row covers once a long range buckets the data ("week", "month"). */
    rangeBucketNoun?: string | undefined;
    /** Card body. */
    children?: Snippet;
  }

  let { title, subtitle, actions, range, rangeBucketNoun, children }: Props = $props();

  const hasHeader = $derived(Boolean(title || subtitle || actions || range));
</script>

<section class="card">
  {#if hasHeader}
    <header class="card-header">
      <div class="titles">
        {#if title}<h3 class="title">{title}</h3>{/if}
        {#if subtitle}<p class="subtitle">{subtitle}</p>{/if}
      </div>
      {#if range || actions}
        <div class="actions">
          {#if range}<RangeBadge label={range} bucketNoun={rangeBucketNoun} />{/if}
          {@render actions?.()}
        </div>
      {/if}
    </header>
  {/if}
  <div class="card-body">
    {@render children?.()}
  </div>
</section>

<style>
  .card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--color-border);
  }

  .titles {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .title {
    font-size: var(--text-md);
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text);
  }

  .subtitle {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
    /* A long "cały czas (od …)" badge beside a card's own actions wraps instead of overflowing the
       header on a phone (spec 034). */
    flex-wrap: wrap;
    justify-content: flex-end;
    min-width: 0;
  }

  .card-body {
    padding: var(--space-5);
  }
</style>
