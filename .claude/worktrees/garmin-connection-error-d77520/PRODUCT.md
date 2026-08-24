# PRODUCT.md — OpenVitals

> Durable product context for design work. Written from the project brief + AGENTS.md.
> Assumptions are labelled **[assumption]** — correct them and this file improves.

## Language
The product UI is **Polish** (single language). MCP tool names/descriptions stay English (AI-client config).

## What it is
A **multi-tenant, internet-connected** service where each person signs in with **Google** (passwordless),
connects their **own** Garmin Connect account, and exposes it to AI clients through their **own** personal
MCP URL. Every user's data is isolated. (Pivoted from the original single-user/LAN tool — see spec 012.)

## One app, switchable parts (spec 071)
There are no tiers. Everyone gets the whole thing — **pulpit** (dashboard), **analityka**, **wnioski**
(readiness, trends, anomalies, correlations), **wykresy długiego okresu** and a personal MCP URL — from the
first sync. The two-tier split of spec 014 was a terms-acceptance gate in front of an app the owner already
self-hosts for themselves; asking them to consent to their own data being drawn on a chart was ceremony.

What remains is a small set of **switches**, and each lives on its own integration card in Settings:
- **Garmin** — automatic background fetching, and automatic push of authored workouts to the Garmin calendar.
- **MCP** — whether the personal MCP endpoint answers at all.

All three default ON, all three actually do something, and no switch exists that nothing reads.

## Who uses it
- **Each signed-in user** — a technical, fitness-minded person with a Google account. Self-service
  registration; no passwords. They connect their own Garmin, glance at today's readiness and the
  week's trend, and wire up their personal MCP connector. One user never sees another's data.
- **AI clients** (Claude/ChatGPT) reading a single user's data over that user's MCP URL.

## Jobs to be done
1. "Is my Garmin connected and healthy?" — status at a glance.
2. "How am I doing today, and how's the trend?" — snapshot + multi-day trends (the analytics).
3. "Give my AI assistant read access to my data." — copy the MCP URL, understand the risk.
4. "Turn off the parts I don't want running." — one switch per behaviour, on the card that owns it.

## Brand & voice
- **Athletic / energetic.** Confident, precise, momentum. Think a performance wearable's
  companion app, not a hospital chart. Data is the hero; numbers are large and legible.
- Voice: direct, plain, a little coaching. No hype, no dark patterns, no fake urgency.
- Trust is the throughline: this is *your* private data on *your* network. Say what is stored and what
  runs in the background, plainly, and let it be switched off.

## Principles
1. **Privacy is the feature.** The Garmin sidecar is never exposed; tokens are encrypted at rest; MCP is
   stateless and can be switched off; the only thing that ever writes to Garmin is behind its own switch.
2. **Clarity over decoration.** Operate mode — scanability, consistent components, honest
   empty/error/not-connected states. Expression lives in precise details and motion, not noise.
3. **One system.** All visual decisions live in design tokens + the shared `lib/ui` library
   (AGENTS.md §6). Feature code never hardcodes color or spacing.
4. **Self-hosted assets.** Self-hosted fonts and assets only; no external CDNs (keeps the strict CSP tight
   and the app resilient). Internet-facing only so Google sign-in and remote AI clients work.

## Surfaces
- **Landing** (logged-out) — what it is and what stays yours; Google sign-in. *Persuade.*
- **Dashboard** — connection health, today's readiness, snapshot, trends. *Operate.*
- **Analytics / Insights** — deep numbers, life-time charts, readiness/trends/anomalies/correlations.
- **Settings** — one card per integration (Garmin, MCP, Strava, Withings), each holding its own status,
  its own connect/disconnect, and its own switches. *Operate.*
- **Style guide** — internal component gallery.
