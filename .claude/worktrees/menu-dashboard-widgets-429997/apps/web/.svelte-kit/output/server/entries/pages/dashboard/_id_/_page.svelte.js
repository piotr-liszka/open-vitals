import { aj as is_array, ak as get_prototype_of, al as object_prototype, e as escape_html, g as derived, a as ensure_array_like, d as attr_style, f as stringify, c as attr, b as attr_class, i as spread_props, h as head } from "../../../../chunks/index.js";
import { t as toasts } from "../../../../chunks/toast.js";
/* empty css                                                    */
/* empty css                                                     */
/* empty css                                                                */
/* empty css                                                        */
/* empty css                                                           */
/* empty css                                                        */
/* empty css                                                          */
/* empty css                                                          */
/* empty css                                                          */
/* empty css                                                     */
/* empty css                                                          */
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import { g as goto, i as invalidateAll } from "../../../../chunks/client.js";
import "../../../../chunks/client2.js";
import { A as AppShell } from "../../../../chunks/AppShell.js";
import { S as SyncFooter } from "../../../../chunks/SyncFooter.js";
import { B as Button } from "../../../../chunks/Button.js";
import { C as Card } from "../../../../chunks/Card.js";
import { R as RangeBadge } from "../../../../chunks/RangeBadge.js";
import { C as ConfirmDialog } from "../../../../chunks/ConfirmDialog.js";
import { c as bucketAxisLabel, a as bucketNoun } from "../../../../chunks/series.js";
import { b as sportLabel } from "../../../../chunks/sport-labels.js";
import { m as metricMeta } from "../../../../chunks/metric-labels.js";
import { a as dashboardHref } from "../../../../chunks/dashboard-nav.js";
import { M as MAX_DASHBOARD_NAME, W as WIDGET_TYPES } from "../../../../chunks/dashboards.types.js";
const empty = [];
function snapshot(value, skip_warning = false, no_tojson = false) {
  return clone(value, /* @__PURE__ */ new Map(), "", empty, null, no_tojson);
}
function clone(value, cloned, path, paths, original = null, no_tojson = false) {
  if (typeof value === "object" && value !== null) {
    var unwrapped = cloned.get(value);
    if (unwrapped !== void 0) return unwrapped;
    if (value instanceof Map) return (
      /** @type {Snapshot<T>} */
      new Map(value)
    );
    if (value instanceof Set) return (
      /** @type {Snapshot<T>} */
      new Set(value)
    );
    if (is_array(value)) {
      var copy = (
        /** @type {Snapshot<any>} */
        Array(value.length)
      );
      cloned.set(value, copy);
      if (original !== null) {
        cloned.set(original, copy);
      }
      for (var i = 0; i < value.length; i += 1) {
        var element = value[i];
        if (i in value) {
          copy[i] = clone(element, cloned, path, paths, null, no_tojson);
        }
      }
      return copy;
    }
    if (get_prototype_of(value) === object_prototype) {
      copy = {};
      cloned.set(value, copy);
      if (original !== null) {
        cloned.set(original, copy);
      }
      for (var key of Object.keys(value)) {
        copy[key] = clone(
          // @ts-expect-error
          value[key],
          cloned,
          path,
          paths,
          null,
          no_tojson
        );
      }
      return copy;
    }
    if (value instanceof Date) {
      return (
        /** @type {Snapshot<T>} */
        structuredClone(value)
      );
    }
    if (typeof /** @type {T & { toJSON?: any } } */
    value.toJSON === "function" && !no_tojson) {
      return clone(
        /** @type {T & { toJSON(): any } } */
        value.toJSON(),
        cloned,
        path,
        paths,
        // Associate the instance with the toJSON clone
        value
      );
    }
  }
  if (value instanceof EventTarget) {
    return (
      /** @type {Snapshot<T>} */
      value
    );
  }
  try {
    return (
      /** @type {Snapshot<T>} */
      structuredClone(value)
    );
  } catch (e) {
    return (
      /** @type {Snapshot<T>} */
      value
    );
  }
}
function StreakWidget($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    $$renderer2.push(`<div class="streak svelte-fk1sfn"><span class="flame svelte-fk1sfn" aria-hidden="true">🔥</span> <div><div class="num svelte-fk1sfn">${escape_html(data.streakWeeks)}</div> <div class="cap svelte-fk1sfn">${escape_html(data.streakWeeks === 1 ? "tydzień" : "tygodni")} serii</div></div></div>`);
  });
}
function CoverageWidget($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const km = (m) => `${(m / 1e3).toLocaleString("pl-PL", { maximumFractionDigits: 0 })} km`;
    const cov = derived(() => data.coverage);
    $$renderer2.push(`<div class="grid svelte-dnwonn"><div class="cell svelte-dnwonn"><span class="v svelte-dnwonn">${escape_html(cov().activities.count)}</span><span class="k svelte-dnwonn">Aktywności</span></div> <div class="cell svelte-dnwonn"><span class="v svelte-dnwonn">${escape_html(cov().activities.withGps)}</span><span class="k svelte-dnwonn">Z trasą GPS</span></div> <div class="cell svelte-dnwonn"><span class="v svelte-dnwonn">${escape_html(km(cov().activities.totalDistanceM))}</span><span class="k svelte-dnwonn">Dystans</span></div> <div class="cell svelte-dnwonn"><span class="v svelte-dnwonn">${escape_html(cov().weight.count)}</span><span class="k svelte-dnwonn">Pomiary wagi</span></div></div>`);
  });
}
function WeeklyVolumeWidget($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const all = derived(() => data.weeklyVolume);
    const shown = derived(() => all().slice(-14));
    const hidden = derived(() => all().length - shown().length);
    const max = derived(() => Math.max(1, ...shown().map((w) => w.hours)));
    const fmtBucket = (start) => bucketAxisLabel(start, data.range.bucket);
    $$renderer2.push(`<div class="bars svelte-e13ewm"><!--[-->`);
    const each_array = ensure_array_like(shown());
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let w = each_array[$$index];
      $$renderer2.push(`<div class="row svelte-e13ewm"><span class="lbl svelte-e13ewm">${escape_html(fmtBucket(w.week))}</span> <div class="track svelte-e13ewm"><div class="fill svelte-e13ewm"${attr_style(`width: ${stringify(w.hours / max() * 100)}%`)}></div></div> <span class="val svelte-e13ewm">${escape_html(w.hours ? `${w.hours} h` : "—")}</span></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (hidden() > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="note svelte-e13ewm">Pokazano ${escape_html(shown().length)} ostatnich z ${escape_html(all().length)} w zakresie.</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function ActivityTypesWidget($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const LANES = [
      "orange",
      "cyan",
      "green",
      "indigo",
      "amber",
      "red",
      "sky",
      "teal",
      "lime"
    ];
    const total = derived(() => data.typeBreakdown.reduce((s, t) => s + t.count, 0) || 1);
    $$renderer2.push(`<div class="types svelte-1lhviw7">`);
    const each_array = ensure_array_like(data.typeBreakdown.slice(0, 6));
    if (each_array.length !== 0) {
      $$renderer2.push("<!--[-->");
      for (let i = 0, $$length = each_array.length; i < $$length; i++) {
        let t = each_array[i];
        $$renderer2.push(`<div class="row svelte-1lhviw7"><span class="dot svelte-1lhviw7"${attr_style(`background: var(--lane-${stringify(LANES[i % LANES.length])})`)}></span> <span class="name svelte-1lhviw7">${escape_html(sportLabel(t.sport))}</span> <div class="track svelte-1lhviw7"><div class="fill svelte-1lhviw7"${attr_style(`width: ${stringify(t.count / total() * 100)}%; background: var(--lane-${stringify(LANES[i % LANES.length])})`)}></div></div> <span class="n svelte-1lhviw7">${escape_html(t.count)}</span></div>`);
      }
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<p class="empty svelte-1lhviw7">Brak aktywności w zakresie: ${escape_html(data.range.label)}.</p>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function RecentActivitiesWidget($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const km = (m) => m == null ? "—" : `${(m / 1e3).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} km`;
    const dur = (s) => {
      if (s == null) return "—";
      const h = Math.floor(s / 3600);
      const m = Math.round(s % 3600 / 60);
      return h ? `${h}h ${m}m` : `${m}m`;
    };
    $$renderer2.push(`<div class="list svelte-ndn3yz">`);
    const each_array = ensure_array_like(data.recentActivities);
    if (each_array.length !== 0) {
      $$renderer2.push("<!--[-->");
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let a = each_array[$$index];
        $$renderer2.push(`<a class="item svelte-ndn3yz"${attr("href", `/activities/${a.activityId}`)}><div class="main svelte-ndn3yz"><span class="name svelte-ndn3yz">${escape_html(a.name ?? sportLabel(a.sport))}</span> <span class="date svelte-ndn3yz">${escape_html(a.startTimeLocal.slice(0, 10))}</span></div> <div class="stats svelte-ndn3yz"><span>${escape_html(km(a.distanceM))}</span> <span>${escape_html(dur(a.movingS ?? a.durationS))}</span></div></a>`);
      }
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<p class="empty svelte-ndn3yz">Brak aktywności w zakresie: ${escape_html(data.range.label)}. Zmień zakres u góry lub zsynchronizuj dane w zakładce <a href="/data">Dane</a>.</p>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function MetricTrendWidget($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data, options } = $$props;
    const metricKey = derived(() => typeof options?.metric === "string" ? options.metric : "steps");
    const spec = derived(() => metricMeta(metricKey()));
    const series = derived(() => data.metricSeries[metricKey()] ?? []);
    const points = derived(() => series().filter((p) => p.value !== null));
    const latest = derived(() => points().length ? points()[points().length - 1].value : null);
    const lane = derived(() => spec()?.accent ?? "orange");
    const path = derived(() => {
      if (points().length < 2) return "";
      const vals = points().map((p) => p.value);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const span = max - min || 1;
      return points().map((p, i) => {
        const x = i / (points().length - 1) * 100;
        const y = 30 - (p.value - min) / span * 28;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");
    });
    $$renderer2.push(`<div class="trend svelte-tzl1oa"><div class="head svelte-tzl1oa"><span class="label svelte-tzl1oa">${escape_html(spec()?.label ?? metricKey())}</span> <span class="value svelte-tzl1oa">${escape_html(latest() ?? "—")}<span class="unit svelte-tzl1oa">${escape_html(spec()?.unit ?? "")}</span></span></div> `);
    if (path()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<svg class="spark svelte-tzl1oa" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><path${attr("d", path())} fill="none"${attr("stroke", `var(--lane-${stringify(lane())})`)} stroke-width="1.5" vector-effect="non-scaling-stroke"></path></svg>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<p class="empty svelte-tzl1oa">Za mało danych w zakresie: ${escape_html(data.range.label)}.</p>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
const WIDGETS = {
  streak: {
    label: "Seria",
    description: "Tygodnie z aktywnością pod rząd",
    defaultSpan: 4,
    component: StreakWidget,
    // A streak is "how long, ever" — a window would truncate it into a different, smaller claim.
    ranged: false
  },
  coverage: {
    label: "Zebrane dane",
    description: "Ile danych masz lokalnie",
    defaultSpan: 8,
    component: CoverageWidget,
    // Reports the whole local store, which is exactly what a range must not narrow.
    ranged: false,
    seeAlso: { href: "/data", label: "Pełny obraz w Dane" }
  },
  "weekly-volume": {
    label: "Objętość treningu",
    description: "Godziny treningu na tydzień (miesiąc w długich zakresach)",
    defaultSpan: 6,
    component: WeeklyVolumeWidget,
    ranged: true,
    seeAlso: { href: "/training", label: "Pełny obraz w Trening" }
  },
  "activity-types": {
    label: "Typy aktywności",
    description: "Podział wg sportu w wybranym zakresie",
    defaultSpan: 6,
    component: ActivityTypesWidget,
    ranged: true,
    seeAlso: { href: "/training", label: "Pełny obraz w Trening" }
  },
  "recent-activities": {
    label: "Ostatnie aktywności",
    description: "Najnowsze treningi z wybranego zakresu",
    defaultSpan: 6,
    component: RecentActivitiesWidget,
    ranged: true,
    seeAlso: { href: "/activities", label: "Pełny obraz w Aktywności" }
  },
  "metric-trend": {
    label: "Trend metryki",
    description: "Wykres metryki w wybranym zakresie",
    defaultSpan: 6,
    component: MetricTrendWidget,
    ranged: true,
    seeAlso: { href: "/insights", label: "Pełny obraz w Wnioski" }
  }
};
function DashboardGrid($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { config, dashboardId, data } = $$props;
    const bucketLabel = derived(() => data.range.bucket === "day" ? void 0 : bucketNoun(data.range.bucket));
    let cfg = structuredClone(config);
    let editing = false;
    let adding = false;
    let confirmingDelete = false;
    const active = derived(() => cfg.dashboards.find((d) => d.id === dashboardId) ?? cfg.dashboards[0]);
    const isLast = derived(() => cfg.dashboards.length <= 1);
    async function persist(opts = {}) {
      const res = await fetch("/api/dashboards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(snapshot(cfg))
      });
      if (!res.ok) {
        toasts.error("Nie udało się zapisać panelu");
        return;
      }
      if (opts.refreshNav) await invalidateAll();
    }
    async function deleteDashboard() {
      confirmingDelete = false;
      if (isLast()) return;
      const remaining = cfg.dashboards.filter((d) => d.id !== active().id);
      cfg.dashboards = remaining;
      await persist({ refreshNav: true });
      await goto(dashboardHref(remaining[0].id));
    }
    let dragIndex = null;
    let overIndex = null;
    $$renderer2.push(`<div class="board svelte-xy4qqr"><div class="bar svelte-xy4qqr">`);
    if (editing) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<input class="name-input svelte-xy4qqr" type="text"${attr("value", active().name)}${attr("maxlength", MAX_DASHBOARD_NAME)} aria-label="Nazwa panelu"/>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<h2 class="name svelte-xy4qqr">${escape_html(active().name)}</h2>`);
    }
    $$renderer2.push(`<!--]--> <div class="spacer svelte-xy4qqr"></div> `);
    if (editing) {
      $$renderer2.push("<!--[0-->");
      Button($$renderer2, {
        size: "sm",
        variant: "danger",
        disabled: isLast(),
        title: isLast() ? "To jedyny panel — nie można go usunąć" : void 0,
        onclick: () => confirmingDelete = true,
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Usuń panel`);
        },
        $$slots: { default: true }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    Button($$renderer2, {
      size: "sm",
      variant: editing ? "primary" : "secondary",
      onclick: () => editing = !editing,
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->${escape_html(editing ? "Gotowe" : "Edytuj")}`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----></div> `);
    if (editing) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="adder svelte-xy4qqr">`);
      if (adding) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="picker svelte-xy4qqr"><!--[-->`);
        const each_array = ensure_array_like(WIDGET_TYPES);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let t = each_array[$$index];
          $$renderer2.push(`<button type="button" class="pick svelte-xy4qqr"><span class="pick-name svelte-xy4qqr">${escape_html(WIDGETS[t].label)}</span> <span class="pick-desc svelte-xy4qqr">${escape_html(WIDGETS[t].description)}</span></button>`);
        }
        $$renderer2.push(`<!--]--></div> <div>`);
        Button($$renderer2, {
          size: "sm",
          variant: "ghost",
          onclick: () => adding = false,
          children: ($$renderer3) => {
            $$renderer3.push(`<!---->Anuluj`);
          },
          $$slots: { default: true }
        });
        $$renderer2.push(`<!----></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="adder-row svelte-xy4qqr">`);
        Button($$renderer2, {
          size: "sm",
          variant: "secondary",
          onclick: () => adding = true,
          children: ($$renderer3) => {
            $$renderer3.push(`<!---->+ Dodaj widget`);
          },
          $$slots: { default: true }
        });
        $$renderer2.push(`<!----> <p class="hint svelte-xy4qqr">Przeciągnij kartę za uchwyt, aby zmienić kolejność.</p></div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div${attr_class("board-grid svelte-xy4qqr", void 0, { "editing": editing })} role="list">`);
    const each_array_1 = ensure_array_like(active().widgets);
    if (each_array_1.length !== 0) {
      $$renderer2.push("<!--[-->");
      for (let i = 0, $$length = each_array_1.length; i < $$length; i++) {
        let w = each_array_1[i];
        const def = WIDGETS[w.type];
        const Comp = def.component;
        $$renderer2.push(`<section${attr_class("board-cell svelte-xy4qqr", void 0, {
          "dragging": dragIndex === i,
          "dropzone": overIndex === i && dragIndex !== i
        })} role="listitem"${attr_style(`--span: ${stringify(w.span)}`)}${attr("draggable", editing)}>`);
        Card($$renderer2, {
          children: ($$renderer3) => {
            $$renderer3.push(`<div class="wtitle svelte-xy4qqr">`);
            if (editing) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<span class="grip svelte-xy4qqr" aria-hidden="true" title="Przeciągnij, aby przenieść">⠿</span>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> <span class="wname svelte-xy4qqr">${escape_html(def.label)}</span> `);
            if (def.ranged) {
              $$renderer3.push("<!--[0-->");
              RangeBadge($$renderer3, {
                label: data.range.label,
                bucketNoun: bucketLabel(),
                size: "sm"
              });
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            if (editing) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="wctrl svelte-xy4qqr"><button type="button" title="W lewo" aria-label="Przesuń w lewo"${attr("disabled", i === 0, true)} class="svelte-xy4qqr">←</button> <button type="button" title="W prawo" aria-label="Przesuń w prawo"${attr("disabled", i === active().widgets.length - 1, true)} class="svelte-xy4qqr">→</button> <button type="button" title="Zmień rozmiar" aria-label="Zmień rozmiar" class="svelte-xy4qqr">⤢ ${escape_html(w.span)}</button> <button type="button" class="del svelte-xy4qqr" title="Usuń" aria-label="Usuń widget">✕</button></div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--></div> <div class="wbody svelte-xy4qqr">`);
            if (Comp) {
              $$renderer3.push("<!--[-->");
              Comp($$renderer3, spread_props([{ data }, w.options ? { options: w.options } : {}]));
              $$renderer3.push("<!--]-->");
            } else {
              $$renderer3.push("<!--[!-->");
              $$renderer3.push("<!--]-->");
            }
            $$renderer3.push(`</div> `);
            if (def.seeAlso) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<a class="wsee svelte-xy4qqr"${attr("href", def.seeAlso.href)}>${escape_html(def.seeAlso.label)} →</a>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]-->`);
          }
        });
        $$renderer2.push(`<!----></section>`);
      }
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<p class="empty svelte-xy4qqr">Ten panel jest pusty. Kliknij <strong>Edytuj</strong> → <strong>Dodaj widget</strong>.</p>`);
    }
    $$renderer2.push(`<!--]--></div></div> `);
    ConfirmDialog($$renderer2, {
      open: confirmingDelete,
      title: `Usunąć panel „${stringify(active().name)}”?`,
      body: active().widgets.length === 1 ? "1 widget zostanie usunięty. Tej operacji nie można cofnąć." : `${active().widgets.length} widgetów zostanie usuniętych. Tej operacji nie można cofnąć.`,
      onconfirm: deleteDashboard,
      oncancel: () => confirmingDelete = false
    });
    $$renderer2.push(`<!---->`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    head("1yhad0r", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(data.dashboard.name)} · Vagus</title>`);
      });
    });
    {
      let footer = function($$renderer3) {
        SyncFooter($$renderer3);
      };
      AppShell($$renderer2, {
        title: data.dashboard.name,
        tier: "advanced",
        advanced: true,
        footer,
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->`);
          {
            DashboardGrid($$renderer3, {
              config: data.config,
              dashboardId: data.dashboard.id,
              data: data.widgetData
            });
          }
          $$renderer3.push(`<!---->`);
        }
      });
    }
  });
}
export {
  _page as default
};
