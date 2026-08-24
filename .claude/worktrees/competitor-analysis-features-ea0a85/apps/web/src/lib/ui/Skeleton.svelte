<script lang="ts">
  type Radius = 'sm' | 'md' | 'lg' | 'full';

  interface Props {
    /** CSS length for the block width. Pass a token, e.g. `var(--space-16)`. */
    width?: string;
    /** CSS length for the block height. */
    height?: string;
    /** Corner rounding, mapped to a radius token. */
    radius?: Radius;
    /** Square block sized to `height`, fully rounded — for avatars/dots. */
    circle?: boolean;
  }

  let { width = '100%', height = 'var(--space-4)', radius = 'sm', circle = false }: Props = $props();

  const dimension = $derived(circle ? height : width);
</script>

<span
  class="skeleton"
  class:circle
  data-radius={radius}
  aria-hidden="true"
  style="--sk-w: {dimension}; --sk-h: {height};"
></span>

<style>
  .skeleton {
    display: block;
    width: var(--sk-w);
    height: var(--sk-h);
    background: var(--color-skeleton);
    border-radius: var(--radius-sm);
    position: relative;
    overflow: hidden;
  }

  .skeleton[data-radius='md'] {
    border-radius: var(--radius-md);
  }
  .skeleton[data-radius='lg'] {
    border-radius: var(--radius-lg);
  }
  .skeleton[data-radius='full'] {
    border-radius: var(--radius-full);
  }

  .skeleton.circle {
    border-radius: var(--radius-full);
    flex-shrink: 0;
  }

  /* Sheen sweep — a functional highlight moving across the block. */
  .skeleton::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, var(--color-skeleton-sheen) 50%, transparent 100%);
    transform: translateX(-100%);
    animation: shimmer var(--duration-shimmer) var(--ease-in-out) infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton::after {
      animation: none;
    }
  }

  @keyframes shimmer {
    to {
      transform: translateX(100%);
    }
  }
</style>
