import { describe, it, expect } from 'vitest';
import {
  createMemoryUserRepo,
  createMemorySessionRepo,
  createMemoryMcpTokenRepo,
  createMemorySettingsRepo
} from './memory';
import { sequenceRandom } from '../random';

describe('in-memory UserRepo', () => {
  it('provisions on first sign-in and looks up by sub and id', async () => {
    const users = createMemoryUserRepo({ random: sequenceRandom('u') });
    const created = await users.upsertFromIdentity({
      googleSub: 'g-123',
      email: 'ada@example.com',
      name: 'Ada',
      avatarUrl: 'https://img/a.png'
    });
    expect(created.id).toBe('u-1');
    expect(created.googleSub).toBe('g-123');

    expect(await users.findByGoogleSub('g-123')).toMatchObject({ id: 'u-1', email: 'ada@example.com' });
    expect(await users.findById('u-1')).toMatchObject({ googleSub: 'g-123' });
    expect(await users.findByGoogleSub('missing')).toBeNull();
  });

  it('refreshes profile on repeat sign-in without creating a duplicate', async () => {
    const users = createMemoryUserRepo({ random: sequenceRandom('u') });
    const first = await users.upsertFromIdentity({
      googleSub: 'g-1',
      email: 'old@x.co',
      name: 'Old',
      avatarUrl: null
    });
    const second = await users.upsertFromIdentity({
      googleSub: 'g-1',
      email: 'new@x.co',
      name: 'New',
      avatarUrl: null
    });
    expect(second.id).toBe(first.id); // no duplicate
    expect(second.email).toBe('new@x.co');
    expect(second.name).toBe('New');
  });
});

describe('in-memory SessionRepo', () => {
  it('creates, finds, and deletes rows', async () => {
    const sessions = createMemorySessionRepo({ random: sequenceRandom('s') });
    const expiresAt = new Date('2026-09-01T00:00:00Z');
    const id = await sessions.create({ userId: 'u-1', expiresAt });
    expect(id).toBe('s-1');

    const row = await sessions.find(id);
    expect(row).toEqual({ userId: 'u-1', expiresAt });

    await sessions.delete(id);
    expect(await sessions.find(id)).toBeNull();
    // Idempotent delete.
    await sessions.delete(id);
  });
});

describe('in-memory McpTokenRepo', () => {
  it('get-or-create is stable and resolves the token back to the user', async () => {
    const repo = createMemoryMcpTokenRepo({ random: sequenceRandom('t') });
    const token = await repo.getOrCreate('u-1');
    expect(token).toBe('t-1');
    expect(await repo.getOrCreate('u-1')).toBe('t-1'); // idempotent
    expect(await repo.resolve('t-1')).toBe('u-1');
    expect(await repo.resolve('unknown')).toBeNull();
  });

  it('isolates tokens per user', async () => {
    const repo = createMemoryMcpTokenRepo({ random: sequenceRandom('t') });
    const a = await repo.getOrCreate('alice');
    const b = await repo.getOrCreate('bob');
    expect(a).not.toBe(b);
    expect(await repo.resolve(a)).toBe('alice');
    expect(await repo.resolve(b)).toBe('bob');
  });

  it('rotate issues a new token and invalidates the old one', async () => {
    const repo = createMemoryMcpTokenRepo({ random: sequenceRandom('t') });
    const first = await repo.getOrCreate('u-1');
    const second = await repo.rotate('u-1');
    expect(second).not.toBe(first);
    expect(await repo.resolve(first)).toBeNull(); // old token no longer resolves
    expect(await repo.resolve(second)).toBe('u-1');
  });
});

describe('in-memory SettingsRepo', () => {
  it('defaults to an empty bag and round-trips per user', async () => {
    const repo = createMemorySettingsRepo();
    expect(await repo.get('u-1')).toEqual({});
    await repo.set('u-1', { theme: 'dark' });
    expect(await repo.get('u-1')).toEqual({ theme: 'dark' });
    expect(await repo.get('u-2')).toEqual({}); // isolated
  });
});
