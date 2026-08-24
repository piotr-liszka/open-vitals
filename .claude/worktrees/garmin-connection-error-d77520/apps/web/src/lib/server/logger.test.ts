/**
 * Logger redaction tests (spec 055). AGENTS.md §10 promises that no token, password, cookie or
 * e-mail reaches a log line; before spec 055 that promise only held for TOP-LEVEL keys, so the
 * common shape — a nested provider/error payload — was written out verbatim.
 */
import { describe, expect, it } from 'vitest';
import { createLogger } from './logger';

/** Capture emitted lines as parsed objects. */
function capture(): { lines: Record<string, unknown>[]; sink: Pick<Console, 'log' | 'error'> } {
  const lines: Record<string, unknown>[] = [];
  const push = (s: unknown): void => void lines.push(JSON.parse(String(s)));
  return { lines, sink: { log: push, error: push } as Pick<Console, 'log' | 'error'> };
}

describe('createLogger redaction', () => {
  it('masks sensitive top-level keys', () => {
    const { lines, sink } = capture();
    createLogger('info', sink).info('login', { password: 'hunter2', userId: 'u1' });
    expect(lines[0]).toMatchObject({ password: '[redacted]', userId: 'u1' });
  });

  it('masks sensitive keys nested inside objects', () => {
    const { lines, sink } = capture();
    createLogger('info', sink).error('exchange failed', {
      provider: 'strava',
      response: { status: 401, access_token: 'super-secret', refresh_token: 'also-secret' }
    });

    const response = lines[0]!.response as Record<string, unknown>;
    expect(response.access_token).toBe('[redacted]');
    expect(response.refresh_token).toBe('[redacted]');
    expect(response.status).toBe(401);
    // And the whole line really does not contain the secret anywhere.
    expect(JSON.stringify(lines[0])).not.toContain('super-secret');
  });

  it('masks sensitive keys nested inside arrays', () => {
    const { lines, sink } = capture();
    createLogger('info', sink).warn('batch', { users: [{ email: 'a@b.c' }, { email: 'd@e.f' }] });

    expect(JSON.stringify(lines[0])).not.toContain('a@b.c');
    expect(lines[0]!.users).toEqual([{ email: '[redacted]' }, { email: '[redacted]' }]);
  });

  it('keeps an Error readable without walking its internals', () => {
    const { lines, sink } = capture();
    createLogger('info', sink).error('boom', { err: new TypeError('bad input') });
    expect(lines[0]!.err).toEqual({ name: 'TypeError', message: 'bad input' });
  });

  it('survives a circular structure instead of throwing', () => {
    const { lines, sink } = capture();
    const cyclic: Record<string, unknown> = { name: 'root' };
    cyclic.self = cyclic;

    expect(() => createLogger('info', sink).info('cycle', { cyclic })).not.toThrow();
    expect(JSON.stringify(lines[0])).toContain('[circular]');
  });

  it('truncates rather than recursing without bound', () => {
    const { lines, sink } = capture();
    let deep: Record<string, unknown> = { token: 'leaf-secret' };
    for (let i = 0; i < 20; i++) deep = { nested: deep };

    createLogger('info', sink).info('deep', deep);
    const serialized = JSON.stringify(lines[0]);
    expect(serialized).toContain('[truncated]');
    expect(serialized).not.toContain('leaf-secret');
  });

  it('respects the minimum level', () => {
    const { lines, sink } = capture();
    createLogger('warn', sink).debug('noise');
    expect(lines).toHaveLength(0);
  });
});
