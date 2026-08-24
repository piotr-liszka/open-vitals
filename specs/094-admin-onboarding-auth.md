# Spec 094 — Admin Onboarding & Local Auth

- **Status:** Closed
- **Module:** `apps/web/src/modules/onboarding/`, `apps/web/src/modules/auth/` (extended),
  `apps/web/src/modules/admin-users/`, `apps/web/src/modules/account/`, plus
  `apps/web/src/lib/server/{db,repo,session,auth,logger,container}` (extended)
- **Owner agent:** module-dev
- **Depends on:** 012 (multi-user Google auth — this spec changes its sign-up behavior; see "Relationship
  to spec 012" below). 004/014/071 are historical context only (pre-012 single-user model, dead env vars,
  feature-switch registry) and are not touched.

## Context

OpenVitals is self-hosted, not a public multi-tenant product (per the current README/AGENTS.md framing —
this spec's own product decisions supersede the "signs in with Google" framing in AGENTS.md §1, which
should be updated in the same change). Today the only way in is "Continue with Google" (spec 012): any
Google account that completes the OAuth dance is auto-provisioned a new user, there is no concept of an
admin, and a full marketing landing page (`modules/landing/Landing.svelte`) is shown to every signed-out
visitor at `/`. None of that fits a self-hosted box someone stands up for themselves and their household:
there is no "sign up," there is a fixed, small set of people who should be able to log in, and someone has
to be able to manage that set without editing the database by hand.

This spec: (1) removes the landing page, (2) adds a first-run onboarding flow that creates exactly one
initial **admin** account and gates the entire app until that account exists, (3) adds **username/email +
password** login as a first-class second auth method alongside Google, (4) changes Google sign-in from
"anyone can join" to "sign in only if an account already exists for this email" (admin-provisioned,
auto-linked by email), (5) adds an admin-only user management area, and (6) adds a self-service "my
account" area (password, active sessions, linked-method status) for every user.

### Relationship to spec 012

Spec 012 introduced Google OIDC as the *only* auth method and made every new Google sign-in
self-provisioning ("any Google account works"). This spec:

- **Keeps** spec 012's session mechanism as-is (DB-backed opaque id, httpOnly/SameSite=Lax cookie,
  `lib/server/session.ts`) — no new session mechanism, both auth methods end at the same `session.issue()`.
- **Supersedes** spec 012's auto-provisioning: Google sign-in no longer creates a user. It looks the
  identity up by email against pre-existing accounts and signs in on a match; no match is a rejection
  (see "Google sign-in" below).
- **Adds** a second, independent auth method (password) that spec 012 did not have.
- **Adds** the concept of an admin/role, which did not exist before this spec at all.

## Scope note (why one spec number covers several slices)

This bundles onboarding, password auth, the Google auto-link change, admin user management, and
self-service account settings into one spec rather than several because they are one coherent change to
"how authentication and accounts work" landing in a single migration and a single change to the `users`
table — splitting them would leave intermediate states where e.g. password login exists but there is no
admin able to create password-only accounts. Each module below still gets its own files and its own
unit + API-integration tests per AGENTS.md §5/§7, and could reasonably be implemented as a short sequence
of PRs against this one spec.

## Data model (migrations)

Both `apps/web/src/lib/server/db/index.ts` files — the `MIGRATIONS` array (what actually runs) **and**
the `schemaSql` doc string (reference only, nothing runs it) — must be updated together, per the file's own
convention.

### `users` — final shape (for `schemaSql`)

```sql
CREATE TABLE IF NOT EXISTS users (
  id            text PRIMARY KEY,
  google_sub    text UNIQUE,              -- now OPTIONAL: a password-only account has none
  email         text UNIQUE NOT NULL,     -- the Google auto-link key; unique+required
  username      text UNIQUE NOT NULL,     -- the local sign-in handle, separate from email
  password_hash text,                     -- null = no password set (Google-only account)
  is_admin      boolean NOT NULL DEFAULT false,
  name          text,
  avatar_url    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

`username`/`email` are normalized to lowercase before storage and lookup (case-insensitive identity),
enforced in the repo layer, not by a DB `CITEXT` extension (keeps the migration a plain `ALTER`/`CREATE
INDEX`, no new extension to enable).

### `sessions` — final shape (for `schemaSql`)

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent  text,          -- raw request User-Agent at issue time; null for pre-094 rows
  ip_address  text,          -- client address at issue time (event.getClientAddress()); nullable
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
```

### New `MIGRATIONS` entries (appended at the end of the array, in this order)

```sql
-- spec 094: google_sub becomes OPTIONAL — a user can now exist with a password only, never having
-- signed in with Google.
ALTER TABLE users ALTER COLUMN google_sub DROP NOT NULL;

-- spec 094: username is the local sign-in handle, separate from email. Backfilled to the internal id
-- for any pre-existing row — a cosmetically ugly but ALWAYS-unique placeholder — so the NOT NULL +
-- UNIQUE constraints below never fail an in-place upgrade. An admin renames these from /admin/users
-- once one exists (see "Upgrade note" below — a pre-094 deployment has no admin either, until onboarding
-- is completed again post-upgrade).
ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
UPDATE users SET username = id WHERE username IS NULL;
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users(username);

-- spec 094: email is the Google auto-link key, so it must be required + unique. Spec 012's OIDC scope
-- has always requested `email`, so this backfill is defense-in-depth, not an expected path — but it
-- keeps `migrate()` from ever failing outright on a row a future bug left without one.
UPDATE users SET email = id || '@unknown.local' WHERE email IS NULL;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- spec 094: session provenance for the self-service "active sessions" list (My Account). Nullable —
-- rows minted before this column existed simply render nothing for these two fields.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address text;
```

**Upgrade note:** on an existing deployment, this migration makes `existsAdmin()` (below) false for
every pre-094 user (nobody has `is_admin = true` yet), so the app drops into onboarding-needed state on
first boot after the upgrade — existing users are **not** deleted or logged out at the DB level, but the
onboarding gate (see below) blocks every route, including theirs, until an operator opens `/onboarding`
once and creates the first admin. Operators should do this immediately after deploying this spec.

## Ports & adapters

### `lib/server/repo/types.ts`

`User` gains fields, `email`/`googleSub` nullability flips, and `passwordHash` itself is **never** part of
this type (it must never round-trip into a JSON response by accident):

```ts
export interface User {
  readonly id: string;
  readonly googleSub: string | null;   // CHANGED: was string (required); now optional
  readonly email: string;              // CHANGED: was string | null; now required
  readonly username: string;           // NEW
  readonly isAdmin: boolean;           // NEW
  readonly hasPassword: boolean;       // NEW — derived; the hash itself never leaves the repo
  readonly name: string | null;
  readonly avatarUrl: string | null;
  readonly createdAt: string;
}

/** Narrow, security-sensitive projection used ONLY by password verification. */
export interface UserCredential {
  readonly id: string;
  readonly passwordHash: string | null;
}
```

`UserRepo` gains:

```ts
existsAdmin(): Promise<boolean>;                              // the onboarding gate's one query
countAdmins(): Promise<number>;                                // last-admin guard
findByEmail(email: string): Promise<User | null>;
findByUsername(username: string): Promise<User | null>;
findCredentialByIdentifier(identifier: string): Promise<UserCredential | null>; // username OR email
listAll(): Promise<User[]>;                                    // admin list

/** Onboarding + admin "create user". Caller pre-validates uniqueness; a DB unique-violation on a
 *  race is still possible and must be caught by the handler (see "Design notes"). */
createLocal(input: {
  email: string; username: string; passwordHash: string | null; isAdmin: boolean;
}): Promise<User>;

setPassword(userId: string, passwordHash: string | null): Promise<User>;
setAdmin(userId: string, isAdmin: boolean): Promise<User>;
updateIdentity(userId: string, patch: { username?: string; email?: string }): Promise<User>;
deleteUser(userId: string): Promise<void>;                     // sessions cascade via existing FK

/** Auto-link-by-email on Google sign-in: backfills google_sub + refreshes name/avatar/email. */
linkGoogle(userId: string, identity: Identity): Promise<User>;
```

`upsertFromIdentity` **stays**, but is used only by the `mock` auth adapter's dev/test shortcut from now
on (see "Google sign-in" below) — the real OIDC path no longer calls it.

`SessionRepo` gains:

```ts
export interface SessionSummary {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly userAgent: string | null;
  readonly ipAddress: string | null;
}

listByUser(userId: string): Promise<SessionSummary[]>;
deleteOtherSessions(userId: string, keepSessionId: string): Promise<number>;
```

`create` gains optional provenance:

```ts
create(input: {
  userId: string; expiresAt: Date; userAgent?: string | null; ipAddress?: string | null;
}): Promise<string>;
```

`lib/server/interfaces.ts`'s `SessionService.issue` gains the same optional second argument:

```ts
issue(userId: string, meta?: { userAgent?: string | null; ipAddress?: string | null }): Promise<string>;
```

Every session-issuing call site is updated to capture and pass it through: `/auth/login` (POST, password),
`/auth/callback` (GET, Google), `/onboarding`'s form action, and the `mock` adapter's dev shortcut in
`beginLogin`. All four extract `event.getClientAddress()` and `event.request.headers.get('user-agent')` at
the route layer (never inside the pure `*.api.ts` handlers, consistent with "no raw `Request` in
handlers" — the route passes plain strings in).

Every adapter (`lib/server/repo/pg.ts` and `lib/server/repo/memory.ts`) implements the same additions;
both are covered by the existing shared contract-test convention (the same test suite run against both).

### New: `lib/server/auth/password.ts` (a port + two adapters, alongside `oidc.ts`/`mock.ts`)

```ts
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}

export function createBcryptHasher(costFactor?: number): PasswordHasher; // real, bcryptjs
export function createFixedPasswordHasher(): PasswordHasher;             // test double, no real bcrypt
```

- **Package:** `bcryptjs` (pure JS — no native build step, matching every other dependency in this repo;
  `bcrypt` needs `node-gyp` and would be the first native dependency in `apps/web`). Add to
  `apps/web/package.json` `dependencies` (+ `@types/bcryptjs` to `devDependencies`).
- **Cost factor:** `10` (bcryptjs's own default). Documented tradeoff: `bcryptjs` is markedly slower than
  native `bcrypt` per round since it's pure JS; 10 keeps a single login under ~150ms on modest hardware,
  which matters for a self-hosted box that might be a Raspberry Pi. A future spec can raise this if that
  box turns out to be much faster than expected.
- **bcrypt's 72-byte input cap:** passwords are validated to be ≤ 72 **bytes** (not just characters — a
  password with multi-byte UTF-8 characters could exceed 72 bytes well under 72 characters) and rejected
  with a clear "password too long" error rather than silently truncated by the hasher.
- `createFixedPasswordHasher()` is a deterministic, non-cryptographic stand-in (e.g. a fixed prefix +
  the plaintext) used only by `createTestContainer`, so unit/API-integration tests never pay bcrypt's
  real timing cost and never depend on the `bcryptjs` package being installed to run fast.

`container.ts` gains a `passwordHasher: PasswordHasher` field (prod default `createBcryptHasher()`, test
default `createFixedPasswordHasher()`), injectable via `ContainerOverrides` like every other adapter.

### `lib/server/logger.ts`

`REDACT_KEYS` gains `ip_?address` and `user_?agent` (word-bounded, not a bare `ip`, to avoid false
positives on unrelated keys that merely contain the letters "ip") — defense-in-depth per AGENTS.md §10,
even though the rule below is that IP/UA are never passed to the logger at all:

- IP address and user agent are stored in `sessions` for the signed-in user's **own** visibility (shown
  in "My Account" → active sessions) and **must never appear in a log line**. The auth/session/onboarding
  handlers pass them straight from the route layer to the repo and never through `logger.*()`. If a
  future change needs to log a session-related event, these fields must go through the redacted logger,
  not printed directly — the widened `REDACT_KEYS` regex is the backstop for that future change, not the
  primary control.

## Onboarding

### Gate semantics (`hooks.server.ts` + `modules/auth/guard.ts`)

The pure decision stays in `guard.ts` (unit-testable without a DB); the DB check + its cache live in
`hooks.server.ts`, mirroring the existing `ensureMigrated`/`schedulerStarted` module-level-flag pattern in
that same file.

```ts
// hooks.server.ts — new module-level state, same shape as `migrated`/`schedulerStarted`.
let adminExists = false;
async function onboardingNeeded(c: AppContainer): Promise<boolean> {
  if (adminExists) return false;         // sticky: this only ever flips false → true, once, ever
  adminExists = await c.repo.users.existsAdmin();
  return !adminExists;
}
```

**Caching tradeoff (decided):** memoize in-process once `existsAdmin()` returns true, and never re-check.
This is safe specifically because "an admin exists" can only become true, never false again in normal
operation (deleting the last admin from the DB by hand is explicitly unsupported, per the product
decision below) — so a per-process cache cannot go stale in the dangerous direction. It costs exactly one
extra indexed `SELECT EXISTS` per request only during the (typically very short) window before the first
admin is created, and zero afterwards. This app is a single Node process per AGENTS.md's deployment model
(one published web service); a hypothetical multi-replica deployment would have each replica's cache flip
independently on its own next request after another replica creates the admin — acceptable given this
project has no such deployment today, and worth re-visiting only if that changes.

`guard.ts`'s `authGuard` gains an `onboardingNeeded: boolean` input and a new possible action:

```ts
export type GuardDecision =
  | { action: 'allow' }
  | { action: 'redirect'; to: string }
  | { action: 'unauthorized' }
  | { action: 'onboarding_required' };   // NEW
```

Decision table (evaluated before the existing authenticated/public checks):

- `path === '/onboarding'` **and** `onboardingNeeded` → `allow` (the only page reachable pre-admin,
  besides assets/health).
- `path === '/onboarding'` **and NOT** `onboardingNeeded` → `redirect` to `/login` — unconditionally,
  regardless of `authenticated`, and for both GET (page) and the page's POST form action (same route id).
  Not a 404, not an error page: a clean redirect, per the product decision.
- `onboardingNeeded` **and** path is not `/onboarding`, not a static asset (`routeMatched === false`),
  and not `GET /api/health` → `onboarding_required`.
- Otherwise → falls through to the existing authenticated/public logic unchanged.

`hooks.server.ts` maps `onboarding_required` the same way it already maps the other two non-`allow`
actions: page route (`routeMatched`) → `redirect(303, '/onboarding')`; `/api/**` route → `503` JSON
`{ error: 'onboarding_required' }` (503, not 401/403: nothing is wrong with the caller's credentials or
permissions, the *server* isn't usable yet — mirrors how `unauthorized` already gets its own status).

`/` is **removed** from `guard.ts`'s `PUBLIC_PAGES` (the landing page it existed for is deleted — see
below); an unauthenticated visit to `/` now falls through to the ordinary "redirect to `/login`" branch
(or `/onboarding`, if that gate fires first).

### First-run admin creation

Route: `/onboarding` — a `+page.svelte` (form: email, username, password, confirm password) +
`+page.server.ts` with a `load` (trivial — just enough for the page to render) and a form `actions.default`
that calls into `modules/onboarding/onboarding.api.ts`'s pure `createInitialAdmin()`. This keeps the route
thin (§5) while still satisfying the "GET or POST both redirect once an admin exists" requirement, because
the page's `load` and its form action share one route id (`/onboarding`) that the guard already gates
identically for both verbs.

`createInitialAdmin()` re-checks `existsAdmin()` itself (defense in depth — never trust the guard alone
for a security-relevant write): if an admin now exists (a race between two people loading a fresh
install's `/onboarding` at once, or the in-process cache lagging a moment behind a concurrent request that
just created one), it returns a distinct `already_onboarded` result; the action responds with
`redirect(303, '/login')` for that one case, and ordinary `fail(400, { fields })` for validation errors
(weak/too-long password, mismatched confirm, malformed email, taken username) so those render inline on
the form instead of bouncing the visitor away.

On success: creates the user via `repo.users.createLocal({ email, username, passwordHash, isAdmin: true })`,
issues a session (capturing IP/UA from the request), sets the cookie, and redirects to `/` — the same
landing spot every other login method uses.

### Google sign-in (auto-link by email, no auto-create)

`modules/auth/auth.api.ts`'s `completeCallback` changes:

1. Exchange the code, verify the `id_token` (unchanged).
2. If the identity carries no `email` (a Google account that somehow denied the `email` scope claim) →
   `401` with `t('auth.verificationFailed')` — the existing generic error, no new string needed.
3. `user = await repo.users.findByGoogleSub(identity.googleSub)`.
4. If not found: `user = await repo.users.findByEmail(identity.email)`.
5. If **still** not found → **reject**: `401`, safe generic message
   (`t('auth.noAccountForGoogleEmail')`, wording along the lines of "No account found for this Google
   account. Ask an admin to create one for you.") — it must not reveal whether *other* accounts exist,
   only that this one doesn't. Log the attempt at `warn`, with the Google `sub` and email redacted per
   §10 (the existing `email`/`credential` redaction keys already catch a bare `email` key; log a generic
   message like `'google sign-in rejected: no matching account'` with no identity fields at all, rather
   than relying on redaction to scrub an object that shouldn't be logged in the first place).
6. If found via step 4 and that row's `googleSub` is still null → `await repo.users.linkGoogle(user.id,
   identity)` (backfills `google_sub`, refreshes `name`/`avatarUrl`/`email` from the fresher Google
   profile) — this is the "auto-link by email" the account can now use **either** method with.
7. If found via step 3 (already linked before) → same refresh of `name`/`avatarUrl` as spec 012 did on
   every login (kept, folded into `linkGoogle`, called even when `googleSub` was already set — it's
   idempotent).
8. Issue a session (capturing IP/UA) exactly as before.

**`upsertFromIdentity` and the `mock` auth adapter:** the `mock` adapter's dev/test shortcut in
`beginLogin` still auto-provisions its one fixed dev user via `upsertFromIdentity` — unchanged — because
`AUTH_ADAPTER=mock` is already refused in production (per the existing env var table) and exists purely so
`make dev`/tests never need real Google. **New in this spec:** immediately after that upsert, `beginLogin`
also calls `repo.users.setAdmin(user.id, true)` (idempotent — setting `true` on an already-`true` row is a
no-op) so the mock dev/test shortcut is never itself blocked by the onboarding gate. This is a deliberate,
explicit carve-out for the same reason the `mock` adapter already is one; it does not touch the real OIDC
path or any production deployment.

## Password login

`modules/auth/auth.api.ts` gains:

```ts
export type PasswordLoginResult =
  | { ok: true; location: string; session: { id: string; cookieName: string; maxAge: number } }
  | { ok: false; status: 401; error: string };

export async function loginWithPassword(
  container: AppContainer,
  input: { identifier: string; password: string; userAgent: string | null; ipAddress: string | null; locale: Locale }
): Promise<PasswordLoginResult>;
```

Logic: look up `findCredentialByIdentifier(identifier)`; if not found, or `passwordHash` is null (a
Google-only account), or `hasher.verify(password, passwordHash)` is false → the **same** generic
`t('auth.invalidCredentials')` 401 in every case (never reveal which of "no such account" / "no password
set" / "wrong password" applies — a standard enumeration-resistance measure). On success, `session.issue`
+ return, same shape as the Google flow.

Route: `apps/web/src/routes/auth/login/+server.ts` gains a new `export const POST` alongside the existing
`GET` (Google-start) — same file, same URL, different verb, matching the existing route's own comment
style. Parses `{ identifier, password }` from the JSON body, extracts `event.getClientAddress()` +
`user-agent`, calls `loginWithPassword`, sets the session cookie identically to the `GET`/callback paths on
success, and returns `{ ok: true }` (200) or `{ error }` (401) as JSON — the login page calls this with
`fetch`, unlike the Google button's full-page navigation.

`apps/web/src/routes/login/+page.svelte` gains an identifier + password `Field`/`Input` pair and a submit
button, in addition to the existing "Continue with Google" button — both visible at once, no toggle
between "modes". Submitting the password form calls `fetch('/auth/login', { method: 'POST', ... })`; on
`ok: true`, `location.href = '/'`; on failure, the existing inline error area (currently used for the
`?error=` query param from the Google callback) shows the same message.

**i18n key relocation:** the login page currently reads `i18n.t('landing.continueWithGoogle')` for its
Google button label. Since `landing.*` is deleted wholesale (below), this key moves to
`login.continueWithGoogle` (same English/Polish copy, new key) — call this out explicitly so the rename
happens in the same change and nothing goes temporarily untranslated.

## Landing page removal

- Delete `apps/web/src/modules/landing/Landing.svelte` and the module folder if nothing else lives in it.
- Delete every `landing.*` key from `apps/web/src/lib/i18n/messages/en.ts` and `pl.ts`, **except** the one
  relocated to `login.continueWithGoogle` above.
- `apps/web/src/routes/+page.svelte`: remove the `Landing` import and the `{#if !data.authed}` branch
  entirely — by the time this component renders, `guard.ts` has already redirected any unauthenticated
  (or pre-onboarding) visitor away, so `data.authed` is always true here now.
- `apps/web/src/routes/+page.server.ts`: remove the `if (!locals.user) return { authed: false as const }`
  short-circuit and the `authed` discriminant from the return type — `locals.user` is guaranteed non-null
  by the guard before this `load` ever runs.
- `apps/web/src/routes/home-payload.test.ts`: delete the `'logged out: nothing per-user is loaded at all'`
  test (the scenario it covers can no longer occur — the loader is never invoked logged-out) and drop the
  `authed: false` expectations from the remaining cases' typing.
- `apps/web/src/modules/auth/guard.test.ts`: the `'/'`-is-public assertions and the `authed: false` case
  in `home-payload.test.ts` are replaced by new cases exercising `onboarding_required` and the
  onboarding-route lockout (see Test plan).

## Admin user management

**Placement decision:** a new top-level area, `apps/web/src/routes/admin/users/`, rather than a tab under
`/settings`. `/settings` is every user's own per-account/integration surface (Garmin connection, MCP URL,
profile, feature switches); admin user management is a different audience (admins only, about *other*
people's accounts) and belongs in its own namespace so it can grow (or not) independently and so there is
never a risk of an admin-only card accidentally rendering for a non-admin `/settings` visitor. A small
"Admin" link is added to `NavLinks.svelte`, visible only when `isAdmin` — `+layout.server.ts` (already the
one place that resolves cross-page nav data, per spec 064) gains `isAdmin: locals.user?.isAdmin ?? false`
in its returned data.

Module: `apps/web/src/modules/admin-users/`
- `UserTable.svelte` — `lib/ui`'s `Table` listing every user.
- `UserEditDialog.svelte` — create/edit form (`Field`, `Input`, `Toggle` for `is_admin`) and a
  `ConfirmDialog` for delete + for the last-admin-guard message.
- `admin-users.api.ts` — pure handlers: `listUsers`, `createUser`, `updateUser`, `resetPassword`,
  `deleteUser`.
- `admin-users.types.ts`, `admin-users.validate.ts` (shared username/email/password rules — see
  "Validation rules" below), tests.

Authorization: a small reusable helper, `modules/auth/require-admin.ts`:

```ts
export function requireAdmin(user: User | null): void; // throws SvelteKit error(403, …) for pages
```

used at the top of every admin `+page.server.ts` `load`/`actions` and every `/api/admin/**` handler (the
latter returns a plain `403` JSON `Response` rather than SvelteKit's HTML-oriented `error()`, since it's
an API route). This is a role check, not a session check, so it stays separate from the generic
`authGuard` in `hooks.server.ts` — consistent with how other route-specific authorization already lives
at the route/handler level in this codebase rather than centrally.

**Last-admin guard:** before any `updateUser` that sets `isAdmin: false` on a currently-admin user, or any
`deleteUser` targeting an admin, the handler calls `countAdmins()`; if it is `1` and the target is that one
admin, the write is rejected with `409 { error: 'last_admin' }` and nothing is changed. Demoting/deleting a
*non-last* admin, and having multiple admins simultaneously, are both explicitly supported (per the product
decision).

Deleting a user cascades to their `sessions` rows via the existing `ON DELETE CASCADE` FK — no extra work
needed, called out so it's not "discovered" during implementation.

**Explicitly out of scope** (call out so it is not silently expected): self-service "forgot password" /
email-based reset (no outbound email system exists in this app at all) — password reset for another user
is admin-mediated only, via `resetPassword` above. An admin-wide *sessions* view (listing/revoking any
user's sessions from the admin area, not just your own) is not built here either — see "Suggested follow-up"
below.

## Self-service account ("My Account")

**Placement decision:** a new section on the existing `/settings` page — `/settings` is already every
user's personal account surface (profile numbers, Garmin connection, MCP URL), and "my password" / "my
sessions" / "how do I sign in" fit that exact description; composing them as two more cards there (after
the existing sections, before "housekeeping") reuses the page, its load, and its nav entry with no new
route. New module: `apps/web/src/modules/account/`.

- `AccountCard.svelte` — read-only "signed in with" status (`hasPassword`, and Google linked yes/no + the
  linked email/avatar if so — read-only, no "disconnect Google"/"link Google now" action; see "Out of
  scope" below) plus the password form: if `hasPassword` is false, a bare "set a password" form (new
  password + confirm, no current-password field, since there isn't one yet); if `hasPassword` is true, a
  "change password" form (current password + new password + confirm).
- `SessionsCard.svelte` — table of the caller's own sessions (`createdAt`, `expiresAt`, a simple
  human-readable rendering of `userAgent`, the raw `ipAddress`, and a "this device" badge on whichever
  session id matches the request's own), a per-row "Sign out" button, and a "Sign out all other sessions"
  button.
- `account.api.ts` — `getAccountInfo`, `setOwnPassword`, `listOwnSessions`, `revokeOwnSession`,
  `revokeOtherSessions`.
- `account.types.ts`, `account.validate.ts` (reuses the shared password rules), `account.ua.ts` (tiny pure
  `describeUserAgent(ua: string | null): string` — a handful of substring checks for common
  browser/OS names, falling back to the raw string; deliberately not a dependency, this repo has none for
  UA parsing and the display is cosmetic only), tests.

`hooks.server.ts` gains `event.locals.sessionId = sessionId ?? null` (the raw cookie value it already
reads to call `session.resolve`) so the account module can identify "this session" without a second cookie
read; `app.d.ts`'s `App.Locals` gains `sessionId: string | null`.

**Revoking your own current session:** allowed via the same single-session `DELETE` as any other row (no
special-casing to prevent it — it is equivalent to "sign out"). The response shape tells the client whether
it just deleted its own session (`wasCurrent: boolean`) so the UI can redirect to `/login` immediately
instead of leaving a dead session cookie in the browser until the next navigation trips the guard.

**Sessions table decision (confirmed):** `user_agent`/`ip_address` are captured (see migrations above) and
shown to the user about their own sessions only. No richer device fingerprinting (parsed browser/OS
structure stored server-side, geolocation, etc.) is built — the UA string is parsed only for cosmetic
display, on read, never stored pre-parsed.

**Explicitly out of scope:**
- "Disconnect Google" / "Link Google now" from this card — read-only status is enough for this spec; a
  user with a password can already sign in without Google regardless, and a user without one can ask an
  admin to add their email to an account and then just use "Continue with Google" (auto-linked on next
  login).
- An admin-wide sessions view is not built here, but the primitives this spec adds
  (`SessionRepo.listByUser`/single-session `delete`, already present) make it a small follow-up if wanted
  — noted as a suggestion, not a requirement.

## Validation rules (shared across onboarding, admin-create/edit/reset, self-service)

A single module, `lib/server/auth/password-policy.ts`, is the one place these are enforced (validated at
the API boundary in every case; the repo layer never re-validates):

- **Email:** standard email shape (via `zod`'s `z.string().email()` — `zod` is already a dependency),
  lower-cased before comparison/storage.
- **Username:** 3–32 characters, `[a-z0-9_-]` only after lower-casing, unique.
- **Password:** 10–72 bytes (UTF-8), no other composition rules (length is the one lever that matters
  most and this is a low-QPS self-hosted app, not a target worth an arbitrary complexity policy).
- **Confirm password:** must byte-for-byte equal `password` wherever a confirm field exists (onboarding,
  admin create, self-service set/change) — checked before hashing, never stored.

## Requirements (acceptance criteria)

**Landing page removal**
- [x] `apps/web/src/modules/landing/` no longer exists; nothing imports `Landing.svelte`.
- [x] No `landing.*` key remains in `en.ts`/`pl.ts`, except the copy relocated to
      `login.continueWithGoogle` (present, translated, and used by the login page).
- [x] An unauthenticated visit to `/` never renders marketing content; it redirects to `/login` (or
      `/onboarding`, when onboarding is needed) before any per-user data loads.

**Onboarding**
- [x] While no user has `is_admin = true`, every route except `/onboarding`, static assets, and
      `GET /api/health` redirects (`303`, pages) or `503`s with `{ error: 'onboarding_required' }`
      (`/api/**`) instead of doing its normal thing.
- [x] `/onboarding` renders and accepts a submission (email, username, password, confirm) only while no
      admin exists; the created user has `is_admin = true`.
- [x] Once any admin exists, `GET /onboarding` and the page's submit action both redirect (`303`) to
      `/login` — never a 404, never an error page — even for a still-unauthenticated visitor.
- [x] Submitting a mismatched confirm password, a too-short/too-long password, a malformed email, or an
      already-taken username re-renders the form with a field-level error and creates nothing.
- [x] A race where two submissions land after an admin already exists never produces a second "first
      admin" row created outside the normal admin-management path.

**Password login**
- [x] A user with a `password_hash` set can sign in with `POST /auth/login` using either their username
      or their email as `identifier`, landing on the same session-cookie flow as Google sign-in.
- [x] Wrong password, unknown identifier, and a Google-only account (no password set) all produce the
      *identical* generic `401` error — no response distinguishes them.
- [x] The `/login` page always renders the identifier/password form; it renders the "Continue with
      Google" button only when Google OAuth is configured (`GOOGLE_CLIENT_ID`/`SECRET` set), and omits it
      entirely otherwise. Submitting the password form never triggers a full-page navigation to Google.

**Google sign-in (spec 012 behavior change)**
- [x] A Google account whose email matches an existing user signs in and, if that user had no
      `google_sub` yet, backfills it — without creating a second row.
- [x] A Google account whose email matches **no** existing user is rejected with a `401` and a generic,
      non-enumerating message; no new user row is created.
- [x] The rejection is logged (redacted, no email/sub/tokens in the log line) per §10.
- [x] `AUTH_ADAPTER=mock`'s fixed dev user is always `is_admin = true` after signing in, so dev/test
      workflows are never blocked by the onboarding gate.

**Admin user management**
- [x] `/admin/users` and every `/api/admin/users/**` endpoint are reachable only by `is_admin = true`
      sessions; every other session gets `403` (API) or a `403` page (page route), never the data.
- [x] The list shows id, username, email, name/avatar (if present), `is_admin`, `has_password`,
      `has_google`, `created_at` for every user — and never a password hash, in any response.
- [x] Creating a user accepts email + username, an optional initial password, and an optional
      `is_admin` flag; a duplicate email or username is rejected with a field-level `409`, and nothing is
      written.
- [x] Editing a user can change username/email, toggle `is_admin`, and (via the dedicated reset endpoint)
      set a new password for someone else — all without needing that user's current password.
- [x] Demoting or deleting the sole remaining admin is rejected with `409 { error: 'last_admin' }`; the
      same action on any admin when at least one other admin exists succeeds.
- [x] Deleting a user also invalidates their sessions (verified via the existing cascade, not re-built).
- [x] A non-admin visiting `/admin/users` never sees an admin-only nav link either.

**Self-service account**
- [x] `/settings` (any signed-in user) shows: whether they have a password, whether a Google account is
      linked (and which email/avatar, if so), and a password form appropriate to which of those is true.
- [x] A Google-only user can set an initial password with no current-password field; a user who already
      has one must supply it correctly to change it, or the change is rejected with `401`.
- [x] `/settings` lists the caller's own active sessions (created/expires, a human-readable device label,
      IP) and marks which one is "this device" — and shows **no other user's** sessions, ever.
- [x] Revoking one of the caller's own sessions deletes exactly that row; "sign out all other sessions"
      deletes every one of the caller's sessions except the current one and leaves the current one intact.
- [x] IP address and user agent never appear in any log line emitted by any of these endpoints.

**Standing criteria**
- [x] Unit + API-integration tests pass for every module touched (no e2e).
- [x] Built only from `lib/ui` components + design tokens (Table, Field, Input, Toggle, ConfirmDialog,
      Badge, Banner as applicable) — no bespoke inline UI.
- [x] Every new user-facing string exists in both `en.ts` and `pl.ts` — no hardcoded English or Polish
      page chrome. (Minor, pre-existing-pattern exception noted in Closeout: `account.ua.ts`'s cosmetic
      `describeUserAgent` fallback — "Unknown device" and raw browser/OS tokens like "Chrome"/"Windows" —
      is not routed through i18n; it only surfaces for a missing/unrecognized User-Agent.)
- [x] No secrets (passwords, password hashes, session ids, IP/UA) are logged or committed.
- [x] `pnpm run verify` (test + check + lint + build) is green.

## API contract

```
GET  /onboarding                 → 200 (form) while no admin exists; 303 → /login once one does.
POST /onboarding  (form action)  req: { email, username, password, confirmPassword }
                                  res: redirect 303 → / on success (session cookie set)
                                       fail(400, { fields: { email?, username?, password?, confirmPassword? } })
                                       redirect 303 → /login if an admin already exists (race)

POST /auth/login                 req: { identifier: string, password: string }
                                  res: 200 { ok: true }  (session cookie set)
                                       401 { error: string }  (invalid credentials, any reason)

GET  /auth/callback              (existing route; behavior changed, contract unchanged)
                                  res: 303 → /            on success
                                       303 → /login?error=…   on rejection (incl. "no matching account")

GET  /api/admin/users            res: 200 { users: AdminUserSummary[] }
                                       403 { error: 'forbidden' }   (non-admin)

POST /api/admin/users            req: { email, username, password?: string, isAdmin?: boolean }
                                  res: 201 { user: AdminUserSummary }
                                       409 { error: 'email_taken' | 'username_taken' }
                                       400 { error: 'invalid', fields: {...} }
                                       403 { error: 'forbidden' }

PATCH /api/admin/users/:id       req: { username?, email?, isAdmin? }
                                  res: 200 { user: AdminUserSummary }
                                       409 { error: 'email_taken' | 'username_taken' | 'last_admin' }
                                       404 { error: 'not_found' }
                                       403 { error: 'forbidden' }

DELETE /api/admin/users/:id      res: 204
                                       409 { error: 'last_admin' }
                                       404 { error: 'not_found' }
                                       403 { error: 'forbidden' }

POST /api/admin/users/:id/password   req: { password: string }
                                      res: 200 { ok: true }
                                           400 { error: 'invalid_password' }
                                           404 { error: 'not_found' }
                                           403 { error: 'forbidden' }

GET  /settings                   (existing route; load extended)
                                  res page data += {
                                    account: { username, email, isAdmin, hasPassword, hasGoogle,
                                               googleEmail: string | null, googleAvatarUrl: string | null },
                                    sessions: Array<{ id, createdAt, expiresAt, userAgent: string | null,
                                                       ipAddress: string | null, isCurrent: boolean }>
                                  }

POST /api/account/password       req: { currentPassword?: string, newPassword: string, confirmPassword: string }
                                  res: 200 { ok: true }
                                       401 { error: 'invalid_current_password' }  (hasPassword=true only)
                                       400 { error: 'invalid_password' | 'mismatch' }

DELETE /api/account/sessions/:id res: 200 { ok: true, wasCurrent: boolean }
                                       404 { error: 'not_found' }   (not one of the caller's own sessions)

POST /api/account/sessions/revoke-others
                                  res: 200 { ok: true, revoked: number }
```

`AdminUserSummary`:

```ts
interface AdminUserSummary {
  id: string; username: string; email: string; name: string | null; avatarUrl: string | null;
  isAdmin: boolean; hasPassword: boolean; hasGoogle: boolean; createdAt: string;
}
```

## UI

- **Onboarding page:** `Card` + `Field`/`Input` (email, username, password, confirm), `Button` (primary
  submit). Loading state disables the submit button; error state shows inline field errors under each
  input; success is a redirect (no success state to render). Reuses the same page chrome as `/login`
  (`LangSwitch`, `ThemeToggle`, centered panel) for visual consistency on the one screen a fresh install
  shows.
- **Login page:** existing `Card`/`Button` layout gains a `Field`/`Input` identifier + password pair above
  the Google button (visual order: password form first, since that is the primary method for a
  self-hosted install with no Google configured at all; Google stays as a secondary option when present).
  The Google button is **only rendered when Google is configured** — `+page.server.ts`'s `load` returns a
  `googleEnabled: boolean` computed from whether `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set (reuse
  whatever existing config check `lib/server/config.ts` already does to select the `oidc` vs. `mock`
  adapter — do not duplicate that logic, expose the boolean it already effectively computes), and the
  page conditionally renders the button on that flag. Loading state disables the form during the fetch;
  error state reuses the existing `.error` banner.
- **`/admin/users`:** `AppShell` + `Table` (columns: username, email, name/avatar, admin toggle badge,
  auth methods as two small `Badge`s, created date, row actions) + a "New user" `Button` opening
  `UserEditDialog` (a `ConfirmDialog`-style modal built from `Field`/`Input`/`Toggle`). Empty state: never
  actually empty (the caller's own admin row always exists). Error state: a `Banner` on a failed
  create/edit/delete, inline per-field errors preferred over a banner where the API returned `fields`.
- **`/settings` additions:** `AccountCard` (status rows + password `Field`/`Input` form + `Button`) and
  `SessionsCard` (`Table` of sessions, a `Badge` for "this device", `IconButton`/`Button` per-row revoke,
  a top-level "Sign out other sessions" `Button` with a `ConfirmDialog` since it is destructive to more
  than one row at once).
- Light + dark: everything above is composed from existing `lib/ui` components/tokens, so both themes
  follow from those components already supporting both — no new theming work.

## Design / implementation notes

- **Interfaces & adapters touched:** `UserRepo`, `SessionRepo` (both ports + pg + memory adapters),
  `SessionService`, a new `PasswordHasher` port (`bcryptjs` adapter + fixed test adapter), `guard.ts`
  (pure decision), `hooks.server.ts` (onboarding-gate cache + `sessionId` local), `container.ts`
  (`passwordHasher` field), `app.d.ts` (`sessionId` local type), `logger.ts` (`REDACT_KEYS`).
- **Race safety on create:** `admin-users.api.ts`/`onboarding.api.ts` pre-check `findByEmail`/
  `findByUsername` before calling `createLocal`, but a concurrent create can still hit the DB's unique
  index first — the handler catches the underlying Postgres unique-violation (`23505`) and maps it to the
  same `409 { error: 'email_taken' | 'username_taken' }` response rather than a raw `500`.
- **`event.getClientAddress()`**, not hand-parsed `X-Forwarded-For`: normal SvelteKit routes (unlike
  `/mcp`, which bypasses `hooks.server.ts` entirely per spec 055) go through the adapter-node-aware
  built-in, so no new trust-proxy flag is needed for this spec.
- **Edge case — Google identity with no email:** treated as a verification failure (existing generic
  `401`), not a new user-facing message; this should be rare (Google's `openid email profile` scope,
  requested since spec 012, normally guarantees it).
- **Edge case — onboarding vs. an in-flight session from before this spec:** covered under "Upgrade note"
  above; deliberately not special-cased further.
- **Edge case — self-hosted operator deletes the last admin by hand in the DB:** explicitly unsupported;
  the app falls back into onboarding-needed state (by construction of `existsAdmin()`), which is a
  reasonable, if blunt, recovery path and not a bug.

## Test plan

- **Unit:**
  - `guard.test.ts`: every branch of the new `onboarding_required` decision (onboarding page pre/post
    admin, api vs page path, static asset passthrough, health check exemption).
  - `password-policy.test.ts`: email/username/password/confirm boundary cases (min/max length, byte vs.
    character length for passwords, case normalization).
  - `password.test.ts` (the hasher adapter): `createBcryptHasher` round-trips a hash/verify pair and
    rejects a wrong password; `createFixedPasswordHasher` is deterministic and never touches `bcryptjs`.
  - `account.ua.test.ts`: `describeUserAgent` on a handful of representative UA strings + a null/empty
    fallback.
  - `onboarding.validate.test.ts`, `admin-users.validate.test.ts` (shared rules exercised from each
    caller's own module, in case a future edit only updates one call site).
- **API integration (mock adapters, in-memory repo):**
  - `onboarding.api.test.ts`: creates the first admin; rejects a second `createInitialAdmin` once one
    exists (`already_onboarded`); rejects mismatched/weak passwords and duplicate email/username without
    writing anything.
  - `auth.api.test.ts` (extended): `loginWithPassword` success (by username, by email), the three-way
    identical-401 case (wrong password / unknown identifier / Google-only account); `completeCallback`
    signs in an existing email match, backfills `google_sub` on first Google use of a password account,
    and rejects (no create) an unmatched email, asserting the fake logger never received email/sub/token
    fields.
  - `admin-users.api.test.ts`: list/create/edit/reset-password/delete happy paths; 403 for a non-admin
    caller on every endpoint; 409 on duplicate email/username; 409 on demoting/deleting the sole admin,
    with a success case once a second admin exists.
  - `account.api.test.ts`: `getAccountInfo` shape (never includes a hash); `setOwnPassword` set-when-none
    vs. change-with-current-password (including a wrong-current-password 401); `listOwnSessions`/
    `revokeOwnSession`/`revokeOtherSessions` scoped strictly to the caller (a session belonging to a
    different user id is never returned or deletable via these endpoints, asserted directly).
  - `repo` contract tests (both pg — skipped without `TEST_DATABASE_URL` — and memory adapters, per this
    repo's existing convention): every new `UserRepo`/`SessionRepo` method, including the `users_email_idx`
    /`users_username_idx` uniqueness and the `sessions` cascade-on-delete.
  - `home-payload.test.ts` (updated): the logged-out short-circuit case is removed; a new case in
    `guard.test.ts`/an equivalent route-level test confirms `/` never runs the per-user load for a
    logged-out visitor (it never reaches the loader at all — the guard redirects first).

## Closeout

- Commits: <hashes/links — user to fill in on commit>
- Implemented via `module-dev` subagent; verified by `qa-closer` on 2026-08-24.
- Verification performed: read every touched file against the spec (migrations, `schemaSql`,
  `UserRepo`/`SessionRepo` ports + pg/memory adapters + shared contract test, `guard.ts`/`hooks.server.ts`
  onboarding gate, `auth.api.ts` (Google auto-link + password login), `onboarding.api.ts`,
  `admin-users.api.ts` (incl. last-admin guard), `account.api.ts` (incl. session-scoping), `password.ts`/
  `password-policy.ts`, `logger.ts` `REDACT_KEYS`, all new routes under `/onboarding`, `/login`,
  `/auth/login`, `/admin/users`, `/api/admin/users/**`, `/api/account/**`, `/settings`, and the `NavLinks`/
  `+layout.server.ts` admin-link gating) — not just the implementer's summary.
- Ran `pnpm run verify` (test + check + lint + build) from a clean state in `apps/web`: **214 test files,
  2927 tests passed, 8 skipped** (the skipped are the Postgres-only halves of contract tests that require
  `TEST_DATABASE_URL`, per this repo's existing convention — not run against a real Postgres in this
  session; the pg adapter was verified by code review only, consistent with the project's own
  "green verify ≠ working adapter" caveat for that path). `svelte-check`: 0 errors/warnings. `prettier
  --check`: clean. `pnpm run build` (SvelteKit + MCP bundle): succeeded.
- Spot-checked the trickier guarantees directly in code (not just via tests, though tests cover all of
  them too):
  - Last-admin guard: `admin-users.api.ts`'s `updateUser`/`deleteUser` call `countAdmins()` and reject with
    `409 { error: 'last_admin' }` when demoting/deleting the sole admin; succeeds once a second admin
    exists. Covered by `admin-users.api.test.ts`.
  - Password-login enumeration resistance: `loginWithPassword` returns the exact same
    `{ ok: false, status: 401, error: t('auth.invalidCredentials') }` object for an unknown identifier, a
    Google-only account (`passwordHash === null`), and a wrong password — asserted directly in
    `auth.api.test.ts` (`wrongPassword` === `unknownIdentifier` === `googleOnlyLogin`).
  - Google auto-link-no-auto-create: `completeCallback` looks up by `googleSub` then `email`; on no match
    it logs `'google sign-in rejected: no matching account'` with **no metadata argument at all** (verified
    the call site directly, not just the redaction regex) and creates nothing; on an email match it calls
    `linkGoogle`, which only backfills a **null** `google_sub` (`COALESCE(google_sub, …)` in the pg
    adapter; `existing.googleSub ?? identity.googleSub` in memory) — never overwrites an existing one.
  - IP/UA never reach the logger: grepped every new module + route for `logger.*(` calls — the only one is
    the no-match warning above, which passes no meta object; `REDACT_KEYS` also covers `ip_?address`/
    `user_?agent` as a backstop, tested in `logger.test.ts`.
  - Onboarding gate permanence: `hooks.server.ts`'s `adminExists` module-level flag only ever flips
    `false → true`, never re-checked once true — matches the spec's documented caching tradeoff exactly.
- Notes / follow-ups:
  - Minor: `modules/account/account.ua.ts`'s `describeUserAgent` fallback string `'Unknown device'` (and
    the raw-UA passthrough for an unrecognized string) is hardcoded English, not routed through i18n —
    the one place in this spec's new user-facing surface that isn't in both `en.ts`/`pl.ts`. It only
    surfaces for a missing or unrecognized User-Agent (an edge case: pre-094 session rows, non-browser
    clients), and the recognized browser/OS tokens it otherwise returns ("Chrome", "Windows", "macOS", …)
    are proper nouns that are conventionally left untranslated anyway. Flagged rather than blocking close;
    a follow-up could move `'Unknown device'` into the catalog and have the component call `i18n.t()` on
    it instead of returning it from the pure function.
  - Suggested follow-up (not required by this spec): an admin-wide sessions view under `/admin/users`,
    reusing `SessionRepo.listByUser`/`delete` against an arbitrary user id instead of the caller's own.
  - Open question: should the Google "Continue with" button hide itself entirely when
    `GOOGLE_CLIENT_ID`/`SECRET` are unset, rather than always rendering next to the password form? Left
    as-is (always shown) for this spec; worth revisiting once a self-host-without-Google deployment
    actually exists.
