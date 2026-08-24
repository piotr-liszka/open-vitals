/**
 * Password hashing PORT (spec 094), alongside `oidc.ts`/`mock.ts`. Two adapters: `bcryptjs` for real
 * deployments, a deterministic fixed hasher for tests (so unit/API-integration tests never pay
 * bcrypt's real timing cost and never depend on the `bcryptjs` package being installed to run fast).
 */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}

/**
 * `bcryptjs`'s own default cost factor. Documented tradeoff: `bcryptjs` is markedly slower than
 * native `bcrypt` per round since it's pure JS; 10 keeps a single login under ~150ms on modest
 * hardware, which matters for a self-hosted box that might be a Raspberry Pi.
 */
const DEFAULT_COST_FACTOR = 10;

/**
 * Real adapter: `bcryptjs` (pure JS — no native build step, matching every other dependency here).
 * The import is INSIDE the adapter, not at module top level, so `createFixedPasswordHasher` (the
 * test default) never touches the package at all — tests do not pay its cost even indirectly via a
 * module-load side effect.
 */
export function createBcryptHasher(costFactor: number = DEFAULT_COST_FACTOR): PasswordHasher {
  return {
    async hash(plain: string): Promise<string> {
      const bcrypt = await loadBcrypt();
      return bcrypt.hash(plain, costFactor);
    },
    async verify(plain: string, hash: string): Promise<boolean> {
      const bcrypt = await loadBcrypt();
      return bcrypt.compare(plain, hash);
    }
  };
}

/**
 * `bcryptjs` is CommonJS with no statically-analyzable named exports, so Node's dynamic `import()`
 * yields only `{ default: <the real module> }` here (verified directly against this project's
 * runtime) rather than hoisting `hash`/`compare` onto the namespace the way some CJS packages do.
 * Guard for both shapes so this keeps working if that ever changes upstream or across bundlers.
 */
async function loadBcrypt(): Promise<{
  hash(plain: string, cost: number): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}> {
  const mod = await import('bcryptjs');
  return (mod as unknown as { default?: typeof mod }).default ?? mod;
}

/** Prefix marking a fixed-hasher output, so a real bcrypt hash can never be misread as one. */
const FIXED_PREFIX = 'fixed-hash:';

/**
 * Test double: deterministic, non-cryptographic, and never touches `bcryptjs` — used only by
 * `createTestContainer`, so tests never pay bcrypt's real timing cost.
 */
export function createFixedPasswordHasher(): PasswordHasher {
  return {
    async hash(plain: string): Promise<string> {
      return `${FIXED_PREFIX}${plain}`;
    },
    async verify(plain: string, hash: string): Promise<boolean> {
      return hash === `${FIXED_PREFIX}${plain}`;
    }
  };
}
