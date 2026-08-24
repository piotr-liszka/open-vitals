import { e as escape_html, g as derived, a as ensure_array_like } from "../../../chunks/index.js";
import { B as Button, S as Spinner } from "../../../chunks/Button.js";
import { C as Card } from "../../../chunks/Card.js";
import { I as Input } from "../../../chunks/Input.js";
import { F as Field } from "../../../chunks/Field.js";
import { B as Badge } from "../../../chunks/Badge.js";
import { S as SegmentedControl } from "../../../chunks/SegmentedControl.js";
/* empty css                                                     */
/* empty css                                                        */
import { B as Banner } from "../../../chunks/Banner.js";
import { t as toasts } from "../../../chunks/toast.js";
import { S as Skeleton } from "../../../chunks/Skeleton.js";
import { S as StatTile } from "../../../chunks/StatTile.js";
/* empty css                                                 */
import { A as AppShell, I as IconButton } from "../../../chunks/AppShell.js";
/* empty css                                                       */
import { S as Sparkline } from "../../../chunks/Sparkline.js";
import { B as BarChart } from "../../../chunks/BarChart.js";
import { R as RadarChart } from "../../../chunks/RadarChart.js";
import { T as TrendChart } from "../../../chunks/TrendChart.js";
/* empty css                                                       */
import { T as Table } from "../../../chunks/Table.js";
import { T as Toast } from "../../../chunks/Toast2.js";
import { T as Toggle } from "../../../chunks/Toggle.js";
import { R as RankMedal } from "../../../chunks/RankMedal.js";
import { D as DeltaBadge } from "../../../chunks/DeltaBadge.js";
import { R as RangeBadge } from "../../../chunks/RangeBadge.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/client.js";
import "../../../chunks/client2.js";
import { a as RANGE_OPTIONS, D as DEFAULT_RANGE } from "../../../chunks/range.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let sampleValue = "";
    let errorValue = "not-an-email";
    let toggleOn = true;
    const rows = [
      { day: "Mon", steps: 8421, rhr: 54, sleep: "7h 12m" },
      { day: "Tue", steps: 11238, rhr: 52, sleep: "6h 48m" },
      { day: "Wed", steps: 6094, rhr: 55, sleep: "7h 40m" },
      { day: "Thu", steps: 9765, rhr: 53, sleep: "7h 02m" }
    ];
    const radarFull = [
      { key: "speed", label: "Szybkość", value: 0.81 },
      { key: "tempo", label: "Tempo", value: 0.57 },
      { key: "endurance", label: "Wytrzymałość", value: 0.62 },
      { key: "volume", label: "Objętość", value: 0.4 },
      { key: "consistency", label: "Regularność", value: 0.72 }
    ];
    const radarGap = radarFull.map((a) => a.key === "endurance" ? { ...a, value: null } : a);
    const radarSparse = radarFull.map((a, i) => i === 0 ? a : { ...a, value: null });
    const stepsSeries = [8421, 11238, 6094, 9765, 7310, 10420, 9204];
    const rhrSeries = [54, 52, 55, 53, 53, 51, 50];
    const batterySeries = [61, 68, 72, 66, 74, 70, 72];
    const hrvSeries = [42, 45, 41, 48, 47, 52, 49];
    const dailySteps = [
      8421,
      11238,
      6094,
      9765,
      7310,
      10420,
      9204,
      12480,
      5900,
      8830,
      10120,
      7640,
      9950,
      11870
    ];
    const dayLabels = [
      "Jul 25",
      "Jul 26",
      "Jul 27",
      "Jul 28",
      "Jul 29",
      "Jul 30",
      "Jul 31",
      "Aug 1",
      "Aug 2",
      "Aug 3",
      "Aug 4",
      "Aug 5",
      "Aug 6",
      "Aug 7"
    ];
    const dailyBattery = [61, 68, 72, 66, 74, 70, 72, 58, 63, 69, 77, 71, 66, 73];
    const dailyRhr = [54, 52, 55, 53, 53, 51, 50, 56, 54, 52, 51, 53, 52, 49];
    const fmtInt = (n) => n.toLocaleString();
    const quarterSteps = Array.from({ length: 90 }, (_, i) => Math.round(9e3 + Math.sin(i / 4) * 2600 + (i % 7 === 6 ? -2800 : 0) + i % 11 * 120));
    const MONTHS_PL = [
      "sty",
      "lut",
      "mar",
      "kwi",
      "maj",
      "cze",
      "lip",
      "sie",
      "wrz",
      "paź",
      "lis",
      "gru"
    ];
    const quarterLabels = Array.from({ length: 90 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 4, 14 + i));
      return `${d.getUTCDate()} ${MONTHS_PL[d.getUTCMonth()]}`;
    });
    const pmcSeries = [
      {
        name: "CTL",
        values: [38, 40, 41, 43, 44, 46, 47, 49, 50, 51, 52, 54, 55, 56],
        color: "var(--lane-green)"
      },
      {
        name: "ATL",
        values: [30, 46, 52, 38, 61, 44, 35, 58, 66, 42, 39, 71, 48, 40],
        color: "var(--lane-red)"
      },
      {
        name: "TSB",
        values: [8, -6, -11, 5, -17, 2, 12, -9, -16, 9, 13, -17, 7, 16],
        color: "var(--lane-sky)"
      }
    ];
    const sportSeries = [
      {
        name: "Bieg",
        values: [45, 0, 62, 0, 38, 0, 74],
        color: "var(--lane-orange)"
      },
      {
        name: "Rower",
        values: [0, 90, 0, 55, 0, 120, 0],
        color: "var(--lane-cyan)"
      },
      {
        name: "Siła",
        values: [20, 0, 25, 0, 30, 0, 0],
        color: "var(--lane-violet)"
      }
    ];
    const weekLabels = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Ndz"];
    let pickedDay = dailySteps.length - 1;
    const pickedLabel = derived(() => pickedDay === null ? "—" : dayLabels[pickedDay] ?? "—");
    const pickedSteps = derived(() => pickedDay === null ? "—" : fmtInt(dailySteps[pickedDay] ?? 0));
    const rangeOptions = [
      { value: "7d", label: "7D" },
      { value: "30d", label: "30D" },
      { value: "90d", label: "90D" },
      { value: "1y", label: "1Y" }
    ];
    let range = "30d";
    const globalRangeOptions = RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label, short: o.short }));
    let globalRange = DEFAULT_RANGE;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      {
        let brand = function($$renderer4) {
          $$renderer4.push(`<span class="brand svelte-1ncf5z4">GB Design System</span>`);
        }, nav = function($$renderer4) {
          $$renderer4.push(`<a class="nav-link active svelte-1ncf5z4" href="#buttons">Buttons</a> <a class="nav-link svelte-1ncf5z4" href="#badges">Badges</a> <a class="nav-link svelte-1ncf5z4" href="#ranks">Rank medals</a> <a class="nav-link svelte-1ncf5z4" href="#deltas">Delta badges</a> <a class="nav-link svelte-1ncf5z4" href="#segmented">Segmented control</a> <a class="nav-link svelte-1ncf5z4" href="#range">Range indicator</a> <a class="nav-link svelte-1ncf5z4" href="#banners">Banners</a> <a class="nav-link svelte-1ncf5z4" href="#stats">Stat tiles</a> <a class="nav-link svelte-1ncf5z4" href="#sparklines">Sparklines</a> <a class="nav-link svelte-1ncf5z4" href="#charts">Charts</a> <a class="nav-link svelte-1ncf5z4" href="#cards">Cards</a> <a class="nav-link svelte-1ncf5z4" href="#forms">Forms</a> <a class="nav-link svelte-1ncf5z4" href="#table">Table</a> <a class="nav-link svelte-1ncf5z4" href="#feedback">Feedback</a> <a class="nav-link svelte-1ncf5z4" href="#skeletons">Skeletons</a>`);
        }, actions = function($$renderer4) {
          Button($$renderer4, {
            size: "sm",
            variant: "secondary",
            children: ($$renderer5) => {
              $$renderer5.push(`<!---->Docs`);
            },
            $$slots: { default: true }
          });
        };
        AppShell($$renderer3, {
          title: "Styleguide",
          brand,
          nav,
          actions,
          children: ($$renderer4) => {
            $$renderer4.push(`<div class="page svelte-1ncf5z4"><section id="buttons" class="group svelte-1ncf5z4"><h2>Buttons</h2> <h3 class="svelte-1ncf5z4">Variants (md)</h3> <div class="row svelte-1ncf5z4">`);
            Button($$renderer4, {
              variant: "primary",
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Primary`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Button($$renderer4, {
              variant: "secondary",
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Secondary`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Button($$renderer4, {
              variant: "ghost",
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Ghost`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Button($$renderer4, {
              variant: "danger",
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Danger`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----></div> <h3 class="svelte-1ncf5z4">Sizes</h3> <div class="row svelte-1ncf5z4">`);
            Button($$renderer4, {
              size: "sm",
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Small`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Button($$renderer4, {
              size: "md",
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Medium`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Button($$renderer4, {
              size: "sm",
              variant: "secondary",
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Small`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Button($$renderer4, {
              size: "md",
              variant: "secondary",
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Medium`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----></div> <h3 class="svelte-1ncf5z4">States</h3> <div class="row svelte-1ncf5z4">`);
            Button($$renderer4, {
              loading: true,
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Saving…`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Button($$renderer4, {
              variant: "secondary",
              loading: true,
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Loading`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Button($$renderer4, {
              disabled: true,
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Disabled`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Button($$renderer4, {
              variant: "danger",
              disabled: true,
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Disabled`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----></div> <h3 class="svelte-1ncf5z4">Icon only (spec 027)</h3> <div class="row svelte-1ncf5z4">`);
            IconButton($$renderer4, { icon: "refresh", label: "Synchronizuj teraz" });
            $$renderer4.push(`<!----> `);
            IconButton($$renderer4, { icon: "refresh", label: "Synchronizuj teraz", size: "sm" });
            $$renderer4.push(`<!----> `);
            IconButton($$renderer4, {
              icon: "refresh",
              label: "Synchronizacja w toku",
              loading: true
            });
            $$renderer4.push(`<!----> `);
            IconButton($$renderer4, { icon: "calendar", label: "Kalendarz", disabled: true });
            $$renderer4.push(`<!----></div></section> <section id="badges" class="group svelte-1ncf5z4"><h2>Badges</h2> <div class="row svelte-1ncf5z4">`);
            Badge($$renderer4, {
              tone: "neutral",
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Neutral`);
              }
            });
            $$renderer4.push(`<!----> `);
            Badge($$renderer4, {
              tone: "success",
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Connected`);
              }
            });
            $$renderer4.push(`<!----> `);
            Badge($$renderer4, {
              tone: "warning",
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Degraded`);
              }
            });
            $$renderer4.push(`<!----> `);
            Badge($$renderer4, {
              tone: "danger",
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Down`);
              }
            });
            $$renderer4.push(`<!----> `);
            Badge($$renderer4, {
              tone: "info",
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Info`);
              }
            });
            $$renderer4.push(`<!----></div></section> <section id="ranks" class="group svelte-1ncf5z4"><h2>Rank medals</h2> <p class="muted svelte-1ncf5z4">The podium hierarchy for any "best N ever" list (spec 054): gold, silver, bronze, then plainly
        numbered. Colour never carries the meaning on its own — the rank (or a short label such as <code>PR</code>) is always printed, so the order survives greyscale and a screen reader.</p> <div class="row svelte-1ncf5z4">`);
            RankMedal($$renderer4, { rank: 1, label: "PR", ariaLabel: "Rekord życiowy" });
            $$renderer4.push(`<!----> `);
            RankMedal($$renderer4, { rank: 2 });
            $$renderer4.push(`<!----> `);
            RankMedal($$renderer4, { rank: 3 });
            $$renderer4.push(`<!----> `);
            RankMedal($$renderer4, { rank: 4 });
            $$renderer4.push(`<!----> `);
            RankMedal($$renderer4, { rank: 12 });
            $$renderer4.push(`<!----></div></section> <section id="deltas" class="group svelte-1ncf5z4"><h2>Delta badges</h2> <p class="muted svelte-1ncf5z4">"This metric moved, and that is good or bad" (spec 055). Direction (the tone) and arrow are separate
        props on purpose: a faster race time is an improvement that points <em>down</em>, a rising weekly
        volume is an improvement that points <em>up</em>. Colour never carries the meaning alone — the
        arrow plus a visually hidden sentence state it too.</p> <div class="row svelte-1ncf5z4">`);
            DeltaBadge($$renderer4, {
              direction: "better",
              arrow: "down",
              value: "1:40",
              label: "szybciej o 1:40 niż 90 dni temu"
            });
            $$renderer4.push(`<!----> `);
            DeltaBadge($$renderer4, {
              direction: "worse",
              arrow: "up",
              value: "0:35",
              label: "wolniej o 0:35 niż 90 dni temu"
            });
            $$renderer4.push(`<!----> `);
            DeltaBadge($$renderer4, {
              direction: "same",
              value: "bez zmian",
              label: "bez zmian od 90 dni"
            });
            $$renderer4.push(`<!----> `);
            DeltaBadge($$renderer4, {
              direction: "better",
              arrow: "up",
              value: "+12 km",
              label: "12 km więcej niż w zeszłym miesiącu"
            });
            $$renderer4.push(`<!----></div></section> <section id="segmented" class="group svelte-1ncf5z4"><h2>Segmented control</h2> <h3 class="svelte-1ncf5z4">Window range (md)</h3> <div class="row svelte-1ncf5z4">`);
            SegmentedControl($$renderer4, {
              options: rangeOptions,
              ariaLabel: "Insights window range",
              get value() {
                return range;
              },
              set value($$value) {
                range = $$value;
                $$settled = false;
              }
            });
            $$renderer4.push(`<!----> <span class="muted svelte-1ncf5z4">Selected: ${escape_html(range)}</span></div> <h3 class="svelte-1ncf5z4">Compact (sm)</h3> <div class="row svelte-1ncf5z4">`);
            SegmentedControl($$renderer4, {
              options: rangeOptions,
              ariaLabel: "Insights window range (compact)",
              size: "sm",
              get value() {
                return range;
              },
              set value($$value) {
                range = $$value;
                $$settled = false;
              }
            });
            $$renderer4.push(`<!----></div> <h3 class="svelte-1ncf5z4">With compact labels (spec 047)</h3> <p class="muted svelte-1ncf5z4">Options carrying a <code>short</code> label swap to it below 768 px. Narrow the window to see <code>7d 14d 30d 1r ∞</code>. The full label stays the accessible name at every width.</p> <div class="row svelte-1ncf5z4">`);
            SegmentedControl($$renderer4, {
              options: globalRangeOptions,
              ariaLabel: "Global data range",
              size: "sm",
              get value() {
                return globalRange;
              },
              set value($$value) {
                globalRange = $$value;
                $$settled = false;
              }
            });
            $$renderer4.push(`<!----> <span class="muted svelte-1ncf5z4">Selected: ${escape_html(globalRange)}</span></div></section> <section id="range" class="group svelte-1ncf5z4"><h2>Range indicator</h2> <p class="muted svelte-1ncf5z4">The global range switch (spec 047) lives in the <code>AppShell</code> topbar on every range-aware route
        — it is not composed per page, so there is nothing to demo here. What pages DO compose is the indicator:
        every card whose content follows the switch carries one, and a card without one is claiming the opposite
        (all-time, switch-independent). Absence is meaningful, so never add it decoratively.</p> <h3 class="svelte-1ncf5z4">Sizes</h3> <div class="row svelte-1ncf5z4">`);
            RangeBadge($$renderer4, { label: "30 dni" });
            $$renderer4.push(`<!----> `);
            RangeBadge($$renderer4, { label: "30 dni", size: "sm" });
            $$renderer4.push(`<!----></div> <h3 class="svelte-1ncf5z4">Bucketed range</h3> <p class="muted svelte-1ncf5z4">Past 45 days a chart point stops being a day. Pass <code>bucketNoun</code> and the tooltip says what one
        point covers — hover to read it.</p> <div class="row svelte-1ncf5z4">`);
            RangeBadge($$renderer4, { label: "1 rok", bucketNoun: "tydzień" });
            $$renderer4.push(`<!----> `);
            RangeBadge($$renderer4, { label: "cały czas (od 2021-03-04)", bucketNoun: "miesiąc" });
            $$renderer4.push(`<!----></div> <h3 class="svelte-1ncf5z4">On a card</h3> <div class="row col svelte-1ncf5z4">`);
            Card($$renderer4, {
              title: "Objętość treningu",
              subtitle: "Godziny w tygodniu",
              range: "30 dni",
              children: ($$renderer5) => {
                $$renderer5.push(`<p class="muted svelte-1ncf5z4">Ranged: the badge appears in the header via the <code>range</code> prop.</p>`);
              }
            });
            $$renderer4.push(`<!----> `);
            Card($$renderer4, {
              title: "Zebrane dane",
              subtitle: "Ile danych masz lokalnie",
              children: ($$renderer5) => {
                $$renderer5.push(`<p class="muted svelte-1ncf5z4">Not ranged: no badge, because the switch does not move these numbers.</p>`);
              }
            });
            $$renderer4.push(`<!----></div></section> <section id="toggle" class="group svelte-1ncf5z4"><h2>Toggle</h2> <div class="row svelte-1ncf5z4">`);
            Toggle($$renderer4, {
              checked: toggleOn,
              label: "Demo toggle",
              onchange: (next) => toggleOn = next
            });
            $$renderer4.push(`<!----> <span class="muted svelte-1ncf5z4">${escape_html(toggleOn ? "On" : "Off")}</span> `);
            Toggle($$renderer4, { checked: true, size: "sm", label: "Small on" });
            $$renderer4.push(`<!----> `);
            Toggle($$renderer4, { checked: false, disabled: true, label: "Disabled" });
            $$renderer4.push(`<!----> `);
            Toggle($$renderer4, { checked: true, loading: true, label: "Loading" });
            $$renderer4.push(`<!----></div></section> <section id="banners" class="group svelte-1ncf5z4"><h2>Banners</h2> <div class="stack full svelte-1ncf5z4">`);
            Banner($$renderer4, {
              tone: "danger",
              title: "Garmin service is temporarily unavailable",
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->We couldn't reach the Garmin service, so these readings may be stale. Your data is safe — we'll
          reconnect automatically.`);
              }
            });
            $$renderer4.push(`<!----> `);
            Banner($$renderer4, {
              tone: "warning",
              title: "Session expiring soon",
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Reconnect within 24 hours to keep your metrics syncing.`);
              }
            });
            $$renderer4.push(`<!----> `);
            Banner($$renderer4, {
              tone: "success",
              title: "Garmin account connected",
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Your dashboard will populate on the next refresh.`);
              }
            });
            $$renderer4.push(`<!----> `);
            {
              let children = function($$renderer5) {
                $$renderer5.push(`<!---->Heads up: trends need 7 days of history to appear.`);
              };
              Banner($$renderer4, { tone: "info", children });
            }
            $$renderer4.push(`<!----> `);
            {
              let children = function($$renderer5) {
                $$renderer5.push(`<!---->Trend collection is off for this account.`);
              }, actions2 = function($$renderer5) {
                Button($$renderer5, {
                  size: "sm",
                  variant: "secondary",
                  children: ($$renderer6) => {
                    $$renderer6.push(`<!---->Resume`);
                  },
                  $$slots: { default: true }
                });
              };
              Banner($$renderer4, {
                tone: "warning",
                title: "Analytics paused",
                children,
                actions: actions2
              });
            }
            $$renderer4.push(`<!----></div></section> <section id="stats" class="group svelte-1ncf5z4"><h2>Stat tiles</h2> <div class="grid svelte-1ncf5z4">`);
            {
              let sparkline = function($$renderer5) {
                Sparkline($$renderer5, {
                  values: stepsSeries,
                  label: "steps",
                  color: "var(--lane-orange)",
                  showArea: true
                });
              };
              StatTile($$renderer4, {
                label: "Steps today",
                value: "9,204",
                accent: "orange",
                delta: 12,
                deltaSuffix: "%",
                sparkline
              });
            }
            $$renderer4.push(`<!----> `);
            {
              let sparkline = function($$renderer5) {
                Sparkline($$renderer5, {
                  values: rhrSeries,
                  label: "resting HR",
                  color: "var(--lane-red)"
                });
              };
              StatTile($$renderer4, {
                label: "Resting HR",
                value: "50",
                unit: "bpm",
                accent: "red",
                delta: -2,
                deltaSuffix: " bpm",
                sparkline
              });
            }
            $$renderer4.push(`<!----> `);
            {
              let sparkline = function($$renderer5) {
                Sparkline($$renderer5, {
                  values: batterySeries,
                  label: "body battery",
                  color: "var(--lane-cyan)",
                  showArea: true
                });
              };
              StatTile($$renderer4, {
                label: "Body battery",
                value: "72",
                unit: "%",
                accent: "cyan",
                delta: 3,
                deltaSuffix: "%",
                sparkline
              });
            }
            $$renderer4.push(`<!----> `);
            StatTile($$renderer4, {
              label: "HRV overnight",
              value: "49",
              unit: "ms",
              accent: "green",
              delta: 0,
              deltaSuffix: " ms"
            });
            $$renderer4.push(`<!----> `);
            StatTile($$renderer4, { label: "SpO2", value: "—", accent: "sky", muted: true });
            $$renderer4.push(`<!----> `);
            StatTile($$renderer4, { label: "Czas", value: "6 h 52 min", accent: "indigo" });
            $$renderer4.push(`<!----> `);
            StatTile($$renderer4, {
              label: "Dystans łącznie",
              value: "12 345 678",
              unit: "km",
              accent: "violet"
            });
            $$renderer4.push(`<!----></div> <h3 class="svelte-1ncf5z4">Narrow columns (activity hero)</h3> <div class="tiles-narrow svelte-1ncf5z4">`);
            StatTile($$renderer4, {
              label: "Dystans",
              value: "6,11",
              unit: "km",
              accent: "orange"
            });
            $$renderer4.push(`<!----> `);
            StatTile($$renderer4, { label: "Czas w ruchu", value: "34:50", accent: "cyan" });
            $$renderer4.push(`<!----> `);
            StatTile($$renderer4, {
              label: "Średnie tempo",
              value: "5:44",
              unit: "min/km",
              accent: "lime"
            });
            $$renderer4.push(`<!----> `);
            StatTile($$renderer4, {
              label: "Średnie tętno",
              value: "135",
              unit: "bpm",
              accent: "red"
            });
            $$renderer4.push(`<!----> `);
            StatTile($$renderer4, {
              label: "Średnia moc",
              value: "387",
              unit: "W",
              accent: "amber"
            });
            $$renderer4.push(`<!----> `);
            StatTile($$renderer4, {
              label: "Przewyższenie",
              value: "30",
              unit: "m",
              accent: "green"
            });
            $$renderer4.push(`<!----> `);
            StatTile($$renderer4, {
              label: "Kalorie",
              value: "517",
              unit: "kcal",
              accent: "violet"
            });
            $$renderer4.push(`<!----> `);
            StatTile($$renderer4, { label: "Obciążenie", value: "65", accent: "indigo" });
            $$renderer4.push(`<!----></div></section> <section id="sparklines" class="group svelte-1ncf5z4"><h2>Sparklines</h2> <h3 class="svelte-1ncf5z4">Lane colours</h3> <div class="sparks svelte-1ncf5z4"><div class="spark-cell svelte-1ncf5z4"><span class="spark-name svelte-1ncf5z4">Steps</span> `);
            Sparkline($$renderer4, {
              values: stepsSeries,
              label: "steps",
              color: "var(--lane-orange)",
              showArea: true
            });
            $$renderer4.push(`<!----></div> <div class="spark-cell svelte-1ncf5z4"><span class="spark-name svelte-1ncf5z4">HRV</span> `);
            Sparkline($$renderer4, {
              values: hrvSeries,
              label: "HRV",
              color: "var(--lane-green)",
              showArea: true,
              baseline: 45
            });
            $$renderer4.push(`<!----></div> <div class="spark-cell svelte-1ncf5z4"><span class="spark-name svelte-1ncf5z4">Resting HR</span> `);
            Sparkline($$renderer4, {
              values: rhrSeries,
              label: "resting HR",
              color: "var(--lane-red)"
            });
            $$renderer4.push(`<!----></div> <div class="spark-cell svelte-1ncf5z4"><span class="spark-name svelte-1ncf5z4">Body battery</span> `);
            Sparkline($$renderer4, {
              values: batterySeries,
              label: "body battery",
              color: "var(--lane-cyan)",
              showArea: true
            });
            $$renderer4.push(`<!----></div></div> <h3 class="svelte-1ncf5z4">Edge cases</h3> <div class="sparks svelte-1ncf5z4"><div class="spark-cell svelte-1ncf5z4"><span class="spark-name svelte-1ncf5z4">Single point</span> `);
            Sparkline($$renderer4, { values: [72], label: "single", color: "var(--lane-indigo)" });
            $$renderer4.push(`<!----></div> <div class="spark-cell svelte-1ncf5z4"><span class="spark-name svelte-1ncf5z4">All equal</span> `);
            Sparkline($$renderer4, {
              values: [60, 60, 60, 60],
              label: "flat",
              color: "var(--lane-amber)",
              showArea: true
            });
            $$renderer4.push(`<!----></div> <div class="spark-cell svelte-1ncf5z4"><span class="spark-name svelte-1ncf5z4">Empty</span> `);
            Sparkline($$renderer4, { values: [], label: "empty" });
            $$renderer4.push(`<!----></div></div></section> <section id="charts" class="group svelte-1ncf5z4"><h2>Charts</h2> <h3 class="svelte-1ncf5z4">Bar chart — daily series</h3> <div class="charts svelte-1ncf5z4"><div class="chart-cell svelte-1ncf5z4"><span class="chart-name svelte-1ncf5z4">Steps · 14 days</span> `);
            BarChart($$renderer4, {
              values: dailySteps,
              labels: dayLabels,
              color: "var(--lane-orange)",
              formatValue: fmtInt
            });
            $$renderer4.push(`<!----></div> <div class="chart-cell svelte-1ncf5z4"><span class="chart-name svelte-1ncf5z4">Body battery · goal 70</span> `);
            BarChart($$renderer4, {
              values: dailyBattery,
              labels: dayLabels,
              color: "var(--lane-cyan)",
              baseline: 70
            });
            $$renderer4.push(`<!----></div></div> <h3 class="svelte-1ncf5z4">Trend chart — line + area</h3> <p class="muted svelte-1ncf5z4">Hover, tap-and-drag, or focus the chart and press ←/→ to read a single day. Pass <code>labels</code> to title the read-out with its date.</p> <div class="charts svelte-1ncf5z4"><div class="chart-cell wide svelte-1ncf5z4"><span class="chart-name svelte-1ncf5z4">Steps · min/max + average</span> `);
            TrendChart($$renderer4, {
              values: dailySteps,
              labels: dayLabels,
              label: "steps",
              color: "var(--lane-orange)",
              formatValue: fmtInt,
              showAvg: true
            });
            $$renderer4.push(`<!----></div> <div class="chart-cell wide svelte-1ncf5z4"><span class="chart-name svelte-1ncf5z4">Resting HR</span> `);
            TrendChart($$renderer4, {
              values: dailyRhr,
              labels: dayLabels,
              label: "resting HR",
              color: "var(--lane-red)"
            });
            $$renderer4.push(`<!----></div></div> <h3 class="svelte-1ncf5z4">Axes — labelled scale, thinned date ticks, unit</h3> <p class="muted svelte-1ncf5z4">The y scale lands on round values and reserves exactly the gutter its widest tick needs; the unit is
        printed once, never on every tick. X ticks thin themselves to the measured width, so 90 dates and 7
        dates both stay readable. <code>xAxis</code>/<code>yAxis</code> turn them off for decorative uses.</p> <div class="charts svelte-1ncf5z4"><div class="chart-cell wide svelte-1ncf5z4"><span class="chart-name svelte-1ncf5z4">Steps · 90 days · ticks thin automatically</span> `);
            TrendChart($$renderer4, {
              values: quarterSteps,
              labels: quarterLabels,
              label: "steps",
              unit: "kroki",
              color: "var(--lane-orange)",
              formatValue: fmtInt,
              showAvg: true
            });
            $$renderer4.push(`<!----></div> <div class="chart-cell wide svelte-1ncf5z4"><span class="chart-name svelte-1ncf5z4">Resting HR · bpm</span> `);
            BarChart($$renderer4, {
              values: dailyRhr,
              labels: dayLabels,
              label: "resting HR",
              unit: "bpm",
              color: "var(--lane-red)",
              height: 180
            });
            $$renderer4.push(`<!----></div> <div class="chart-cell wide svelte-1ncf5z4"><span class="chart-name svelte-1ncf5z4">Axes off — decorative</span> `);
            TrendChart($$renderer4, {
              values: dailyBattery,
              labels: dayLabels,
              label: "body battery",
              color: "var(--lane-cyan)",
              xAxis: false,
              yAxis: false,
              height: 120
            });
            $$renderer4.push(`<!----></div></div> <h3 class="svelte-1ncf5z4">Multi-series + legend</h3> <p class="muted svelte-1ncf5z4">Pass <code>series</code> for two or more named lines/bars. Legend items carry each series' value while a
        read-out is open, and toggle their series on click or Enter — the last visible series can't be switched
        off.</p> <div class="charts svelte-1ncf5z4"><div class="chart-cell wide svelte-1ncf5z4"><span class="chart-name svelte-1ncf5z4">Training load · CTL / ATL / TSB</span> `);
            TrendChart($$renderer4, {
              series: pmcSeries,
              labels: dayLabels.slice(0, 14),
              label: "load",
              unit: "TSS/d",
              height: 220
            });
            $$renderer4.push(`<!----></div> <div class="chart-cell wide svelte-1ncf5z4"><span class="chart-name svelte-1ncf5z4">Minutes per sport · grouped bars</span> `);
            BarChart($$renderer4, {
              series: sportSeries,
              labels: weekLabels,
              unit: "min",
              height: 200
            });
            $$renderer4.push(`<!----></div></div> <h3 class="svelte-1ncf5z4">Click to select</h3> <p class="muted svelte-1ncf5z4">Click, tap, or focus the chart and press Enter to pin a day — the pinned read-out survives the pointer
        leaving, so a headline can follow it via <code>bind:selectedIndex</code>. Esc clears the pin.</p> <div class="charts svelte-1ncf5z4"><div class="chart-cell wide svelte-1ncf5z4"><span class="chart-name svelte-1ncf5z4">Steps · ${escape_html(pickedLabel())}</span> `);
            StatTile($$renderer4, {
              label: "Kroki tego dnia",
              value: pickedSteps(),
              unit: "kroki",
              accent: "orange"
            });
            $$renderer4.push(`<!----> `);
            BarChart($$renderer4, {
              values: dailySteps,
              labels: dayLabels,
              label: "steps",
              color: "var(--lane-orange)",
              formatValue: fmtInt,
              height: 180,
              get selectedIndex() {
                return pickedDay;
              },
              set selectedIndex($$value) {
                pickedDay = $$value;
                $$settled = false;
              }
            });
            $$renderer4.push(`<!----></div></div> <h3 class="svelte-1ncf5z4">Edge cases</h3> <div class="charts svelte-1ncf5z4"><div class="chart-cell svelte-1ncf5z4"><span class="chart-name svelte-1ncf5z4">Bar · empty</span> `);
            BarChart($$renderer4, { values: [] });
            $$renderer4.push(`<!----></div> <div class="chart-cell svelte-1ncf5z4"><span class="chart-name svelte-1ncf5z4">Bar · single</span> `);
            BarChart($$renderer4, {
              values: [9204],
              labels: ["Aug 7"],
              color: "var(--lane-green)"
            });
            $$renderer4.push(`<!----></div> <div class="chart-cell svelte-1ncf5z4"><span class="chart-name svelte-1ncf5z4">Bar · all equal</span> `);
            BarChart($$renderer4, { values: [60, 60, 60, 60, 60], color: "var(--lane-amber)" });
            $$renderer4.push(`<!----></div> <div class="chart-cell wide svelte-1ncf5z4"><span class="chart-name svelte-1ncf5z4">Trend · empty</span> `);
            TrendChart($$renderer4, { values: [], label: "steps" });
            $$renderer4.push(`<!----></div> <div class="chart-cell wide svelte-1ncf5z4"><span class="chart-name svelte-1ncf5z4">Trend · single</span> `);
            TrendChart($$renderer4, {
              values: [72],
              label: "body battery",
              color: "var(--lane-cyan)"
            });
            $$renderer4.push(`<!----></div> <div class="chart-cell wide svelte-1ncf5z4"><span class="chart-name svelte-1ncf5z4">Trend · all equal</span> `);
            TrendChart($$renderer4, {
              values: [50, 50, 50, 50, 50],
              label: "flat",
              color: "var(--lane-indigo)"
            });
            $$renderer4.push(`<!----></div></div> <h3 class="svelte-1ncf5z4">Radar (profile shape)</h3> <div class="charts svelte-1ncf5z4"><div class="chart-cell svelte-1ncf5z4"><span class="chart-name svelte-1ncf5z4">Radar · five axes</span> `);
            RadarChart($$renderer4, {
              axes: radarFull,
              ariaLabel: "Radar demo",
              color: "var(--lane-orange)"
            });
            $$renderer4.push(`<!----></div> <div class="chart-cell svelte-1ncf5z4"><span class="chart-name svelte-1ncf5z4">Radar · one axis missing</span> `);
            RadarChart($$renderer4, { axes: radarGap, ariaLabel: "Radar demo z brakiem danych" });
            $$renderer4.push(`<!----></div> <div class="chart-cell svelte-1ncf5z4"><span class="chart-name svelte-1ncf5z4">Radar · too little data (frame only)</span> `);
            RadarChart($$renderer4, { axes: radarSparse, ariaLabel: "Radar demo bez danych" });
            $$renderer4.push(`<!----></div></div></section> <section id="cards" class="group svelte-1ncf5z4"><h2>Cards</h2> <div class="grid svelte-1ncf5z4">`);
            {
              let actions2 = function($$renderer5) {
                Badge($$renderer5, {
                  tone: "success",
                  children: ($$renderer6) => {
                    $$renderer6.push(`<!---->Healthy`);
                  }
                });
              };
              Card($$renderer4, {
                title: "Health check",
                subtitle: "Sidecar + Garmin session",
                actions: actions2,
                children: ($$renderer5) => {
                  $$renderer5.push(`<p class="muted svelte-1ncf5z4">All systems reporting. Last checked a moment ago.</p>`);
                }
              });
            }
            $$renderer4.push(`<!----> `);
            {
              let actions2 = function($$renderer5) {
                Button($$renderer5, {
                  size: "sm",
                  variant: "ghost",
                  children: ($$renderer6) => {
                    $$renderer6.push(`<!---->Copy`);
                  },
                  $$slots: { default: true }
                });
              };
              Card($$renderer4, {
                title: "MCP endpoint",
                actions: actions2,
                children: ($$renderer5) => {
                  $$renderer5.push(`<code class="mcp svelte-1ncf5z4">https://bridge.lan:8080/mcp?token=•••••</code>`);
                }
              });
            }
            $$renderer4.push(`<!----> `);
            Card($$renderer4, {
              children: ($$renderer5) => {
                $$renderer5.push(`<p class="muted svelte-1ncf5z4">A plain card with no header — just body content and token padding.</p>`);
              }
            });
            $$renderer4.push(`<!----></div></section> <section id="forms" class="group svelte-1ncf5z4"><h2>Forms</h2> <div class="form svelte-1ncf5z4">`);
            {
              let children = function($$renderer5, c) {
                Input($$renderer5, {
                  id: c.id,
                  "aria-describedby": c.describedBy,
                  type: "email",
                  placeholder: "you@example.com",
                  get value() {
                    return sampleValue;
                  },
                  set value($$value) {
                    sampleValue = $$value;
                    $$settled = false;
                  }
                });
              };
              Field($$renderer4, {
                label: "Email",
                help: "We only use this to log you in.",
                children
              });
            }
            $$renderer4.push(`<!----> `);
            {
              let children = function($$renderer5, c) {
                Input($$renderer5, {
                  id: c.id,
                  "aria-describedby": c.describedBy,
                  invalid: c.invalid,
                  type: "email",
                  get value() {
                    return errorValue;
                  },
                  set value($$value) {
                    errorValue = $$value;
                    $$settled = false;
                  }
                });
              };
              Field($$renderer4, {
                label: "Garmin email",
                error: "Enter a valid email address.",
                required: true,
                children
              });
            }
            $$renderer4.push(`<!----> `);
            {
              let children = function($$renderer5, c) {
                Input($$renderer5, {
                  id: c.id,
                  "aria-describedby": c.describedBy,
                  value: "locked",
                  disabled: true
                });
              };
              Field($$renderer4, {
                label: "Disabled field",
                help: "Read-only example.",
                children
              });
            }
            $$renderer4.push(`<!----></div></section> <section id="table" class="group svelte-1ncf5z4"><h2>Table</h2> `);
            {
              let head = function($$renderer5) {
                $$renderer5.push(`<th>Day</th> <th>Steps</th> <th>Resting HR</th> <th>Sleep</th>`);
              };
              Table($$renderer4, {
                zebra: true,
                caption: "Recent daily metrics",
                head,
                children: ($$renderer5) => {
                  $$renderer5.push(`<!--[-->`);
                  const each_array = ensure_array_like(rows);
                  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                    let r = each_array[$$index];
                    $$renderer5.push(`<tr><td>${escape_html(r.day)}</td><td>${escape_html(r.steps.toLocaleString())}</td><td>${escape_html(r.rhr)} bpm</td><td>${escape_html(r.sleep)}</td></tr>`);
                  }
                  $$renderer5.push(`<!--]-->`);
                }
              });
            }
            $$renderer4.push(`<!----></section> <section id="feedback" class="group svelte-1ncf5z4"><h2>Feedback</h2> <h3 class="svelte-1ncf5z4">Spinner</h3> <div class="row svelte-1ncf5z4">`);
            Spinner($$renderer4, { size: "sm" });
            $$renderer4.push(`<!----> `);
            Spinner($$renderer4, { size: "md" });
            $$renderer4.push(`<!----></div> <h3 class="svelte-1ncf5z4">Toast (static preview)</h3> <div class="stack svelte-1ncf5z4">`);
            Toast($$renderer4, {
              tone: "success",
              message: "Garmin session refreshed.",
              ondismiss: () => {
              }
            });
            $$renderer4.push(`<!----> `);
            Toast($$renderer4, {
              tone: "error",
              message: "Sidecar is unreachable.",
              ondismiss: () => {
              }
            });
            $$renderer4.push(`<!----> `);
            Toast($$renderer4, {
              tone: "info",
              message: "MCP token copied to clipboard.",
              ondismiss: () => {
              }
            });
            $$renderer4.push(`<!----></div> <h3 class="svelte-1ncf5z4">Toast (live via store)</h3> <div class="row svelte-1ncf5z4">`);
            Button($$renderer4, {
              size: "sm",
              variant: "secondary",
              onclick: () => toasts.success("Saved successfully."),
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Fire success`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Button($$renderer4, {
              size: "sm",
              variant: "secondary",
              onclick: () => toasts.error("Something went wrong."),
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Fire error`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----> `);
            Button($$renderer4, {
              size: "sm",
              variant: "secondary",
              onclick: () => toasts.info("Heads up."),
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Fire info`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!----></div></section> <section id="skeletons" class="group svelte-1ncf5z4"><h2>Skeletons</h2> <h3 class="svelte-1ncf5z4">Primitives</h3> <div class="skeleton-demo svelte-1ncf5z4">`);
            Skeleton($$renderer4, { width: "var(--space-16)", height: "var(--space-2)" });
            $$renderer4.push(`<!----> `);
            Skeleton($$renderer4, { height: "var(--space-4)", radius: "md" });
            $$renderer4.push(`<!----> `);
            Skeleton($$renderer4, { height: "var(--space-8)", radius: "lg" });
            $$renderer4.push(`<!----> <div class="skeleton-row svelte-1ncf5z4">`);
            Skeleton($$renderer4, { circle: true, height: "var(--space-10)" });
            $$renderer4.push(`<!----> <div class="skeleton-lines svelte-1ncf5z4">`);
            Skeleton($$renderer4, { width: "60%", height: "var(--space-3)" });
            $$renderer4.push(`<!----> `);
            Skeleton($$renderer4, { width: "90%", height: "var(--space-2)" });
            $$renderer4.push(`<!----></div></div></div> <h3 class="svelte-1ncf5z4">Composed tile placeholder</h3> <div class="grid svelte-1ncf5z4"><div class="tile-skeleton svelte-1ncf5z4">`);
            Skeleton($$renderer4, { width: "40%", height: "var(--space-2)" });
            $$renderer4.push(`<!----> `);
            Skeleton($$renderer4, { width: "70%", height: "var(--space-10)", radius: "md" });
            $$renderer4.push(`<!----> `);
            Skeleton($$renderer4, { height: "var(--space-8)", radius: "md" });
            $$renderer4.push(`<!----></div> <div class="tile-skeleton svelte-1ncf5z4">`);
            Skeleton($$renderer4, { width: "45%", height: "var(--space-2)" });
            $$renderer4.push(`<!----> `);
            Skeleton($$renderer4, { width: "60%", height: "var(--space-10)", radius: "md" });
            $$renderer4.push(`<!----> `);
            Skeleton($$renderer4, { height: "var(--space-8)", radius: "md" });
            $$renderer4.push(`<!----></div></div></section></div>`);
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
export {
  _page as default
};
