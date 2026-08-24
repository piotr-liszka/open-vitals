import { describe, expect, it } from 'vitest';
import { validateOnboardingInput } from './onboarding.validate';

const valid = {
  email: 'admin@example.com',
  username: 'admin',
  password: 'a-strong-password',
  confirmPassword: 'a-strong-password'
};

describe('validateOnboardingInput', () => {
  it('accepts a well-formed submission', () => {
    const result = validateOnboardingInput(valid);
    expect(result).toEqual({
      ok: true,
      email: 'admin@example.com',
      username: 'admin',
      password: 'a-strong-password'
    });
  });

  it('rejects a malformed email with a field error', () => {
    const result = validateOnboardingInput({ ...valid, email: 'not-an-email' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.fields.email).toBeTruthy();
    expect(result.fields.username).toBeUndefined();
  });

  it('rejects a too-short username', () => {
    const result = validateOnboardingInput({ ...valid, username: 'ab' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.fields.username).toBeTruthy();
  });

  it('rejects a too-short or too-long password', () => {
    const short = validateOnboardingInput({ ...valid, password: 'short', confirmPassword: 'short' });
    expect(short.ok).toBe(false);
    const long = validateOnboardingInput({
      ...valid,
      password: 'a'.repeat(73),
      confirmPassword: 'a'.repeat(73)
    });
    expect(long.ok).toBe(false);
  });

  it('rejects a mismatched confirm password', () => {
    const result = validateOnboardingInput({ ...valid, confirmPassword: 'something-else' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.fields.confirmPassword).toBeTruthy();
  });

  it('lower-cases email and username', () => {
    const result = validateOnboardingInput({ ...valid, email: 'Admin@Example.COM', username: 'Admin' });
    expect(result).toMatchObject({ ok: true, email: 'admin@example.com', username: 'admin' });
  });
});
