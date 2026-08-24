# Spec 001 — Shared UI design system

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/ui/` (shared design system, not a vertical slice)
- **Owner agent:** ui-designer
- **Depends on:** none (builds on existing `lib/styles/tokens.css` + `global.css`)

## Context

Every feature module (healthcheck, dashboard, MCP URL card, login) must be built from a
shared, token-driven component library rather than bespoke inline UI (AGENTS.md §5/§6). This
spec delivers that library: a set of presentational Svelte 5 components, a theme toggle, an
app shell, a toast system, and a `/styleguide` page that renders every component so the
visual system can be reviewed in light and dark. No business logic or data fetching lives
here — modules pass data in via props.

## Requirements (acceptance criteria)

- [x] `lib/ui` provides Button, Card, Input, Field, Badge, StatTile, Table, Toast, Spinner, ThemeToggle, AppShell
- [x] Every component is presentational (props/snippets only), Svelte 5 runes, TypeScript strict, no `any`
- [x] Components reference design tokens only — no raw hex, no magic px in component styles
- [x] Both light and dark themes render intentionally (driven by `[data-theme]` tokens)
- [x] Accessible markup: labels tied to inputs, visible focus states, semantic elements, ARIA where needed
- [x] A lightweight toast store (`lib/ui/toast.ts`) with success/error/info + auto-dismiss; a container renders the stack
- [x] `ThemeToggle` persists to `localStorage['gb-theme']` and sets `document.documentElement.dataset.theme`
- [x] `AppShell` uses `--sidebar-width` / `--topbar-height`; sidebar collapses on narrow screens
- [x] Root `+layout.svelte` imports global styles, renders children, mounts the toast container
- [x] `/styleguide` renders every component with its variants/states, grouped under headings
- [x] `index.ts` re-exports all components + the toast store
- [x] Unit tests pass for components with logic (Button, Badge, StatTile, ThemeToggle, toast store)
- [x] Built only from `lib/ui` components + design tokens (if UI)
- [x] No secrets logged or committed

## API contract

N/A — no HTTP endpoints or MCP tools. This is the presentational layer only.

## UI

Components delivered under `apps/web/src/lib/ui/`:

| Component | Purpose | Key states / variants |
|-----------|---------|-----------------------|
| `Button` | primary action control | variants primary/secondary/ghost/danger; sizes sm/md; loading, disabled |
| `Card` | content container | title, subtitle, optional `actions` header snippet, body snippet |
| `Input` | text control | bindable value, invalid state; extends `HTMLInputAttributes` |
| `Field` | label + control + help/error | label tied to control via generated id; error/help text |
| `Badge` | status pill | tones neutral/success/warning/danger/info |
| `StatTile` | dashboard KPI | label, big value, optional signed delta (up/down/flat), optional icon snippet |
| `Table` | tabular data | `head` + `children` (rows) snippets, optional zebra, responsive overflow-x |
| `Toast` | single notification | tones success/error/info, dismissible |
| `ToastContainer` | renders the toast stack from the store | fixed overlay |
| `Spinner` | loading indicator | sizes sm/md, `role="status"` |
| `ThemeToggle` | light/dark switch | persists `gb-theme`, sets `documentElement.dataset.theme` |
| `AppShell` | app layout | fixed sidebar (`nav` snippet), topbar (title + `actions`), main; collapses on mobile |

States: loading (Button, Spinner), empty/disabled (Button, Input), error (Field), light + dark
for all (tokens only). `/styleguide` exercises every one.

## Design / implementation notes

- Ports & adapters: none — pure presentation, no injected deps.
- Svelte 5 conventions: `$props`, `$state`, `$derived`, `$bindable`, `$effect`; slots via `Snippet`;
  event props (`onclick`). `{@render snippet?.()}` for optional slots.
- `Field` passes a generated `id` (+ `describedBy`) to its control snippet so the `<label for>` and
  `aria-describedby` wiring is automatic.
- Toast store is a Svelte `writable` (importable from a plain `.ts`); auto-dismiss via `setTimeout`,
  timers cleared on manual dismiss/clear.
- Theme is pre-applied before paint in `app.html`; `ThemeToggle` reads the current
  `documentElement.dataset.theme` on mount, then writes both the dataset and `localStorage`.
- No breakpoint token exists — `AppShell` uses a raw `768px` media-query breakpoint (see follow-ups).

## Test plan

- **Unit (jsdom, `*.svelte.test.ts`):**
  - Button — loading shows spinner + is disabled + `aria-busy`; `disabled` prop; variant/size classes
  - Badge — tone maps to the correct class
  - StatTile — positive/negative/zero delta renders the right direction (sign + class)
  - ThemeToggle — click toggles `documentElement.dataset.theme` and persists `gb-theme`
  - toast store — push adds by tone; dismiss removes; auto-dismiss fires after the duration
- **API integration:** N/A (no handlers)
- **Sidecar:** N/A

## Closeout

- Commits: <pending>
- Notes / follow-ups:
  - Add a `--breakpoint-*` token scale so `AppShell` (and future responsive UI) stops using raw px.
  - Modules that can now reuse this: `healthcheck` (Card/StatTile/Badge/Spinner), dashboard
    (StatTile/Table/Card), login (Field/Input/Button), MCP URL card (Card/Button/Toast).
