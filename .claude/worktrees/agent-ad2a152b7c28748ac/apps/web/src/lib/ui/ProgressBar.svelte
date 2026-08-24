<script lang="ts">
  /** Tokenized progress bar (spec 015). `value` is 0..1; omit/undefined for an indeterminate sweep. */
  interface Props {
    value?: number | null;
    label?: string;
    /** Show the percent on the right. */
    showPct?: boolean;
    accent?: string;
  }
  let { value = null, label, showPct = true, accent = 'var(--color-accent)' }: Props = $props();

  const pct = $derived(value === null || value === undefined ? null : Math.max(0, Math.min(1, value)));
  const isIndeterminate = $derived(pct === null);
</script>

<div class="wrap">
  {#if label || (showPct && pct !== null)}
    <div class="row">
      {#if label}<span class="label">{label}</span>{/if}
      {#if showPct && pct !== null}<span class="pct">{Math.round(pct * 100)}%</span>{/if}
    </div>
  {/if}
  <div
    class="track"
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={pct === null ? undefined : Math.round(pct * 100)}
  >
    <div
      class="fill"
      class:indeterminate={isIndeterminate}
      style="--accent: {accent}; {pct === null ? '' : `width: ${pct * 100}%`}"
    ></div>
  </div>
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-3);
  }
  .label {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }
  .pct {
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }
  .track {
    position: relative;
    height: 10px;
    border-radius: var(--radius-pill, 999px);
    background: var(--color-surface-hover, rgba(127, 127, 127, 0.15));
    overflow: hidden;
  }
  .fill {
    position: absolute;
    inset: 0 auto 0 0;
    height: 100%;
    border-radius: inherit;
    background: var(--accent);
    transition: width var(--transition-base, 220ms ease-out);
  }
  .fill.indeterminate {
    width: 40%;
    animation: slide 1.1s ease-in-out infinite;
  }
  @keyframes slide {
    0% {
      transform: translateX(-110%);
    }
    100% {
      transform: translateX(320%);
    }
  }
</style>
