# Spec 071 — OpenVitals: one tier, integration cards, real feature switches

- **Status:** Closed
- **Module:** `apps/web/src/modules/features/`, `apps/web/src/modules/integrations/`, `apps/web/src/routes/settings/`
- **Owner agent:** module-dev
- **Depends on:** 011 (consent), 014 (tiers), 017 (integrations), 021 (settings), 027 (scheduler), 050 (workout push)

## Context

Three things had drifted apart. The product is called **Vagus**, a name nobody can spell or place; it becomes
**OpenVitals**. The app ships **two tiers** (spec 014) whose only real content is one terms-acceptance gate —
in a self-hosted app the owner runs for themselves, asking them to consent to their own data being drawn on a
chart is theatre, and the `ZAAWANSOWANY` chip in the chrome advertises a distinction that means nothing. And
Settings had grown four different vocabularies for the same idea: a tier toggle, a "Funkcje i zgody" list, a
Garmin connection card, and an Integracje section that Garmin itself was not part of.

This spec collapses all of it to one sentence: **Settings is a list of integrations, and each integration card
owns its own on/off switches.** No tiers, no terms, no acceptance flow — just switches that do what they say.

Two of the three switches the user asked for did not previously exist as switches at all: automatic fetching
was a deployment env var and the MCP toggle was decorative (nothing read it). Making them honest is the bulk
of the work here.

## Requirements (acceptance criteria)

**Rename**

- [x] No occurrence of `Vagus`/`vagus` survives in code, docs, compose files, agent definitions, or any spec other than this one
- [x] UI chrome, page `<title>`s, MCP server identity and `package.json` all say `OpenVitals`

**One tier**

- [x] `lib/server/tier.ts`, `lib/ui/TierBadge.svelte` and `modules/base-home/` are deleted
- [x] `AppShell` no longer accepts `advanced` or `tier`; the sidebar shows the wordmark alone
- [x] Nav items are no longer flagged `advanced`; every destination is always listed
- [x] No route loader redirects on a missing `detailed_analytics` consent; `/` always renders the dashboard
- [x] Dashboard, insights, season and the MCP season tools no longer gate on `detailed_analytics`

**Feature switches**

- [x] `lib/server/consent/` is replaced by `lib/server/features/`: a registry of plain switches with
      `defaultEnabled`, no `termsVersion`, no `termsText`, no `requiresConsent`
- [x] Switch state persists in a new `feature_settings(user_id, feature_id, enabled, updated_at)` table, so a
      feature that defaults ON can be turned OFF and stay off across restarts
- [x] `POST /api/features` takes `{ featureId, enabled }` and returns the resolved switch
- [x] Three switches ship: `auto_sync` (on), `workout_write` (on), `mcp` (on)

**Switches that actually do something**

- [x] The background scheduler skips a user whose `auto_sync` is off, and says so in its tick log counters
- [x] The sync engine's workout-push phase runs only for a user whose `workout_write` is on
- [x] `GARMIN_WORKOUT_PUSH` is retired: the per-user switch is the sole authority (owner decision, 2026-08-16)
- [x] `/mcp` answers `403 mcp_disabled` for a user whose `mcp` switch is off, charging no auth-failure budget

**Settings IA**

- [x] Settings renders one section, `Integracje`, holding one card per integration: Garmin, MCP, Strava, Withings
- [x] The Garmin card holds the connection status/connect/disconnect **and** its two switches
- [x] The MCP card holds the personal URL, copy/rotate **and** the MCP on/off switch
- [x] Nothing on the page mentions tiers, terms, consent, or acceptance
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

```
GET  (loader)        res: { features: FeatureView[] }        # via listFeatures(deps)
POST /api/features   req: { featureId: string, enabled: boolean }
                     res: { feature: FeatureView }
                     errors: 400 → unknown feature / malformed body

FeatureView = { id, title, summary, integration: 'garmin' | 'mcp', enabled, defaultEnabled }
```

`POST /api/consent` is removed. `/mcp` gains a decision branch:

```
POST /mcp?token=…    403 { error: "mcp_disabled" }   # token resolves, but the user switched MCP off
```

## UI

`Card`, `Toggle`, `Badge`, `Button` from `lib/ui` only. New shared piece: `modules/features/FeatureSwitch.svelte`
— title + one-line summary + `Toggle`, optimistic flip with rollback on failure, `toasts.error` on failure.
The Settings page composes four cards in one column; each card's body is status first, switches second.

States: switch busy (Toggle `loading`), switch failed (reverted + toast), Garmin disconnected (switches still
render but the card leads with the connect form), MCP off (URL row dimmed with a "wyłączony" badge).
Light + dark come from tokens; no new colors.

## Design / implementation notes

- **Port shape.** `FeatureStore.get(userId) -> Record<string, boolean>` and `.set(userId, id, enabled)`. The old
  store keyed on `terms_version` and encoded "off" as *row absent*, which cannot express "off" for a switch
  that defaults on — hence the new table rather than an `ALTER TABLE`. The `consents` table is left in place,
  unread, and dropped in a later cleanup.
- **Per-user resolution outside a request.** The scheduler and the sync engine both need switch state for a user
  they are not serving a request for. `container.featuresFor(userId)` is the single factory both use;
  `SyncEngineDeps.workoutPushEnabledFor(userId)` replaces the construction-time boolean.
- **`/mcp`.** `mcpGate` takes a new `isEnabled(userId)` dep and gains a `403` decision. Checked *after* the token
  resolves, so a disabled user's own token still costs them nothing from the per-IP failure limiter.
- **Data already stored.** `detailed_analytics` rows in `consents` become meaningless and are ignored; nobody
  loses data, and everything the tier used to hide is simply visible.

## Test plan

- **Unit:** feature service resolution (default on + explicit off persists; default off + explicit on);
  memory + pg store round-trip; `runScheduledSync` skips a switched-off user and counts it; `mcpGate` returns
  403 for a disabled user and does not charge the failure limiter; nav groups contain every item.
- **API integration (mock adapters):** `POST /api/features` happy path, unknown feature → 400, malformed → 400;
  settings loader returns four integration views; sync engine push phase runs/does not run per switch.
- **Component:** `FeatureSwitch` reverts and toasts on a failed POST; Settings page renders four cards and no
  tier/terms wording; `AppShell` renders no tier badge.
- **Sidecar (pytest):** N/A.

## Closeout

- Commits: this branch (`claude/app-rename-suggestions-53b126`).
- Notes / follow-ups:
  - `consents` table is dead but not dropped — a one-line migration when convenient.
  - `RangeSwitch`/`ConditionCard` browser preferences moved from `vagus.*` to `openvitals.*` localStorage
    keys, so the first load after this deploy falls back to the defaults once. Not worth a migration.
  - `GARMIN_WORKOUT_PUSH` removal means a fresh deploy pushes authored workouts to Garmin on the first tick.
    `scripts/verify-workout-push.sh` remains the way to sanity-check the endpoints before enabling the switch.
