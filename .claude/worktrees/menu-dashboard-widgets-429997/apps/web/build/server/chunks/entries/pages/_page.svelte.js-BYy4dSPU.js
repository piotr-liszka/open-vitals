import { af as head, a5 as escape_html, a7 as ensure_array_like, a4 as attr_class, ag as attr_style, a6 as stringify, ab as attr, Q as derived, ah as props_id } from '../../chunks/index.js-D7taQuDv.js';
import { i as invalidateAll } from '../../chunks/client.js-C1MYAKQX.js';
import '../../chunks/toast.js-D9a9Yw3o.js';
import { B as Banner } from '../../chunks/Banner.js-fddbOwaW.js';
import '../../chunks/client2.js-DKEBrJ7O.js';
import { A as AppShell, w as writePref, a as writeBoolPref } from '../../chunks/AppShell.js-Dxd-FjMr.js';
import { S as SyncFooter } from '../../chunks/SyncFooter.js-VTNqeJEz.js';
import { C as Card } from '../../chunks/Card.js-D8ZxuUNK.js';
import { S as StatTile } from '../../chunks/StatTile.js-DDgLmTba.js';
import { T as TrendChart } from '../../chunks/TrendChart.js-C2RJO89W.js';
import { R as RangeBadge } from '../../chunks/RangeBadge.js-CR-NnSex.js';
import '../../chunks/exports.js-aFGE3YQF.js';
import '../../chunks/utils2.js-BQzn9ikS.js';
import '../../chunks/utils.js-D6eaf5bT.js';
import '../../chunks/root.js-DLPDgkXe.js';
import { r as formatInstant, i as formatDay, d as daysBetween } from '../../chunks/date.js-Cf0GyZI8.js';
import { d as bucketNoun, e as bucketAxisLabel } from '../../chunks/series.js-BlIzPiOH.js';
import { C as ConsentPanel } from '../../chunks/ConsentPanel.js-BgRTbgDF.js';
import { a as formatMetricText } from '../../chunks/dashboard.format.js-EKs6APVZ.js';
import { B as Badge } from '../../chunks/Badge.js-Bcg4u8Go.js';
import { S as SegmentedControl } from '../../chunks/SegmentedControl.js-vIk-Z1KL.js';
import { S as Skeleton } from '../../chunks/Skeleton.js-CIiszAAg.js';
import { I as Icon } from '../../chunks/Icon.js-D5N4FEG5.js';
import { S as StackedBar } from '../../chunks/StackedBar.js-B5eUCO7y.js';
import { R as ReadinessGauge } from '../../chunks/ReadinessGauge.js-BABYMBSa.js';
import { a as fmtRecovery, f as fmtSleepDuration, b as fmtChannelValue, c as fmtDelta, d as fmtBaseline, e as fmtPercent } from '../../chunks/condition.format.js-D1Rk637l.js';
import { B as Button } from '../../chunks/Button.js-B1j4uOxB.js';
import { S as SetupForm } from '../../chunks/SetupForm.js-DbPkuttk.js';
import { S as Sparkline } from '../../chunks/Sparkline.js-CULxbeAT.js';
import { T as ThemeToggle } from '../../chunks/ThemeToggle.js-T-urDE0b.js';
import '../../chunks/uneval.js-BnYgIxRU.js';
import '../../chunks/index2.js-DFeLIU8S.js';
import '../../chunks/range.js-VDtVJAwH.js';
import '../../chunks/stores.js-pwimOGzR.js';
import '../../chunks/Input.js-Bx-2KbvO.js';
import '../../chunks/Field.js-C_UPfDr-.js';

function InfoPopover($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const id = props_id($$renderer2);
    let { label } = $$props;
    let open = false;
    $$renderer2.push(`<span class="info svelte-v7h5kj"><button type="button"${attr_class("trigger svelte-v7h5kj", void 0, { "open": open })}${attr("aria-label", label)}${attr("aria-expanded", open)}${attr("aria-controls", id)}${attr("title", label)}>`);
    Icon($$renderer2, { name: "help", size: 16 });
    $$renderer2.push(`<!----></button> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></span>`);
  });
}
function MetricsDashboard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      data,
      analyticsFeature,
      onConsentChange,
      updatedLabel,
      busy = false
    } = $$props;
    const dateLabel = derived(() => formatDay(data.date, "long"));
    const bucketLabel = derived(() => data.range.bucket === "day" ? void 0 : bucketNoun(data.range.bucket));
    const dayLabels = derived(() => data.days.map((d) => bucketAxisLabel(d, data.range.bucket)));
    function chartValues(series) {
      return series.map((v) => v === null ? Number.NaN : v);
    }
    const definedCount = (series) => series.reduce((n, v) => v === null ? n : n + 1, 0);
    $$renderer2.push(`<section class="dash svelte-1jfifjz" aria-label="Dzisiejsze metryki"><header class="head svelte-1jfifjz"><div><h2 class="h svelte-1jfifjz">Dziś</h2> <p class="sub svelte-1jfifjz">Migawka z ${escape_html(dateLabel())}</p></div> <div class="head-meta svelte-1jfifjz">`);
    if (updatedLabel) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="updated svelte-1jfifjz" aria-live="polite">${escape_html(updatedLabel)}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (data.analyticsEnabled) {
      $$renderer2.push("<!--[0-->");
      RangeBadge($$renderer2, {
        label: data.range.label,
        bucketNoun: bucketLabel(),
        size: "sm"
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></header> <div${attr_class("grid svelte-1jfifjz", void 0, { "busy": busy })}${attr("aria-busy", busy)}><!--[-->`);
    const each_array = ensure_array_like(data.tiles);
    for (let i = 0, $$length = each_array.length; i < $$length; i++) {
      let tile = each_array[i];
      $$renderer2.push(`<div class="cell svelte-1jfifjz"${attr_style(`--i: ${stringify(i)};`)}>`);
      {
        let sparkline = function($$renderer3) {
          if (data.analyticsEnabled && definedCount(tile.series) > 1) {
            $$renderer3.push("<!--[0-->");
            TrendChart($$renderer3, {
              values: chartValues(tile.series),
              labels: dayLabels(),
              color: `var(--lane-${tile.accent})`,
              label: tile.label,
              height: 96,
              yAxis: false,
              legend: false,
              showArea: true,
              formatValue: (n) => formatMetricText(n, tile.format)
            });
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]-->`);
        };
        StatTile($$renderer2, {
          label: tile.label,
          value: tile.value ?? "—",
          muted: tile.value === null,
          unit: tile.unit,
          accent: tile.accent,
          delta: data.analyticsEnabled && tile.delta !== null ? tile.delta : void 0,
          deltaSuffix: "%",
          goodWhen: tile.goodWhen,
          sparkline
        });
      }
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    if (!data.analyticsEnabled && analyticsFeature) {
      $$renderer2.push("<!--[0-->");
      Card($$renderer2, {
        title: "Odblokuj trendy tygodniowe",
        subtitle: "Włącz, aby zobaczyć, jak każda metryka zmienia się w czasie",
        children: ($$renderer3) => {
          ConsentPanel($$renderer3, {
            feature: analyticsFeature,
            onUpdated: () => onConsentChange?.()
          });
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></section>`);
  });
}
const GARMIN_LEVEL_TONE = {
  prime: "success",
  high: "info",
  moderate: "warning",
  low: "danger",
  poor: "danger",
  unknown: "neutral"
};
const GARMIN_LEVEL_LABEL = {
  prime: "Szczytowa",
  high: "Wysoka",
  moderate: "Umiarkowana",
  low: "Niska",
  poor: "Bardzo niska",
  unknown: "Bez oceny"
};
function GarminReadinessGauge($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { readiness, size = "md" } = $$props;
    $$renderer2.push(`<div${attr_class("gauge svelte-maxsy8", void 0, { "lg": size === "lg" })}><div class="score-block svelte-maxsy8"><span class="score svelte-maxsy8">${escape_html(readiness.score)}</span> <div class="band svelte-maxsy8">`);
    Badge($$renderer2, {
      tone: GARMIN_LEVEL_TONE[readiness.level],
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->${escape_html(GARMIN_LEVEL_LABEL[readiness.level])}`);
      }
    });
    $$renderer2.push(`<!----> <span class="basis svelte-maxsy8">wynik Garmina, 0–100</span></div></div> `);
    if (readiness.factors.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<ul class="factors svelte-maxsy8" aria-label="Czynniki gotowości według Garmina"><!--[-->`);
      const each_array = ensure_array_like(readiness.factors);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let f = each_array[$$index];
        $$renderer2.push(`<li class="chip svelte-maxsy8"${attr_style(`--m: var(--lane-${stringify(f.accent)})`)}><span class="marker svelte-maxsy8" aria-hidden="true"></span> <span class="chip-label svelte-maxsy8">${escape_html(f.label)}</span> <span class="chip-value svelte-maxsy8">${escape_html(f.percent)}%</span></li>`);
      }
      $$renderer2.push(`<!--]--></ul>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function ConditionCard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { condition, connected, enabled, loading = false, consent } = $$props;
    const STATE_TONE = {
      rested: "success",
      steady: "info",
      strained: "danger",
      unknown: "neutral"
    };
    const STATE_LABEL = {
      rested: "Wypoczęty",
      steady: "Stabilnie",
      strained: "Obciążony",
      unknown: "Brak oceny"
    };
    const CHANNEL_ICON = {
      body_battery: "battery",
      hrv: "pulse",
      resting_heart_rate: "heart",
      stress: "alert",
      sleep: "moon"
    };
    const icon = (key) => CHANNEL_ICON[key] ?? "activity";
    const sleep = derived(() => condition?.sleep ?? null);
    const SOURCE_PREF_KEY = "vagus.condition.source";
    const SOURCES = ["garmin", "own"];
    const garmin = derived(() => condition?.garmin ?? null);
    const recovery = derived(() => condition?.recovery ?? null);
    let remembered = null;
    const source = derived(() => garmin() === null ? "own" : remembered ?? "garmin");
    const showingGarmin = derived(() => source() === "garmin" && garmin() !== null);
    const sourceOptions = [
      { value: "garmin", label: "Garmin", short: "Garmin" },
      { value: "own", label: "Twoja baza", short: "Baza" }
    ];
    function pickSource(value) {
      if (!SOURCES.includes(value)) return;
      remembered = value;
      writePref(SOURCE_PREF_KEY, value);
    }
    const activeState = derived(() => showingGarmin() && garmin() ? garmin().state : condition?.state ?? "unknown");
    const activeSummary = derived(() => showingGarmin() && garmin() ? garmin().summary : condition?.summary ?? "");
    const batteryDay = derived(() => condition?.batteryDay ?? []);
    const hasBatteryChart = derived(() => batteryDay().filter((p) => p.value !== null).length >= 2);
    const stages = derived(() => sleep() === null ? [] : [
      {
        label: "Głęboki",
        value: sleep().deepS ?? 0,
        color: "var(--lane-indigo)"
      },
      {
        label: "REM",
        value: sleep().remS ?? 0,
        color: "var(--lane-violet)"
      },
      {
        label: "Lekki",
        value: sleep().lightS ?? 0,
        color: "var(--lane-sky)"
      },
      {
        label: "Czuwanie",
        value: sleep().awakeS ?? 0,
        color: "var(--lane-amber)"
      }
    ]);
    const sleepReadouts = derived(() => sleep() === null ? [] : [
      sleep().score !== null ? {
        key: "score",
        icon: "moon",
        label: "Wynik snu",
        value: String(Math.round(sleep().score)),
        accent: "var(--lane-indigo)"
      } : null,
      sleep().efficiencyPct !== null ? {
        key: "eff",
        icon: "activity",
        label: "Efektywność",
        value: fmtPercent(sleep().efficiencyPct) ?? "—",
        accent: "var(--lane-teal)"
      } : null,
      sleep().bedTime !== null ? {
        key: "bed",
        icon: "bed",
        label: "Zaśnięcie",
        value: sleep().bedTime,
        accent: "var(--lane-violet)"
      } : null,
      sleep().wakeTime !== null ? {
        key: "wake",
        icon: "sunrise",
        label: "Pobudka",
        value: sleep().wakeTime,
        accent: "var(--lane-amber)"
      } : null
    ].filter((r) => r !== null));
    function deltaClass(metric) {
      if (metric.favourable === null) return "flat";
      return metric.favourable ? "good" : "bad";
    }
    {
      let actions = function($$renderer3) {
        if (condition && !loading && connected && enabled) {
          $$renderer3.push("<!--[0-->");
          Badge($$renderer3, {
            tone: STATE_TONE[activeState()],
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->${escape_html(STATE_LABEL[activeState()])}`);
            }
          });
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]-->`);
      };
      Card($$renderer2, {
        title: "Regeneracja",
        subtitle: "Twoja gotowość, ostatnia noc i kanały odnowy względem Twojej własnej bazy",
        actions,
        children: ($$renderer3) => {
          if (loading) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<div class="loading svelte-1b4t1xw">`);
            Skeleton($$renderer3, {
              width: "var(--space-16)",
              height: "var(--space-12)",
              radius: "md"
            });
            $$renderer3.push(`<!----> `);
            Skeleton($$renderer3, { width: "70%", height: "var(--space-4)" });
            $$renderer3.push(`<!----> `);
            Skeleton($$renderer3, { width: "90%", height: "var(--space-4)" });
            $$renderer3.push(`<!----></div>`);
          } else if (!connected) {
            $$renderer3.push("<!--[1-->");
            $$renderer3.push(`<p class="note svelte-1b4t1xw">Połącz konto Garmin, aby zobaczyć swoją regenerację.</p> <a class="link svelte-1b4t1xw" href="/settings">Połącz w Ustawieniach →</a>`);
          } else if (!enabled) {
            $$renderer3.push("<!--[2-->");
            $$renderer3.push(`<p class="note svelte-1b4t1xw">Regeneracja liczy się z Twoich wielodniowych metryk. Włącz tryb zaawansowany, aby ją uruchomić.</p> `);
            consent?.($$renderer3);
            $$renderer3.push(`<!---->`);
          } else if (condition === null) {
            $$renderer3.push("<!--[3-->");
            $$renderer3.push(`<p class="note svelte-1b4t1xw">Za mało danych — synchronizuj zegarek i wróć za kilka dni.</p>`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<div class="panel svelte-1b4t1xw"><div${attr_class("hero svelte-1b4t1xw", void 0, { "with-chart": hasBatteryChart() })}><div class="lead svelte-1b4t1xw"><div class="lead-head svelte-1b4t1xw">`);
            if (garmin()) {
              $$renderer3.push("<!--[0-->");
              SegmentedControl($$renderer3, {
                options: sourceOptions,
                value: source(),
                ariaLabel: "Źródło wyniku gotowości",
                size: "sm",
                onChange: pickSource
              });
            } else {
              $$renderer3.push("<!--[-1-->");
              $$renderer3.push(`<span class="source-name svelte-1b4t1xw">Twoja baza z ostatnich dni</span>`);
            }
            $$renderer3.push(`<!--]--> `);
            InfoPopover($$renderer3, {
              label: "Jak liczymy ten wynik?"
            });
            $$renderer3.push(`<!----></div> `);
            if (showingGarmin() && garmin()) {
              $$renderer3.push("<!--[0-->");
              GarminReadinessGauge($$renderer3, { readiness: garmin(), size: "lg" });
            } else if (condition.readiness) {
              $$renderer3.push("<!--[1-->");
              ReadinessGauge($$renderer3, { readiness: condition.readiness, size: "lg" });
            } else {
              $$renderer3.push("<!--[-1-->");
              $$renderer3.push(`<p class="note svelte-1b4t1xw">Za mało dni w bazie, żeby policzyć wynik.</p>`);
            }
            $$renderer3.push(`<!--]--> `);
            if (recovery()) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="recovery svelte-1b4t1xw"><span class="recovery-icon svelte-1b4t1xw" style="color: var(--lane-cyan)">`);
              Icon($$renderer3, { name: "clock", size: 16 });
              $$renderer3.push(`<!----></span> <span class="recovery-value svelte-1b4t1xw">${escape_html(fmtRecovery(recovery().hours))}</span> <span class="recovery-label svelte-1b4t1xw">${escape_html(recovery().hours > 0 ? "do pełnej regeneracji wg Garmina" : "wg Garmina jesteś zregenerowany")}</span> `);
              if (recovery().change) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`<span class="recovery-change svelte-1b4t1xw">${escape_html(recovery().change)}</span>`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--></div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> <p class="summary svelte-1b4t1xw">${escape_html(activeSummary())}</p> `);
            if (source() === "own" && garmin() === null) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<p class="source-note svelte-1b4t1xw">Garmin nie przysłał dla tego konta swojego wyniku gotowości — pokazujemy naszą bazę.</p>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--></div> `);
            if (hasBatteryChart()) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="battery svelte-1b4t1xw"><div class="battery-head svelte-1b4t1xw"><h4 class="block-title svelte-1b4t1xw"><span class="block-icon svelte-1b4t1xw" style="color: var(--lane-cyan)">`);
              Icon($$renderer3, { name: "battery", size: 16 });
              $$renderer3.push(`<!----></span> Body Battery</h4> <span class="block-meta svelte-1b4t1xw">ostatnia doba</span></div> `);
              TrendChart($$renderer3, {
                values: batteryDay().map((p) => p.value ?? NaN),
                labels: batteryDay().map((p) => formatInstant(new Date(p.at), "time")),
                color: "var(--lane-cyan)",
                height: 132,
                yAxis: false,
                label: "Body Battery",
                formatValue: (n) => String(Math.round(n))
              });
              $$renderer3.push(`<!----></div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--></div> `);
            if (sleep()) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<section class="block svelte-1b4t1xw" aria-labelledby="condition-sleep"><div class="block-head svelte-1b4t1xw"><h4 class="block-title svelte-1b4t1xw" id="condition-sleep"><span class="block-icon svelte-1b4t1xw" style="color: var(--lane-indigo)">`);
              Icon($$renderer3, { name: "moon", size: 16 });
              $$renderer3.push(`<!----></span> Ostatnia noc</h4> <span class="block-meta svelte-1b4t1xw">${escape_html(formatDay(sleep().day, "weekday"))}</span></div> <div class="sleep-total svelte-1b4t1xw"><span class="total-value svelte-1b4t1xw">${escape_html(fmtSleepDuration(sleep().totalS) ?? "—")}</span> <span class="total-label svelte-1b4t1xw">snu</span></div> `);
              if (sleepReadouts().length > 0) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`<ul class="readouts svelte-1b4t1xw"><!--[-->`);
                const each_array = ensure_array_like(sleepReadouts());
                for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                  let r = each_array[$$index];
                  $$renderer3.push(`<li class="readout svelte-1b4t1xw"><span class="readout-icon svelte-1b4t1xw"${attr_style(`color: ${stringify(r.accent)}`)}>`);
                  Icon($$renderer3, { name: r.icon, size: 16 });
                  $$renderer3.push(`<!----></span> <span class="readout-value svelte-1b4t1xw">${escape_html(r.value)}</span> <span class="readout-label svelte-1b4t1xw">${escape_html(r.label)}</span></li>`);
                }
                $$renderer3.push(`<!--]--></ul>`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--> `);
              if (stages().some((s) => s.value > 0)) {
                $$renderer3.push("<!--[0-->");
                StackedBar($$renderer3, {
                  segments: stages(),
                  ariaLabel: "Fazy snu",
                  format: (v) => fmtSleepDuration(v) ?? "—"
                });
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--></section>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            if (condition.channels.length > 0) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<section class="block svelte-1b4t1xw" aria-labelledby="condition-channels"><div class="block-head svelte-1b4t1xw"><h4 class="block-title svelte-1b4t1xw" id="condition-channels"><span class="block-icon svelte-1b4t1xw" style="color: var(--lane-green)">`);
              Icon($$renderer3, { name: "pulse", size: 16 });
              $$renderer3.push(`<!----></span> Kanały odnowy</h4> <span class="block-meta svelte-1b4t1xw">względem Twojej bazy z ostatnich dni</span></div> <ul class="channels svelte-1b4t1xw"><!--[-->`);
              const each_array_1 = ensure_array_like(condition.channels);
              for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
                let c = each_array_1[$$index_1];
                $$renderer3.push(`<li class="channel svelte-1b4t1xw"${attr_style(`--lane: var(--lane-${stringify(c.accent)})`)}><span class="channel-icon svelte-1b4t1xw">`);
                Icon($$renderer3, { name: icon(c.key), size: 16 });
                $$renderer3.push(`<!----></span> <span class="channel-readout svelte-1b4t1xw"><span class="channel-value svelte-1b4t1xw">${escape_html(fmtChannelValue(c))}</span> `);
                if (c.unit) {
                  $$renderer3.push("<!--[0-->");
                  $$renderer3.push(`<span class="channel-unit svelte-1b4t1xw">${escape_html(c.unit)}</span>`);
                } else {
                  $$renderer3.push("<!--[-1-->");
                }
                $$renderer3.push(`<!--]--></span> <span class="channel-label svelte-1b4t1xw">${escape_html(c.label)}</span> <span${attr_class(`channel-delta ${stringify(deltaClass(c))}`, "svelte-1b4t1xw")}>`);
                if (fmtDelta(c)) {
                  $$renderer3.push("<!--[0-->");
                  $$renderer3.push(`${escape_html(fmtDelta(c))} vs ${escape_html(fmtBaseline(c))}`);
                } else {
                  $$renderer3.push("<!--[-1-->");
                  $$renderer3.push(`bez zmian`);
                }
                $$renderer3.push(`<!--]--></span></li>`);
              }
              $$renderer3.push(`<!--]--></ul></section>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--></div>`);
          }
          $$renderer3.push(`<!--]-->`);
        }
      });
    }
  });
}
function TimelineEventRow($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { event, layout = "rail" } = $$props;
    const tone = derived(() => event.kind === "health" ? event.favourable ? "good" : "bad" : event.kind === "milestone" ? "mark" : "plain");
    $$renderer2.push(`<li${attr_class(`row ${tone()} ${stringify(layout)}`, "svelte-1t1366k")}${attr_style(`--lane: var(--lane-${stringify(event.accent)})`)}>`);
    if (layout === "rail") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="node svelte-1t1366k" aria-hidden="true"></span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <span class="glyph svelte-1t1366k">`);
    Icon($$renderer2, { name: event.icon, size: 18 });
    $$renderer2.push(`<!----></span> <div class="body svelte-1t1366k"><div class="head svelte-1t1366k">`);
    if (event.href) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<a class="title svelte-1t1366k"${attr("href", event.href)}>${escape_html(event.title)}</a>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<span class="title svelte-1t1366k">${escape_html(event.title)}</span>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (event.time) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="time svelte-1t1366k">${escape_html(event.time)}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    if (event.detail) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="detail svelte-1t1366k">${escape_html(event.detail)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (event.stats.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<dl class="stats svelte-1t1366k"><!--[-->`);
      const each_array = ensure_array_like(event.stats);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let stat = each_array[$$index];
        $$renderer2.push(`<div class="stat svelte-1t1366k"><dt class="svelte-1t1366k">${escape_html(stat.label)}</dt> <dd class="svelte-1t1366k">${escape_html(stat.value)}`);
        if (stat.unit) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="unit svelte-1t1366k">${escape_html(stat.unit)}</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></dd></div>`);
      }
      $$renderer2.push(`<!--]--></dl>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></li>`);
  });
}
const TIMELINE_ORIENTATION_KEY = "gb-timeline-orientation";
const TIMELINE_EXPANDED_KEY = "gb-timeline-expanded";
function TimelineView($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data, connected = true, enabled = true } = $$props;
    let expanded = false;
    function toggleExpanded() {
      expanded = !expanded;
      writeBoolPref(TIMELINE_EXPANDED_KEY, expanded);
    }
    let orientation = "vertical";
    const ORIENTATION_OPTIONS = [
      { value: "vertical", label: "Pion" },
      { value: "horizontal", label: "Poziom" }
    ];
    function rememberOrientation(next) {
      writePref(TIMELINE_ORIENTATION_KEY, next);
    }
    const visible = derived(() => data === null ? [] : expanded ? [...data.past.events] : data.past.events.filter((e) => e.primary));
    function dayLabel(day, today) {
      const delta = daysBetween(day, today);
      if (delta === 0) return "dziś";
      if (delta === 1) return "wczoraj";
      return formatDay(day, "weekday");
    }
    const groups = derived(() => data === null ? [] : visible().reduce(
      (acc, event) => {
        const last = acc[acc.length - 1];
        if (last && last.day === event.day) {
          last.events.push(event);
          return acc;
        }
        acc.push({
          day: event.day,
          label: dayLabel(event.day, data.today),
          events: [event]
        });
        return acc;
      },
      []
    ));
    const axisGroups = derived(() => [...groups()].reverse().map((g) => ({ ...g, events: [...g.events].reverse() })));
    const PUSH_BADGE = {
      pending: { tone: "neutral", label: "do wysłania" },
      pushed: { tone: "success", label: "w Garminie" },
      failed: { tone: "warning", label: "błąd wysyłki" },
      unsupported: { tone: "danger", label: "niewspierane" }
    };
    const pushBadge = (event) => event.authored && event.push ? PUSH_BADGE[event.push] ?? null : null;
    const hiddenCount = derived(() => data === null ? 0 : data.past.totalCount - data.past.primaryCount);
    const windowDays = derived(() => data === null ? 14 : daysBetween(data.past.from, data.past.to) + 1);
    const plannedDays = derived(() => data === null ? 7 : daysBetween(data.planned.from, data.planned.to) + 1);
    let moreBefore = false;
    let moreAfter = false;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      {
        let actions = function($$renderer4) {
          if (connected && enabled && data !== null) {
            $$renderer4.push("<!--[0-->");
            SegmentedControl($$renderer4, {
              options: ORIENTATION_OPTIONS,
              ariaLabel: "Układ osi czasu",
              size: "sm",
              onChange: rememberOrientation,
              get value() {
                return orientation;
              },
              set value($$value) {
                orientation = $$value;
                $$settled = false;
              }
            });
          } else {
            $$renderer4.push("<!--[-1-->");
          }
          $$renderer4.push(`<!--]-->`);
        };
        Card($$renderer3, {
          title: "Oś czasu",
          subtitle: `Ostatnie ${windowDays()} dni i najbliższe ${plannedDays()}`,
          actions,
          children: ($$renderer4) => {
            if (!connected) {
              $$renderer4.push("<!--[0-->");
              $$renderer4.push(`<p class="note svelte-4v8lzv">Połącz konto Garmin, aby zobaczyć swoją oś czasu.</p> <a class="link svelte-4v8lzv" href="/settings">Połącz w Ustawieniach →</a>`);
            } else if (!enabled) {
              $$renderer4.push("<!--[1-->");
              $$renderer4.push(`<p class="note svelte-4v8lzv">Oś czasu korzysta z Twoich zsynchronizowanych danych. Włącz tryb zaawansowany, aby ją uruchomić.</p>`);
            } else if (data === null) {
              $$renderer4.push("<!--[2-->");
              $$renderer4.push(`<p class="note svelte-4v8lzv">Za mało danych — synchronizuj zegarek i wróć za chwilę.</p>`);
            } else if (orientation === "horizontal") {
              $$renderer4.push("<!--[3-->");
              $$renderer4.push(`<div class="timeline svelte-4v8lzv" data-orientation="horizontal">`);
              if (axisGroups().length === 0 && data.planned.status !== "ok") {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<p class="note svelte-4v8lzv">Brak zdarzeń w ostatnich ${escape_html(windowDays())} dniach. Kiedy zsynchronizujesz trening albo pojawi się nietypowy
          odczyt, zobaczysz je tutaj.</p>`);
              } else {
                $$renderer4.push("<!--[-1-->");
                $$renderer4.push(`<div${attr_class("axis svelte-4v8lzv", void 0, { "fade-start": moreBefore, "fade-end": moreAfter })} role="group" tabindex="0"${attr("aria-label", `Oś czasu — ostatnie ${windowDays()} dni, przewijana w poziomie`)}><ol class="track svelte-4v8lzv"><!--[-->`);
                const each_array = ensure_array_like(axisGroups());
                for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
                  let group = each_array[$$index_1];
                  $$renderer4.push(`<li${attr_class("col svelte-4v8lzv", void 0, { "is-today": group.day === data.today })}><div class="col-head svelte-4v8lzv"><span class="col-label svelte-4v8lzv">${escape_html(group.label)}</span> <span class="col-date svelte-4v8lzv">${escape_html(formatDay(group.day, "numeric"))}</span></div> <div class="rule svelte-4v8lzv" aria-hidden="true"><span class="tick svelte-4v8lzv"></span></div> <ul class="col-events svelte-4v8lzv"><!--[-->`);
                  const each_array_1 = ensure_array_like(group.events);
                  for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
                    let event = each_array_1[$$index];
                    TimelineEventRow($$renderer4, { event, layout: "column" });
                  }
                  $$renderer4.push(`<!--]--></ul></li>`);
                }
                $$renderer4.push(`<!--]--> `);
                if (data.planned.status === "ok") {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<!--[-->`);
                  const each_array_2 = ensure_array_like(data.planned.events);
                  for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
                    let event = each_array_2[$$index_2];
                    $$renderer4.push(`<li class="col ahead svelte-4v8lzv"><div class="col-head svelte-4v8lzv"><span class="col-label svelte-4v8lzv">${escape_html(formatDay(event.day, "weekday"))}</span> <span class="col-date svelte-4v8lzv">${escape_html(event.time ?? "plan")}</span></div> <div class="rule svelte-4v8lzv" aria-hidden="true"><span class="tick svelte-4v8lzv"></span></div> <div class="col-events svelte-4v8lzv"><div class="plan column svelte-4v8lzv"><span class="glyph svelte-4v8lzv">`);
                    Icon($$renderer4, { name: "calendar", size: 18 });
                    $$renderer4.push(`<!----></span> <div class="plan-body svelte-4v8lzv"><span class="plan-title svelte-4v8lzv">${escape_html(event.title)}</span> `);
                    if (pushBadge(event)) {
                      $$renderer4.push("<!--[0-->");
                      $$renderer4.push(`<span class="plan-state svelte-4v8lzv">`);
                      Badge($$renderer4, {
                        tone: pushBadge(event).tone,
                        children: ($$renderer5) => {
                          $$renderer5.push(`<!---->${escape_html(pushBadge(event).label)}`);
                        }
                      });
                      $$renderer4.push(`<!----></span>`);
                    } else {
                      $$renderer4.push("<!--[-1-->");
                    }
                    $$renderer4.push(`<!--]--> `);
                    if (event.description) {
                      $$renderer4.push("<!--[0-->");
                      $$renderer4.push(`<p class="detail svelte-4v8lzv">${escape_html(event.description)}</p>`);
                    } else {
                      $$renderer4.push("<!--[-1-->");
                    }
                    $$renderer4.push(`<!--]--></div></div></div></li>`);
                  }
                  $$renderer4.push(`<!--]-->`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                  $$renderer4.push(`<li class="col ahead svelte-4v8lzv"><div class="col-head svelte-4v8lzv"><span class="col-label svelte-4v8lzv">Co dalej</span> <span class="col-date svelte-4v8lzv">${escape_html(plannedDays())} dni</span></div> <div class="rule svelte-4v8lzv" aria-hidden="true"><span class="tick svelte-4v8lzv"></span></div> <div class="col-events svelte-4v8lzv">`);
                  if (data.planned.status === "empty") {
                    $$renderer4.push("<!--[0-->");
                    $$renderer4.push(`<p class="empty-title svelte-4v8lzv">Brak zaplanowanych treningów</p> <p class="note svelte-4v8lzv">Na najbliższe ${escape_html(plannedDays())} dni nie masz nic w kalendarzu Garmina.</p>`);
                  } else {
                    $$renderer4.push("<!--[-1-->");
                    $$renderer4.push(`<p class="empty-title svelte-4v8lzv">Zaplanowane treningi nie są jeszcze synchronizowane</p> <p class="note svelte-4v8lzv">Nie pobieramy jeszcze kalendarza treningów z Garmina, więc nie pokazujemy tu nic —
                      zamiast zgadywać, co masz w planie.</p>`);
                  }
                  $$renderer4.push(`<!--]--></div></li>`);
                }
                $$renderer4.push(`<!--]--></ol></div> `);
                if (hiddenCount() > 0) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<div class="expander svelte-4v8lzv">`);
                  Button($$renderer4, {
                    size: "sm",
                    variant: "ghost",
                    "aria-expanded": expanded,
                    onclick: toggleExpanded,
                    children: ($$renderer5) => {
                      $$renderer5.push(`<!---->${escape_html(expanded ? "Pokaż tylko najważniejsze" : `Pokaż wszystkie zdarzenia (${data.past.totalCount})`)}`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer4.push(`<!----> `);
                  if (!expanded) {
                    $$renderer4.push("<!--[0-->");
                    $$renderer4.push(`<span class="expander-note svelte-4v8lzv">ukryto ${escape_html(hiddenCount())} mniej istotnych</span>`);
                  } else {
                    $$renderer4.push("<!--[-1-->");
                  }
                  $$renderer4.push(`<!--]--></div>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                }
                $$renderer4.push(`<!--]-->`);
              }
              $$renderer4.push(`<!--]--></div>`);
            } else {
              $$renderer4.push("<!--[-1-->");
              $$renderer4.push(`<div class="timeline svelte-4v8lzv" data-orientation="vertical"><section class="half svelte-4v8lzv" aria-labelledby="timeline-past"><h4 class="half-title svelte-4v8lzv" id="timeline-past">Co się wydarzyło</h4> `);
              if (groups().length === 0) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<p class="note svelte-4v8lzv">Brak zdarzeń w ostatnich ${escape_html(windowDays())} dniach. Kiedy zsynchronizujesz trening albo pojawi się nietypowy
            odczyt, zobaczysz je tutaj.</p>`);
              } else {
                $$renderer4.push("<!--[-1-->");
                $$renderer4.push(`<ol class="rail svelte-4v8lzv"><!--[-->`);
                const each_array_3 = ensure_array_like(groups());
                for (let $$index_4 = 0, $$length = each_array_3.length; $$index_4 < $$length; $$index_4++) {
                  let group = each_array_3[$$index_4];
                  $$renderer4.push(`<li class="group svelte-4v8lzv"><div class="day svelte-4v8lzv"><span class="day-node svelte-4v8lzv" aria-hidden="true"></span> <span class="day-label svelte-4v8lzv">${escape_html(group.label)}</span> <span class="day-date svelte-4v8lzv">${escape_html(formatDay(group.day, "numeric"))}</span></div> <ul class="events svelte-4v8lzv"><!--[-->`);
                  const each_array_4 = ensure_array_like(group.events);
                  for (let $$index_3 = 0, $$length2 = each_array_4.length; $$index_3 < $$length2; $$index_3++) {
                    let event = each_array_4[$$index_3];
                    TimelineEventRow($$renderer4, { event });
                  }
                  $$renderer4.push(`<!--]--></ul></li>`);
                }
                $$renderer4.push(`<!--]--></ol> `);
                if (hiddenCount() > 0) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<div class="expander svelte-4v8lzv">`);
                  Button($$renderer4, {
                    size: "sm",
                    variant: "ghost",
                    "aria-expanded": expanded,
                    onclick: toggleExpanded,
                    children: ($$renderer5) => {
                      $$renderer5.push(`<!---->${escape_html(expanded ? "Pokaż tylko najważniejsze" : `Pokaż wszystkie zdarzenia (${data.past.totalCount})`)}`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer4.push(`<!----> `);
                  if (!expanded) {
                    $$renderer4.push("<!--[0-->");
                    $$renderer4.push(`<span class="expander-note svelte-4v8lzv">ukryto ${escape_html(hiddenCount())} mniej istotnych</span>`);
                  } else {
                    $$renderer4.push("<!--[-1-->");
                  }
                  $$renderer4.push(`<!--]--></div>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                }
                $$renderer4.push(`<!--]-->`);
              }
              $$renderer4.push(`<!--]--></section> <section class="half planned svelte-4v8lzv" aria-labelledby="timeline-next"><h4 class="half-title svelte-4v8lzv" id="timeline-next">Co dalej</h4> `);
              if (data.planned.status === "ok") {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<ol class="rail svelte-4v8lzv"><!--[-->`);
                const each_array_5 = ensure_array_like(data.planned.events);
                for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
                  let event = each_array_5[$$index_5];
                  $$renderer4.push(`<li class="group svelte-4v8lzv"><div class="day svelte-4v8lzv"><span class="day-node svelte-4v8lzv" aria-hidden="true"></span> <span class="day-label svelte-4v8lzv">${escape_html(formatDay(event.day, "weekday"))}</span> `);
                  if (event.time) {
                    $$renderer4.push("<!--[0-->");
                    $$renderer4.push(`<span class="day-date svelte-4v8lzv">${escape_html(event.time)}</span>`);
                  } else {
                    $$renderer4.push("<!--[-1-->");
                  }
                  $$renderer4.push(`<!--]--></div> <div class="plan svelte-4v8lzv"><span class="glyph svelte-4v8lzv">`);
                  Icon($$renderer4, { name: "calendar", size: 18 });
                  $$renderer4.push(`<!----></span> <div class="plan-body svelte-4v8lzv"><span class="plan-title svelte-4v8lzv">${escape_html(event.title)}</span> `);
                  if (pushBadge(event)) {
                    $$renderer4.push("<!--[0-->");
                    $$renderer4.push(`<span class="plan-state svelte-4v8lzv">`);
                    Badge($$renderer4, {
                      tone: pushBadge(event).tone,
                      children: ($$renderer5) => {
                        $$renderer5.push(`<!---->${escape_html(pushBadge(event).label)}`);
                      }
                    });
                    $$renderer4.push(`<!----></span>`);
                  } else {
                    $$renderer4.push("<!--[-1-->");
                  }
                  $$renderer4.push(`<!--]--> `);
                  if (event.description) {
                    $$renderer4.push("<!--[0-->");
                    $$renderer4.push(`<p class="detail svelte-4v8lzv">${escape_html(event.description)}</p>`);
                  } else {
                    $$renderer4.push("<!--[-1-->");
                  }
                  $$renderer4.push(`<!--]--></div></div></li>`);
                }
                $$renderer4.push(`<!--]--></ol>`);
              } else {
                $$renderer4.push("<!--[-1-->");
                $$renderer4.push(`<div class="empty svelte-4v8lzv"><span class="empty-glyph svelte-4v8lzv">`);
                Icon($$renderer4, { name: "calendar", size: 20 });
                $$renderer4.push(`<!----></span> <div class="empty-body svelte-4v8lzv">`);
                if (data.planned.status === "empty") {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<p class="empty-title svelte-4v8lzv">Brak zaplanowanych treningów</p> <p class="note svelte-4v8lzv">Na najbliższe ${escape_html(plannedDays())} dni nie masz nic w kalendarzu Garmina.</p>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                  $$renderer4.push(`<p class="empty-title svelte-4v8lzv">Zaplanowane treningi nie są jeszcze synchronizowane</p> <p class="note svelte-4v8lzv">Nie pobieramy jeszcze kalendarza treningów z Garmina, więc nie pokazujemy tu nic — zamiast
                  zgadywać, co masz w planie. Gdy synchronizacja planu ruszy, to miejsce wypełni się samo.</p>`);
                }
                $$renderer4.push(`<!--]--></div></div>`);
              }
              $$renderer4.push(`<!--]--></section></div>`);
            }
            $$renderer4.push(`<!--]-->`);
          }
        });
      }
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
function BaseHome($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      health,
      advancedFeature,
      onConnected = () => {
      },
      onUpdated = () => {
      }
    } = $$props;
    const ADVANTAGES = [
      "Pulpit — dzisiejsza gotowość i najważniejsze metryki na jeden rzut oka.",
      "Analityka — wielodniowe trendy i statystyki dla każdej metryki.",
      "Wnioski — gotowość, anomalie i korelacje liczone lokalnie, bez AI.",
      // Names the real range set (spec 047) — this line still advertised the old 7/30/90 windows.
      "Jeden przełącznik zakresu — 7, 14, 30 dni, rok albo cały czas, na każdej stronie."
    ];
    if (!health.connected) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="connect svelte-nhi12r">`);
      Card($$renderer2, {
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="onboard svelte-nhi12r"><div class="onboard-intro svelte-nhi12r"><p class="eyebrow svelte-nhi12r">Tryb podstawowy</p> <h2 class="onboard-title svelte-nhi12r">Podłącz Garmina i gotowe</h2> <p class="onboard-lede svelte-nhi12r">W trybie podstawowym łączysz swoje konto Garmin i dostajesz osobisty adres MCP dla asystenta AI. <strong>Nie przetwarzamy ani nie pokazujemy tu Twoich danych</strong> — pośredniczymy tylko w odczytach na Twoje żądanie.</p> <ol class="onboard-steps svelte-nhi12r"><li class="svelte-nhi12r"><span class="step-n svelte-nhi12r" aria-hidden="true">1</span> <span>Zaloguj się danymi Garmina — użyjemy ich jednorazowo, by pobrać tokeny dostępu.</span></li> <li class="svelte-nhi12r"><span class="step-n svelte-nhi12r" aria-hidden="true">2</span> <span>Zapisujemy wyłącznie zaszyfrowane tokeny. Twoje hasło nie jest przechowywane.</span></li> <li class="svelte-nhi12r"><span class="step-n svelte-nhi12r" aria-hidden="true">3</span> <span>Twój osobisty adres MCP staje się aktywny — skopiuj go z <a class="link svelte-nhi12r" href="/settings">Ustawień</a> do klienta AI.</span></li></ol></div> <div class="onboard-action svelte-nhi12r"><h3 class="onboard-action-title svelte-nhi12r">Połącz konto Garmin</h3> `);
          SetupForm($$renderer3, { onConnected });
          $$renderer3.push(`<!----></div></div>`);
        }
      });
      $$renderer2.push(`<!----></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="stack svelte-nhi12r">`);
      if (!health.reachable) {
        $$renderer2.push("<!--[0-->");
        Banner($$renderer2, {
          tone: "danger",
          title: "Usługa Garmin jest chwilowo niedostępna",
          children: ($$renderer3) => {
            $$renderer3.push(`<!---->Nie udało się połączyć z usługą Garmin. Twoje dane są bezpieczne — spróbujemy ponownie automatycznie.`);
          }
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      Card($$renderer2, {
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="advance svelte-nhi12r"><div class="advance-copy svelte-nhi12r"><p class="eyebrow svelte-nhi12r">Tryb podstawowy jest aktywny</p> <h2 class="advance-title svelte-nhi12r">Odblokuj tryb zaawansowany</h2> <p class="advance-lede svelte-nhi12r">Na razie nic nie przetwarzamy — masz połączenie z Garminem i swój adres MCP. Włącz tryb
            zaawansowany, aby zobaczyć swoje dane w aplikacji:</p> <ul class="advance-list svelte-nhi12r"><!--[-->`);
          const each_array = ensure_array_like(ADVANTAGES);
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let item = each_array[$$index];
            $$renderer3.push(`<li class="svelte-nhi12r"><span class="tick svelte-nhi12r" aria-hidden="true"></span> <span>${escape_html(item)}</span></li>`);
          }
          $$renderer3.push(`<!--]--></ul> <p class="advance-note svelte-nhi12r">Przetwarzanie odbywa się w Twojej sesji, dane nie są sprzedawane ani wysyłane dalej. Zgodę możesz
            wycofać w każdej chwili i wrócić do trybu podstawowego.</p></div> <div class="advance-gate svelte-nhi12r">`);
          if (advancedFeature) {
            $$renderer3.push("<!--[0-->");
            ConsentPanel($$renderer3, { feature: advancedFeature, onUpdated: () => onUpdated?.() });
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<p class="advance-lede svelte-nhi12r">Panel zgody jest chwilowo niedostępny.</p>`);
          }
          $$renderer3.push(`<!--]--></div></div>`);
        }
      });
      $$renderer2.push(`<!----> `);
      Card($$renderer2, {
        title: "Adres MCP i połączenie",
        subtitle: "Stan konta Garmin oraz Twój osobisty adres MCP znajdziesz w Ustawieniach.",
        children: ($$renderer3) => {
          $$renderer3.push(`<a class="link svelte-nhi12r" href="/settings">Otwórz ustawienia →</a>`);
        }
      });
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function Landing($$renderer) {
  const spark = [58, 61, 60, 66, 63, 69, 72];
  $$renderer.push(`<div class="page svelte-10j2sak"><header class="topbar svelte-10j2sak"><span class="brand svelte-10j2sak"><span class="dot svelte-10j2sak" aria-hidden="true"></span> Vagus</span> <nav class="top-nav svelte-10j2sak"><a href="#how" class="svelte-10j2sak">Jak to działa</a> <a href="#self-host" class="svelte-10j2sak">Hostuj u siebie</a> `);
  ThemeToggle($$renderer);
  $$renderer.push(`<!----> `);
  Button($$renderer, {
    size: "sm",
    onclick: () => location.href = "/auth/login",
    children: ($$renderer2) => {
      $$renderer2.push(`<!---->Zaloguj się`);
    },
    $$slots: { default: true }
  });
  $$renderer.push(`<!----></nav></header> <section class="hero svelte-10j2sak"><div class="hero-bg svelte-10j2sak" aria-hidden="true"></div> <div class="hero-copy svelte-10j2sak"><p class="eyebrow svelte-10j2sak"><span class="eyebrow-dot svelte-10j2sak" aria-hidden="true"></span>Telemetria Twojego ciała</p> <h1 class="headline svelte-10j2sak">Dane z Twojego Garmina,<br class="svelte-10j2sak"/><span class="accent svelte-10j2sak">podłączone do AI.</span></h1> <p class="sub svelte-10j2sak">Vagus łączy Twoje konto Garmin Connect z asystentem AI przez osobisty adres MCP. Zacznij w trybie
        podstawowym — nic nie przetwarzamy — a gdy zechcesz, włącz tryb zaawansowany z pulpitem i analityką.</p> <div class="cta svelte-10j2sak">`);
  Button($$renderer, {
    size: "md",
    onclick: () => location.href = "/auth/login",
    children: ($$renderer2) => {
      $$renderer2.push(`<!---->Kontynuuj z Google`);
    },
    $$slots: { default: true }
  });
  $$renderer.push(`<!----> <a class="ghost-cta svelte-10j2sak" href="#self-host">albo hostuj u siebie →</a></div> <p class="reassure svelte-10j2sak">Bez hasła. Twoje dane zostają Twoje — osobno dla każdego konta, za zgodą, nigdy nie sprzedawane.</p></div> <div class="preview svelte-10j2sak" aria-hidden="true"><div class="preview-head svelte-10j2sak"><span class="preview-label svelte-10j2sak">Dziś</span> <span class="preview-live svelte-10j2sak"><span class="pulse svelte-10j2sak"></span> na żywo</span></div> <div class="preview-grid svelte-10j2sak">`);
  {
    let sparkline = function($$renderer2) {
      Sparkline($$renderer2, {
        values: [7100, 8200, 6400, 9100, 8800, 10200, 11039],
        color: "var(--lane-orange)",
        label: "kroki",
        showArea: true
      });
    };
    StatTile($$renderer, {
      label: "Kroki",
      value: "11 039",
      accent: "orange",
      delta: 12,
      deltaSuffix: "%",
      goodWhen: "up",
      sparkline
    });
  }
  $$renderer.push(`<!----> `);
  {
    let sparkline = function($$renderer2) {
      Sparkline($$renderer2, {
        values: spark,
        color: "var(--lane-green)",
        label: "hrv",
        showArea: true
      });
    };
    StatTile($$renderer, {
      label: "HRV",
      value: "63",
      unit: "ms",
      accent: "green",
      delta: 9,
      deltaSuffix: "%",
      goodWhen: "up",
      sparkline
    });
  }
  $$renderer.push(`<!----> `);
  StatTile($$renderer, {
    label: "Tętno spoczynkowe",
    value: "53",
    unit: "bpm",
    accent: "red",
    delta: -4,
    deltaSuffix: "%",
    goodWhen: "down"
  });
  $$renderer.push(`<!----> `);
  StatTile($$renderer, {
    label: "Sen",
    value: "7h 47m",
    accent: "indigo",
    delta: 6,
    deltaSuffix: "%",
    goodWhen: "up"
  });
  $$renderer.push(`<!----></div></div></section> <section class="band svelte-10j2sak"><div class="features svelte-10j2sak"><article class="svelte-10j2sak"><h3 class="svelte-10j2sak"><span class="marker svelte-10j2sak" style="--m: var(--lane-orange)"></span>Tryb podstawowy</h3> <p class="svelte-10j2sak">Połącz konto Garmin i dostań osobisty adres MCP. Nic nie przetwarzamy ani nie pokazujemy —
          pośredniczymy tylko w odczytach na Twoje żądanie. Sen, kroki, HRV, Body Battery, stres, SpO₂ i
          więcej — zawsze Twoje. Zapis w Garminie jest tylko jeden i włączasz go osobno: treningi, które sam
          ułożysz.</p></article> <article class="svelte-10j2sak"><h3 class="svelte-10j2sak"><span class="marker svelte-10j2sak" style="--m: var(--lane-cyan)"></span>Tryb zaawansowany</h3> <p class="svelte-10j2sak">Po akceptacji zgody włączasz pulpit, analitykę, wnioski i wykresy. Twoje dane widać w aplikacji, a
          gotowość, anomalie i korelacje liczymy lokalnie — bez AI.</p></article> <article class="svelte-10j2sak"><h3 class="svelte-10j2sak"><span class="marker svelte-10j2sak" style="--m: var(--lane-green)"></span>Prywatność w standardzie</h3> <p class="svelte-10j2sak">Każde konto jest odizolowane. Tokeny są zaszyfrowane, a tryb zaawansowany jest opcjonalny i za
          wersjonowaną zgodą. Nic nie jest sprzedawane ani udostępniane.</p></article></div></section> <section id="how" class="how svelte-10j2sak"><h2 class="section-title svelte-10j2sak">Trzy kroki do Twoich danych</h2> <ol class="steps svelte-10j2sak"><li class="svelte-10j2sak"><span class="step-n svelte-10j2sak">1</span> <div class="svelte-10j2sak"><h4 class="svelte-10j2sak">Zaloguj się przez Google</h4> <p class="svelte-10j2sak">Bez hasła. Tworzymy prywatną przestrzeń tylko dla Ciebie.</p></div></li> <li class="svelte-10j2sak"><span class="step-n svelte-10j2sak">2</span> <div class="svelte-10j2sak"><h4 class="svelte-10j2sak">Połącz Garmina</h4> <p class="svelte-10j2sak">Jednorazowe logowanie (obsługa MFA). Nie przechowujemy danych logowania — tylko zaszyfrowane
            tokeny.</p></div></li> <li class="svelte-10j2sak"><span class="step-n svelte-10j2sak">3</span> <div class="svelte-10j2sak"><h4 class="svelte-10j2sak">Czytaj gdziekolwiek</h4> <p class="svelte-10j2sak">Włącz tryb zaawansowany, aby zobaczyć pulpit, albo podaj adres MCP asystentowi AI, by czytał Twoje
            metryki.</p></div></li></ol></section> <section id="self-host" class="band svelte-10j2sak"><div class="self-host svelte-10j2sak"><div class="svelte-10j2sak"><h2 class="section-title left svelte-10j2sak">Wolisz uruchomić to samodzielnie?</h2> <p class="svelte-10j2sak">Vagus można hostować samodzielnie. Podłącz własny Postgres i klienta Google OAuth — całość działa
          jako dwa małe kontenery na Twoim sprzęcie, a dane nigdy nie opuszczają Twojej infrastruktury.</p> <p class="fineprint svelte-10j2sak">Do wdrożenia samodzielnego wymagany jest klient Google OAuth oraz instancja Postgres.</p></div> <pre class="code svelte-10j2sak" aria-label="Uruchom w Dockerze"><code class="svelte-10j2sak">$ cp .env.example .env   # ustaw swoje sekrety
$ make up                # web + sidecar + postgres</code></pre></div></section> <section class="final svelte-10j2sak"><h2 class="final-h svelte-10j2sak">Gotowe, kiedy tylko zechcesz.</h2> `);
  Button($$renderer, {
    size: "md",
    onclick: () => location.href = "/auth/login",
    children: ($$renderer2) => {
      $$renderer2.push(`<!---->Kontynuuj z Google`);
    },
    $$slots: { default: true }
  });
  $$renderer.push(`<!----></section> <footer class="foot svelte-10j2sak"><span class="svelte-10j2sak"><span class="dot svelte-10j2sak" aria-hidden="true"></span> Vagus</span> <span class="foot-note svelte-10j2sak">Twoje dane z Garmina — dla Ciebie i Twojego AI.</span></footer></div>`);
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    let busy = false;
    let lastUpdated = null;
    const updatedLabel = derived(() => lastUpdated ? `Zaktualizowano ${lastUpdated.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}` : void 0);
    async function reload() {
      if (busy) return;
      busy = true;
      try {
        await invalidateAll();
        lastUpdated = /* @__PURE__ */ new Date();
      } finally {
        busy = false;
      }
    }
    function refresh() {
      void reload();
    }
    head("1uha8ag", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(data.authed ? data.tier === "advanced" ? "Pulpit · Vagus" : "Start · Vagus" : "Vagus — Twoje dane z Garmina, połączone z AI")}</title>`);
      });
    });
    if (!data.authed) {
      $$renderer2.push("<!--[0-->");
      Landing($$renderer2);
    } else if (data.tier === "base") {
      $$renderer2.push("<!--[1-->");
      {
        let footer = function($$renderer3) {
          SyncFooter($$renderer3);
        };
        AppShell($$renderer2, {
          title: "Start",
          tier: "base",
          range: "off",
          footer,
          children: ($$renderer3) => {
            BaseHome($$renderer3, {
              health: data.health,
              advancedFeature: data.advancedFeature,
              onConnected: refresh,
              onUpdated: refresh
            });
          }
        });
      }
    } else {
      $$renderer2.push("<!--[-1-->");
      {
        let footer = function($$renderer3) {
          SyncFooter($$renderer3);
        };
        AppShell($$renderer2, {
          title: "Pulpit",
          tier: "advanced",
          advanced: true,
          footer,
          children: ($$renderer3) => {
            if (!data.health.connected) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="reconnect svelte-1uha8ag">`);
              {
                let actions = function($$renderer4) {
                  $$renderer4.push(`<a class="banner-cta svelte-1uha8ag" href="/settings">Połącz w Ustawieniach →</a>`);
                };
                Banner($$renderer3, {
                  tone: "warning",
                  title: "Konto Garmin nie jest połączone",
                  actions,
                  children: ($$renderer4) => {
                    $$renderer4.push(`<!---->Tryb zaawansowany jest włączony, ale nie widzimy połączenia z Garminem. Połącz konto ponownie w Ustawieniach.`);
                  }
                });
              }
              $$renderer3.push(`<!----></div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
              $$renderer3.push(`<div class="stack svelte-1uha8ag">`);
              if (!data.health.reachable) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`<div class="banner-slot svelte-1uha8ag">`);
                {
                  let actions = function($$renderer4) {
                    $$renderer4.push(`<a class="banner-cta svelte-1uha8ag" href="/settings">Sprawdź połączenie →</a>`);
                  };
                  Banner($$renderer3, {
                    tone: "danger",
                    title: "Usługa Garmin jest chwilowo niedostępna",
                    actions,
                    children: ($$renderer4) => {
                      $$renderer4.push(`<!---->Nie udało się połączyć z usługą Garmin, więc odczyty mogą być nieaktualne. Twoje dane są bezpieczne
              — połączymy się ponownie automatycznie.`);
                    }
                  });
                }
                $$renderer3.push(`<!----></div>`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--> `);
              {
                let consent = function($$renderer4) {
                  if (data.advancedFeature) {
                    $$renderer4.push("<!--[0-->");
                    ConsentPanel($$renderer4, { feature: data.advancedFeature, onUpdated: refresh });
                  } else {
                    $$renderer4.push("<!--[-1-->");
                  }
                  $$renderer4.push(`<!--]-->`);
                };
                ConditionCard($$renderer3, {
                  condition: data.readiness.condition,
                  connected: data.readiness.connected,
                  enabled: data.readiness.enabled,
                  consent
                });
              }
              $$renderer3.push(`<!----> `);
              TimelineView($$renderer3, {
                data: data.timeline,
                connected: data.readiness.connected,
                enabled: data.readiness.enabled
              });
              $$renderer3.push(`<!----> `);
              MetricsDashboard($$renderer3, {
                data: data.dashboard,
                analyticsFeature: data.advancedFeature,
                onConsentChange: refresh,
                updatedLabel: updatedLabel(),
                busy
              });
              $$renderer3.push(`<!----></div>`);
            }
            $$renderer3.push(`<!--]-->`);
          }
        });
      }
    }
    $$renderer2.push(`<!--]-->`);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte.js-BYy4dSPU.js.map
