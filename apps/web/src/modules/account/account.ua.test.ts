import { describe, expect, it } from 'vitest';
import { describeUserAgent } from './account.ua';

describe('describeUserAgent', () => {
  it('recognizes a handful of representative UA strings', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
      )
    ).toBe('Chrome on Windows');

    expect(
      describeUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      )
    ).toBe('Safari on macOS');

    expect(describeUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0')).toBe(
      'Firefox on Linux'
    );

    expect(
      describeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      )
    ).toBe('Safari on iOS');

    expect(
      describeUserAgent(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'
      )
    ).toBe('Chrome on Android');
  });

  it('falls back to the raw string when nothing is recognized', () => {
    expect(describeUserAgent('SomeCustomAgent/1.0')).toBe('SomeCustomAgent/1.0');
  });

  it('falls back to a generic label for null/empty', () => {
    expect(describeUserAgent(null)).toBe('Unknown device');
    expect(describeUserAgent(undefined)).toBe('Unknown device');
    expect(describeUserAgent('')).toBe('Unknown device');
    expect(describeUserAgent('   ')).toBe('Unknown device');
  });
});
