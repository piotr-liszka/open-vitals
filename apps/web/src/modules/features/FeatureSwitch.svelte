<script lang="ts">
  /**
   * One row of an integration card: title, one-line summary, and the switch itself (spec 071).
   *
   * The switch flips OPTIMISTICALLY and rolls back on failure. That is a deliberate reversal of the
   * consent-era flow this replaces, where every flip opened a terms panel and waited for a round
   * trip: there is nothing to read and nothing to agree to any more, so the only honest latency is
   * none. A failed write reverts the visible position and says so, rather than leaving the UI
   * claiming a state the server never accepted.
   */
  import { Toggle, toasts } from '$lib/ui';
  import { getI18n } from '$lib/i18n';
  import type { FeatureView } from './features.types';

  const i18n = getI18n();

  interface Props {
    feature: FeatureView;
    /** Called with the server's resolved switch after a successful write. */
    onUpdated?: (feature: FeatureView) => void;
  }

  let { feature, onUpdated }: Props = $props();

  let busy = $state(false);
  /** Set while a write is in flight or after it failed; otherwise the prop is the truth. */
  let optimistic = $state<boolean | null>(null);
  const checked = $derived(optimistic ?? feature.enabled);

  const switchId = $derived(`feature-${feature.id}`);

  async function onchange(next: boolean): Promise<void> {
    optimistic = next;
    busy = true;
    try {
      const res = await fetch('/api/features', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ featureId: feature.id, enabled: next })
      });
      const body = (await res.json().catch(() => null)) as
        { feature: FeatureView } | { error: string } | null;
      if (!res.ok || !body || !('feature' in body)) {
        optimistic = null;
        toasts.error((body && 'error' in body && body.error) || i18n.t('features.saveFailed'));
        return;
      }
      optimistic = null;
      onUpdated?.(body.feature);
    } catch {
      optimistic = null;
      toasts.error(i18n.t('features.networkError'));
    } finally {
      busy = false;
    }
  }
</script>

<div class="row">
  <div class="copy">
    <label class="title" for={switchId}>{i18n.t(feature.titleKey)}</label>
    <p class="summary">{i18n.t(feature.summaryKey)}</p>
  </div>
  <Toggle id={switchId} {checked} loading={busy} onchange={(next) => void onchange(next)} />
</div>

<style>
  .row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
  }
  .copy {
    min-width: 0;
  }
  .title {
    display: block;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text);
    cursor: pointer;
  }
  .summary {
    margin: var(--space-1) 0 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
  }
</style>
