# Spec 068 — Update check in Settings

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/version/`
- **Owner agent:** module-dev
- **Depends on:** 019 (live-code stack + build stamp)

## Context

The sidebar shows when the running bundle was built, and that is all anyone can see. When a deploy
silently fails to arrive, the stamp looks perfectly normal — there is nothing to compare it against,
so "is this the newest code?" is unanswerable from inside the app. That question came up after a push
appeared to land and the running app stayed on an older build.

This adds the missing half: a Settings card that asks GitHub for the newest commit on the tracked
branch and says whether the running build predates it. It **reports** only. Pulling and running new
code from a request handler would turn any authenticated session into remote code execution on the
host, so applying an update stays a deliberate, manual act outside the app.

## Requirements (acceptance criteria)

- [x] Settings shows the running build's timestamp (and sha when the build had git metadata)
- [x] A button checks GitHub for the newest commit on the configured repo/branch — nothing runs on
      page load, so a page view never spends an API call
- [x] "Behind" is decided by comparing commit TIME to build TIME, not shas: the production container
      builds from a bind mount containing no `.git`, so `__BUILD_SHA__` is empty exactly where the
      answer matters most
- [x] When behind, the card names the commit (short sha, subject, date) and links to it
- [x] No `GITHUB_TOKEN` → "not configured" with a pointer at the fix, distinct from a failure
- [x] GitHub unreachable, rejecting, or returning an unexpected payload → a warning state; the card
      never throws and the build stamp still renders
- [x] The token never appears in a log line or an error message
- [x] `/api/version` requires a session (it is not in the guard's `PUBLIC_APIS`)
- [x] The app never applies an update itself
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

```
GET /api/version    req: —    res: UpdateStatus    errors: 401 → { error: 'unauthorized' }
```

`UpdateStatus` (`version.types.ts`):

```ts
{
  buildTime: string;            // ISO, __BUILD_TIME__ of the running bundle
  buildSha: string;             // '' when the build saw no git metadata (the production case)
  state: 'ok' | 'not-configured' | 'unreachable';
  latest: { sha: string; committedAt: string; subject: string; url: string } | null;
  behind: boolean;
  checkedAt: string;            // ISO
}
```

A failed upstream check is a **200 with `state: 'unreachable'`**, not a 5xx: "I could not ask" is a
normal answer to this question, and the build half of the card is still valid.

## UI

`UpdateCard.svelte` in Settings, built from `Card`, `Button`, `Badge`, `Spinner` and tokens only.
States: idle (build stamp + button) · checking (spinner) · `Aktualna` (success badge) · `Dostępna
nowsza wersja` (warning + commit row + what-to-do-next line) · `Sprawdzanie nieskonfigurowane`
(neutral + token hint) · `GitHub nieosiągalny` (warning) · `Nie udało się sprawdzić` (danger, when
the endpoint itself fails). Instants render via `formatInstant` in the app zone on first paint and
the browser zone after mount, matching `AppShell` (spec 018). Light/dark come from the tokens.

## Design / implementation notes

- **Injected, per golden rule 4:** `checkForUpdate` takes `fetch`, `clock`, `logger`, repo/branch,
  token and both build stamps. The route reads the Vite `define` literals at the edge and passes them
  in, so the handler stays a pure function of its dependencies and is fully testable offline.
- **Config:** `GITHUB_TOKEN` (default `''`), `UPDATE_CHECK_REPO`, `UPDATE_CHECK_BRANCH`. The token
  being optional is deliberate — an existing deployment upgrades into this with no `.env` change and
  simply sees "not configured".
- **Logging:** only the HTTP status and repo are logged on failure. Response bodies are never logged,
  since GitHub echoes request context and the request carries the token.
- **Private repo:** anonymous reads 404, which is why a token is required at all rather than optional
  polish. `encodeURIComponent` on the branch keeps `release/v2`-style names in one path segment.

## Test plan

- **Unit / API integration (`version.api.test.ts`, mock fetch — 8 tests):** no token → no call at all;
  newer commit → `behind`; older commit → up to date; correct URL and `Authorization` header for a
  configured repo/branch; non-2xx → `unreachable`; network throw → `unreachable`; unexpected payload →
  `unreachable`; the token never reaches a log line.
- **Component (`UpdateCard.svelte.test.ts`, 6 tests):** build stamp renders with no fetch on mount;
  behind names and links the commit; up to date offers no next step; not-configured points at the
  token; unreachable warns; endpoint failure surfaces an error.

## Closeout

- Commits: this change.
- Notes / follow-ups:
  - `__BUILD_SHA__` is empty in production because the web container mounts `apps/web`, which contains
    no `.git`. Mounting the repo root read-only would populate it and allow an exact sha comparison —
    a compose change, deliberately not bundled here.
  - Deploying remains manual. This spec makes the gap **visible**; closing it is a separate decision.
