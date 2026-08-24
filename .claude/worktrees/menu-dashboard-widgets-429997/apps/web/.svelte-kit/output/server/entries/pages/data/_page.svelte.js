import { e as escape_html, a as ensure_array_like, b as attr_class, c as attr, f as stringify, g as derived, h as head } from "../../../chunks/index.js";
import "../../../chunks/toast.js";
/* empty css                                                 */
/* empty css                                                  */
/* empty css                                                             */
/* empty css                                                     */
/* empty css                                                        */
/* empty css                                                     */
/* empty css                                                       */
/* empty css                                                       */
/* empty css                                                       */
/* empty css                                                  */
/* empty css                                                       */
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import { i as invalidateAll } from "../../../chunks/client.js";
import "../../../chunks/client2.js";
import { A as AppShell } from "../../../chunks/AppShell.js";
import { S as SyncFooter } from "../../../chunks/SyncFooter.js";
import { C as Card } from "../../../chunks/Card.js";
import { S as StatTile } from "../../../chunks/StatTile.js";
import { B as Button } from "../../../chunks/Button.js";
import { B as Badge } from "../../../chunks/Badge.js";
import { B as Banner } from "../../../chunks/Banner.js";
import { P as ProgressBar } from "../../../chunks/ProgressBar.js";
import { F as FilterChips } from "../../../chunks/FilterChips.js";
import { a as metricLabel } from "../../../chunks/metric-labels.js";
import { h as formatInstant, i as isDayKey, g as formatDay } from "../../../chunks/date.js";
function DataView($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { coverage, lastRun, connected, prompt = false } = $$props;
    let liveRun = null;
    let liveProgress = null;
    let busy = false;
    let stopping = false;
    let poll = null;
    const run = derived(() => liveRun ?? lastRun);
    const progress = derived(() => liveProgress ?? (lastRun && lastRun.total > 0 ? lastRun.done / lastRun.total : null));
    const running = derived(() => run()?.status === "running" || busy);
    const km = (m) => `${(m / 1e3).toLocaleString("pl-PL", { maximumFractionDigits: 0 })} km`;
    function niceDate(s) {
      if (!s) return "—";
      const head2 = s.slice(0, 10);
      return isDayKey(head2) ? formatDay(head2, "iso") : "—";
    }
    function fmtBytes(b) {
      if (!b) return "0 B";
      const u = ["B", "KB", "MB", "GB"];
      const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
      return `${(b / 1024 ** i).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} ${u[i]}`;
    }
    const PHASE_LABELS = {
      activities: "Aktywności",
      streams: "Trasy / strumienie",
      weight: "Waga",
      planned: "Plan treningowy",
      workoutPush: "Wysyłka treningów",
      metrics: "Metryki dzienne"
    };
    const phaseRows = derived(() => {
      const d = run()?.detail;
      if (!d) return [];
      const rows = [];
      if (d.activities) rows.push({
        key: "activities",
        label: PHASE_LABELS.activities,
        summary: `${d.activities.count} aktywności (${d.activities.pages} stron)`,
        error: d.activities.error ?? null
      });
      if (d.streams) rows.push({
        key: "streams",
        label: PHASE_LABELS.streams,
        // Best efforts are derived inside this phase (spec 054), so they are named here rather than
        // silently inflating "pobranych" — the two are different kinds of work.
        summary: [
          `${d.streams.fetched} pobranych`,
          d.streams.efforts ? `${d.streams.efforts} odcinków przeliczonych` : null,
          d.streams.effortsPending ? `${d.streams.effortsPending} odcinków w kolejce` : null
        ].filter(Boolean).join(", "),
        error: d.streams.error ?? null
      });
      if (d.weight) rows.push({
        key: "weight",
        label: PHASE_LABELS.weight,
        summary: `${d.weight.points} pomiarów`,
        error: d.weight.error ?? null
      });
      if (d.planned) rows.push({
        key: "planned",
        label: PHASE_LABELS.planned,
        summary: d.planned.available ? `${d.planned.count} zaplanowanych` : "kalendarz niedostępny w Garminie",
        error: d.planned.error ?? null
      });
      if (d.workoutPush) rows.push({
        key: "workoutPush",
        label: PHASE_LABELS.workoutPush,
        // The queue is named explicitly: "0 wysłanych" alone would read like "nothing to send".
        summary: [
          `${d.workoutPush.pushed} wysłanych`,
          d.workoutPush.pending > 0 ? `${d.workoutPush.pending} w kolejce` : null,
          d.workoutPush.unsupported > 0 ? `${d.workoutPush.unsupported} niewspieranych` : null
        ].filter(Boolean).join(", "),
        error: d.workoutPush.error ?? null
      });
      if (d.metrics) rows.push({
        key: "metrics",
        label: PHASE_LABELS.metrics,
        summary: `${d.metrics.days} dni z danymi (od ${d.metrics.windowStart ?? "—"})`,
        error: d.metrics.error ?? null
      });
      return rows;
    });
    const logEntries = derived(() => run()?.detail?.log ?? []);
    const logTime = (iso) => formatInstant(iso, "timeSeconds");
    const ago = (iso) => iso ? formatInstant(iso, "dateTime") : "nigdy";
    let logFilter = null;
    const LOG_FILTERS = [
      { value: "warn", label: "Problemy" },
      { value: "error", label: "Tylko błędy" }
    ];
    const visibleLog = derived(() => logFilter === "error" ? logEntries().filter((e) => e.level === "error") : logFilter === "warn" ? logEntries().filter((e) => e.level !== "info") : logEntries());
    const PHASE_NAMES = {
      start: "start",
      activities: "aktywności",
      streams: "trasy",
      weight: "waga",
      planned: "plan",
      workoutPush: "wysyłka treningów",
      metrics: "metryki",
      done: "koniec"
    };
    const CODE_NAMES = {
      rate_limited: "limit zapytań",
      token_rejected: "token wygasł",
      not_connected: "brak połączenia",
      sidecar_unreachable: "usługa nie działa",
      timeout: "przekroczony czas",
      blocked: "zablokowane",
      not_found: "brak endpointu",
      bad_response: "zła odpowiedź",
      upstream_error: "błąd Garmina",
      unsupported: "niedostępne w tym trybie"
    };
    const codeLabel = (code) => CODE_NAMES[code] ?? code;
    const backfill = derived(() => {
      const m = run()?.detail?.metrics;
      if (!m || !m.backfillTo && !m.complete) return null;
      return {
        complete: m.complete === true,
        to: m.backfillTo ?? null,
        target: m.backfillTarget ?? null,
        remaining: m.remainingDays ?? 0
      };
    });
    let sidecar = null;
    let sidecarBusy = false;
    async function loadSidecarLog() {
      sidecarBusy = true;
      try {
        const res = await fetch("/api/sync/diagnostics?limit=200");
        sidecar = await res.json();
      } catch {
        sidecar = { available: false, entries: [], reason: "sidecar_unreachable" };
      } finally {
        sidecarBusy = false;
      }
    }
    const sidecarTime = (t) => formatInstant(new Date(t * 1e3), "timeSeconds");
    async function startSync(kind) {
      if (running()) return;
      busy = true;
      try {
        const res = await fetch(`/api/sync?kind=${kind}`, { method: "POST" });
        const data = await res.json();
        startPolling(data.runId);
      } catch {
        busy = false;
      }
    }
    async function stopSync() {
      stopping = true;
      try {
        const res = await fetch("/api/sync", { method: "DELETE" });
        const data = await res.json();
        liveRun = data.run;
        liveProgress = data.progress;
        if (!data.run || data.run.status !== "running") {
          stopPolling();
          await invalidateAll();
        }
      } finally {
        stopping = false;
      }
    }
    function startPolling(runId) {
      if (poll) clearInterval(poll);
      poll = setInterval(
        async () => {
          try {
            const res = await fetch(`/api/sync/status?runId=${encodeURIComponent(runId)}`);
            const data = await res.json();
            liveRun = data.run;
            liveProgress = data.progress;
            if (!data.run || data.run.status !== "running") {
              stopPolling();
              await invalidateAll();
            }
          } catch {
            stopPolling();
          }
        },
        1e3
      );
    }
    function stopPolling() {
      if (poll) clearInterval(poll);
      poll = null;
      busy = false;
    }
    $$renderer2.push(`<div class="data svelte-1x1lejm">`);
    if (
      // If a sync is already in flight when this page loads, attach the poll so the log + progress stream
      // live (e.g. it was started from another tab or a prior navigation).
      !connected
    ) {
      $$renderer2.push("<!--[0-->");
      Banner($$renderer2, {
        tone: "warning",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Konto Garmin nie jest połączone. Połącz je w <a href="/settings">Ustawieniach</a>, aby synchronizować
      dane.`);
        }
      });
    } else if (prompt) {
      $$renderer2.push("<!--[1-->");
      Banner($$renderer2, {
        tone: "info",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Zalogowano. Chcesz teraz odświeżyć swoje dane z Garmina?`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    Card($$renderer2, {
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="sync-head svelte-1x1lejm"><div><h2 class="svelte-1x1lejm">Synchronizacja</h2> <p class="muted svelte-1x1lejm">Ostatnia synchronizacja: ${escape_html(ago(lastRun?.finishedAt ?? lastRun?.startedAt ?? null))} `);
        if (run()?.status === "failed") {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`· `);
          Badge($$renderer3, {
            tone: "danger",
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->błąd`);
            }
          });
          $$renderer3.push(`<!---->`);
        } else if (run()?.status === "succeeded") {
          $$renderer3.push("<!--[1-->");
          $$renderer3.push(`· `);
          Badge($$renderer3, {
            tone: "success",
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->ok`);
            }
          });
          $$renderer3.push(`<!---->`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--></p></div> <div class="sync-actions svelte-1x1lejm">`);
        if (running()) {
          $$renderer3.push("<!--[0-->");
          Button($$renderer3, {
            size: "sm",
            variant: "secondary",
            loading: stopping,
            onclick: stopSync,
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->Zatrzymaj`);
            },
            $$slots: { default: true }
          });
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        Button($$renderer3, {
          size: "sm",
          variant: "secondary",
          disabled: running() || !connected,
          onclick: () => startSync("incremental"),
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->Synchronizuj teraz`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----> `);
        Button($$renderer3, {
          size: "sm",
          disabled: running() || !connected,
          onclick: () => startSync("full"),
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->Pełna synchronizacja`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----></div></div> `);
        if (running()) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<div class="progress svelte-1x1lejm">`);
          ProgressBar($$renderer3, {
            value: progress(),
            label: run()?.step ? `Pobieranie: ${run().step}` : "Synchronizacja…"
          });
          $$renderer3.push(`<!----></div>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        if (phaseRows().length > 0) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<div class="phases svelte-1x1lejm"><!--[-->`);
          const each_array = ensure_array_like(phaseRows());
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let p = each_array[$$index];
            $$renderer3.push(`<div${attr_class("phase svelte-1x1lejm", void 0, { "err": p.error })}><span class="pname svelte-1x1lejm">${escape_html(p.label)}</span> <span class="psum svelte-1x1lejm">${escape_html(p.summary)}</span> `);
            if (p.error) {
              $$renderer3.push("<!--[0-->");
              Badge($$renderer3, {
                tone: "danger",
                children: ($$renderer4) => {
                  $$renderer4.push(`<!---->${escape_html(p.error)}`);
                }
              });
            } else {
              $$renderer3.push("<!--[-1-->");
              Badge($$renderer3, {
                tone: "success",
                dot: false,
                children: ($$renderer4) => {
                  $$renderer4.push(`<!---->OK`);
                }
              });
            }
            $$renderer3.push(`<!--]--></div>`);
          }
          $$renderer3.push(`<!--]--></div>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        if (backfill()) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<p class="backfill svelte-1x1lejm">`);
          if (backfill().complete) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`Historia metryk dziennych jest kompletna.`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`Uzupełnianie historii: pobrano wstecz do <strong>${escape_html(niceDate(backfill().to))}</strong> `);
            if (backfill().remaining > 0) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`· zostało ~${escape_html(backfill().remaining)} dni (do ${escape_html(niceDate(backfill().target))})`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> · dociąganie trwa dalej przy kolejnych synchronizacjach.`);
          }
          $$renderer3.push(`<!--]--></p>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        if (logEntries().length > 0) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<details class="log svelte-1x1lejm"${attr("open", running(), true)}><summary class="svelte-1x1lejm">Dziennik synchronizacji (${escape_html(logEntries().length)})</summary> <div class="logfilter svelte-1x1lejm">`);
          FilterChips($$renderer3, {
            options: LOG_FILTERS,
            value: logFilter,
            onSelect: (v) => logFilter = v,
            ariaLabel: "Filtr dziennika",
            allLabel: "Wszystko"
          });
          $$renderer3.push(`<!----></div> <div class="loglines svelte-1x1lejm">`);
          const each_array_1 = ensure_array_like(visibleLog());
          if (each_array_1.length !== 0) {
            $$renderer3.push("<!--[-->");
            for (let i = 0, $$length = each_array_1.length; i < $$length; i++) {
              let e = each_array_1[i];
              $$renderer3.push(`<div${attr_class(`logline ${stringify(e.level)}`, "svelte-1x1lejm")}><span class="lt svelte-1x1lejm">${escape_html(logTime(e.t))}</span> `);
              if (e.phase) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`<span class="lp svelte-1x1lejm">${escape_html(PHASE_NAMES[e.phase] ?? e.phase)}</span>`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--> <span class="lm svelte-1x1lejm">${escape_html(e.msg)} `);
              if (e.metric || e.day) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`<span class="lmeta svelte-1x1lejm">${escape_html(e.metric ?? "")}${escape_html(e.metric && e.day ? " · " : "")}${escape_html(e.day ?? "")}</span>`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--></span> `);
              if (e.code) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`<span class="lcode svelte-1x1lejm">${escape_html(codeLabel(e.code))}${escape_html(e.retryable === false ? " · wymaga działania" : "")}</span>`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--></div>`);
            }
          } else {
            $$renderer3.push("<!--[!-->");
            $$renderer3.push(`<p class="logempty svelte-1x1lejm">Brak wpisów dla wybranego filtru.</p>`);
          }
          $$renderer3.push(`<!--]--></div></details>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> <details class="log svelte-1x1lejm"><summary class="svelte-1x1lejm">Log usługi Garmin (Python)</summary> <p class="muted svelte-1x1lejm">Szczegóły po stronie usługi łączącej się z Garminem — dokładny powód odrzucenia zapytania.</p> <div class="sidecar-actions svelte-1x1lejm">`);
        Button($$renderer3, {
          size: "sm",
          variant: "secondary",
          loading: sidecarBusy,
          onclick: loadSidecarLog,
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->${escape_html(sidecar ? "Odśwież log" : "Pobierz log")}`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----></div> `);
        if (sidecar && !sidecar.available) {
          $$renderer3.push("<!--[0-->");
          Banner($$renderer3, {
            tone: "warning",
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->Log niedostępny: ${escape_html(codeLabel(sidecar.reason ?? "upstream_error"))}.`);
            }
          });
        } else if (sidecar) {
          $$renderer3.push("<!--[1-->");
          $$renderer3.push(`<div class="loglines svelte-1x1lejm">`);
          const each_array_2 = ensure_array_like(sidecar.entries);
          if (each_array_2.length !== 0) {
            $$renderer3.push("<!--[-->");
            for (let i = 0, $$length = each_array_2.length; i < $$length; i++) {
              let e = each_array_2[i];
              $$renderer3.push(`<div${attr_class(`logline ${stringify(e.level === "warning" ? "warn" : e.level)}`, "svelte-1x1lejm")}><span class="lt svelte-1x1lejm">${escape_html(sidecarTime(e.t))}</span> <span class="lm svelte-1x1lejm">${escape_html(e.msg)} `);
              if (e.endpoint) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`<span class="lmeta svelte-1x1lejm">${escape_html(e.endpoint)}</span>`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--></span> `);
              if (e.code) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`<span class="lcode svelte-1x1lejm">${escape_html(codeLabel(e.code))}</span>`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--></div>`);
            }
          } else {
            $$renderer3.push("<!--[!-->");
            $$renderer3.push(`<p class="logempty svelte-1x1lejm">Brak wpisów — usługa nie odnotowała nic dla tego konta.</p>`);
          }
          $$renderer3.push(`<!--]--></div>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--></details>`);
      }
    });
    $$renderer2.push(`<!----> <div class="tiles svelte-1x1lejm">`);
    StatTile($$renderer2, {
      label: "Dane od",
      value: coverage.earliest ?? "—",
      accent: "orange"
    });
    $$renderer2.push(`<!----> `);
    StatTile($$renderer2, {
      label: "Aktywności",
      value: String(coverage.activities.count),
      accent: "cyan"
    });
    $$renderer2.push(`<!----> `);
    StatTile($$renderer2, {
      label: "Łączny dystans",
      value: km(coverage.activities.totalDistanceM),
      accent: "green"
    });
    $$renderer2.push(`<!----> `);
    StatTile($$renderer2, {
      label: "Pomiary wagi",
      value: String(coverage.weight.count),
      accent: "indigo"
    });
    $$renderer2.push(`<!----> `);
    StatTile($$renderer2, {
      label: "Rozmiar w bazie",
      value: fmtBytes(coverage.storage.totalBytes),
      accent: "amber"
    });
    $$renderer2.push(`<!----></div> <p class="rows-note svelte-1x1lejm">W bazie: ${escape_html(coverage.storage.rows.metricDays.toLocaleString("pl-PL"))} dni metryk ·
    ${escape_html(coverage.storage.rows.activities.toLocaleString("pl-PL"))} aktywności (${escape_html(coverage.activities.withGps)} z GPS)
    ·
    ${escape_html(coverage.storage.rows.streams.toLocaleString("pl-PL"))} strumieni tras ·
    ${escape_html(coverage.storage.rows.weight.toLocaleString("pl-PL"))} pomiarów wagi</p> `);
    Card($$renderer2, {
      children: ($$renderer3) => {
        $$renderer3.push(`<h2 class="svelte-1x1lejm">Pokrycie danych dziennych</h2> <p class="muted svelte-1x1lejm">Zakres dni zsynchronizowanych lokalnie dla każdej metryki.</p> <div class="cov-table svelte-1x1lejm" role="table"><div class="cov-row cov-head svelte-1x1lejm" role="row"><span role="columnheader">Metryka</span> <span role="columnheader">Od</span> <span role="columnheader">Do</span> <span role="columnheader">Dni z danymi</span></div> `);
        const each_array_3 = ensure_array_like(coverage.metrics);
        if (each_array_3.length !== 0) {
          $$renderer3.push("<!--[-->");
          for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
            let m = each_array_3[$$index_3];
            $$renderer3.push(`<div class="cov-row svelte-1x1lejm" role="row"><span role="cell">${escape_html(metricLabel(m.metric))}</span> <span role="cell" class="mono svelte-1x1lejm">${escape_html(niceDate(m.firstDay))}</span> <span role="cell" class="mono svelte-1x1lejm">${escape_html(niceDate(m.lastDay))}</span> <span role="cell" class="mono svelte-1x1lejm">${escape_html(m.presentDays)}</span></div>`);
          }
        } else {
          $$renderer3.push("<!--[!-->");
          $$renderer3.push(`<p class="muted empty svelte-1x1lejm">Brak danych. Uruchom pełną synchronizację, aby pobrać historię.</p>`);
        }
        $$renderer3.push(`<!--]--></div>`);
      }
    });
    $$renderer2.push(`<!----></div>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    head("1yre5p1", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Dane · Vagus</title>`);
      });
    });
    {
      let footer = function($$renderer3) {
        SyncFooter($$renderer3);
      };
      AppShell($$renderer2, {
        advanced: data.advanced,
        title: "Twoje dane",
        tier: data.advanced ? "advanced" : "base",
        footer,
        children: ($$renderer3) => {
          DataView($$renderer3, {
            coverage: data.coverage,
            lastRun: data.lastRun,
            connected: data.connected,
            prompt: data.prompt
          });
        }
      });
    }
  });
}
export {
  _page as default
};
