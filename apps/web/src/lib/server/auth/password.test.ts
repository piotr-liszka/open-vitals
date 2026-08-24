import { describe, expect, it } from 'vitest';
import { createBcryptHasher, createFixedPasswordHasher } from './password';

describe('createBcryptHasher', () => {
  it('round-trips a hash/verify pair and rejects a wrong password', async () => {
    const hasher = createBcryptHasher(4); // low cost factor — this is a correctness test, not a timing one
    const hash = await hasher.hash('correct horse battery staple');
    expect(hash).not.toBe('correct horse battery staple');
    expect(await hasher.verify('correct horse battery staple', hash)).toBe(true);
    expect(await hasher.verify('wrong password', hash)).toBe(false);
  });
});

describe('createFixedPasswordHasher', () => {
  it('is deterministic', async () => {
    const hasher = createFixedPasswordHasher();
    const first = await hasher.hash('hunter2');
    const second = await hasher.hash('hunter2');
    expect(first).toBe(second);
  });

  it('verifies the right plaintext and rejects the wrong one', async () => {
    const hasher = createFixedPasswordHasher();
    const hash = await hasher.hash('hunter2');
    expect(await hasher.verify('hunter2', hash)).toBe(true);
    expect(await hasher.verify('other', hash)).toBe(false);
  });

  it('produces a value distinguishable from a real bcrypt hash', async () => {
    const hasher = createFixedPasswordHasher();
    const hash = await hasher.hash('hunter2');
    expect(hash.startsWith('$2')).toBe(false); // never looks like a real bcrypt hash
  });
});
