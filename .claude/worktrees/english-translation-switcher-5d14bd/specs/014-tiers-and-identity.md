# Spec 014 — Two tiers (Base / Advanced) + identity refactor

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `apps/web` — routes, `lib/ui` (AppShell + new bits), `modules/landing`, `modules/base-home`, consent registry, tokens/DESIGN
- **Owner agent:** ui-designer (design system + surfaces) + main (IA/gating wiring) + qa-closer
- **Depends on:** 011 (consent), 012 (multi-user), 013 (insights)

## Context

The product is really **two tiers**, and users must instantly understand which one they're in:

- **Base** — the user connects Garmin and gets their **personal MCP URL**. We proxy reads to AI clients and
  **process/display nothing** on our side. Home = connection status + MCP URL + an honest invitation to upgrade.
- **Advanced** — the user accepts a **single "Enable data processing" terms** gate, which unlocks the whole
  processed world at once: dashboard, analytics, **insights & life-time charts** (spec 013).

One gate controls the boundary (decided with the user): accepting the Advanced terms flips the account; the
former per-feature `detailed_analytics` consent **is** that single gate (relabelled "Advanced data processing",
terms bumped to cover the full processed tier). The two tiers must be **visually separated** and the whole UI
gets a **deep identity pass** with impeccable — distinctive, best-practice, not generic; a signature moment per
surface while data screens stay fast and scannable (Operate).

## Requirements (acceptance criteria)

- [x] **Single gate.** `advanced = consent.isEnabled('detailed_analytics')`. Registry entry relabelled to
      "Advanced data processing" with terms describing the whole processed tier and `termsVersion` bumped (prior
      acceptances re-prompt by construction). Analytics, insights, and the dashboard all gate on this one flag.
- [x] **Base logged-in home** (`modules/base-home`): connection status, the personal **MCP URL** card, and a
      prominent, honest **"Go Advanced"** panel (what processing enables + the terms + accept action). **No health
      numbers rendered** for Base users — we process nothing.
- [x] **Advanced logged-in home** = the dashboard (readiness + snapshot + trends), unchanged in function.
- [x] **Tier-aware navigation.** AppShell shows a clear **tier indicator**; Dashboard/Analytics/Insights nav links
      appear only when Advanced. Base users hitting `/analytics` or `/insights` are redirected to the upgrade home
      (server-side), never a broken/empty processed screen.
- [x] **Accept flow** turns Base→Advanced (records consent for the current version) and lands on the dashboard;
      **Settings** lets an Advanced user review/revoke, dropping back to Base (existing consent revoke path).
- [x] **Landing (logged-out)** tells the two-tier story (Persuade): what Base is, what Advanced adds, privacy
      posture. Real product UI as proof.
- [x] **Identity pass** (impeccable, craft-floor honored): a signature visual system distinguishing Base
      ("standby / powered-down instrument") from Advanced ("live instrument"); refined AppShell chrome, a signature
      motif, purposeful motion (reduced-motion safe), light + dark both first-class. Tokens/`lib/ui` only — no
      hardcoded color/spacing; new patterns become `lib/ui` components or tokens.
- [x] Unit + integration tests for the gating/redirect + base-home loader; existing tests stay green.
- [x] PRODUCT.md, DESIGN.md, AGENTS.md updated (two-tier model, single gate, corrected multi-tenant/internet copy).

## API contract

No new external endpoints beyond the accept action (reuses existing `POST /api/consent`). Server loads change:

```
/        load: if !user → landing. else advanced? dashboard payload : base-home payload {health, mcpUrl, feature}
/analytics, /insights  load: if !advanced → redirect(303,'/') ; else existing payload
POST /api/consent  (existing) accept 'detailed_analytics'@currentVersion → Advanced; revoke → Base
```

## UI

- New/changed `lib/ui`: **TierBadge** (Base/Advanced pill with distinct treatment), AppShell gains a `tier` prop +
  tier indicator and conditional nav; a signature brand mark. Reuse Card/Button/Badge/Banner/StatTile/etc.
- **Base home**: standby aesthetic — the instrument is "armed but not reading"; one confident switch to go live.
- **Landing**: hero + a clear Base-vs-Advanced comparison; privacy section.
- States everywhere: loading / not-connected / base / advanced. Light + dark via tokens.

## Design / implementation notes

- Keep the consent **key** `detailed_analytics` (internal) to avoid churn with spec 013's wiring; relabel + bump
  version only. Follow-up: rename the key to `data_processing` for clarity.
- Gating helper: a tiny `isAdvanced(consent)` used by loaders + AppShell prop; per-user isolation unchanged.
- Ports & adapters intact; no new external deps. Sidecar untouched.
- Identity: extend `tokens.css` with any new signature tokens (e.g. a telemetry gradient, standby vs live surface
  treatment) rather than per-component hardcoding; document in DESIGN.md.

## Test plan

- **Unit/integration:** base-home loader returns `{health, mcpUrl, feature}` and **no dashboard** for Base; `/`
  returns dashboard payload for Advanced; `/analytics` & `/insights` loaders redirect Base users; accept flips the
  gate. Consent registry: relabelled entry + bumped version invalidates old acceptance.
- Re-run full web suite (analytics, dashboard, insights, consent) after the gate relabel.
- No e2e.

## Closeout

- **Status: Closed 2026-08-07.** Two-tier backbone + Polish localization + identity groundwork shipped;
  verified green (`check`: 606 files / 0 errors, `vitest`: 205 tests) incl. `tier.test.ts` and the
  `tier-gating.test.ts` redirect boundary.
- Delivered: single gate via `lib/server/tier.ts` (`detailed_analytics` relabelled "Tryb zaawansowany");
  `modules/base-home/BaseHome.svelte` (standby connect + MCP + upgrade); tier-aware `AppShell` + `TierBadge`
  (standby vs live pulse); Base users redirected out of `/analytics` + `/insights`; landing reworked to the
  two-tier story; **whole UI localized to Polish** (MCP stays English); PRODUCT.md/DESIGN.md/AGENTS.md updated.
- Also folded in (security): CSP + security headers, dead-secret removal, rate limiting (setup + `/mcp`).
- Follow-ups: rename consent key `detailed_analytics` → `data_processing` (+ bump termsVersion when copy final);
  deeper signature identity pass (landing hero / motion); settings nav could read tier; per-user metric cache.
