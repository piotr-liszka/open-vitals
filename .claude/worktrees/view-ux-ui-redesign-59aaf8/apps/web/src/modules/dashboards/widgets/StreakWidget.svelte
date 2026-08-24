<script lang="ts">
  import type { WidgetData } from '../dashboard-data';
  import { getI18n } from '$lib/i18n';

  const i18n = getI18n();
  let { data }: { data: WidgetData } = $props();
</script>

<div class="streak">
  <span class="flame" aria-hidden="true">🔥</span>
  <div>
    <div class="num">{data.streakWeeks}</div>
    <div class="cap">{i18n.t('widget.streakUnit', { count: data.streakWeeks })}</div>
  </div>
</div>

<style>
  .streak {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    height: 100%;
  }
  .flame {
    font-size: 2.4rem;
    line-height: 1;
    filter: drop-shadow(0 0 8px color-mix(in srgb, var(--lane-orange, #ff5a1f) 60%, transparent));
  }
  .num {
    font-size: var(--readout-lg);
    font-weight: var(--font-bold);
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
    line-height: 1;
  }
  .cap {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    margin-top: var(--space-1);
  }
</style>
