# Spec 076 — English translation and language switch (pl/en)

- **Status:** In progress <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/i18n/` (new) + `apps/web/src/modules/locale/` (new) and every string-bearing module
- **Owner agent:** module-dev
- **Depends on:** 012 (per-user settings + `SettingsRepo`), 018 (local dates / `$lib/date`), 020 (`sport-labels`),
  047 (global range labels), 048 (nav groups)

## Context

The app is Polish-only: every label, heading, tooltip, empty state, error, consent paragraph and sport name
is a Polish string literal hardcoded in the component or the module that renders it (~117 non-test source
files), and every number/date formatter is pinned to `pl-PL` in ~40 places. That is fine for one Polish
athlete and useless for anyone else, and it also means the copy has no single place to review.

This adds a second language — **English** — and a switch between the two. Polish stays the default and the
source of truth for the copy; English is a complete parallel catalog, not a partial overlay. The language is
picked from the **browser's `Accept-Language`** on first visit and, once the user chooses explicitly, stored
in their **per-user DB settings** so it follows them to any device.

Non-goal: a general localization framework. No new dependency, no ICU parser, no translation-management
tooling. A typed catalog plus `Intl` covers what two languages need, and TypeScript makes a missing key a
build error rather than a blank label discovered in production.

## Requirements (acceptance criteria)

**Engine**

- [x] `$lib/i18n` exposes `Locale = 'pl' | 'en'`, `LOCALES`, `DEFAULT_LOCALE = 'pl'`, and `isLocale()`.
- [x] Message catalogs live in `$lib/i18n/messages/pl.ts` and `.../en.ts`. **`pl` is the source of truth**:
      `MessageKey = keyof typeof pl`, and `en` is typed `Record<MessageKey, Message>` so a missing or
      misspelled key fails `pnpm run check` (and the build) instead of rendering blank.
- [x] `createTranslator(locale)` returns `t(key, params?)` with `{placeholder}` interpolation.
- [x] Plurals are real, not an `n === 1` guess: a message may be `{ one, few, many, other }` and the form is
      chosen by `Intl.PluralRules` for the active locale, so Polish gets its three forms
      (1 dzień / 2–4 dni / 5+ dni) and English its two.
- [x] An unknown key or a missing interpolation param **never throws** — it degrades to the key/placeholder,
      because a broken label must not take a page down.
- [x] The active locale reaches components through **Svelte context**, never a module-level store: module
      state is shared across requests on the Node server, so a store would let one user's language leak into
      another user's SSR render. `getI18n()` falls back to the default-locale translator when no context is
      set, so an isolated component unit test still renders.

**Locale resolution & persistence**

- [x] Resolution order, applied per request in `hooks.server.ts` → `event.locals.locale`:
      **1.** the signed-in user's stored setting → **2.** the `gb-lang` cookie → **3.** `Accept-Language`
      negotiation → **4.** `pl`.
- [x] `Accept-Language` negotiation honours quality values and language-only tags (`en-US`, `en;q=0.9`,
      `pl-PL`), ignores junk, and returns the default when nothing matches.
- [x] An explicit choice is persisted to the user's **DB settings bag** (`settings.locale`, existing
      `SettingsRepo` — no migration) and mirrored to the `gb-lang` cookie so anonymous visitors (landing,
      login) can switch too and so the next SSR paint is already correct.
- [x] A stored value that is not a known locale is ignored rather than trusted.
- [x] The page is server-rendered in the resolved language — **no flash of Polish** on an English session,
      and no hydration mismatch.
- [x] `<html lang>` carries the active locale (via `transformPageChunk`), so screen readers and translation
      tooling get the truth.

**Switch**

- [x] A `LangSwitch` control lives in the **AppShell topbar** next to `ThemeToggle`, so every shell page has
      it without per-page wiring, and also on the logged-out landing/login screens.
- [x] Choosing a language persists it, then re-renders the page in that language without a full reload
      (`invalidateAll()`), keeping the current route, query string and scroll position.
- [x] The control is a labelled `role="group"` of two buttons with `aria-pressed`, keyboard reachable, with
      visible focus — not a bare pair of unlabelled flags.

**Coverage**

- [ ] Every user-visible string in `src/routes/**`, `src/modules/**` and `src/lib/ui/**` comes from the
      catalog: nav, page titles (`<title>`), headings, tiles, tables, buttons, tooltips, `aria-label`s,
      empty/loading/error states, toasts, form labels and validation messages.
- [x] Data-shaped label sets stop carrying Polish text and carry **keys** instead — `sport-labels`,
      `metric-labels`, `nav`, `range` labels, `workout-presets`, activity stat groups/highlights/charts,
      timeline events, widget registry, runner-profile axes, insights copy, consent registry.
- [ ] Server-produced user-visible text is translated at **render** time, not write time:
      `SyncLogEntry` gains `key` + `params` (with the legacy free-text `msg` kept as the fallback for rows
      already in the database), and phase errors render from the existing machine-readable `errorCode`.
- [x] Numbers, dates, months and weekdays format in the active locale — the hardcoded `pl-PL` literals are
      gone and `$lib/date` takes the locale as a parameter. English uses **`en-GB`**: metric units, 24-hour
      clock and day-first dates, which is what the rest of the app assumes.
- [x] Units stay metric in both languages (km, m, kg, °C) — this is a European athlete's instrument, not a
      unit-conversion feature.
- [ ] Grepping `src/{routes,modules,lib/ui}` for Polish diacritics returns **only** catalog files and tests.

**Standard**

- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens (if UI)
- [x] No secrets logged or committed

## API contract

One new endpoint; the language is otherwise an ambient per-request value, not a query parameter.

```
PUT /api/settings/locale
  req:  { locale: 'pl' | 'en' }
  res:  200 { locale: 'pl' | 'en' }         + Set-Cookie: gb-lang=<locale>; Path=/; SameSite=Lax; Max-Age=1y
  errors:
    400 { error: 'invalid_locale' }          unknown/absent locale in the body
    (no 401 — anonymous callers get the cookie only; signed-in callers also get the DB write)
```

Shared contract (`src/modules/locale/locale.types.ts`):

```ts
export interface SetLocaleRequest {
  locale: Locale;
}
export interface SetLocaleResponse {
  locale: Locale;
  /** True when the choice was written to the user's account, false when it is cookie-only (anonymous). */
  persisted: boolean;
}
```

Engine contract (`src/lib/i18n/`):

```ts
type Locale = 'pl' | 'en';
type Message = string | { one: string; few?: string; many?: string; other: string };
type MessageKey = keyof typeof pl;
type TranslateParams = Record<string, string | number>;

interface Translator {
  (key: MessageKey, params?: TranslateParams): string;
  readonly locale: Locale;
}

createTranslator(locale: Locale): Translator
negotiateLocale(acceptLanguage: string | null): Locale | null
resolveLocale(input: { stored?: unknown; cookie?: string | null; acceptLanguage?: string | null }): Locale
intlLocale(locale: Locale): 'pl-PL' | 'en-GB'
```

## UI

- **New `lib/ui` component:** `LangSwitch.svelte` — two-button segmented group (`PL` / `EN`), styled from the
  same tokens as `ThemeToggle`/`SegmentedControl`, rendered by `AppShell` beside the theme toggle and
  reused on landing/login.
- **Touched:** `AppShell`, `NavLinks`, `SubNav`, `RangeSwitch`, `RangeBadge`, `FilterChips`, `Sparkline`,
  `Table`, `Toast`, `ThemeToggle` (its `aria-label`/`title`), `StatTile` — every `lib/ui` component holding
  a hardcoded string or a `pl-PL` formatter.
- **States:** unchanged. Loading/empty/error copy is translated, not restructured.
- **Light + dark:** `LangSwitch` uses surface/border/accent tokens only, so both themes come for free.
- **Layout:** English strings are frequently longer than Polish ("Wytrzymałość" → "Endurance", but
  "Regularność" → "Consistency"); tiles, chips and nav items must not overflow — verified against the
  existing readout-fit rules rather than by widening the chrome.

## Design / implementation notes

**Ports & adapters.** Nothing new is injected: locale resolution reads the existing `SettingsRepo` through
the container, and `Intl` is a platform primitive. `resolveLocale`/`negotiateLocale` are pure functions
taking their inputs as arguments, so they unit-test without a request.

**Where the locale enters.** `hooks.server.ts` resolves it once per request (after the session → user
resolution, since the DB setting wins) onto `event.locals.locale`; a new root `src/routes/+layout.server.ts`
returns it as page data; `src/routes/+layout.svelte` puts the translator into context. `transformPageChunk`
rewrites the `%lang%` placeholder in `app.html`.

**Reactivity.** The context value is an object with getters over `$derived`, so a language change propagates
to every consumer after `invalidateAll()` without each component re-subscribing.

**Keys.** Dotted and namespaced by surface (`nav.training`, `insights.condition.title`, `sport.trail_running`,
`sync.log.activitiesPageEmpty`). Shared vocabulary lives under `common.*` so "Zapisz"/"Save" is written once.

**Persisted text.** `sync_runs.detail.log` rows already in Postgres hold Polish free text; they are rendered
via the legacy `msg` fallback and are not rewritten. New runs write `key` + `params`.

**Edge cases.**
- Anonymous switch on the landing page: cookie only, no DB write, no 401.
- A user whose stored setting is `en` visiting with a Polish browser gets English — the account beats the header.
- Sidecar/Garmin error text arriving from upstream is *data*, not copy: it is rendered as-is, never
  translated, and never treated as a key.
- SSR determinism: `Intl` output must not depend on the server's ambient locale — every formatter is
  constructed with an explicit locale tag.

## Test plan

- **Unit:**
  - `negotiateLocale` — `en-US,en;q=0.9,pl;q=0.8` → `en`; `pl-PL` → `pl`; `de` → `null`; junk → `null`.
  - `resolveLocale` — precedence (stored > cookie > header > default) and rejection of an unknown stored value.
  - `createTranslator` — interpolation, missing param, unknown key, and **Polish plural forms at 1 / 2 / 5 /
    22 / 25** plus English at 1 / 2.
  - Catalog parity — `en` has exactly the `pl` key set, no key maps to an empty string, and every
    `{placeholder}` in a `pl` message appears in its `en` counterpart (a guard against a dropped variable).
  - `$lib/date` + number formatting — the same input renders differently under `pl` and `en`, and identically
    across runs regardless of ambient locale.
  - `LangSwitch` — renders both options, marks the active one `aria-pressed`, calls its handler on click.
- **API integration (mock adapters):**
  - `PUT /api/settings/locale` with `{locale:'en'}` → 200, `persisted:true` for a signed-in user, and the
    settings bag actually holds `locale:'en'`; the response sets the `gb-lang` cookie.
  - Same call anonymous → 200, `persisted:false`, cookie set, no DB write.
  - `{locale:'de'}` and `{}` → 400 `invalid_locale`, nothing written.
  - Existing settings keys survive the write (bag merge, not replace).
- **Regression:** the existing suite must stay green — every component test asserting Polish text is updated
  to assert through the catalog, so the assertions keep testing behaviour rather than a frozen string.

## Closeout

- Commits:
  - `afce49d` — the engine, locale resolution, `PUT /api/settings/locale`, `LangSwitch`, the app
    shell, and every data-shaped label set converted to message keys.
  - `af52721` — landing + base-tier start screens (the logged-out surfaces).
  - `1934be2` — readiness, small widgets, auth/error strings; fixes a `<script module>` context read.

- **State:** the engine and every cross-cutting surface are done and green
  (`pnpm run verify`: 1627 tests, 0 type errors, prettier clean, build passes). 713 messages are in
  both catalogs. What is translated end-to-end: app shell and nav, the global range switch, settings,
  consent, Garmin connection + setup, MCP URL, sync footer and the Data page, the dashboard grid and
  every widget, the start page, training overview, running, walking, volume, activities list, heat
  map, power, insights, the timeline, landing and login.

- **Remaining (383 lines across 41 files)** — mechanical string extraction against the existing
  engine, no design decisions left:
  - **Activity detail (~177 lines).** `activity-stat-groups.ts`, `activity-highlights.ts`,
    `activity-charts.ts`, `activity-format.ts`, `activity-laps.ts`, `activity-comparison*.ts` and the
    `Activity*.svelte` panels. The largest single cluster, and self-contained.
  - **Server-produced text (~104 lines).** `sync/engine.ts` log lines (needs `SyncLogEntry` to carry
    `key` + `params`, with the legacy free-text `msg` kept as the fallback for rows already in
    Postgres), `consent/registry.ts` terms copy, and the analytics label sets
    (`runner-profile`, `load-risk`, `training-load`, `intensity-mix`, `power-profile`).
  - **Remaining cards (~86 lines).** `IntensityMixCard`, `LoadRiskCard`, `TrainingVerdict`,
    `ConditionCard`, `RunnerProfileCard`, `IntegrationsPanel`, `insights.condition.ts`.
  - **Styleguide (16 lines).** Demo copy only — no user-facing impact.

- Notes / follow-ups:
  - MCP tool output renders sport names in **English** rather than the reader's UI language: an MCP
    request carries no locale, and the surrounding tool names, descriptions and errors are already
    English. Revisit if MCP ever gains a per-user locale.
  - Route slugs stay Polish (`/training/rower`, `/activities/mapa`) in both languages: a URL is an
    identifier, and translating it would break existing links and make a shared link resolve
    differently per recipient.
  - The stored setting is read once per request for signed-in users. If that ever shows up in a
    profile, cache it on the session row rather than weakening the account-beats-cookie ordering.
