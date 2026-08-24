<script lang="ts">
  /**
   * Sidebar freshness block (spec 027). Answers "how old is what I'm looking at?" from every page,
   * next to the build stamp that people were misreading as the data time.
   *
   * Owns its own data: one `GET /api/sync/status` on mount, then polling — slow while idle, fast
   * while a run is in flight — plus the quick manual sync. Renders nothing when the request is
   * unauthorized, so the login/landing chrome is untouched.
   */
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import IconButton from '$lib/ui/IconButton.svelte';
  import { formatInstant } from '$lib/date';
  import type { SyncStatusResponse } from './sync.types';

  /** Idle poll: slow enough to be free, fast enough that a scheduled sync shows up on its own. */
  const IDLE_POLL_MS = 60_000;
  /** While a run is in flight, follow it closely enough to feel live. */
  const ACTIVE_POLL_MS = 2_000;
  /** Countdown re-render cadence (the label is minute-grained, so this is plenty). */
  const TICK_MS = 15_000;

  let status = $state<SyncStatusResponse | null>(null);
  let available = $state(true); // flipped off by a 401 — the footer then renders nothing
  let busy = $state(false); // a manual sync request is in flight
  let failed = $state(false);
  let now = $state<number>(0);

  const run = $derived(status?.run ?? null);
  const running = $derived(busy || run?.status === 'running');
  const progressPct = $derived(
    run && run.status === 'running' ? Math.round((status?.progress ?? 0) * 100) : null
  );

  const lastLabel = $derived(status?.lastSyncAt ? formatInstant(status.lastSyncAt, 'dateTime') : 'nigdy');

  /**
   * The "checked, nothing new" note. Only shown when the last check happened AFTER the last real
   * sync — otherwise the stamp above already tells the whole story.
   */
  const unchangedAt = $derived.by(() => {
    const { lastCheckAt, lastSyncAt, lastResult } = status ?? {};
    if (lastResult !== 'unchanged' || !lastCheckAt) return null;
    if (lastSyncAt && lastCheckAt <= lastSyncAt) return null;
    return formatInstant(lastCheckAt, 'time');
  });

  /** Minutes until the next automatic tick; null when no scheduler runs in this process. */
  const nextInMin = $derived.by(() => {
    const next = status?.autoSync?.nextRunAt;
    if (!next || now === 0) return null;
    const due = new Date(next).getTime();
    if (!Number.isFinite(due)) return null;
    return Math.max(0, Math.ceil((due - now) / 60_000));
  });

  const autoLabel = $derived.by(() => {
    if (nextInMin === null) return null;
    if (nextInMin <= 1) return 'Auto: w każdej chwili';
    return `Auto za ~${nextInMin} min`;
  });

  async function load(): Promise<void> {
    try {
      const res = await fetch('/api/sync/status', { headers: { accept: 'application/json' } });
      if (res.status === 401) {
        available = false;
        return;
      }
      if (!res.ok) return;
      status = (await res.json()) as SyncStatusResponse;
      failed = status.run?.status === 'failed';
    } catch {
      // A dropped poll is not worth a visible error: the next tick retries.
    }
  }

  async function syncNow(): Promise<void> {
    if (running) return;
    busy = true;
    failed = false;
    try {
      const res = await fetch('/api/sync?kind=incremental', { method: 'POST' });
      if (!res.ok) {
        failed = true;
        return;
      }
      await load();
    } catch {
      failed = true;
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    now = Date.now();
    void load();
  });

  // Poll cadence follows the run state: reading `running` here means the effect re-arms itself the
  // moment a sync starts or finishes, with no watchdog timer of its own.
  $effect(() => {
    if (!available) return;
    const every = running ? ACTIVE_POLL_MS : IDLE_POLL_MS;
    const timer = setInterval(() => {
      // A hidden tab polls nothing and catches up on re-focus below, so a background tab costs zero.
      if (document.hidden) return;
      now = Date.now();
      void load();
    }, every);
    return () => clearInterval(timer);
  });

  // Countdown re-render + catch-up on return. Split from the poll so changing cadence never restarts
  // the clock the "Auto za ~N min" label is read from.
  $effect(() => {
    if (!available) return;
    const ticker = setInterval(() => {
      if (!document.hidden) now = Date.now();
    }, TICK_MS);
    const onVisible = (): void => {
      if (document.hidden) return;
      now = Date.now();
      void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(ticker);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  });

  // A finished run means the page's loader data is stale — refresh it once, quietly.
  let lastSeenRunId = $state<string | null>(null);
  $effect(() => {
    const finished = run && run.status !== 'running' ? run.id : null;
    if (!finished) return;
    if (lastSeenRunId === null) {
      lastSeenRunId = finished; // first observation: nothing changed on screen, don't reload
      return;
    }
    if (lastSeenRunId !== finished) {
      lastSeenRunId = finished;
      void invalidateAll();
    }
  });
</script>

{#if available}
  <div class="sync">
    <span class="label">Ostatnia synchronizacja</span>

    <div class="row">
      <time class="stamp" datetime={status?.lastSyncAt ?? undefined}>{lastLabel}</time>
      <IconButton
        icon="refresh"
        size="sm"
        loading={running}
        onclick={syncNow}
        label={running ? 'Synchronizacja w toku' : 'Synchronizuj teraz'}
      />
    </div>

    {#if running}
      <span class="note running" aria-live="polite">
        Synchronizuję{progressPct !== null ? ` · ${progressPct}%` : ''}
      </span>
    {:else if failed}
      <span class="note bad">Ostatnia próba nie powiodła się — <a href="/data">szczegóły</a></span>
    {:else if autoLabel}
      <span class="note auto">
        <!-- The pulse is the "something is scheduled" signal; it stops for reduced-motion users,
             who still get the same text. -->
        <span class="dot" aria-hidden="true"></span>
        {autoLabel}{unchangedAt ? ` · bez zmian ${unchangedAt}` : ''}
      </span>
    {:else if unchangedAt}
      <span class="note">Sprawdzono {unchangedAt} · bez zmian</span>
    {/if}
  </div>
{/if}

<style>
  .sync {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .label {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-subtle);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    min-width: 0;
  }

  .stamp {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .note {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    font-variant-numeric: tabular-nums;
  }

  .note.running {
    color: var(--color-accent);
  }

  .note.bad {
    color: var(--color-danger);
  }

  .note a {
    color: inherit;
  }

  .dot {
    width: var(--space-2);
    height: var(--space-2);
    flex-shrink: 0;
    border-radius: var(--radius-full);
    background: var(--color-accent);
  }

  @media (prefers-reduced-motion: no-preference) {
    .dot {
      animation: sync-pulse 2.4s var(--ease-out) infinite;
    }
  }

  @keyframes sync-pulse {
    0%,
    100% {
      opacity: 0.35;
      transform: scale(0.85);
    }
    50% {
      opacity: 1;
      transform: scale(1.15);
    }
  }
</style>
