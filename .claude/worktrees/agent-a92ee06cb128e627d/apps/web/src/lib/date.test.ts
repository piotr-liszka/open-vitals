import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TIME_ZONE,
  InvalidDayKeyError,
  InvalidMonthKeyError,
  addDays,
  addMonths,
  compareDays,
  dayKeyOf,
  dayOfWeek,
  dayOfYear,
  dayRange,
  daysAgoKey,
  daysBetween,
  daysInYear,
  endOfMonth,
  firstDayOf,
  formatDay,
  formatInstant,
  formatMonth,
  isDayKey,
  isMonthKey,
  lastDays,
  lastMonths,
  maxDay,
  minDay,
  monthKeyOf,
  monthRange,
  monthsBetween,
  parseDayKey,
  startOfMonth,
  startOfWeek,
  toDayKey,
  todayKey,
  yearOf
} from './date';

/** Local stand-in for `Clock` (importing $lib/server here would break client bundling). */
const at = (iso: string) => ({ now: () => new Date(iso) });

describe('day key validation', () => {
  it('accepts real calendar days', () => {
    expect(isDayKey('2026-08-03')).toBe(true);
    expect(isDayKey('2024-02-29')).toBe(true); // leap year
  });

  it('rejects malformed or impossible days', () => {
    expect(isDayKey('2026-8-3')).toBe(false);
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('2025-02-29')).toBe(false); // not a leap year
    expect(isDayKey('2026-13-01')).toBe(false);
    expect(isDayKey('2026-08-03T10:00:00Z')).toBe(false);
    expect(isDayKey(20260803)).toBe(false);
    expect(isDayKey(null)).toBe(false);
  });

  it('parses parts and throws on garbage', () => {
    expect(parseDayKey('2026-08-03')).toEqual({ year: 2026, month: 8, day: 3 });
    expect(() => parseDayKey('nope')).toThrow(InvalidDayKeyError);
  });

  it('takes the day out of ISO instants and Garmin local wall-clock strings', () => {
    expect(toDayKey('2026-08-03T22:10:00Z')).toBe('2026-08-03');
    expect(toDayKey('2026-08-03 06:12:44')).toBe('2026-08-03');
    expect(toDayKey('2026-08-03')).toBe('2026-08-03');
    expect(() => toDayKey('03.08.2026')).toThrow(InvalidDayKeyError);
  });
});

describe('day arithmetic', () => {
  it('adds and subtracts days across month and year boundaries', () => {
    expect(addDays('2026-08-03', 1)).toBe('2026-08-04');
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
    expect(addDays('2026-08-03', 0)).toBe('2026-08-03');
  });

  it('round-trips over a long span', () => {
    expect(addDays(addDays('2026-08-03', 4000), -4000)).toBe('2026-08-03');
  });

  it('measures distance between days', () => {
    expect(daysBetween('2026-08-03', '2026-08-10')).toBe(7);
    expect(daysBetween('2026-08-10', '2026-08-03')).toBe(-7);
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
    expect(daysBetween('2026-08-03', '2026-08-03')).toBe(0);
  });

  it('orders days', () => {
    expect(compareDays('2026-08-03', '2026-08-04')).toBe(-1);
    expect(compareDays('2026-08-04', '2026-08-03')).toBe(1);
    expect(compareDays('2026-08-03', '2026-08-03')).toBe(0);
    expect(minDay('2026-08-04', '2026-08-03')).toBe('2026-08-03');
    expect(maxDay('2026-08-04', '2026-08-03')).toBe('2026-08-04');
  });

  it('knows ISO weekdays and week starts', () => {
    expect(dayOfWeek('2026-08-03')).toBe(0); // Monday
    expect(dayOfWeek('2026-08-09')).toBe(6); // Sunday
    expect(startOfWeek('2026-08-03')).toBe('2026-08-03');
    expect(startOfWeek('2026-08-09')).toBe('2026-08-03');
    expect(startOfWeek('2026-08-10')).toBe('2026-08-10');
  });

  it('builds inclusive ranges', () => {
    expect(dayRange('2026-08-03', '2026-08-05')).toEqual(['2026-08-03', '2026-08-04', '2026-08-05']);
    expect(dayRange('2026-08-03', '2026-08-03')).toEqual(['2026-08-03']);
    expect(dayRange('2026-08-05', '2026-08-03')).toEqual([]);
    expect(lastDays('2026-08-03', 3)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
    expect(lastDays('2026-08-03', 0)).toEqual([]);
  });
});

describe('instant → day key (timezone-explicit)', () => {
  it('resolves "today" in the app timezone, not UTC', () => {
    // 00:30 Warsaw on 4 Aug is still 22:30 UTC on 3 Aug — the old UTC convention said "yesterday".
    expect(todayKey(at('2026-08-03T22:30:00Z'), DEFAULT_TIME_ZONE)).toBe('2026-08-04');
    expect(dayKeyOf(new Date('2026-08-03T22:30:00Z'), 'UTC')).toBe('2026-08-03');
  });

  it('handles the winter offset (UTC+1) too', () => {
    expect(todayKey(at('2026-01-14T23:30:00Z'), DEFAULT_TIME_ZONE)).toBe('2026-01-15');
    expect(todayKey(at('2026-01-14T22:30:00Z'), DEFAULT_TIME_ZONE)).toBe('2026-01-14');
  });

  it('defaults to the app timezone', () => {
    expect(todayKey(at('2026-08-03T22:30:00Z'))).toBe('2026-08-04');
  });

  it('walks back N days from today', () => {
    const clock = at('2026-08-03T09:00:00Z');
    expect(daysAgoKey(clock, 0)).toBe('2026-08-03');
    expect(daysAgoKey(clock, 6)).toBe('2026-07-28');
  });

  it('is deterministic for a fixed clock + zone regardless of the host zone', () => {
    const clock = at('2026-08-03T12:00:00Z');
    expect(todayKey(clock, 'Pacific/Kiritimati')).toBe('2026-08-04');
    expect(todayKey(clock, 'Pacific/Midway')).toBe('2026-08-03');
  });
});

describe('formatting', () => {
  it('renders Polish calendar days', () => {
    expect(formatDay('pl', '2026-08-03', 'short')).toBe('3 sie');
    expect(formatDay('pl', '2026-08-03', 'shortYear')).toBe('3 sie 2026');
    expect(formatDay('pl', '2026-08-03', 'long')).toBe('3 sierpnia');
    expect(formatDay('pl', '2026-08-03', 'longYear')).toBe('3 sierpnia 2026');
    expect(formatDay('pl', '2026-08-03', 'numeric')).toBe('3.08.2026');
    expect(formatDay('pl', '2026-08-03', 'iso')).toBe('2026-08-03');
    expect(formatDay('pl', '2026-08-03')).toBe('3 sie');
  });

  it('matches the month abbreviations the hand-rolled formatters used', () => {
    const months = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
    months.forEach((abbr, i) => {
      expect(formatDay('pl', `2026-${String(i + 1).padStart(2, '0')}-15`, 'short')).toBe(`15 ${abbr}`);
    });
  });

  it('never drifts a day when formatting (first/last of month)', () => {
    expect(formatDay('pl', '2026-01-01', 'short')).toBe('1 sty');
    expect(formatDay('pl', '2026-12-31', 'short')).toBe('31 gru');
  });

  it('rejects non-day-keys', () => {
    expect(() => formatDay('pl', '2026-08-03T10:00:00Z')).toThrow(InvalidDayKeyError);
  });

  it('renders instants in an explicit timezone', () => {
    const iso = '2026-08-03T14:05:09Z'; // 16:05:09 in Warsaw (UTC+2)
    expect(formatInstant('pl', iso, 'time')).toBe('16:05');
    expect(formatInstant('pl', iso, 'timeSeconds')).toBe('16:05:09');
    expect(formatInstant('pl', iso, 'date')).toBe('3 sie 2026');
    expect(formatInstant('pl', iso, 'numeric')).toBe('3.08.2026');
    expect(formatInstant('pl', iso, 'dateTime')).toBe('3 sie 2026, 16:05');
    expect(formatInstant('pl', iso, 'time', 'UTC')).toBe('14:05');
  });

  it('formats a Date the same as its ISO string', () => {
    const iso = '2026-08-03T14:05:09Z';
    expect(formatInstant('pl', new Date(iso), 'dateTime')).toBe(formatInstant('pl', iso, 'dateTime'));
  });

  it('degrades to an empty string for unparseable instants', () => {
    expect(formatInstant('pl', 'not-a-date', 'time')).toBe('');
    expect(formatInstant('pl', new Date(NaN))).toBe('');
  });

  it('crosses midnight correctly when the zone shifts the day', () => {
    expect(formatInstant('pl', '2026-08-03T22:30:00Z', 'date')).toBe('4 sie 2026');
    expect(formatInstant('pl', '2026-08-03T22:30:00Z', 'date', 'UTC')).toBe('3 sie 2026');
  });
});

describe('calendar months (spec 037)', () => {
  it('validates month keys and rejects a month number that cannot exist', () => {
    expect(isMonthKey('2026-08')).toBe(true);
    expect(isMonthKey('2026-01')).toBe(true);
    expect(isMonthKey('2026-12')).toBe(true);
    expect(isMonthKey('2026-00')).toBe(false);
    expect(isMonthKey('2026-13')).toBe(false);
    expect(isMonthKey('2026-8')).toBe(false);
    expect(isMonthKey('2026-08-01')).toBe(false);
    expect(isMonthKey(202608)).toBe(false);
  });

  it('throws a typed error rather than guessing at a bad month key', () => {
    expect(() => addMonths('2026-13', 1)).toThrow(InvalidMonthKeyError);
    expect(() => formatMonth('pl', 'nope')).toThrow(InvalidMonthKeyError);
  });

  it('reads the month a day belongs to', () => {
    expect(monthKeyOf('2026-08-31')).toBe('2026-08');
    expect(monthKeyOf('2026-01-01')).toBe('2026-01');
  });

  it('finds the first and last day of a month, leap years included', () => {
    expect(startOfMonth('2026-08-17')).toBe('2026-08-01');
    expect(endOfMonth('2026-08-17')).toBe('2026-08-31');
    expect(endOfMonth('2026-04-02')).toBe('2026-04-30');
    // 2024 is a leap year, 2026 is not.
    expect(endOfMonth('2024-02-10')).toBe('2024-02-29');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(firstDayOf('2026-12')).toBe('2026-12-01');
  });

  it('shifts months across a year boundary in both directions', () => {
    expect(addMonths('2026-08', 1)).toBe('2026-09');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-08', -20)).toBe('2024-12');
    expect(addMonths('2026-08', 0)).toBe('2026-08');
  });

  it('counts whole months between two keys, signed', () => {
    expect(monthsBetween('2026-01', '2026-08')).toBe(7);
    expect(monthsBetween('2025-11', '2026-02')).toBe(3);
    expect(monthsBetween('2026-08', '2026-01')).toBe(-7);
    expect(monthsBetween('2026-08', '2026-08')).toBe(0);
  });

  it('builds an inclusive month range and refuses a reversed one', () => {
    expect(monthRange('2026-06', '2026-09')).toEqual(['2026-06', '2026-07', '2026-08', '2026-09']);
    expect(monthRange('2026-06', '2026-06')).toEqual(['2026-06']);
    expect(monthRange('2026-09', '2026-06')).toEqual([]);
  });

  it('lists the last N months oldest first, ending at the given one', () => {
    expect(lastMonths('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(lastMonths('2026-02', 1)).toEqual(['2026-02']);
    expect(lastMonths('2026-02', 0)).toEqual([]);
    expect(lastMonths('2026-02', -3)).toEqual([]);
  });

  it('renders months in Polish, identically on server and client (UTC-pinned)', () => {
    expect(formatMonth('pl', '2026-08')).toBe('sie');
    expect(formatMonth('pl', '2026-08', 'long')).toBe('sierpień');
    expect(formatMonth('pl', '2026-08', 'shortYear')).toBe('sie 2026');
    expect(formatMonth('pl', '2026-01', 'longYear')).toBe('styczeń 2026');
  });
});

describe('calendar years (spec 037)', () => {
  it('reads the year of a day', () => {
    expect(yearOf('2026-08-11')).toBe(2026);
  });

  it('numbers the day of the year from 1', () => {
    expect(dayOfYear('2026-01-01')).toBe(1);
    expect(dayOfYear('2026-12-31')).toBe(365);
  });

  it('shifts day-of-year past February in a leap year', () => {
    expect(dayOfYear('2024-03-01')).toBe(61); // 2024: 31 + 29 + 1
    expect(dayOfYear('2026-03-01')).toBe(60); // 2026: 31 + 28 + 1
    expect(dayOfYear('2024-12-31')).toBe(366);
  });

  it('counts the days in a year', () => {
    expect(daysInYear(2026)).toBe(365);
    expect(daysInYear(2024)).toBe(366);
    expect(daysInYear(2000)).toBe(366); // divisible by 400
    expect(daysInYear(1900)).toBe(365); // divisible by 100 but not 400
  });
});
