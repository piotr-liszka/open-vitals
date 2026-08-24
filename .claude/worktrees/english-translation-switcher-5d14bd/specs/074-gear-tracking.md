# Spec 074 — Sprzęt: przebieg butów i rowerów liczony, nie kumulowany

- **Status:** Draft <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/gear/` + `lib/server/store/` + `lib/mcp/`
- **Owner agent:** module-dev
- **Depends on:** 015 (local store), 025 (training section)

## Context

Split out of spec 062 on 2026-08-16. That spec bundled the subjective journal with gear tracking
because both are hand-entered data Garmin does not hold well — but they share nothing else: different
tables, different UI, different reasons to exist, and AGENTS.md §8 asks for one feature per spec.
The journal had a coach waiting on it and shipped first; this is the other half, unchanged in scope.

Shoe and bike mileage is universally wanted, Garmin's own version is poor, and every input it needs is
already in `synced_activities`.

## Requirements (acceptance criteria)

### Gear


- [ ] A `gear` table: `name`, `kind` (`shoe` | `bike` | `other`), `sport`, `purchased_on`, `retired_on`,
      `initial_distance_m` (gear bought used, or in service before OpenVitals), `alert_distance_m`, `note`.
- [ ] A `gear_activities` link table, so one activity attributes to at most one item of gear per kind.
- [ ] **Default gear per sport family**: new activities in that family attribute automatically, so the
      common case needs no interaction at all. Re-attribution of a past activity is one click.
- [ ] Mileage is computed from `synced_activities`, never stored as a running total — a re-sync or a
      corrected activity must move the number, which a counter would not.
- [ ] A retirement alert at `alert_distance_m` (default 800 km for shoes, off for bikes), shown on the gear
      page and in the start page's attention area.
- [ ] Retired gear keeps its history and drops out of the default-attribution rotation.

### General

- [ ] MCP: `list_gear`, so an assistant can reason about what the athlete is running in.
- [ ] Unit + API-integration tests pass (no e2e)
- [ ] Built only from `lib/ui` components + design tokens
- [ ] No secrets logged or committed

## API contract

```
GET    /api/gear                   res: { gear: GearItem[] }   // incl. computed distance + alert state
POST   /api/gear                   req: NewGearInput      res: { gear: GearItem }
PATCH  /api/gear/[id]              req: GearPatch         res: { gear: GearItem }
POST   /api/gear/[id]/retire                              res: { gear: GearItem }
```

## UI

A `/training/sprzet` tab — `Table` of items with distance, a `ProgressBar` against the alert
threshold, and a `Badge` when it is passed. States: no gear yet, retired gear, alert passed.

## Design / implementation notes

- Gear mileage is **derived, never accumulated** — see the acceptance criterion. This is the single
  most common bug in every gear tracker: a stored running total cannot be moved by a re-sync or a
  corrected activity, so it drifts away from the truth and never comes back.
- **Edge cases:** gear attributed to an activity later deleted upstream; an activity in a sport with
  no default gear; gear bought used (`initial_distance_m`).

## Test plan

- **Unit:** gear distance from a set of activities including a re-sync that changes one; alert
  threshold either side; retired gear excluded from rotation but not from history.
- **API integration (mock adapters):** each endpoint's success and validation failures; per-user
  isolation on every read and write.

## Closeout

- Commits:
- Notes / follow-ups:
