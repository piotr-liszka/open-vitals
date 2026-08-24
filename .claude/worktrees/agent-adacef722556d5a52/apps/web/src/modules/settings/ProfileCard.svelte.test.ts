/**
 * Spec 090 — the card's four states: empty, set, invalid, saving.
 *
 * The assertions that earn their keep are about COPY and PAYLOAD. An empty field has to say what is
 * happening instead of the value ("we are estimating it from every ride"), or the reader has no
 * reason to fill it in; and the request has to carry numbers, because the endpoint refuses strings.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/svelte';
import { createTranslator } from '$lib/i18n';
import { toasts } from '$lib/ui';
import ProfileCard from './ProfileCard.svelte';
import type { AthleteProfile } from './profile.types';

afterEach(() => {
  cleanup();
  toasts.clear();
  vi.unstubAllGlobals();
});

/** Assert against the catalog, not against a second copy of the copy. */
const t = createTranslator('pl');

const EMPTY: AthleteProfile = { ftpWatts: null, maxHrBpm: null, weightKg: null };

function view(profile: AthleteProfile = EMPTY) {
  const rendered = render(ProfileCard, { props: { profile } });
  const form = rendered.container.querySelector('form');
  if (!form) throw new Error('no form rendered');
  return {
    ...rendered,
    form,
    input: (label: string) => rendered.getByLabelText(label) as HTMLInputElement,
    submit: () => fireEvent.submit(form)
  };
}

/** A `fetch` that answers with `body` at `status`, and records what it was asked. */
function stubFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fn = vi.fn(
    async () =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('ProfileCard', () => {
  it('offers all three numbers as optional fields', () => {
    const v = view();
    for (const label of [t('profile.ftp.label'), t('profile.maxHr.label'), t('profile.weight.label')]) {
      expect(v.input(label).value).toBe('');
    }
  });

  it('says what an empty field changes AND what happens meanwhile', () => {
    const text = view().container.textContent ?? '';
    expect(text).toContain(t('profile.ftp.help'));
    expect(text).toContain(t('profile.ftp.empty'));
    expect(text).toContain(t('profile.maxHr.help'));
    expect(text).toContain(t('profile.maxHr.empty'));
    expect(text).toContain(t('profile.weight.help'));
    expect(text).toContain(t('profile.weight.empty'));
  });

  it('drops the estimate line for a field that is set, and keeps the consequence', () => {
    const text = view({ ftpWatts: 250, maxHrBpm: null, weightKg: null }).container.textContent ?? '';
    expect(text).toContain(t('profile.ftp.help'));
    expect(text).not.toContain(t('profile.ftp.empty'));
    // The other two are still empty, so they still explain themselves.
    expect(text).toContain(t('profile.maxHr.empty'));
  });

  it('renders the stored values', () => {
    const v = view({ ftpWatts: 250, maxHrBpm: 175, weightKg: 72.5 });
    expect(v.input(t('profile.ftp.label')).value).toBe('250');
    expect(v.input(t('profile.maxHr.label')).value).toBe('175');
    expect(v.input(t('profile.weight.label')).value).toBe('72.5');
  });

  it('refuses an out-of-range value under the field, without asking the server', async () => {
    const fetchMock = stubFetch(200, EMPTY);
    const v = view();
    await fireEvent.input(v.input(t('profile.maxHr.label')), { target: { value: '900' } });
    await v.submit();

    expect(v.container.textContent).toContain(t('profile.error.range', { min: '100', max: '230' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses text under the field', async () => {
    const fetchMock = stubFetch(200, EMPTY);
    const v = view();
    await fireEvent.input(v.input(t('profile.ftp.label')), { target: { value: 'dużo' } });
    await v.submit();

    expect(v.container.textContent).toContain(t('profile.error.number'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends numbers, not the typed strings, and confirms the save', async () => {
    const saved: AthleteProfile = { ftpWatts: 250, maxHrBpm: 175, weightKg: 72.5 };
    const fetchMock = stubFetch(200, saved);
    const v = view();
    await fireEvent.input(v.input(t('profile.ftp.label')), { target: { value: '250' } });
    await fireEvent.input(v.input(t('profile.maxHr.label')), { target: { value: '175' } });
    // A decimal comma is what this app's first language types.
    await fireEvent.input(v.input(t('profile.weight.label')), { target: { value: '72,5' } });
    await v.submit();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/settings/profile',
      expect.objectContaining({ method: 'PUT' })
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual(saved);
    await waitFor(() =>
      expect(get(toasts)[0]).toMatchObject({ tone: 'success', message: t('profile.saved') })
    );
  });

  it('sends null for a field the athlete cleared', async () => {
    const fetchMock = stubFetch(200, EMPTY);
    const v = view({ ftpWatts: 250, maxHrBpm: 175, weightKg: 72.5 });
    for (const label of [t('profile.ftp.label'), t('profile.maxHr.label'), t('profile.weight.label')]) {
      await fireEvent.input(v.input(label), { target: { value: '' } });
    }
    await v.submit();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual(EMPTY);
  });

  it('shows the server verdict per field when it refuses something the card let through', async () => {
    stubFetch(400, { error: 'invalid_profile', fields: { weightKg: 'out_of_range' } });
    const v = view();
    // Nothing typed is invalid client-side; the refusal can only come from the server.
    await v.submit();

    await waitFor(() =>
      expect(v.container.textContent).toContain(t('profile.error.range', { min: '30', max: '250' }))
    );
    expect(get(toasts)[0]).toMatchObject({ tone: 'error', message: t('profile.saveFailed') });
  });

  it('says so when the server cannot be reached at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      })
    );
    const v = view();
    await v.submit();

    await waitFor(() =>
      expect(get(toasts)[0]).toMatchObject({ tone: 'error', message: t('profile.networkError') })
    );
  });
});
