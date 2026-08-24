import { describe, it, expect } from 'vitest';
import { createTestContainer } from '$lib/server/container';
import { setLocale } from './locale.api';

/** A fresh in-memory settings repo per test, so one test's write cannot leak into the next. */
function settings() {
  return createTestContainer().repo.settings;
}

describe('PUT /api/settings/locale', () => {
  it('stores the choice on the account for a signed-in user', async () => {
    const repo = settings();
    const res = await setLocale(repo, 'user-1', { locale: 'en' });

    expect(res).toEqual({ ok: true, body: { locale: 'en', persisted: true } });
    expect(await repo.get('user-1')).toMatchObject({ locale: 'en' });
  });

  it('accepts an anonymous caller without persisting — the login screen needs the switch too', async () => {
    const repo = settings();
    const res = await setLocale(repo, null, { locale: 'en' });

    expect(res).toEqual({ ok: true, body: { locale: 'en', persisted: false } });
  });

  it('merges into the settings bag instead of replacing it', async () => {
    const repo = settings();
    await repo.set('user-1', { somethingElse: 'keep me', locale: 'pl' });

    await setLocale(repo, 'user-1', { locale: 'en' });

    expect(await repo.get('user-1')).toEqual({ somethingElse: 'keep me', locale: 'en' });
  });

  it('switches back to Polish', async () => {
    const repo = settings();
    await setLocale(repo, 'user-1', { locale: 'en' });
    await setLocale(repo, 'user-1', { locale: 'pl' });

    expect(await repo.get('user-1')).toMatchObject({ locale: 'pl' });
  });

  it.each([
    ['an unsupported language', { locale: 'de' }],
    ['an empty body', {}],
    ['null', null],
    ['a non-string locale', { locale: 42 }],
    ['a locale-shaped string that is not one', { locale: 'en-US' }]
  ])('rejects %s with 400 invalid_locale and writes nothing', async (_label, body) => {
    const repo = settings();
    const res = await setLocale(repo, 'user-1', body);

    expect(res).toEqual({ ok: false, status: 400, error: 'invalid_locale' });
    expect(await repo.get('user-1')).toEqual({});
  });
});
