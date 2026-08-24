import { describe, it, expect } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { GET } from './+server';
import { createTestContainer } from '$lib/server/container';
import { fixedClock } from '$lib/server/clock';

describe('GET /api/health', () => {
  it('returns ok with the injected clock time', async () => {
    const container = createTestContainer({ clock: fixedClock(new Date('2026-08-02T09:30:00Z')) });
    const event = { locals: { container, authenticated: true } } as unknown as RequestEvent;

    const res = await GET(event);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; service: string; time: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('vagus-web');
    expect(body.time).toBe('2026-08-02T09:30:00.000Z');
  });
});
