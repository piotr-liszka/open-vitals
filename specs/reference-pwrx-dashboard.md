# Reference — PWRX-style local dashboard (from user screenshots, 2026-08-08)

The user wants **all** of these charts/pages, rebuilt on **local data** (our sync store), in our
design system + Polish UI. This file is the source-of-truth catalog; specs reference it by section.

## Data-dependency tiers (what each chart needs)

- **T0 — activity summaries** (we already get these from garmy): type, date, distance, moving time,
  elevation, avg/max speed, avg/max HR, avg power, calories.
- **T1 — GPS streams** per activity (lat/lng[, elevation]): route maps + heatmap. Needs new sidecar
  activity-detail/stream endpoint. Best-effort (garmy `ActivityDetails`/GPX).
- **T2 — power/HR streams** per activity (watts, bpm, cadence, time): best-power curves, NP/IF/TSS,
  power zones, HR zones, rider-type radar, PMC. Needs sidecar stream endpoint + heavy compute.
  Degrade gracefully when a stream is absent (e.g. no power meter → hide power widgets).
- **T3 — Strava / Withings** external integrations (separate specs).

## Pages & widgets

### 1. Dashboard (configurable — our extension)
- Motivational quote header; **Sync** button; grid/list view toggle.
- **Activity search** + type filter chips (Ride, VirtualRide, Run, Walk, Hike, EBikeRide, Swim);
  sort by date; sort direction; filters.
- **Activity cards grid**: route thumbnail map, title, date, Distanz/Zeit/Höhenmeter, tags
  (avg W, avg bpm, power zone Z2/Z3, training phase "Grundlage/Aufbau").
- **Streak card** ("Deine Serie"): N-week active streak, flame icon. [T0]
- **Calendar** (month grid): per-day activity-type icons. [T0]
- **Goals ("Meine Ziele")**: per-sport weekly + yearly distance goals with progress bars and
  "ahead/behind target" delta. [T0]
- **Weekly volume bars**: last N weeks, hours per week, per-sport, horizontal bars. [T0]

### 2. Activity detail
- Stat row: Distance, Moving Time, Elevation, Avg Speed (+Max), Avg HR (+Max), Avg Power (+kJ). [T0]
- **Route map** (Leaflet + OSM/CARTO dark): route line, start (green) / end (red) markers. [T1]
- Photos (if available). [T1/optional]
- **Training Stimulus card** ("Trainingsreiz"): IF, TSS, NP, duration; day-effect CTL/ATL/TSB deltas;
  intensity tags. [T2]
- **Best Power table** ("Beste Leistung"): best avg power for 5s,10s,30s,1m,2m,5m,10m,20m,30m,45m,1h. [T2]
- **Heart Rate** card (avg/max). [T0]
- **Power Zones** donut (time in Coggan Z1–Z7). [T2]
- **Segments** list (name, distance, %grade, time, W, bpm, PR badge). [T2, Strava segments]
- "View on Strava →" link. [T3]

### 3. Heatmap
- Full-screen **GPS route heatmap** on dark OSM map; density-weighted orange lines. [T1]
- Side panel: total Activities count, total Distance; filters Activity Type + Year;
  click a route → detail. [T1]

### 4. Training (PMC — Performance Management Chart)
- Sport toggle (Radfahren/Laufen).
- Big tiles: **CTL (Fitness)** 42-day avg, **ATL (Fatigue)** 7-day avg, **TSB (Form)** = CTL−ATL,
  with band label (Fresh/Optimal/Neutral/Fatigued/Very Fatigued). [T2]
- Text **recommendations** derived from the values. [T2, deterministic]
- **PMC line chart**: ATL (red), CTL (green), TSB (blue) over time; y = training load; band legend. [T2]

### 5. Power (Power Profile)
- Filters: activity type, weight (kg), cached date.
- **Rider-type radar** ("Fahrertyp-Analyse"): 5 axes (Sprint, Punch, Klettern/Climb, Zeitfahren/TT,
  Ausdauer/Endurance) from 5s/1min/5min/20min/60min bests. [T2]
- **FTP & Power Zones**: FTP (W and W/kg), 20-min est, 60-min best, Coggan Z1–Z7 ranges. [T2]
- **All-Time Best Power** tiles per duration (5s…2hr) with W/kg + date achieved. [T2]
- **Yearly Power Curve Comparison**: multi-line, x = duration (log scale 5s→2h), y = power W;
  one line per selected year + dashed all-time-best; year selector chips w/ activity counts. [T2]
- **Yearly Best Efforts** table: rows = years, cols = durations; best-of-column highlighted. [T2]

### 6. Records (all-time PRs) — implied by nav
- Longest ride, most elevation, fastest, biggest week/month, etc. [T0/T2]

### 7. Gear — implied by nav
- Per-bike/shoe mileage totals. [T0, if garmy exposes gear]

## Notes
- PWRX is cycling/power-centric. Our app also keeps the existing **wellness** metrics (sleep, HRV,
  steps, body battery, stress, RHR, SpO2, respiration, calories) as dashboard widgets — additive.
- Every power/HR/GPS widget must **degrade gracefully** when the underlying stream is missing.
- All charts render from the **local store** (never a live Garmin call at view time).
