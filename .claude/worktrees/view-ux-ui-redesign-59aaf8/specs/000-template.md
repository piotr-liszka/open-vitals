# Spec NNN — <feature name>

- **Status:** Draft <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/<feature>/` <!-- or services/garmin -->
- **Owner agent:** <spec-writer | module-dev | ui-designer | garmin-integrator>
- **Depends on:** <spec numbers or "none">

## Context

Why this feature exists — the problem/need, what prompted it, the intended outcome. 2–5 sentences.

## Requirements (acceptance criteria)

Each item is a checkbox that must be **true** before the spec can be `Closed`.

- [ ] …
- [ ] …
- [ ] Unit + API-integration tests pass (no e2e)
- [ ] Built only from `lib/ui` components + design tokens (if UI)
- [ ] No secrets logged or committed

## API contract

Request/response shapes for any endpoint or MCP tool this feature adds. Reference the `*.types.ts` file.

```
METHOD /api/…        req: { … }   res: { … }   errors: 4xx/5xx → …
```

## UI

Which `lib/ui` components are used; states (loading/empty/error/success); light + dark behavior. "N/A" if backend-only.

## Design / implementation notes

Interfaces & adapters touched (ports & adapters). What is injected. Any edge cases (e.g. MFA required, sidecar down).

## Test plan

- **Unit:** …
- **API integration (mock adapters):** … assert status + JSON contract
- **Sidecar (pytest), if applicable:** …

## Closeout

- Commits: <hashes/links>
- Notes / follow-ups:
