/**
 * API-integration tests for the dashboard config endpoint (spec 064). `POST /api/dashboards` is the
 * ONLY write in this slice — every mutation is "save this document" — so the whole surface is what a
 * hostile body can do to a stored layout, and what a round-trip preserves.
 */
import { createTranslator } from '$lib/i18n';
import { describe, it, expect } from 'vitest';
import { createMemorySettingsRepo } from '$lib/server/repo/memory';
import { getConfig, saveConfig, firstDashboardId, findDashboard, navEntries } from './dashboards.api';
import type { DashboardConfig } from './dashboards.types';

const t = createTranslator('pl');

const USER = 'u1';
const OTHER = 'u2';

const cfg = (...names: string[]): DashboardConfig => ({
  dashboards: names.map((n, i) => ({
    id: n,
    name: `Panel ${i}`,
    widgets: [{ id: `w${i}`, type: 'streak', span: 4 }]
  }))
});

describe('POST /api/dashboards contract', () => {
  it('returns the sanitized document, not the one it was handed', async () => {
    const settings = createMemorySettingsRepo();
    const saved = await saveConfig(t, settings, USER, {
      dashboards: [{ id: 'A B', name: '  Spacje  ', widgets: [{ id: 'w', type: 'nope', span: 3 }] }]
    });

    expect(saved.dashboards[0]!.id).toBe('a-b');
    expect(saved.dashboards[0]!.name).toBe('Spacje');
    expect(saved.dashboards[0]!.widgets).toEqual([]);
  });

  it('round-trips a reordered widget list unchanged', async () => {
    const settings = createMemorySettingsRepo();
    const ordered: DashboardConfig = {
      dashboards: [
        {
          id: 'main',
          name: 'Main',
          widgets: [
            { id: 'c', type: 'coverage', span: 8 },
            { id: 'a', type: 'streak', span: 4 },
            { id: 'b', type: 'weekly-volume', span: 12 }
          ]
        }
      ]
    };

    await saveConfig(t, settings, USER, ordered);
    const read = await getConfig(t, settings, USER);
    expect(read.dashboards[0]!.widgets.map((w) => w.id)).toEqual(['c', 'a', 'b']);
    expect(read.dashboards[0]!.widgets.map((w) => w.span)).toEqual([8, 4, 12]);
  });

  it('truncates an over-long name instead of rejecting the whole save', async () => {
    const settings = createMemorySettingsRepo();
    const saved = await saveConfig(t, settings, USER, {
      dashboards: [{ id: 'x', name: 'ą'.repeat(500), widgets: [] }]
    });
    expect(saved.dashboards[0]!.name.length).toBe(60);
  });

  /** AGENTS.md golden rule #2 — one user can never read or overwrite another's layout. */
  it('keeps one user out of another user config', async () => {
    const settings = createMemorySettingsRepo();
    await saveConfig(t, settings, USER, cfg('mine'));
    await saveConfig(t, settings, OTHER, cfg('theirs'));

    expect((await getConfig(t, settings, USER)).dashboards.map((d) => d.id)).toEqual(['mine']);
    expect((await getConfig(t, settings, OTHER)).dashboards.map((d) => d.id)).toEqual(['theirs']);
  });

  it('leaves the rest of the settings bag alone', async () => {
    const settings = createMemorySettingsRepo();
    await settings.set(USER, { ftpWatts: 260 });
    await saveConfig(t, settings, USER, cfg('main'));

    expect((await settings.get(USER)).ftpWatts).toBe(260);
  });
});

describe('route resolution helpers (spec 064)', () => {
  it('resolves /dashboard to the first dashboard', () => {
    expect(firstDashboardId(cfg('alpha', 'beta'))).toBe('alpha');
  });

  it('finds a dashboard by its route segment, and returns null for an unknown one', () => {
    const config = cfg('alpha', 'beta');
    expect(findDashboard(config, 'beta')?.id).toBe('beta');
    // The route turns this null into a 404 rather than silently showing a different panel.
    expect(findDashboard(config, 'gamma')).toBeNull();
  });

  it('hands the sidebar ids and names only — never the widgets', () => {
    const entries = navEntries(cfg('alpha'));
    expect(entries).toEqual([{ id: 'alpha', name: 'Panel 0' }]);
    expect(entries[0]).not.toHaveProperty('widgets');
  });
});
