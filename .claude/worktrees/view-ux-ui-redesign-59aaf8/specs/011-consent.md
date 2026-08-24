# Spec 011 — Consent & feature gating (per-feature terms)

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/consent/`, `apps/web/src/lib/server/consent/`, `routes/api/consent/`
- **Owner agent:** module-dev
- **Depends on:** 003 (server core / container), 001 (UI); gates 010 (detailed analytics)

## Context

Some features process more of the user's Garmin data than the baseline and should require explicit, versioned
consent before they turn on — while stateless features (the MCP surface) need no consent. This introduces a small
feature registry with per-feature terms and a consent store, plus a service that resolves whether each feature is
effectively enabled. The multi-day "detailed analytics" trends (spec 010) are gated by it; the MCP feature is
declared consent-free. Consent records are plain (non-secret) preferences kept in a JSON file, separate from the
encrypted Garmin token store.

## Requirements (acceptance criteria)

- [x] `Feature = { id, title, summary, termsVersion, termsText, requiresConsent, defaultEnabled }` defined; a static registry lists features
- [x] Registry includes `mcp` (`requiresConsent:false`, `defaultEnabled:true`, stateless / stores nothing) and `detailed_analytics` (`requiresConsent:true`, gates multi-day trends)
- [x] Port `ConsentStore` with `get(): Record<featureId, {termsVersion, acceptedAt}>`, `set(featureId, termsVersion)`, `revoke(featureId)`
- [x] File-backed `ConsentStore` adapter persists plain JSON at an injected path (NOT a secret; separate from the Fernet token store); an in-memory mock adapter exists for tests
- [x] `ConsentStore` is injected via the container (new config key for the consent file path)
- [x] `ConsentService` resolves effective enablement: enabled if `!requiresConsent` OR a consent record exists for the CURRENT `termsVersion`; a `termsVersion` bump re-prompts (stale record no longer enables)
- [x] `GET /api/consent` returns features with status; `POST /api/consent {featureId, termsVersion, accept}` records (`accept:true`) or revokes (`accept:false`); mismatched/stale `termsVersion` → 409
- [x] Consent module UI: terms + Accept panel used by the dashboard when `detailed_analytics` is not granted, and a settings surface to review/revoke
- [x] Built only from `lib/ui` components + design tokens; accessible terms text + labeled Accept/Revoke controls
- [x] Unit + API-integration tests pass (no e2e)
- [x] No secrets logged or committed (consent JSON holds no credentials/PII/tokens)

## API contract

```
GET  /api/consent
     res: { features: [{ id, title, summary, termsVersion, requiresConsent, enabled, acceptedAt? }] }   200
POST /api/consent   req: { featureId, termsVersion, accept: boolean }
     res: { feature: { id, termsVersion, enabled, acceptedAt? } }                                        200
     res: { error }   400 (bad body / unknown feature) | 409 (termsVersion mismatch)
```
Types: `apps/web/src/modules/consent/consent.types.ts`; server contracts in
`apps/web/src/lib/server/consent/` (`Feature`, `ConsentStore`, `ConsentService`).

## UI

`consent/` module: a `ConsentPanel.svelte` (terms summary + full `termsText` + Accept `Button`) embedded by the
dashboard trends region (spec 010) when `detailed_analytics` is not enabled; a settings surface listing features
with `Badge` status and Accept/Revoke actions. States: loading (`Spinner`), granted (status badge + Revoke),
needs-consent (terms + Accept), version-bumped (re-prompt notice). Composed from `lib/ui`; light + dark via tokens.

## Design / implementation notes

- **Ports & adapters:** `ConsentStore` file adapter takes an injected path + injected file I/O + `Clock`
  (`acceptedAt` from the clock, never `Date.now()` inline). Container gains `consentStore` and `consent`
  (`ConsentService`) plus a config key for the file path; `createTestContainer` wires the in-memory mock.
- **ConsentService** is pure over the store + registry: `listFeatures()` returns each feature with its resolved
  `enabled`; `isEnabled(featureId)`; `accept(featureId, termsVersion)` rejects a version mismatch; `revoke(featureId)`.
- **Registry** is the single source of truth for `termsVersion`/`termsText`; bumping a version invalidates prior
  acceptances by construction (records store the accepted version).
- **Edge cases:** unknown feature id → 400; posting a stale `termsVersion` → 409 (client must re-fetch terms);
  revoking a `requiresConsent:false` feature is a no-op (still reports enabled); missing/corrupt consent file
  treated as "no records" (all consent-required features disabled).

## Test plan

- **Unit:** `ConsentService` — default-on for `!requiresConsent` (mcp); `detailed_analytics` disabled until
  accepted; accepting the current version enables it; a `termsVersion` bump re-prompts (previously-accepted
  becomes disabled); revoke disables. `ConsentStore` file adapter round-trip via injected I/O.
- **API integration (mock store):** `GET /api/consent` shape; `POST` accept enables + returns `acceptedAt`;
  `POST` with stale `termsVersion` → 409; unknown feature → 400; `accept:false` revokes.
- **Component:** `ConsentPanel` renders terms + Accept in needs-consent state and status + Revoke when granted;
  tokens only, light/dark.

## Closeout

- Commits: <pending>
- Notes / follow-ups: consent file path env key to be added to `.env.example` and AGENTS.md §11 during implementation.
