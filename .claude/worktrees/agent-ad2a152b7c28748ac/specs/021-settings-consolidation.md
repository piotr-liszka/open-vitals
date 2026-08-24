# Spec 021 — Configuration moves off the start page into Settings

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/healthcheck/`, `apps/web/src/modules/base-home/`,
  `apps/web/src/routes/+page.svelte`, `apps/web/src/routes/+page.server.ts`,
  `apps/web/src/routes/settings/+page.svelte`
- **Owner agent:** module-dev
- **Depends on:** 011 (consent), 012 (multi-user auth / per-user MCP token), 014 (tiers)

## Context

User feedback on the start page: _"garmin connection and mcp adress → move to settings page"_. `/` opened with the
day's readiness and metrics but always ended in a two-column grid of `HealthCard` + `McpUrlCard` — configuration
furniture on a page that should answer "how am I today?". Worse, Settings already rendered `McpUrlCard` **and** a
hand-rolled "Konto Garmin" card, so the connection story was told twice in two different shapes, and its
not-connected branch linked back to `/` ("Połącz na pulpicie →") for a connect form that this change removes.
This spec makes `/` purely informational and makes Settings the single place where the bridge is configured.

## Requirements (acceptance criteria)

- [x] `/` (advanced tier) no longer renders the connection card or the MCP address
- [x] `BaseHome` (base tier) no longer renders the connection card or the MCP address
- [x] The two health Banners stay on `/` — they are actionable alerts, not configuration — and each carries a
      CTA linking to `/settings`
- [x] Settings tells the connection story **once**: status beacon + badge, reachability detail, display name,
      session validity (`expiresAt`), Odśwież, and disconnect live in a single "Połączenie z Garmin" card
- [x] `HealthCard.svelte` is deleted (absorbed into `ConnectionCard.svelte`); no import of it remains
- [x] The hand-rolled "Konto Garmin" card in `routes/settings/+page.svelte` is deleted, along with its bespoke
      `.account` / `.confirm` / `.link` CSS
- [x] A disconnected user can connect **from Settings**: `SetupForm` is mounted there (via the card's `connect`
      snippet); the `/`-linking dead end is gone
- [x] The base-tier path can still connect: `BaseHome` keeps `SetupForm` in its first-run panel, and its
      connected state links to `/settings` for the MCP address
- [x] Settings order is connection → MCP access → tier → consents → integrations
- [x] `/`'s auto-refresh loop is narrowed to its only remaining consumer (`MetricsDashboard`): the `refreshing`
      flag that drove the deleted `HealthCard` spinner is gone and the loop no longer arms for base-tier users
- [x] `/` no longer loads the personal MCP URL at all, so the token stops being serialised into that page payload
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens (if UI)
- [x] No secrets logged or committed

## API contract

No endpoint added, removed or changed. `POST /api/garmin/disconnect`, `POST /api/garmin/setup` and
`POST /api/settings/mcp-token/rotate` keep their contracts — only the page that calls them moved.

One **page-load payload** narrows (defence in depth for a secret-bearing value):

```ts
// routes/+page.server.ts — load(): PageData
{ authed: false }                                                  // logged out (unchanged)
{ authed: true, tier: 'base',     health, advancedFeature }        // mcpUrl removed
{ authed: true, tier: 'advanced', health, dashboard, advancedFeature, readiness }  // mcpUrl removed
```

`routes/settings/+page.server.ts` is unchanged and still returns `mcpUrl` — Settings is now its only consumer.

```svelte
<!-- modules/healthcheck/ConnectionCard.svelte -->
status: HealthStatus            // modules/healthcheck/health.types.ts (unchanged contract)
onRefresh?: () => void          // omit to hide the Odśwież button
refreshing?: boolean
onDisconnect?: () => void       // omit to hide the disconnect flow; caller performs the request
disconnecting?: boolean
connect?: Snippet               // rendered only while not connected (Settings passes <SetupForm />)
```

## UI

- **New** `modules/healthcheck/ConnectionCard.svelte` — `Card` + `Badge` + `Button` from `lib/ui`, tokens only.
  States: connected (success beacon, name, "Sesja ważna do", "Rozłącz Garmina" → inline confirm), not connected
  (danger beacon, the `connect` snippet), unreachable (warning beacon, "Szczegóły" row explaining the sidecar is
  down). The beacon/`Badge` tones are `--color-success|danger|warning` + their `-soft` rings, so light and dark
  come from tokens. The disconnect confirm is inline (no dialog), keyboard reachable, `Anuluj` first.
- `routes/settings/+page.svelte` renders, in order: `ConnectionCard` → `McpUrlCard` → "Tryb zaawansowany"
  (`AdvancedModeToggle`) → "Funkcje i zgody" (`ConsentPanel` list) → "Integracje" (`IntegrationsPanel`).
- `routes/+page.svelte` keeps `Banner` (warning: not connected / danger: Garmin unreachable). Each Banner uses its
  `actions` snippet for a text CTA to `/settings` ("Połącz w Ustawieniach →" / "Sprawdź połączenie →"), styled
  with `currentColor` so it inherits the banner tone in both themes and gets a `--focus-ring` on focus.
- `BaseHome.svelte`: the not-connected onboarding is unchanged except step 3 now points at Ustawienia; the
  connected state swaps the old 2-up grid for one "Adres MCP i połączenie" `Card` linking to `/settings`.

## Design / implementation notes

- No new port or adapter. `ConnectionCard` is presentational: it owns only the confirm-open boolean and delegates
  refresh/disconnect to callbacks, so the route keeps the `fetch` + `invalidateAll` wiring (thin-route rule, §5)
  and the component is trivially testable without stubbing globals.
- `SetupForm` is passed **into** the card as a snippet rather than imported by it — same pattern as
  `ReadinessCard`'s `consent` snippet — so the healthcheck slice does not reach into the garmin-setup slice (§5).
- Dropping `getMcpUrl` from `routes/+page.server.ts` is a small security win: the MCP URL embeds a per-user secret
  token and was previously inlined into the SSR payload of the app's most-visited page for no remaining reader.
- The `$effect` polling loop on `/` now guards on `data.tier === 'advanced' && data.health.connected`. Base tier
  renders nothing that refreshes, so it no longer arms an interval + two window listeners.
- Deleted: `modules/healthcheck/HealthCard.svelte` (had no test of its own; `ConnectionCard` is covered instead).

## Test plan

- **Unit (UI):** `modules/healthcheck/ConnectionCard.svelte.test.ts` — connected renders one card carrying status
  + account + session validity; not-connected shows the neutral state and no disconnect action; unreachable warns
  and explains; Odśwież appears only with a handler and calls it; disconnect requires confirmation and Anuluj
  aborts without calling the handler.
- **Unit (UI):** `modules/base-home/BaseHome.svelte.test.ts` — the start page renders no MCP address (no
  `Adres MCP` group, no Kopiuj, no "Twój adres MCP") and no connection panel, links to `/settings` instead, still
  invites the upgrade, and still offers the connect form when not connected.
- **API integration (mock adapters):** `routes/home-payload.test.ts` — calls the `/` loader with a mock
  `GarminService` + stub `ConsentService` and a throwing `container` proxy: base and advanced payloads contain no
  `mcpUrl` and never touch the MCP-token service; logged out returns `{ authed: false }` only.

## Closeout

- Commits: _pending — handed off to `qa-closer`_
- Notes / follow-ups:
  - `pnpm run test` 398/398 green, `pnpm run check` 0 errors / 0 warnings. `pnpm run lint` (`prettier --check .`)
    is red across ~107 pre-existing `src/` files at HEAD (verified in a clean `git worktree`); this change adds no
    new offenders — its new files are Prettier-clean, and the four files it edits were already unformatted before
    it. A repo-wide `pnpm run format` remains a separate chore.
  - `routes/settings/integrations/+page.svelte` is still a redirect-only stub; left alone.
  - Base tier now needs one click to reach its MCP address. If that proves annoying, the answer is a link/entry
    on the base home, not re-inlining the secret-bearing card.
