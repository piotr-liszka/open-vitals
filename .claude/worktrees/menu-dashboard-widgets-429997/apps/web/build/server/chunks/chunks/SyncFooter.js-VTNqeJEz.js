import { ab as attr, a5 as escape_html, Q as derived } from './index.js-D7taQuDv.js';
import './exports.js-aFGE3YQF.js';
import './utils2.js-BQzn9ikS.js';
import './utils.js-D6eaf5bT.js';
import './root.js-DLPDgkXe.js';
import './client.js-C1MYAKQX.js';
import { I as IconButton } from './AppShell.js-Dxd-FjMr.js';
import { r as formatInstant } from './date.js-Cf0GyZI8.js';

function SyncFooter($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let status = null;
    let available = true;
    let busy = false;
    let failed = false;
    const run = derived(() => status?.run ?? null);
    const running = derived(() => busy || run()?.status === "running");
    const progressPct = derived(() => run() && run().status === "running" ? Math.round((status?.progress ?? 0) * 100) : null);
    const lastLabel = derived(() => status?.lastSyncAt ? formatInstant(status.lastSyncAt, "dateTime") : "nigdy");
    const unchangedAt = derived(() => {
      const { lastCheckAt, lastSyncAt, lastResult } = status ?? {};
      if (lastResult !== "unchanged" || !lastCheckAt) return null;
      if (lastSyncAt && lastCheckAt <= lastSyncAt) return null;
      return formatInstant(lastCheckAt, "time");
    });
    const nextInMin = derived(() => {
      status?.autoSync?.nextRunAt;
      return null;
    });
    const autoLabel = derived(() => {
      if (nextInMin() === null) return null;
      if (nextInMin() <= 1) return "Auto: w każdej chwili";
      return `Auto za ~${nextInMin()} min`;
    });
    async function load() {
      try {
        const res = await fetch("/api/sync/status", { headers: { accept: "application/json" } });
        if (res.status === 401) {
          available = false;
          return;
        }
        if (!res.ok) return;
        status = await res.json();
        failed = status.run?.status === "failed";
      } catch {
      }
    }
    async function syncNow() {
      if (running()) return;
      busy = true;
      failed = false;
      try {
        const res = await fetch("/api/sync?kind=incremental", { method: "POST" });
        if (!res.ok) {
          failed = true;
          return;
        }
        await load();
      } catch {
        failed = true;
      } finally {
        busy = false;
      }
    }
    if (
      // first observation: nothing changed on screen, don't reload
      available
    ) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="sync svelte-ako9pt"><span class="label svelte-ako9pt">Ostatnia synchronizacja</span> <div class="row svelte-ako9pt"><time class="stamp svelte-ako9pt"${attr("datetime", status?.lastSyncAt ?? void 0)}>${escape_html(lastLabel())}</time> `);
      IconButton($$renderer2, {
        icon: "refresh",
        size: "sm",
        loading: running(),
        onclick: syncNow,
        label: running() ? "Synchronizacja w toku" : "Synchronizuj teraz"
      });
      $$renderer2.push(`<!----></div> `);
      if (running()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="note running svelte-ako9pt" aria-live="polite">Synchronizuję${escape_html(progressPct() !== null ? ` · ${progressPct()}%` : "")}</span>`);
      } else if (failed) {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`<span class="note bad svelte-ako9pt">Ostatnia próba nie powiodła się — <a href="/data" class="svelte-ako9pt">szczegóły</a></span>`);
      } else if (autoLabel()) {
        $$renderer2.push("<!--[2-->");
        $$renderer2.push(`<span class="note auto svelte-ako9pt"><span class="dot svelte-ako9pt" aria-hidden="true"></span> ${escape_html(autoLabel())}${escape_html(unchangedAt() ? ` · bez zmian ${unchangedAt()}` : "")}</span>`);
      } else if (unchangedAt()) {
        $$renderer2.push("<!--[3-->");
        $$renderer2.push(`<span class="note svelte-ako9pt">Sprawdzono ${escape_html(unchangedAt())} · bez zmian</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}

export { SyncFooter as S };
//# sourceMappingURL=SyncFooter.js-VTNqeJEz.js.map
