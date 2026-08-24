import { describe, expect, it } from 'vitest';
import { passwordsMatch, validateEmail, validatePassword, validateUsername } from './password-policy';

describe('validateEmail', () => {
  it('accepts a well-formed address and lower-cases it', () => {
    expect(validateEmail('Ada@Example.COM')).toEqual({ ok: true, value: 'ada@example.com' });
  });

  it('rejects a malformed address', () => {
    expect(validateEmail('not-an-email').ok).toBe(false);
    expect(validateEmail('').ok).toBe(false);
    expect(validateEmail(42).ok).toBe(false);
  });
});

describe('validateUsername', () => {
  it('accepts 3-32 chars of [a-z0-9_-] after lower-casing', () => {
    expect(validateUsername('Ada-1')).toEqual({ ok: true, value: 'ada-1' });
    expect(validateUsername('abc').ok).toBe(true); // boundary: minimum length
    expect(validateUsername('a'.repeat(32)).ok).toBe(true); // boundary: maximum length
  });

  it('rejects too short, too long, or out-of-charset usernames', () => {
    expect(validateUsername('ab').ok).toBe(false); // one under the minimum
    expect(validateUsername('a'.repeat(33)).ok).toBe(false); // one over the maximum
    expect(validateUsername('ada!').ok).toBe(false);
    expect(validateUsername('ada user').ok).toBe(false);
  });
});

describe('validatePassword', () => {
  it('accepts a password within 10-72 bytes', () => {
    expect(validatePassword('1234567890').ok).toBe(true); // boundary: exactly 10 bytes
    expect(validatePassword('a'.repeat(72)).ok).toBe(true); // boundary: exactly 72 bytes
  });

  it('rejects a password under 10 bytes or over 72 bytes', () => {
    expect(validatePassword('123456789').ok).toBe(false); // 9 bytes
    expect(validatePassword('a'.repeat(73)).ok).toBe(false); // 73 bytes
  });

  it('measures BYTES, not characters — multi-byte UTF-8 can exceed 72 bytes under 72 characters', () => {
    // 'é' is 2 bytes in UTF-8; 40 of them is 80 bytes but only 40 characters.
    const multiByte = 'é'.repeat(40);
    expect(multiByte.length).toBe(40);
    expect(validatePassword(multiByte).ok).toBe(false);
  });

  it('rejects a non-string', () => {
    expect(validatePassword(undefined).ok).toBe(false);
    expect(validatePassword(12345678901).ok).toBe(false);
  });
});

describe('passwordsMatch', () => {
  it('is a byte-for-byte comparison', () => {
    expect(passwordsMatch('hunter2', 'hunter2')).toBe(true);
    expect(passwordsMatch('hunter2', 'Hunter2')).toBe(false);
    expect(passwordsMatch('hunter2', 'hunter2 ')).toBe(false);
  });
});
