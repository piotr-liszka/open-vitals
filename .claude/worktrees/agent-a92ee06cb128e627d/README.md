# OpenVitals

*Open, because you run it yourself and it reads nothing you did not connect. Vitals, because that is
the whole content: sleep, HRV, resting heart rate, training — your own body's numbers, carried to an
assistant that can read them.*

Self-hosted, LAN-only service to talk to your **own** Garmin Connect data from AI clients (Claude, ChatGPT).
Log in once with a shared password, and get a health check, a dashboard (later), and a personal **MCP URL** you
paste into your AI client.

> ⚠️ This uses Garmin's private API via community libraries (`garmy` + `curl_cffi`). It is against Garmin's ToS and
> can break when Garmin changes their defenses. It is intended for **personal self-hosting of your own account only**.

## Architecture

```
LAN devices ─► SvelteKit Node service (published)      Python sidecar (internal only)
                UI + REST API + MCP (/mcp?token=)  ──►   garmy + curl_cffi + encrypted token store ─► Garmin
```

- **`apps/web`** — SvelteKit (Svelte 5) + adapter-node: web UI, REST API, and the MCP server, in one Node process.
- **`services/garmin`** — Python sidecar (FastAPI + garmy). The only component that reaches Garmin. Never LAN-exposed.

Why the split: since March 2026 Garmin fronts its API with Cloudflare TLS fingerprinting that blocks plain HTTP
clients; `curl_cffi` (browser-TLS impersonation) is the reliable way through, and it lives in Python.

## Prerequisites

- **Node 22 LTS** and **Docker** (with `docker compose`).
  - macOS via Homebrew: `brew install node` and install Docker Desktop.

## Run

```bash
cp .env.example .env    # then fill in the secrets (see the table in AGENTS.md §11)
docker compose up --build
```

Then, from any device on your LAN, open `http://<machine-ip>:<port>`:

1. Log in with `APP_PASSWORD`.
2. Complete Garmin setup (email + password; enter an MFA code if prompted). Credentials are used once to obtain
   tokens and then discarded — only encrypted tokens are stored.
3. The **health check** turns green once tokens are valid.
4. Copy the **MCP URL** and add it as a connector in your AI client. Ask away.

## Development

See **[AGENTS.md](AGENTS.md)** — the canonical rules for code, styling, modules, testing, and the spec workflow.

```bash
# web
cd apps/web && pnpm install && pnpm dev
pnpm run test && pnpm run check && pnpm run lint
# sidecar
cd services/garmin && pytest
```

Features are built as vertical-slice **modules** (`apps/web/src/modules/<feature>/`) and tracked as **specs**
(`specs/NNN-*.md`): spec → approve → develop → test → close. Tests are unit + API-integration only (no e2e).

### Local HTTPS (dev)

`make dev` serves plain `http://localhost:<WEB_PORT>`. For trusted HTTPS on this machine — useful when
testing Secure cookies, or reaching the dev server over the tailnet — use **Tailscale Serve**:

```bash
make dev-https        # https://<node>.ts.net  (Ctrl-C stops the stack)
make dev-https-down   # stop the stack + reset the serve config
```

Tailscale terminates TLS and proxies to the HTTP dev server, so nothing runs a cert locally (matches the
prod "behind a reverse proxy" model). One-time prereq: enable HTTPS certs (free) for the tailnet at
`https://login.tailscale.com/admin/dns` → **Enable HTTPS…**. This is tailnet-only, **not** public —
cloud clients (e.g. claude.ai) still can't reach it; that would require Tailscale Funnel.

## Security notes

- Only the web service publishes a port; the sidecar is reachable only on the internal Docker network.
- Garmin tokens are encrypted at rest (Fernet). Nothing sensitive is logged or committed. `.env` is git-ignored.
