#!/usr/bin/env node
/**
 * Live-reload supervisor for the bind-mounted production stack (spec 019).
 *
 * Deploying is `git pull` on the NAS — nothing else. This process:
 *   1. builds the app and starts `server.js`,
 *   2. polls the mounted source for changes (poll, not inotify: bind mounts on NAS/macOS do not
 *      reliably deliver fs events into the container),
 *   3. on a change: reinstalls deps if the manifest moved, rebuilds, and restarts the server.
 *
 * Safety property that matters in production: the running server is only replaced AFTER a build
 * succeeds. A broken pull leaves the previous good build serving traffic instead of taking the site
 * down — the failure is logged and the watcher waits for the next change.
 */
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const POLL_MS = Number(process.env.LIVE_RELOAD_POLL_MS ?? 5000);
/** Paths whose changes should trigger a rebuild. */
const WATCH = [
  'src',
  'static',
  'vite.config.ts',
  'svelte.config.js',
  'server.js',
  'package.json',
  'pnpm-lock.yaml'
];
/** Never descend into build output or deps — they change as a RESULT of building (feedback loop). */
const SKIP = new Set(['node_modules', '.svelte-kit', 'build', 'build-mcp', '.vite', '.git', 'coverage']);

const log = (msg) => console.log(`[live-reload] ${msg}`);

/** Newest mtime across the watched paths, plus a file count (catches deletions too). */
function scan() {
  let newest = 0;
  let count = 0;
  const visit = (p) => {
    let st;
    try {
      st = statSync(p);
    } catch {
      return; // vanished mid-scan (e.g. during a pull) — the next tick sees the settled tree
    }
    if (st.isDirectory()) {
      if (SKIP.has(path.basename(p))) return;
      for (const entry of readdirSync(p)) visit(path.join(p, entry));
      return;
    }
    count++;
    if (st.mtimeMs > newest) newest = st.mtimeMs;
  };
  for (const rel of WATCH) {
    const abs = path.join(ROOT, rel);
    if (existsSync(abs)) visit(abs);
  }
  return `${newest}:${count}`;
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT });
  return res.status === 0;
}

/** Install (only when the manifest changed) + build. Returns false if the build failed. */
function buildApp({ install }) {
  if (install) {
    log('manifest changed — installing dependencies…');
    // --prod=false: NODE_ENV=production would otherwise skip the devDependencies the build needs.
    if (!run('pnpm', ['install', '--frozen-lockfile', '--prefer-offline', '--prod=false'])) {
      log('install FAILED — keeping the current build');
      return false;
    }
  }
  log('building…');
  if (!run('pnpm', ['run', 'build'])) {
    log('build FAILED — keeping the previous build running');
    return false;
  }
  log('build ok');
  return true;
}

let server = null;

function startServer() {
  server = spawn('node', ['server.js'], { stdio: 'inherit', cwd: ROOT });
  server.on('exit', (code, signal) => {
    // A signal means we killed it for a reload; a code means it died on its own.
    if (signal === null && code !== 0) {
      log(`server exited with code ${code} — restarting in 5s`);
      server = null;
      setTimeout(startServer, 5000);
    }
  });
  log(`server started (pid ${server.pid})`);
}

async function restartServer() {
  if (!server) return startServer();
  await new Promise((resolve) => {
    const child = server;
    server = null;
    child.once('exit', resolve);
    child.kill('SIGTERM');
    // Don't hang forever if it ignores SIGTERM.
    setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* already gone */
      }
      resolve();
    }, 10_000);
  });
  startServer();
}

// ---- boot ----------------------------------------------------------------
if (!buildApp({ install: true })) {
  // Nothing to serve on a cold start; exit non-zero so the platform surfaces it.
  log('initial build failed — exiting');
  process.exit(1);
}
startServer();

let signature = scan();
let manifest = `${statSafe('package.json')}:${statSafe('pnpm-lock.yaml')}`;

function statSafe(rel) {
  try {
    return String(statSync(path.join(ROOT, rel)).mtimeMs);
  } catch {
    return '0';
  }
}

log(`watching for changes (every ${POLL_MS}ms) — deploy with: git pull`);
setInterval(async () => {
  const next = scan();
  if (next === signature) return;

  // Wait for the tree to settle so a half-finished pull never triggers a build.
  let settled = next;
  for (;;) {
    await new Promise((r) => setTimeout(r, 1500));
    const again = scan();
    if (again === settled) break;
    settled = again;
  }
  signature = settled;

  const nextManifest = `${statSafe('package.json')}:${statSafe('pnpm-lock.yaml')}`;
  const install = nextManifest !== manifest;
  manifest = nextManifest;

  log('change detected');
  if (buildApp({ install })) await restartServer();
}, POLL_MS);

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    if (server) server.kill('SIGTERM');
    process.exit(0);
  });
}
