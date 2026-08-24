import { describe, it, expect } from 'vitest';
import { formatMetricText, formatMetricValue } from './dashboard.format';

describe('formatMetricValue', () => {
  it('formats integers with the Polish locale', () => {
    expect(formatMetricValue(9000, 'int')).toBe('9000');
    expect(formatMetricValue(12000, 'int')).toBe((12000).toLocaleString('pl-PL'));
    expect(formatMetricValue(52.6, 'int')).toBe('53');
  });

  it('formats a duration in hours and padded minutes', () => {
    expect(formatMetricValue(25560, 'duration')).toBe('7h 06m'); // 7h 06m of sleep
    expect(formatMetricValue(0, 'duration')).toBe('0h 00m');
    expect(formatMetricValue(-10, 'duration')).toBe('0h 00m'); // never renders a negative clock
  });

  it('formats decimals to one place and passes plain numbers through', () => {
    expect(formatMetricValue(4.25, 'decimal')).toBe('4.3');
    expect(formatMetricValue(7, 'plain')).toBe(7);
  });

  it('returns null for a missing or non-finite value', () => {
    expect(formatMetricValue(null, 'int')).toBeNull();
    expect(formatMetricValue(Number.NaN, 'int')).toBeNull();
    expect(formatMetricValue(Number.POSITIVE_INFINITY, 'duration')).toBeNull();
  });
});

describe('formatMetricText', () => {
  it('always yields a string, so a chart read-out never prints "null"', () => {
    expect(formatMetricText(25560, 'duration')).toBe('7h 06m');
    expect(formatMetricText(7, 'plain')).toBe('7');
    expect(formatMetricText(Number.NaN, 'int')).toBe('—');
  });
});
