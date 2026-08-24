# Spec 090 — Profil atlety: FTP, tętno maksymalne i masa ciała

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/settings/` (new) + `routes/settings`
- **Owner agent:** module-dev
- **Depends on:** 016, 026, 086

## Context

Three numbers decide how a large part of this app reads, and **nothing in it can set them**.
`settings.ftpWatts`, `settings.maxHrBpm` and `settings.weightKg` are read in
`activity-detail.api.ts` and nowhere written: the only `settings.set` callers in the codebase are the
locale and dashboards modules. The consequences are all visible on screen today:

- **FTP** always falls back to 95% of the session's best 20-minute power, so IF, TSS and every power
  zone are computed against a number that moves with each ride. Spec 086's popover has to say so.
- **Max HR** is never used for zones at all — `activity-detail.api.ts` buckets against
  `activity.maxHr ?? maxOf(hr)`, i.e. **this session's own observed peak**, which makes the top zone
  nearly unreachable and the split meaningless. The athlete's own block constraints say
  *"HRmax szacowany ~175 (obserwowane 170 w PB 2024) — do potwierdzenia"*: they have the number and
  there is nowhere to put it.
- **Weight** is why the W/kg column of the mean-max power table never appears.

This spec adds the one screen that writes them.

## Requirements (acceptance criteria)

- [ ] A "Profil" card on `/settings` with three optional numeric fields: **FTP (W)**, **Tętno
      maksymalne (bpm)** and **Masa ciała (kg)**. Each may be left empty — empty means "estimate it",
      which is today's behaviour, not an error.
- [ ] Values are validated server-side before storage and rejected with 400 outside sane bounds
      (FTP 50–600 W, max HR 100–230 bpm, weight 30–250 kg). Never trust the field.
- [ ] Stored per user through the existing settings port. No new table.
- [ ] Each field says what it changes ("used for IF, TSS and power zones"), because a number with no
      stated consequence invites the reader to leave it blank.
- [ ] **HR zones use the configured max when it is set.** `activity-detail.api.ts` currently passes
      `activity.maxHr ?? maxOf(hr)` to `hrZones`; it must prefer `settings.maxHrBpm`. This is the
      correctness half of the spec — the form alone would be a setting nothing reads, which
      AGENTS.md §11a bans outright.
- [ ] Spec 086's zones popover reports "configured" rather than "estimated" once a value is set, for
      FTP **and** for max HR — its copy already branches on FTP; max HR needs the same branch.
- [ ] The W/kg column of the mean-max power table appears once weight is set.
- [ ] Copy in `pl.ts` + `en.ts`.
- [ ] Unit + API-integration tests pass (no e2e)
- [ ] Built only from `lib/ui` components + design tokens
- [ ] No secrets logged or committed

## API contract

```
GET  /api/settings/profile   res: { ftpWatts: number|null, maxHrBpm: number|null, weightKg: number|null }
PUT  /api/settings/profile   req: same shape (null clears)   res: same   errors: 400 out of bounds
```

## UI

`Card`, `Field`, `Input`, `Button`, `Toast` from `lib/ui`. States: empty (says the value is being
estimated instead), set, saving, invalid (per-field message). Light + dark via tokens.

## Design / implementation notes

- The estimate stays the fallback everywhere. Setting a value replaces a guess; clearing it restores
  the guess. No path may end up with neither.
- `settings` is `Record<string, unknown>` — validate and narrow on read, never cast.

## Test plan

- **Unit:** bounds validation per field, including null-clears and non-numeric input.
- **API integration (mock adapters):** PUT then GET round-trips; out-of-bounds → 400; a cleared field
  restores the estimated path.
- **API integration:** with `maxHrBpm` set, `loadActivityDetail` buckets HR against it, not the
  session's own peak; with it unset, behaviour is byte-identical to today.

## Closeout

- Commits: <hashes/links>
- Notes / follow-ups:
