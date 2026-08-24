import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { toasts } from './toast';

beforeEach(() => {
  toasts.clear();
});

afterEach(() => {
  vi.useRealTimers();
  toasts.clear();
});

describe('toast store', () => {
  it('pushes a toast with the right tone and message', () => {
    toasts.success('Saved');
    const list = get(toasts);
    expect(list).toHaveLength(1);
    expect(list[0]?.tone).toBe('success');
    expect(list[0]?.message).toBe('Saved');
  });

  it('supports error and info helpers', () => {
    toasts.error('Boom');
    toasts.info('FYI');
    const tones = get(toasts).map((t) => t.tone);
    expect(tones).toEqual(['error', 'info']);
  });

  it('returns an id that can be dismissed', () => {
    const id = toasts.info('Temp');
    expect(get(toasts)).toHaveLength(1);
    toasts.dismiss(id);
    expect(get(toasts)).toHaveLength(0);
  });

  it('auto-dismisses after the given duration', () => {
    vi.useFakeTimers();
    toasts.success('Gone soon', { duration: 1000 });
    expect(get(toasts)).toHaveLength(1);

    vi.advanceTimersByTime(999);
    expect(get(toasts)).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(get(toasts)).toHaveLength(0);
  });

  it('does not auto-dismiss when duration is 0', () => {
    vi.useFakeTimers();
    toasts.info('Sticky', { duration: 0 });
    vi.advanceTimersByTime(100_000);
    expect(get(toasts)).toHaveLength(1);
  });

  it('clear() removes everything', () => {
    toasts.success('a');
    toasts.error('b');
    toasts.clear();
    expect(get(toasts)).toHaveLength(0);
  });
});
