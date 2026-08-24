# Spec 005 — Garmin setup flow (login + optional MFA)

- **Status:** Closed
- **Module:** `apps/web/src/modules/garmin-setup/`, `routes/api/garmin/{setup,disconnect}/`
- **Owner agent:** module-dev
- **Depends on:** 003 (GarminService), 002 (sidecar), 001 (UI)

## Context

To read Garmin data the user connects their account once. Credentials are forwarded to the sidecar, which
returns tokens; if Garmin demands MFA the flow reveals a code field and completes the challenge. Credentials
are never stored by the web service.

## Requirements (acceptance criteria)

- [x] `POST /api/garmin/setup` forwards email/password (+ optional mfaCode) via `GarminService.login`
- [x] Outcomes mapped: success → 200, mfa_required → 202, invalid → 401, bad body → 400, sidecar down → 503
- [x] `SetupForm` reveals an MFA-code field on 202 and resubmits to complete
- [x] `POST /api/garmin/disconnect` clears stored tokens
- [x] UI from `lib/ui`; credentials never logged
- [x] Integration tests pass

## API contract

```
POST /api/garmin/setup  { email, password, mfaCode? }
  -> 200 { outcome:'success', displayName } | 202 { outcome:'mfa_required' }
   | 401 { outcome:'invalid_credentials' } | 400 { error } | 503 { error }
POST /api/garmin/disconnect -> 200 { ok:true } | 503 { error }
```
Types: `modules/garmin-setup/setup.types.ts`.

## UI

`SetupForm.svelte` — email/password fields; on `mfa_required` reveals a one-time-code field and a "Start over".
Shown on the dashboard when not connected.

## Test plan

- **Integration:** `setup.api.test.ts` — success/displayName, mfa_required (202), invalid (401), validation (400),
  sidecar outage (503).

## Closeout

- Files: `modules/garmin-setup/{setup.types,setup.api,SetupForm.svelte}` + test,
  `routes/api/garmin/{setup,disconnect}/+server.ts`.
