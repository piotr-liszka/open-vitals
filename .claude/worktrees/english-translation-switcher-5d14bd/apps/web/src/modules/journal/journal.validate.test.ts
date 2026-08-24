import { describe, it, expect } from 'vitest';
import { parseJournalEntry } from './journal.validate';

const TODAY = '2026-08-16';

describe('parseJournalEntry', () => {
  it('accepts a day entry and carries only the keys given', () => {
    const result = parseJournalEntry({ date: TODAY, soreness: 6, location: ' lewe kolano ' }, TODAY);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.value.day).toBe(TODAY);
    expect(result.value.activityId).toBeNull();
    expect(result.value.soreness).toBe(6);
    expect(result.value.location).toBe('lewe kolano');
    // Untouched fields are ABSENT, not null — the store's three-valued patch depends on it.
    expect('mood' in result.value).toBe(false);
    expect('rpe' in result.value).toBe(false);
  });

  it('accepts either spelling of the day', () => {
    expect(parseJournalEntry({ day: TODAY, mood: 5 }, TODAY)).toMatchObject({ ok: true });
    expect(parseJournalEntry({ date: TODAY, mood: 5 }, TODAY)).toMatchObject({ ok: true });
  });

  it('rejects a score outside 1–10 rather than clamping it', () => {
    // A clamp would turn a typed 11 into a silent 10, and this is a number volume gets cut on.
    for (const bad of [0, 11, -3, 100]) {
      expect(parseJournalEntry({ date: TODAY, rpe: bad }, TODAY)).toMatchObject({ ok: false });
    }
    expect(parseJournalEntry({ date: TODAY, soreness: 5.5 }, TODAY)).toMatchObject({ ok: false });
    // Both ends are legal.
    expect(parseJournalEntry({ date: TODAY, rpe: 1 }, TODAY)).toMatchObject({ ok: true });
    expect(parseJournalEntry({ date: TODAY, rpe: 10 }, TODAY)).toMatchObject({ ok: true });
  });

  it('treats an explicit null as a clear', () => {
    const result = parseJournalEntry({ date: TODAY, soreness: null }, TODAY);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.value.soreness).toBeNull();
  });

  it('refuses a future day', () => {
    // A journal records what happened. A scored tomorrow is a typo or a plan, never a report.
    expect(parseJournalEntry({ date: '2026-08-17', mood: 5 }, TODAY)).toMatchObject({ ok: false });
    // Back-filling is fine — athletes log the week on Sunday.
    expect(parseJournalEntry({ date: '2026-08-10', mood: 5 }, TODAY)).toMatchObject({ ok: true });
  });

  it('refuses an entry with a day and nothing else', () => {
    // An empty row would read as "logged" on every screen that counts logged days.
    expect(parseJournalEntry({ date: TODAY }, TODAY)).toMatchObject({ ok: false });
  });

  it('carries an activity id through, trimmed', () => {
    const result = parseJournalEntry({ date: TODAY, rpe: 9, activityId: ' act-1 ' }, TODAY);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.value.activityId).toBe('act-1');
  });

  it('rejects malformed input', () => {
    expect(parseJournalEntry(null, TODAY)).toMatchObject({ ok: false });
    expect(parseJournalEntry([], TODAY)).toMatchObject({ ok: false });
    expect(parseJournalEntry({ date: '16.08.2026', mood: 5 }, TODAY)).toMatchObject({ ok: false });
    expect(parseJournalEntry({ date: TODAY, illness: 'tak' }, TODAY)).toMatchObject({ ok: false });
    expect(parseJournalEntry({ date: TODAY, note: 'x'.repeat(1001) }, TODAY)).toMatchObject({ ok: false });
  });
});
