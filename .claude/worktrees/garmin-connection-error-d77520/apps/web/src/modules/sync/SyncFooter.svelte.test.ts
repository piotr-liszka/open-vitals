import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/svelte';
import SyncFooter from './SyncFooter.svelte';
import type { SyncStatusResponse } from './sync.types';
import type { SyncRun } from '$lib/server/store/types';

// The component navigates on a finished run; the loader is irrelevant to what we assert here.
vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));

const NOW = new Date('2026-08-11T12:53:00.000Z');

function run(status: SyncRun['status'], done = 5, total = 10): SyncRun {
  return {
    id: 'run-1',
    userId: 'u1',
    kind: 'incremental',
    status,
    startedAt: NOW.toISOString(),
    finishedAt: status === 'running' ? null : NOW.toISOString(),
    total,
    done,
    step: null,
    error: null,
    detail: null
  };
}

function status(over: Partial<SyncStatusResponse> = {}): SyncStatusResponse {
  return {
    run: null,
    progress: 0,
    lastSyncAt: null,
    lastCheckAt: null,
    lastResult: null,
    autoSync: null,
    ...over
  };
}

/** Stub `/api/sync/status` (and the POST) with a scripted response. */
function stubFetch(body: SyncStatusResponse | null, init: { status?: number } = {}): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: (init.status ?? 200) < 400,
      status: init.status ?? 200,
      json: async () => body
    }))
  );
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('SyncFooter', () => {
  it('says "nigdy" until the account has ever synced', async () => {
    stubFetch(status());
    const { container } = render(SyncFooter);
    await waitFor(() => expect(container.querySelector('.stamp')?.textContent).toBe('nigdy'));
    expect(container.querySelector('.label')?.textContent).toContain('Ostatnia synchronizacja');
  });

  it('shows the last sync stamp and a usable quick-sync button', async () => {
    stubFetch(status({ lastSyncAt: '2026-08-11T10:20:00.000Z' }));
    const { container } = render(SyncFooter);
    await waitFor(() => {
      expect(container.querySelector('.stamp')?.getAttribute('datetime')).toBe('2026-08-11T10:20:00.000Z');
    });
    const button = container.querySelector<HTMLButtonElement>('.icon-btn');
    expect(button?.disabled).toBe(false);
    expect(button?.getAttribute('aria-label')).toBe('Synchronizuj teraz');
  });

  it('disables the button and reports progress while a run is in flight', async () => {
    stubFetch(status({ run: run('running'), progress: 0.4, lastSyncAt: '2026-08-11T10:20:00.000Z' }));
    const { container } = render(SyncFooter);
    await waitFor(() => {
      expect(container.querySelector<HTMLButtonElement>('.icon-btn')?.disabled).toBe(true);
    });
    expect(container.querySelector('.note.running')?.textContent).toContain('40%');
  });

  it('counts down to the next automatic sync with a live indicator', async () => {
    stubFetch(
      status({
        lastSyncAt: '2026-08-11T12:50:00.000Z',
        autoSync: { intervalMs: 30 * 60_000, nextRunAt: '2026-08-11T13:20:00.000Z' }
      })
    );
    const { container } = render(SyncFooter);
    await waitFor(() => expect(container.querySelector('.note.auto')).not.toBeNull());
    expect(container.querySelector('.note.auto')?.textContent).toContain('Auto za ~27 min');
    expect(container.querySelector('.dot')).not.toBeNull();
  });

  it('says a fast-returned check found nothing new', async () => {
    stubFetch(
      status({
        lastSyncAt: '2026-08-11T10:20:00.000Z',
        lastCheckAt: '2026-08-11T12:50:00.000Z',
        lastResult: 'unchanged'
      })
    );
    const { container } = render(SyncFooter);
    await waitFor(() => expect(container.querySelector('.note')?.textContent).toContain('bez zmian'));
  });

  it('renders nothing at all when the status read is unauthorized', async () => {
    stubFetch(null, { status: 401 });
    const { container } = render(SyncFooter);
    await waitFor(() => expect(container.querySelector('.sync')).toBeNull());
  });

  it('flags a failed run and points at the diagnostics page', async () => {
    stubFetch(status({ run: run('failed'), lastSyncAt: '2026-08-11T10:20:00.000Z' }));
    const { container } = render(SyncFooter);
    await waitFor(() => expect(container.querySelector('.note.bad')).not.toBeNull());
    expect(container.querySelector('.note.bad a')?.getAttribute('href')).toBe('/data');
  });
});
