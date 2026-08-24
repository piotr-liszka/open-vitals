# Spec 030 — The sidecar must survive a Postgres that is not there yet

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `services/garmin/`
- **Owner agent:** garmin-integrator
- **Depends on:** 012 (per-user token table in Postgres)

## Context

The sidecar dies at boot when Postgres is not reachable yet:

```
File "/app/app/tokens.py", line 186, in _connect
psycopg.OperationalError: connection failed: connection to server at "172.26.0.3", port 5432 …
ERROR: Application startup failed. Exiting.
```

`ensure_ready()` runs in the FastAPI lifespan and raises, uvicorn refuses to start, and with
`restart: "no"`/`on-failure` the container ends up **Stopped** — the app then reports "Garmin
niedostępny" until a human presses Start. Commit `d6d640f` addressed this at the orchestration layer
(`depends_on: db: condition: service_healthy`), but that gate only applies to `docker compose up`:
restarting the single container from Container Manager, a Postgres bounce, or a daemon restart all
reproduce it. It was seen again on the 2026-08-11 deploy.

The durable fix belongs in the process: one unreachable dependency at startup should be *retried*,
not fatal. A sidecar that is up and reporting a classified failure is strictly better than a sidecar
that is gone — the web tier already renders that reason on `/dane` (spec 019).

## Requirements (acceptance criteria)

- [x] `PostgresTokenStore.ensure_ready()` **retries** the connect + `CREATE TABLE IF NOT EXISTS`
      with bounded backoff (~60 s total) before giving up.
- [x] When the retries are exhausted, startup **does not fail**: the error is logged and the sidecar
      serves, so `/status` answers and the web tier can classify the failure.
- [x] The table is prepared **lazily on first use** if startup never managed it, so the sidecar heals
      itself once Postgres appears — without a restart.
- [x] Once prepared, no extra query is added to any token operation (the ready flag latches).
- [x] Failure logs never contain the DSN password (or any token/ciphertext/user id).
- [x] A store that is ready on the first attempt does not sleep at all (fast, ordinary startup).
- [x] pytest suite passes with `psycopg` mocked at the boundary (no real Postgres).

## API contract

N/A — no HTTP surface changes. Internal port contract:

```
TokenStore.ensure_ready()          # best effort; must not raise on a missing backing store
PostgresTokenStore(dsn, key, *, sleep=time.sleep)   # `sleep` injected for deterministic tests
```

## UI

N/A (sidecar). The visible effect is that `/dane` shows a classified reason
(`sidecar_unreachable` → real Garmin/DB errors) instead of the whole sidecar being down.

## Design / implementation notes

- `_prepare()` holds the single connect + `CREATE TABLE` step. `ensure_ready()` wraps it in the retry
  loop; `_ensure_table()` (called at the top of each read/write/delete/exists) retries it lazily and
  latches `self._ready`, so the steady-state path is unchanged.
- Backoff schedule `1, 2, 4, 8, 15, 15, 15` seconds (~60 s), matching the `pg_isready` healthcheck
  window in compose (20 retries × 5 s). `sleep` is injected — tests assert the schedule without
  waiting for it (AGENTS.md §7: no wall-clock in a tested unit).
- Logs carry the exception **type** plus a redacted message: `_redact_dsn()` strips
  `scheme://user:password@` credentials from anything psycopg puts in the text (§10).
- Compose keeps its health gate and `restart: on-failure` — they now read as optimisations (no
  failed-connect noise at boot) rather than as the thing keeping the service alive; the stale comments
  saying "this service exits on a failed DB connect" were corrected in the same change.

## Test plan

- **Unit (pytest, psycopg mocked):**
  - ready on the first attempt ⇒ table created, zero sleeps
  - fails twice then succeeds ⇒ succeeds, sleeps follow the schedule prefix
  - always fails ⇒ `ensure_ready()` returns (no raise), error logged, DSN password absent from logs
  - after an exhausted startup, the next `load()`/`save()` prepares the table and works (self-heal)
  - once ready, a token operation issues no extra `CREATE TABLE`
- **Existing suite:** unchanged behaviour for `InMemoryTokenStore` and every route.

## Closeout

- Commits: `49bcb9d` — fix(sidecar): survive a cold Postgres at startup (spec 030)
- Notes / follow-ups: `docker-compose.image.yml` (the unused prebuilt-image stack) still has a plain
  `depends_on: [db]` with no healthcheck — the racy variant. It needs no change now that the process
  retries, but if that stack is ever adopted, give `db` the same `pg_isready` healthcheck for parity.
  The web tier already had the equivalent behaviour: a failed `migrate()` resets its promise and is
  retried on the next request.
