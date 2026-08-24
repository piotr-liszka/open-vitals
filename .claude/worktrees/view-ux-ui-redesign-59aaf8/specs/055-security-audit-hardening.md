# Spec 055 — Security audit & hardening pass

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** cross-cutting (`apps/web/src/lib/mcp`, `lib/server`, `services/garmin`, compose)
- **Owner agent:** module-dev
- **Depends on:** 012 (multi-user auth), 014 (tiers), 019 (diagnostics), 050 (workout push)

## Context

A full security review of the app's endpoints, configuration and trust boundaries. The architecture
held up well — per-user scoping, PKCE + nonce-verified OIDC, opaque DB-backed sessions, parameterised
SQL, and a sidecar that validates every path parameter were all already correct. What the review
turned up were gaps at the *edges*: a secret committed to the repo, an unmetered unauthenticated
endpoint, two trust boundaries AGENTS.md §10 itself listed as open follow-ups, and — the structural
finding — a `server.js` that hand-rolled its own untested copies of the security controls the rest
of the app is held to.

This spec is that review plus the fixes.

## Requirements (acceptance criteria)

- [x] The committed Fernet token blob is removed from the working tree and `.gitignore` refuses the pattern
- [x] `/mcp` bounds unauthenticated token guessing before they reach the database
- [x] `/mcp` responses carry the same hardened headers as every SvelteKit response, from one source
- [x] The sidecar can require proof that a caller is the web tier, not merely that it reached the port
- [x] Expired sessions are deleted, not merely refused
- [x] Log redaction reaches secrets nested inside objects and arrays
- [x] `img-src` no longer allows the entire public internet
- [x] The dev database is not published to the local network
- [x] Unit + API-integration tests pass (no e2e) — 1618 web, 175 sidecar
- [x] Built only from `lib/ui` components + design tokens (if UI) — N/A, no UI change
- [x] No secrets logged or committed

## Findings

Severity is relative to this deployment: self-hosted, internet-reachable, one household.

### 1. A live encrypted token store was committed (High)

`services/garmin/tokens.enc` — 4 KB of Fernet ciphertext wrapping real Garmin session tokens — was
tracked from the `init` commit. Dead code by then (spec 012 moved tokens to Postgres; the sidecar
Dockerfile even says "no disk volume is needed"), but the ciphertext is real. It breaks golden rule
#1, and pairs a stolen `TOKEN_ENCRYPTION_KEY` with a ready-made target.

Fixed by deleting it and adding `*.enc` to `.gitignore`.

**This does not rewrite history** — the blob is still reachable in the `init` commit. See Closeout.

### 2. `/mcp` token guessing was unmetered (High)

`server.js` resolved the presented token to a user id *before* any rate limiting, and keyed its
limiter on the **resolved** user. An unauthenticated caller could therefore spend unlimited guesses,
each buying a database round-trip, against the one endpoint published without a session. The tokens
are 32 CSPRNG bytes so guessing them is infeasible — the exposure is the free query amplification,
on the app's only unauthenticated write-capable surface.

Fixed with a second limiter keyed by client IP and charged **only on a rejected token**, checked
before the lookup. Legitimate clients produce no auth failures and so never consume it.

### 3. `server.js` re-implemented the security controls (High, structural)

`/mcp` does not pass through `hooks.server.ts`, so it had its own hand-written copies of the
security headers and the rate limiter — plain JavaScript, no tests, free to drift. It already had:

- **Header drift.** It set 4 headers where `securityHeaders()` sets 6; `Permissions-Policy` and
  `X-DNS-Prefetch-Control` were missing from every `/mcp` response.
- **An eviction bug.** Its `Map` cap deleted the *first-inserted* key, which for a long-lived caller
  is the busiest one — evicting exactly the limit state that mattered.
- **A body-reader bug.** The 1 MB cap counted UTF-16 code units of a decoded string, not bytes; and
  on tripping the cap it called `req.destroy()` without ever settling its promise, so the awaiting
  handler and its MCP server + transport stayed pinned until the socket dropped.

Fixed by moving all of it into `src/lib/mcp/http.ts` — pure over injected dependencies, reusing the
already-tested `securityHeaders()` and `createRateLimiter()`. `server.js` is now transport only.

The same LRU-eviction bug existed in `createRateLimiter`, where a *blocked* key was not re-seated —
so an actively-throttled caller was the stalest entry and first to be evicted, handing them a fresh
budget precisely when the limiter should have held them back. Caught by a test written for this spec.

### 4. The sidecar trusted `X-User-Id` alone (High) — AGENTS.md §10 follow-up

The sidecar identifies the user solely from a request header. That header is an *assertion*: anything
that could reach port 8081 on the Docker network could name any user and read their Garmin data. Only
network topology stood between a compromised container and every user's health history.

Fixed with `INTERNAL_API_KEY` — a shared secret the web tier sends as `X-Internal-Key`, compared with
`hmac.compare_digest`, enforced in **middleware** so a future route is covered without opting in.

Deliberately optional: unset means "as before", because an in-place upgrade lands in exactly that
state and refusing to boot would take a running deployment down before its `.env` could be edited.
Both services warn loudly at startup when it is unset. **The guardrail is inert until you set it.**

### 5. Expired sessions were never deleted (Medium) — AGENTS.md §10 follow-up

`resolve` correctly refuses an expired session, but the row stayed forever. Not an access-control
bug; it grows the table without bound and leaves expired-but-valid-looking ids sitting in every
database backup. Fixed with `sweepExpired()`, run on the existing scheduler tick.

### 6. Log redaction was one level deep (Medium)

`redact()` masked top-level keys only, so the shape secrets actually arrive in — a nested provider or
error payload, e.g. `{ response: { access_token } }` — was written out verbatim. Fixed by walking
objects and arrays, with a depth cap, a cycle guard, and `Error` summarised to name + message.
`credential` and `session` were added to the key pattern.

### 7. CSP `img-src` allowed the entire internet (Medium)

`img-src` was `['self', 'data:', 'https:']`. Under an otherwise strict policy, that blanket `https:`
was the one directive leaving a working exfiltration channel: injected markup could send anything
readable from the DOM to any host as an image URL. Narrowed to the two origins actually used —
`lh3.googleusercontent.com` (avatars) and `*.basemaps.cartocdn.com` (map tiles).

### 8. The dev database was published to the network (Low)

`docker-compose.dev.yml` mapped `5433:5432`, which binds `0.0.0.0` — publishing a Postgres whose
password is the literal string `garmin`, printed two lines above, to every machine on the network.
Bound to `127.0.0.1`.

### Reviewed and found correct

Worth recording so the next review can skip them: OIDC (PKCE `S256`, `state`, JWKS-verified
`id_token`, `nonce` compared constant-time), session cookies (`httpOnly`, `SameSite=Lax`, `Secure` in
prod), the `authGuard` allow-list (exact/segment matches — no prefix traps), Postgres access
(parameterised throughout, ids from the CSPRNG, never derived from input), per-user scoping of every
handler and MCP tool, sidecar input validation (the `_workout_id_param` allow-list in particular),
Garmin credentials never persisted, both containers running non-root, and `loadConfig` refusing mock
adapters in production.

## API contract

No request/response contract changes. Two behavioural additions on `/mcp`:

```
POST /mcp   401 {"error":"unauthorized"}   — unknown/absent token (unchanged)
POST /mcp   429 {"error":"rate_limited"} + Retry-After
              — NEW: too many rejected tokens from one client IP
              — existing: too many requests from one resolved user
```

Sidecar, when `INTERNAL_API_KEY` is set:

```
ANY  /*     401 {"detail":"unauthorized"}  — missing/incorrect X-Internal-Key (except /health)
```

## UI

N/A — no user-facing change. The CSP narrowing is invisible unless the map tile host changes, which
is now called out in `LeafletMap.svelte`'s header comment.

## Design / implementation notes

- `src/lib/mcp/http.ts` is the new policy home: `mcpGate`, `extractMcpToken`, `clientIpOf`,
  `readJsonBody`. Pure over injected deps (AGENTS.md §2 rule 4); `server.js` holds no policy.
- `RateLimiter` gained `peek()` — a failure-only limiter must be able to read standing without
  charging a legitimate request for it.
- `SessionService` gained `sweepExpired()`; `SessionRepo` gained `deleteExpired(before)`, implemented
  in both the pg and memory adapters.
- `X-Forwarded-For` is honoured only under `MCP_TRUST_PROXY=on`. Off by default, because an untrusted
  `XFF` lets one client mint unlimited fresh limiter buckets — worse than no limiter. With it off,
  everything behind a proxy shares one bucket, which is acceptable *only* because that bucket counts
  failures, which legitimate traffic does not produce.

## Test plan

- **Unit:** `mcpGate` (serve / 401 / 429, per-IP isolation, no-lookup-when-blocked, header parity,
  HSTS only on https), `extractMcpToken`, `clientIpOf`, `readJsonBody` (byte-accurate cap, settles on
  overflow, stream error), `peek` semantics, LRU eviction, recursive redaction (nested, arrays,
  cycles, depth), `sweepExpired`.
- **API integration (mock adapters):** scheduler sweeps once per tick and a failed sweep does not
  cost anyone their sync.
- **Sidecar (pytest):** every Garmin-touching route gated (parameterised over 11 routes), `/health`
  open, wrong/missing/correct key, unset key stays open, constant-time comparison.
- **Manual smoke:** built `server.js` run against the real bundle — verified 401 → 429 with the full
  six-header set and `Retry-After`.

## Closeout

- Commits: see `chore(security): audit findings and hardening pass (spec 055)`
- Notes / follow-ups:
  - **Action required for finding 4.** Set `INTERNAL_API_KEY` in `.env` (`openssl rand -base64 32`);
    compose passes it to both services. Until then the guardrail is off and both services warn.
  - **Action required for finding 1.** `tokens.enc` remains in the `init` commit. If that history is
    ever pushed somewhere less private, treat those Garmin tokens as compromised: disconnect and
    reconnect Garmin (which mints fresh tokens) and rotate `TOKEN_ENCRYPTION_KEY`. Purging it needs a
    history rewrite (`git filter-repo`), which is a force-push and was left as the owner's call.
  - **Not done: hashing MCP tokens and session ids at rest.** Both are stored in plaintext, so a
    leaked database or backup yields directly usable credentials. Hashing session ids is free;
    hashing MCP tokens is not, because Settings re-displays the URL on every visit — hashing forces
    show-once UX. Deferred rather than shipped as a surprise product change. Note the exposure is
    second-order: an attacker who can read the database can already read the health data itself.
  - The MCP token travels in a query string (`/mcp?token=`). That is the product's copy-paste UX and
    is why `Referrer-Policy` is set; the `Authorization: Bearer` form is supported for clients that
    prefer it.
