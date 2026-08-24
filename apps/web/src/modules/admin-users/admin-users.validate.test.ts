import { describe, expect, it } from 'vitest';
import { validateCreateInput, validateUpdateInput } from './admin-users.validate';

describe('validateCreateInput', () => {
  it('accepts email + username with no password/isAdmin (Google-only account)', () => {
    const result = validateCreateInput({ email: 'a@b.co', username: 'auser' });
    expect(result).toEqual({ ok: true, email: 'a@b.co', username: 'auser', password: null, isAdmin: false });
  });

  it('accepts an initial password and isAdmin flag', () => {
    const result = validateCreateInput({
      email: 'a@b.co',
      username: 'auser',
      password: 'a-strong-password',
      isAdmin: true
    });
    expect(result).toEqual({
      ok: true,
      email: 'a@b.co',
      username: 'auser',
      password: 'a-strong-password',
      isAdmin: true
    });
  });

  it('rejects a malformed email/username/password with field codes', () => {
    const result = validateCreateInput({ email: 'nope', username: 'ab', password: 'short' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.fields.email).toBe('invalid_email');
    expect(result.fields.username).toBe('invalid_username');
    expect(result.fields.password).toBe('invalid_password');
  });

  it('treats an empty-string password the same as omitted (no field, no password)', () => {
    const result = validateCreateInput({ email: 'a@b.co', username: 'auser', password: '' });
    expect(result).toMatchObject({ ok: true, password: null });
  });
});

describe('validateUpdateInput', () => {
  it('validates only the fields present', () => {
    expect(validateUpdateInput({ username: 'newname' })).toEqual({ ok: true, username: 'newname' });
    expect(validateUpdateInput({ isAdmin: true })).toEqual({ ok: true, isAdmin: true });
    expect(validateUpdateInput({})).toEqual({ ok: true });
  });

  it('rejects a malformed present field', () => {
    const result = validateUpdateInput({ email: 'not-an-email' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.fields.email).toBe('invalid_email');
  });

  it('ignores a non-boolean isAdmin rather than erroring', () => {
    expect(validateUpdateInput({ isAdmin: 'yes' as unknown })).toEqual({ ok: true });
  });
});
