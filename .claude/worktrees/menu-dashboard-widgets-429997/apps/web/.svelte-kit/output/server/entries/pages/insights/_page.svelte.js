import { e as escape_html, a as ensure_array_like, g as derived, d as attr_style, f as stringify, b as attr_class, h as head } from "../../../chunks/index.js";
import { i as invalidateAll } from "../../../chunks/client.js";
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
import "../../../chunks/client2.js";
import { A as AppShell } from "../../../chunks/AppShell.js";
import { S as SyncFooter } from "../../../chunks/SyncFooter.js";
import { C as Card } from "../../../chunks/Card.js";
import { B as Badge } from "../../../chunks/Badge.js";
import { B as Banner } from "../../../chunks/Banner.js";
import { S as Skeleton } from "../../../chunks/Skeleton.js";
import { S as StatTile } from "../../../chunks/StatTile.js";
import { T as TrendChart } from "../../../chunks/TrendChart.js";
import { R as RangeBadge } from "../../../chunks/RangeBadge.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import { g as formatDay } from "../../../chunks/date.js";
import { c as bucketAxisLabel, a as bucketNoun } from "../../../chunks/series.js";
import { C as ConsentPanel } from "../../../chunks/ConsentPanel.js";
import { R as ReadinessGauge } from "../../../chunks/ReadinessGauge.js";
function ReadinessCard($$renderer, $$props) {
  let { readiness, connected, enabled, loading = false, consent } = $$props;
  Card($$renderer, {
    title: "Gotowość",
    subtitle: "Jak bardzo jesteś dziś gotowy w porównaniu z Twoją ostatnią bazą",
    children: ($$renderer2) => {
      if (loading) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="loading svelte-1g5o4od">`);
        Skeleton($$renderer2, {
          width: "var(--space-16)",
          height: "var(--space-12)",
          radius: "md"
        });
        $$renderer2.push(`<!----> `);
        Skeleton($$renderer2, { width: "60%", height: "var(--space-4)" });
        $$renderer2.push(`<!----> `);
        Skeleton($$renderer2, { width: "80%", height: "var(--space-4)" });
        $$renderer2.push(`<!----></div>`);
      } else if (!connected) {
        $$renderer2.push("<!--[1-->");
        $$renderer2.push(`<p class="note svelte-1g5o4od">Połącz konto Garmin, aby zobaczyć swoją gotowość.</p> <a class="link svelte-1g5o4od" href="/">Połącz na pulpicie →</a>`);
      } else if (!enabled) {
        $$renderer2.push("<!--[2-->");
        $$renderer2.push(`<p class="note svelte-1g5o4od">Gotowość korzysta z Twoich wielodniowych metryk. Włącz tryb zaawansowany, aby ją uruchomić.</p> `);
        consent?.($$renderer2);
        $$renderer2.push(`<!---->`);
      } else if (readiness === null) {
        $$renderer2.push("<!--[3-->");
        $$renderer2.push(`<p class="note svelte-1g5o4od">Za mało danych — synchronizuj zegarek i wróć za kilka dni.</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        ReadinessGauge($$renderer2, { readiness });
      }
      $$renderer2.push(`<!--]-->`);
    }
  });
}
function InsightsView($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      data,
      range,
      analyticsFeature,
      loading = false,
      onConsentChange
    } = $$props;
    const bucketLabel = derived(() => range.bucket === "day" ? void 0 : bucketNoun(range.bucket));
    const STRENGTH_TONE = { weak: "neutral", moderate: "info", strong: "success" };
    const STRENGTH_LABEL = { weak: "słaba", moderate: "umiarkowana", strong: "silna" };
    const SEVERITY_LABEL = { moderate: "umiarkowana", strong: "silna" };
    const formatByKey = derived(() => new Map(data.charts.map((c) => [c.key, c.format])));
    function fmt(n, format) {
      if (n === null) return "—";
      switch (format) {
        case "int":
          return Math.round(n).toLocaleString("pl-PL");
        case "decimal":
          return n.toFixed(1);
        case "duration": {
          const t = Math.round(n);
          return `${Math.floor(t / 3600)}h ${String(Math.floor(t % 3600 / 60)).padStart(2, "0")}m`;
        }
      }
    }
    const fmtDate = (key) => formatDay(key, "short");
    function trendGoodWhen(t) {
      if (t.direction === "stable" || t.magnitudePct === null) return void 0;
      const moveUp = t.magnitudePct > 0;
      return t.direction === "improving" ? moveUp ? "up" : "down" : moveUp ? "down" : "up";
    }
    function trendArrow(t) {
      if (t.direction === "stable" || t.magnitudePct === null) return "flat";
      return t.magnitudePct > 0 ? "up" : "down";
    }
    function stats(m) {
      if (m.count === 0) return [];
      const rows = [
        { label: "Średnia", value: fmt(m.avg, m.format) },
        {
          label: "Zakres",
          value: `${fmt(m.min, m.format)} – ${fmt(m.max, m.format)}`
        }
      ];
      if (m.total !== null) rows.push({ label: "Suma", value: fmt(m.total, m.format) });
      if (m.best) rows.push({
        label: "Najlepszy",
        value: `${fmt(m.best.value, m.format)} · ${fmtDate(m.best.date)}`,
        tone: "good"
      });
      if (m.worst) rows.push({
        label: "Najsłabszy",
        value: `${fmt(m.worst.value, m.format)} · ${fmtDate(m.worst.date)}`
      });
      rows.push({ label: "Dni z danymi", value: `${m.count} / ${m.rangeDays}` });
      return rows;
    }
    $$renderer2.push(`<div class="insights svelte-1evgn4n"><header class="head svelte-1evgn4n"><div><h2 class="h svelte-1evgn4n">Wnioski</h2> `);
    if (data.connected && data.enabled) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="sub svelte-1evgn4n">${escape_html(fmtDate(data.start))} – ${escape_html(fmtDate(data.end))} · ${escape_html(data.window)} dni</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<p class="sub svelte-1evgn4n">Gotowość, trendy, anomalie i korelacje z Twoich własnych metryk</p>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    RangeBadge($$renderer2, { label: range.label, bucketNoun: bucketLabel() });
    $$renderer2.push(`<!----></header> `);
    if (loading) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="loading svelte-1evgn4n">`);
      Skeleton($$renderer2, { height: "var(--space-24)", radius: "lg" });
      $$renderer2.push(`<!----> `);
      Skeleton($$renderer2, { height: "var(--space-16)", radius: "lg" });
      $$renderer2.push(`<!----> `);
      Skeleton($$renderer2, { height: "var(--space-24)", radius: "lg" });
      $$renderer2.push(`<!----></div>`);
    } else if (!data.connected) {
      $$renderer2.push("<!--[1-->");
      Card($$renderer2, {
        title: "Połącz Garmina, aby zobaczyć wnioski",
        subtitle: "Wnioski wymagają połączonego konta Garmin.",
        children: ($$renderer3) => {
          $$renderer3.push(`<a class="link svelte-1evgn4n" href="/">Połącz na pulpicie →</a>`);
        }
      });
    } else if (!data.enabled) {
      $$renderer2.push("<!--[2-->");
      Card($$renderer2, {
        title: "Włącz tryb zaawansowany",
        subtitle: "Wnioski powstają z Twoich wielodniowych metryk.",
        children: ($$renderer3) => {
          if (analyticsFeature) {
            $$renderer3.push("<!--[0-->");
            ConsentPanel($$renderer3, {
              feature: analyticsFeature,
              onUpdated: () => onConsentChange?.()
            });
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]-->`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
      ReadinessCard($$renderer2, {
        readiness: data.readiness,
        connected: data.connected,
        enabled: data.enabled
      });
      $$renderer2.push(`<!----> <section aria-label="Trendy"><h3 class="section-title svelte-1evgn4n">Trendy</h3> `);
      if (data.trends.length === 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="empty svelte-1evgn4n">Za mało danych, aby pokazać trendy.</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="trend-grid svelte-1evgn4n"><!--[-->`);
        const each_array = ensure_array_like(data.trends);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let t = each_array[$$index];
          StatTile($$renderer2, {
            label: t.label,
            value: `${fmt(t.recentAvg, t.format)}${t.unit ? " " + t.unit : ""}`,
            accent: t.accent,
            delta: t.magnitudePct ?? void 0,
            deltaSuffix: "%",
            goodWhen: trendGoodWhen(t),
            trend: trendArrow(t)
          });
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]--></section> <section aria-label="Anomalie"><h3 class="section-title svelte-1evgn4n">Anomalie</h3> `);
      if (data.anomalies.length === 0) {
        $$renderer2.push("<!--[0-->");
        Banner($$renderer2, {
          tone: "success",
          title: "Nic nietypowego",
          children: ($$renderer3) => {
            $$renderer3.push(`<!---->Nic nietypowego — Twoje metryki są stabilne.`);
          }
        });
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="anomaly-list svelte-1evgn4n"><!--[-->`);
        const each_array_1 = ensure_array_like(data.anomalies);
        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
          let a = each_array_1[$$index_1];
          Banner($$renderer2, {
            tone: a.severity === "strong" ? "warning" : "info",
            title: `${a.label}: ${a.direction === "up" ? "nietypowo wysoko" : "nietypowo nisko"} ${fmtDate(a.date)}`,
            children: ($$renderer3) => {
              $$renderer3.push(`<!---->Odczyt ${escape_html(fmt(a.value, formatByKey().get(a.key) ?? "int"))} — ${escape_html(Math.abs(a.z).toFixed(1))} SD od Twojej bazy
              z ${escape_html(data.window)} dni (odchylenie ${escape_html(SEVERITY_LABEL[a.severity])}).`);
            }
          });
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]--></section> <section aria-label="Korelacje"><h3 class="section-title svelte-1evgn4n">Korelacje</h3> `);
      if (data.correlations.length === 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="empty svelte-1evgn4n">Brak istotnych korelacji — pojawią się, gdy zbierzemy więcej dni.</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="corr-grid svelte-1evgn4n"><!--[-->`);
        const each_array_2 = ensure_array_like(data.correlations);
        for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
          let c = each_array_2[$$index_2];
          Card($$renderer2, {
            children: ($$renderer3) => {
              $$renderer3.push(`<div class="corr svelte-1evgn4n"><p class="corr-phrase svelte-1evgn4n">${escape_html(c.phrasing)}</p> <div class="corr-meta svelte-1evgn4n">`);
              Badge($$renderer3, {
                tone: STRENGTH_TONE[c.strength],
                children: ($$renderer4) => {
                  $$renderer4.push(`<!---->${escape_html(STRENGTH_LABEL[c.strength])}`);
                }
              });
              $$renderer3.push(`<!----> <span class="corr-r svelte-1evgn4n">r = ${escape_html(c.r)} · ${escape_html(c.n)} dni</span></div></div>`);
            }
          });
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]--></section> <section aria-label="Wykresy długiego okresu"><div class="section-head svelte-1evgn4n"><h3 class="section-title svelte-1evgn4n">Metryki — ${escape_html(range.label)}</h3> `);
      RangeBadge($$renderer2, { label: range.label, bucketNoun: bucketLabel(), size: "sm" });
      $$renderer2.push(`<!----></div> <div class="chart-grid svelte-1evgn4n"><!--[-->`);
      const each_array_3 = ensure_array_like(data.charts);
      for (let $$index_4 = 0, $$length = each_array_3.length; $$index_4 < $$length; $$index_4++) {
        let chart = each_array_3[$$index_4];
        Card($$renderer2, {
          children: ($$renderer3) => {
            $$renderer3.push(`<div class="chart-panel svelte-1evgn4n"><div class="chart-head svelte-1evgn4n"><span class="chart-title svelte-1evgn4n"><span class="marker svelte-1evgn4n"${attr_style(`--m: var(--lane-${stringify(chart.accent)})`)}></span>${escape_html(chart.label)}</span> `);
            if (chart.unit) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<span class="chart-unit svelte-1evgn4n">${escape_html(chart.unit)}</span>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--></div> `);
            if (chart.count === 0) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<p class="empty svelte-1evgn4n">Brak danych w tym zakresie.</p>`);
            } else {
              $$renderer3.push("<!--[-1-->");
              TrendChart($$renderer3, {
                values: chart.days.map((d) => d.value ?? NaN),
                labels: chart.days.map((d) => bucketAxisLabel(d.date, range.bucket)),
                color: `var(--lane-${chart.accent})`,
                height: 150,
                showAvg: true,
                label: chart.label,
                formatValue: (n) => fmt(n, chart.format)
              });
              $$renderer3.push(`<!----> <dl class="stats svelte-1evgn4n"><!--[-->`);
              const each_array_4 = ensure_array_like(stats(chart));
              for (let $$index_3 = 0, $$length2 = each_array_4.length; $$index_3 < $$length2; $$index_3++) {
                let s = each_array_4[$$index_3];
                $$renderer3.push(`<div class="stat svelte-1evgn4n"><dt class="svelte-1evgn4n">${escape_html(s.label)}</dt> <dd${attr_class("svelte-1evgn4n", void 0, { "good": s.tone === "good" })}>${escape_html(s.value)}</dd></div>`);
              }
              $$renderer3.push(`<!--]--></dl>`);
            }
            $$renderer3.push(`<!--]--></div>`);
          }
        });
      }
      $$renderer2.push(`<!--]--></div></section>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    async function refresh() {
      await invalidateAll();
    }
    head("u6zn5i", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Wnioski · Vagus</title>`);
      });
    });
    {
      let footer = function($$renderer3) {
        SyncFooter($$renderer3);
      };
      AppShell($$renderer2, {
        advanced: true,
        title: "Wnioski",
        footer,
        children: ($$renderer3) => {
          InsightsView($$renderer3, {
            data: data.insights,
            range: data.range,
            analyticsFeature: data.analyticsFeature,
            onConsentChange: refresh
          });
        }
      });
    }
  });
}
export {
  _page as default
};
