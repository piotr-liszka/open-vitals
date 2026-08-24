import { a6 as stringify, Q as derived, a5 as escape_html, ai as spread_props, a7 as ensure_array_like, a4 as attr_class, ag as attr_style, ab as attr } from '../../../../chunks/index.js-D7taQuDv.js';
import { C as Card } from '../../../../chunks/Card.js-D8ZxuUNK.js';
import { S as StatTile } from '../../../../chunks/StatTile.js-DDgLmTba.js';
import { B as Badge } from '../../../../chunks/Badge.js-Bcg4u8Go.js';
import { B as BarChart } from '../../../../chunks/BarChart.js-D3sjnavQ.js';
import { T as TrendChart } from '../../../../chunks/TrendChart.js-C2RJO89W.js';
import { S as SegmentedControl } from '../../../../chunks/SegmentedControl.js-vIk-Z1KL.js';
import { g as formatMonth, j as isDayKey, u as dayOfWeek, i as formatDay } from '../../../../chunks/date.js-Cf0GyZI8.js';
import '../../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../../chunks/RangeBadge.js-CR-NnSex.js';
import '../../../../chunks/Icon.js-D5N4FEG5.js';

function YearGrid($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      days,
      year,
      color = "var(--color-accent)",
      ariaLabel = "Aktywność w ciągu roku",
      unit = ""
    } = $$props;
    const STEPS = 4;
    const byDay = derived(() => new Map(days.filter((d) => isDayKey(d.day)).map((d) => [d.day, d])));
    const cuts = derived(() => {
      const values = [...byDay().values()].map((d) => d.value).filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
      if (values.length === 0) return [];
      return Array.from({ length: STEPS - 1 }, (_, i) => values[Math.floor((i + 1) / STEPS * (values.length - 1))] ?? 0);
    });
    function levelOf(value) {
      if (!Number.isFinite(value) || value <= 0) return 0;
      let level = 1;
      for (const cut of cuts()) if (value > cut) level++;
      return Math.min(STEPS, level);
    }
    const columns = derived(() => {
      const first = `${year}-01-01`;
      if (!isDayKey(first)) return [];
      const offset = dayOfWeek(first);
      const cells = new Array(offset).fill(null);
      for (let month = 1; month <= 12; month++) {
        for (let day = 1; day <= 31; day++) {
          const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          if (!isDayKey(key)) continue;
          cells.push(byDay().get(key) ?? { day: key, value: 0 });
        }
      }
      const out = [];
      for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
      return out;
    });
    const activeDays = derived(() => [...byDay().values()].filter((d) => d.value > 0).length);
    function tooltip(cell) {
      const when = isDayKey(cell.day) ? formatDay(cell.day, "shortYear") : cell.day;
      if (cell.value <= 0) return `${when}: brak aktywności`;
      return cell.title ?? `${when}: ${cell.value}${unit ? ` ${unit}` : ""}`;
    }
    $$renderer2.push(`<div class="grid-block svelte-ae21yl"${attr_style(`--peak: ${stringify(color)}`)}><div class="grid svelte-ae21yl" role="img"${attr("aria-label", `${ariaLabel}: ${activeDays()} dni z aktywnością w ${year}`)}${attr_style(`--cols: ${stringify(columns().length)}`)}><!--[-->`);
    const each_array = ensure_array_like(columns());
    for (let w = 0, $$length = each_array.length; w < $$length; w++) {
      let week = each_array[w];
      $$renderer2.push(`<div class="week svelte-ae21yl"><!--[-->`);
      const each_array_1 = ensure_array_like(week);
      for (let d = 0, $$length2 = each_array_1.length; d < $$length2; d++) {
        let cell = each_array_1[d];
        if (cell) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="cell svelte-ae21yl"${attr("data-level", levelOf(cell.value))}${attr("title", tooltip(cell))}></span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<span class="cell pad svelte-ae21yl" aria-hidden="true"></span>`);
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="legend svelte-ae21yl"><span class="legend-label svelte-ae21yl">mniej</span> <!--[-->`);
    const each_array_2 = ensure_array_like([0, 1, 2, 3, 4]);
    for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
      let level = each_array_2[$$index_2];
      $$renderer2.push(`<span class="cell svelte-ae21yl"${attr("data-level", level)} aria-hidden="true"></span>`);
    }
    $$renderer2.push(`<!--]--> <span class="legend-label svelte-ae21yl">więcej</span></div></div>`);
  });
}
function VolumeView($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    let measure = "distance";
    const measureOptions = [
      { value: "distance", label: "Dystans" },
      { value: "duration", label: "Czas" },
      { value: "elevation", label: "Przewyższenie" }
    ];
    const nf = new Intl.NumberFormat("pl-PL");
    const nf1 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const fmtKm = (metres) => `${nf.format(Math.round(metres / 1e3))} km`;
    const fmtM = (metres) => `${nf.format(Math.round(metres))} m`;
    function fmtHours(totalS) {
      const h = Math.floor(totalS / 3600);
      const m = Math.round(totalS % 3600 / 60);
      return h > 0 ? `${h} h ${m} min` : `${m} min`;
    }
    const chosen = derived(() => {
      if (measure === "duration") {
        return {
          label: "Czas",
          unit: "h",
          pick: (i) => data.monthly[i]?.durationS ?? 0,
          series: (s) => s.durationS,
          format: fmtHours,
          tick: (v) => nf.format(Math.round(v / 3600))
        };
      }
      if (measure === "elevation") {
        return {
          label: "Przewyższenie",
          unit: "m",
          pick: (i) => data.monthly[i]?.elevationGainM ?? 0,
          series: (s) => s.elevationGainM,
          format: fmtM,
          tick: (v) => nf.format(Math.round(v))
        };
      }
      return {
        label: "Dystans",
        unit: "km",
        pick: (i) => data.monthly[i]?.distanceM ?? 0,
        series: (s) => s.distanceM,
        format: fmtKm,
        tick: (v) => nf.format(Math.round(v / 1e3))
      };
    });
    const monthLabels = derived(() => data.months.map((m) => m.endsWith("-01") ? formatMonth(m, "shortYear") : formatMonth(m, "short")));
    const monthSeries = derived(() => data.bySport.map((s) => ({ name: s.label, values: chosen().series(s), color: s.color })));
    const baseline = derived(() => measure === "distance" && data.avgDistanceM !== null ? data.avgDistanceM : void 0);
    const current = derived(() => data.years.find((y) => y.partial) ?? data.years[0]);
    const previous = derived(() => data.years.find((y) => y.year === (current()?.year ?? 0) - 1));
    const YEAR_LANES = [
      "var(--lane-orange)",
      "var(--lane-cyan)",
      "var(--lane-violet)",
      "var(--lane-teal)"
    ];
    const yearSeries = derived(() => data.years.map((y, i) => ({
      name: String(y.year),
      values: y.cumulativeKm.map((v) => v === null ? NaN : v),
      color: YEAR_LANES[i] ?? "var(--color-accent)"
    })));
    const aheadTone = derived(() => data.vsLastYearKm === null ? "neutral" : data.vsLastYearKm >= 0 ? "success" : "warning");
    if (!data.hasData) {
      $$renderer2.push("<!--[0-->");
      Card($$renderer2, {
        title: "Objętość",
        children: ($$renderer3) => {
          $$renderer3.push(`<p class="empty svelte-1rbq9">Brak zsynchronizowanych aktywności w ostatnich latach. Po pierwszej synchronizacji pojawią się tu
      miesiące i porównanie rok do roku.</p>`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="page svelte-1rbq9"><section class="tiles svelte-1rbq9" aria-label="Podsumowanie objętości">`);
      if (current()) {
        $$renderer2.push("<!--[0-->");
        StatTile($$renderer2, {
          label: "W tym roku do dziś",
          value: nf.format(Math.round(current().toDateKm)),
          unit: "km",
          accent: "orange"
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (previous()) {
        $$renderer2.push("<!--[0-->");
        StatTile($$renderer2, {
          label: `${previous().year} do tego dnia`,
          value: nf.format(Math.round(previous().toDateKm)),
          unit: "km",
          accent: "cyan"
        });
        $$renderer2.push(`<!----> `);
        StatTile($$renderer2, {
          label: `Cały ${previous().year}`,
          value: nf.format(Math.round(previous().totalKm)),
          unit: "km",
          accent: "teal"
        });
        $$renderer2.push(`<!---->`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (data.avgDistanceM !== null) {
        $$renderer2.push("<!--[0-->");
        StatTile($$renderer2, {
          label: "Średnio na pełny miesiąc",
          value: nf.format(Math.round(data.avgDistanceM / 1e3)),
          unit: "km",
          accent: "green"
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (data.bestMonth) {
        $$renderer2.push("<!--[0-->");
        StatTile($$renderer2, {
          label: `Najlepszy miesiąc · ${formatMonth(data.bestMonth.month, "shortYear")}`,
          value: nf.format(Math.round(data.bestMonth.distanceM / 1e3)),
          unit: "km",
          accent: "violet"
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></section> `);
      Card($$renderer2, {
        title: "Rok do roku",
        subtitle: "Suma kilometrów narastająco. Każdy rok mierzony w tym samym dniu sezonu — inaczej porównanie nie miałoby sensu.",
        children: ($$renderer3) => {
          if (data.vsLastYearKm !== null && previous()) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<p class="verdict svelte-1rbq9">`);
            Badge($$renderer3, {
              tone: aheadTone(),
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->${escape_html(data.vsLastYearKm >= 0 ? "Przed" : "Za")} rokiem ${escape_html(previous().year)}`);
              }
            });
            $$renderer3.push(`<!----> <span class="verdict-text svelte-1rbq9">o <strong class="svelte-1rbq9">${escape_html(nf1.format(Math.abs(data.vsLastYearKm)))} km</strong> na ten sam dzień roku.</span></p>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> `);
          TrendChart($$renderer3, {
            series: yearSeries(),
            labels: data.dayOfYearLabels,
            height: 300,
            unit: "km",
            label: "dystans narastająco",
            formatValue: (v) => `${nf1.format(v)} km`,
            formatTick: (v) => nf.format(Math.round(v))
          });
          $$renderer3.push(`<!---->`);
        }
      });
      $$renderer2.push(`<!----> `);
      {
        let actions = function($$renderer3) {
          SegmentedControl($$renderer3, {
            options: measureOptions,
            value: measure,
            onChange: (v) => measure = v,
            ariaLabel: "Miara objętości",
            size: "sm"
          });
        };
        Card($$renderer2, {
          title: "Miesiąc po miesiącu",
          subtitle: `Ostatnie ${data.windowMonths} miesięcy, w podziale na sporty. Bieżący miesiąc jest niepełny.`,
          actions,
          children: ($$renderer3) => {
            BarChart($$renderer3, spread_props([
              {
                series: monthSeries(),
                labels: monthLabels(),
                height: 300,
                unit: chosen().unit,
                label: chosen().label,
                formatValue: chosen().format,
                formatTick: chosen().tick
              },
              baseline() === void 0 ? {} : { baseline: baseline() }
            ]));
            $$renderer3.push(`<!----> `);
            if (baseline() !== void 0) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<p class="note svelte-1rbq9">Linia odniesienia to średnia z pełnych miesięcy — bieżący, niepełny miesiąc nie wchodzi do tej
          średniej ani do „najlepszego miesiąca”.</p>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]-->`);
          }
        });
      }
      $$renderer2.push(`<!----> `);
      if (data.gridDays.length > 0) {
        $$renderer2.push("<!--[0-->");
        Card($$renderer2, {
          title: `Regularność ${stringify(data.gridYear)}`,
          subtitle: "Każdy dzień roku jako jedno pole — streaki, przerwy i sezonowość widać tu od razu, czego nie pokaże żaden wykres tygodniowy",
          children: ($$renderer3) => {
            YearGrid($$renderer3, {
              days: data.gridDays.map((d) => ({ day: d.day, value: d.km, title: d.title })),
              year: data.gridYear,
              color: "var(--lane-orange)",
              ariaLabel: "Regularność treningu",
              unit: "km"
            });
            $$renderer3.push(`<!----> <p class="note svelte-1rbq9">Odcień zależy od tego, jak duży był to dzień <em>na tle Twoich pozostałych dni</em>, a nie na tle
          największego — inaczej jeden długi bieg wyblakłby cały rok. Dzień bez aktywności jest pustym polem,
          nie najjaśniejszym odcieniem.</p>`);
          }
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      Card($$renderer2, {
        title: "Miesiące",
        subtitle: "Te same liczby w tabeli, z zaznaczonym miesiącem w toku",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="table-wrap svelte-1rbq9"><table class="months svelte-1rbq9"><thead class="svelte-1rbq9"><tr><th scope="col" class="svelte-1rbq9">Miesiąc</th><th scope="col" class="num svelte-1rbq9">Aktywności</th><th scope="col" class="num svelte-1rbq9">Dystans</th><th scope="col" class="num svelte-1rbq9">Czas</th><th scope="col" class="num svelte-1rbq9">Przewyższenie</th></tr></thead><tbody class="svelte-1rbq9"><!--[-->`);
          const each_array = ensure_array_like([...data.monthly].reverse());
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let m = each_array[$$index];
            $$renderer3.push(`<tr${attr_class("svelte-1rbq9", void 0, { "partial": m.partial })}><th scope="row" class="svelte-1rbq9">${escape_html(formatMonth(m.month, "longYear"))} `);
            if (m.partial) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<span class="tag svelte-1rbq9">w toku</span>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--></th><td class="num svelte-1rbq9">${escape_html(nf.format(m.activities))}</td><td class="num svelte-1rbq9">${escape_html(fmtKm(m.distanceM))}</td><td class="num svelte-1rbq9">${escape_html(fmtHours(m.durationS))}</td><td class="num svelte-1rbq9">${escape_html(fmtM(m.elevationGainM))}</td></tr>`);
          }
          $$renderer3.push(`<!--]--></tbody></table></div>`);
        }
      });
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    VolumeView($$renderer2, { data: data.volume });
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte.js-2xPjGHGI.js.map
