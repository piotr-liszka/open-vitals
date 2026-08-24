import { e as escape_html, a as ensure_array_like, d as attr_style, f as stringify, g as derived, c as attr } from "../../../chunks/index.js";
import { C as Card } from "../../../chunks/Card.js";
import { B as Badge } from "../../../chunks/Badge.js";
import { S as StatTile } from "../../../chunks/StatTile.js";
import { B as BarChart } from "../../../chunks/BarChart.js";
import { T as TrendChart } from "../../../chunks/TrendChart.js";
import { S as StackedBar } from "../../../chunks/StackedBar.js";
import { g as formatDay } from "../../../chunks/date.js";
import { c as bucketAxisLabel, a as bucketNoun } from "../../../chunks/series.js";
import { R as RangeBadge } from "../../../chunks/RangeBadge.js";
import { S as SPORT_GROUP_LANES } from "../../../chunks/sport-labels.js";
import { F as FilterChips } from "../../../chunks/FilterChips.js";
function LoadRiskCard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { risk, perSport } = $$props;
    const BAND_LABEL = {
      detraining: "Roztrenowanie",
      steady: "Stabilnie",
      building: "Budowanie",
      overreaching: "Przeciążenie",
      spike: "Skok obciążenia"
    };
    const BAND_TONE = {
      detraining: "info",
      steady: "neutral",
      building: "success",
      overreaching: "warning",
      spike: "danger"
    };
    const nf1 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const nf2 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const signed = (v) => `${v > 0 ? "+" : ""}${nf1.format(v)}`;
    const known = derived(() => risk.acwr !== null);
    {
      let actions = function($$renderer3) {
        if (known()) {
          $$renderer3.push("<!--[0-->");
          Badge($$renderer3, {
            tone: BAND_TONE[risk.band],
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->${escape_html(BAND_LABEL[risk.band])}`);
            }
          });
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]-->`);
      };
      Card($$renderer2, {
        title: "Tempo narastania obciążenia",
        subtitle: "Nie „gdzie jestem”, a „w którą stronę i jak szybko” — to stąd biorą się kontuzje przeciążeniowe",
        actions,
        children: ($$renderer3) => {
          if (!known()) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<p class="unknown svelte-1fl7imr">${escape_html(risk.advice)}</p> <p class="meta svelte-1fl7imr">Mamy ${escape_html(risk.historyDays)} dni ciągłej historii.</p>`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<div class="numbers svelte-1fl7imr"><div class="item svelte-1fl7imr"><span class="label svelte-1fl7imr">Ostatni tydzień vs baza</span> <p class="value svelte-1fl7imr">${escape_html(nf2.format(risk.acwr))}</p> <p class="hint svelte-1fl7imr">Obciążenie 7-dniowe podzielone przez 42-dniowe. Zakres 0,80–1,30 to obszar, w którym można
          bezpiecznie budować.</p></div> `);
            if (risk.rampRatePerWeek !== null) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="item svelte-1fl7imr"><span class="label svelte-1fl7imr">Przyrost formy</span> <p class="value svelte-1fl7imr">${escape_html(signed(risk.rampRatePerWeek))}<span class="unit svelte-1fl7imr">CTL/tyg.</span></p> <p class="hint svelte-1fl7imr">Liczone z dwóch tygodni, żeby jeden mocny weekend nie udawał trendu. Powyżej +7 forma jest raczej
            wymuszana niż budowana.</p></div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--></div> <p class="advice svelte-1fl7imr">${escape_html(risk.advice)}</p> <p class="meta svelte-1fl7imr">Wskaźnik ostry/chroniczny to obserwacja populacyjna, nie prawo — traktuj go jako powód, by się
      przyjrzeć, nie jako wyrok. Liczony z ${escape_html(risk.historyDays)} dni historii.</p>`);
          }
          $$renderer3.push(`<!--]--> `);
          if (perSport.length > 1) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<div class="per-sport svelte-1fl7imr"><h4 class="per-sport-title svelte-1fl7imr">Forma w poszczególnych sportach</h4> <p class="hint svelte-1fl7imr">Wspólne CTL potrafi ukryć to, co najważniejsze: formę biegową spadającą, gdy rowerowa rośnie.</p> <ul class="sports svelte-1fl7imr"><!--[-->`);
            const each_array = ensure_array_like(perSport);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let s = each_array[$$index];
              $$renderer3.push(`<li class="sport svelte-1fl7imr"${attr_style(`--lane: ${stringify(s.color)}`)}><span class="sport-name svelte-1fl7imr">${escape_html(s.label)}</span> <span class="sport-nums svelte-1fl7imr"><span class="sport-num svelte-1fl7imr"><small class="svelte-1fl7imr">forma</small>${escape_html(nf1.format(s.ctl))}</span> <span class="sport-num svelte-1fl7imr"><small class="svelte-1fl7imr">świeżość</small>${escape_html(signed(s.tsb))}</span> `);
              if (s.risk.acwr !== null) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`<span class="sport-num svelte-1fl7imr"><small class="svelte-1fl7imr">tydz./baza</small>${escape_html(nf2.format(s.risk.acwr))}</span>`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--></span> `);
              if (s.risk.acwr !== null && s.risk.band !== "steady" && s.risk.band !== "building") {
                $$renderer3.push("<!--[0-->");
                Badge($$renderer3, {
                  tone: BAND_TONE[s.risk.band],
                  children: ($$renderer4) => {
                    $$renderer4.push(`<!---->${escape_html(BAND_LABEL[s.risk.band])}`);
                  }
                });
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--></li>`);
            }
            $$renderer3.push(`<!--]--></ul></div>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]-->`);
        }
      });
    }
  });
}
function IntensityMixCard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { mix, weeks } = $$props;
    const WEEKLY_TARGET = 150;
    const weekLabels = derived(() => weeks.map((w) => formatDay(w.week, "dayMonth")));
    const weekMinutes = derived(() => weeks.map((w) => w.weightedMinutes));
    const weeksOnTarget = derived(() => weeks.filter((w) => w.metTarget).length);
    const hasMinutes = derived(() => weekMinutes().some((m) => m > 0));
    const BAND_LABEL = { easy: "Spokojnie", moderate: "Średnio", hard: "Mocno" };
    const BAND_LANE = {
      easy: "var(--lane-green)",
      moderate: "var(--lane-amber)",
      hard: "var(--lane-red)"
    };
    const VERDICT_LABEL = {
      "on-model": "Zgodnie z modelem",
      "too-hard": "Za mało spokojnie",
      "too-easy": "Brak mocnych bodźców",
      unknown: "Brak danych"
    };
    const VERDICT_TONE = {
      "on-model": "success",
      "too-hard": "warning",
      "too-easy": "info",
      unknown: "neutral"
    };
    const nf = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
    const nf1 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
    function fmtHours(totalS) {
      const h = Math.floor(totalS / 3600);
      const m = Math.round(totalS % 3600 / 60);
      return h > 0 ? `${h} h ${m} min` : `${m} min`;
    }
    const segments = derived(() => mix.bands.map((b) => ({
      label: BAND_LABEL[b.band],
      value: b.pct,
      color: BAND_LANE[b.band]
    })));
    {
      let actions = function($$renderer3) {
        Badge($$renderer3, {
          tone: VERDICT_TONE[mix.verdict],
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->${escape_html(VERDICT_LABEL[mix.verdict])}`);
          }
        });
      };
      Card($$renderer2, {
        title: "Rozkład intensywności",
        subtitle: "Ile treningu było naprawdę spokojne — pytanie, na którym najczęściej łapią się trenujący samodzielnie",
        actions,
        children: ($$renderer3) => {
          if (mix.easyPct === null) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<p class="advice svelte-xto0vp">${escape_html(mix.advice)}</p>`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<p class="headline svelte-xto0vp"><span class="big svelte-xto0vp">${escape_html(nf1.format(mix.easyPct))}<small class="svelte-xto0vp">%</small></span> <span class="headline-text svelte-xto0vp">czasu treningowego spokojnie</span></p> `);
            StackedBar($$renderer3, {
              segments: segments(),
              ariaLabel: "Rozkład czasu treningowego po intensywności",
              format: (v) => `${nf1.format(v)}%`,
              thickness: "var(--space-4)"
            });
            $$renderer3.push(`<!----> <ul class="bands svelte-xto0vp"><!--[-->`);
            const each_array = ensure_array_like(mix.bands);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let b = each_array[$$index];
              $$renderer3.push(`<li class="band svelte-xto0vp"${attr_style(`--lane: ${stringify(BAND_LANE[b.band])}`)}><span class="band-name svelte-xto0vp">${escape_html(BAND_LABEL[b.band])}</span> <span class="band-time svelte-xto0vp">${escape_html(fmtHours(b.seconds))}</span> <span class="band-meta svelte-xto0vp">${escape_html(nf.format(b.sessions))}
            ${escape_html(b.sessions === 1 ? "jednostka" : "jednostek")}`);
              if (b.load > 0) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`· obciążenie ${escape_html(nf.format(b.load))}`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--></span></li>`);
            }
            $$renderer3.push(`<!--]--></ul> <p class="advice svelte-xto0vp">${escape_html(mix.advice)}</p> `);
            if (hasMinutes()) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<section class="minutes svelte-xto0vp"><h4 class="minutes-title svelte-xto0vp">Minuty intensywności</h4> <p class="hint svelte-xto0vp">Cel WHO to 150 minut tygodniowo, licząc minuty intensywne podwójnie. Czas spokojny nie liczy się
          tutaj wcale — spacer jest zdrowy, ale nie jest aktywnością o umiarkowanej intensywności. `);
              if (weeksOnTarget() > 0) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`Cel osiągnięty w ${escape_html(nf.format(weeksOnTarget()))} z ${escape_html(nf.format(weeks.length))} tygodni.`);
              } else {
                $$renderer3.push("<!--[-1-->");
                $$renderer3.push(`Żaden tydzień w tym okresie nie osiągnął celu.`);
              }
              $$renderer3.push(`<!--]--></p> `);
              BarChart($$renderer3, {
                values: weekMinutes(),
                labels: weekLabels(),
                color: "var(--lane-amber)",
                height: 200,
                unit: "min",
                label: "Minuty intensywności",
                baseline: WEEKLY_TARGET,
                formatValue: (v) => `${nf.format(v)} min`
              });
              $$renderer3.push(`<!----></section>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> <p class="note svelte-xto0vp">Podział z tętna średniego wobec maksymalnego ${escape_html(nf.format(mix.maxHr ?? 0))} bpm: poniżej 80% spokojnie, do 87%
      średnio, wyżej mocno. Udziały liczymy z czasu, który dało się zaklasyfikować — jednostka bez pomiaru tętna
      nie jest wliczana jako spokojna. `);
            if (mix.unclassifiedSessions > 0) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`Pominięto ${escape_html(nf.format(mix.unclassifiedSessions))}
        ${escape_html(mix.unclassifiedSessions === 1 ? "jednostkę" : "jednostek")} bez tętna.`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> Pasmo bierze się ze ŚREDNIEJ, więc trening interwałowy wypada w środku niezależnie od tego, jak wyglądał jego
      rozkład stref.</p>`);
          }
          $$renderer3.push(`<!--]-->`);
        }
      });
    }
  });
}
function TrainingOverview($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const BAND_LABEL = {
      fresh: "Świeży",
      optimal: "Optymalny",
      neutral: "Neutralny",
      fatigued: "Zmęczony",
      "very-fatigued": "Bardzo zmęczony"
    };
    const BAND_TONE = {
      fresh: "info",
      optimal: "success",
      neutral: "neutral",
      fatigued: "warning",
      "very-fatigued": "danger"
    };
    const GROUP_LANE = SPORT_GROUP_LANES;
    const REST_LANE = "var(--lane-teal)";
    const MAX_SERIES = 4;
    const nf = new Intl.NumberFormat("pl-PL");
    const round = (n) => nf.format(Math.round(n));
    function fmtHours(totalS) {
      const h = Math.floor(totalS / 3600);
      const m = Math.round(totalS % 3600 / 60);
      return h > 0 ? `${h} h ${m} min` : `${m} min`;
    }
    const fmtKm = (m) => nf.format(Math.round(m / 1e3));
    const weekLabels = derived(() => data.weeks.map((w) => bucketAxisLabel(w, data.range.bucket)));
    const rangeLabel = derived(() => data.range.label);
    const bucketLabel = derived(() => data.range.bucket === "day" ? void 0 : bucketNoun(data.range.bucket));
    const volumeUnit = derived(() => data.range.bucket === "month" ? "miesiącu" : "tygodniu");
    const mix = derived(() => data.sports.map((s) => ({
      label: s.label,
      value: s.durationS,
      color: GROUP_LANE[s.group]
    })));
    const volumeSeries = derived(() => {
      const head = data.weekly.slice(0, MAX_SERIES).map((s) => ({ name: s.label, values: s.hours, color: GROUP_LANE[s.group] }));
      const tail = data.weekly.slice(MAX_SERIES);
      if (tail.length === 0) return head;
      const merged = data.weeks.map((_, i) => Math.round(tail.reduce((sum, s) => sum + (s.hours[i] ?? 0), 0) * 10) / 10);
      return [
        ...head,
        { name: "Pozostałe", values: merged, color: REST_LANE }
      ];
    });
    const pmcSeries = derived(() => [
      {
        name: "CTL",
        values: data.series.map((p) => p.ctl),
        color: "var(--lane-green)"
      },
      {
        name: "ATL",
        values: data.series.map((p) => p.atl),
        color: "var(--lane-red)"
      },
      {
        name: "TSB",
        values: data.series.map((p) => p.tsb),
        color: "var(--lane-sky)"
      }
    ]);
    const pmcLabels = derived(() => data.series.map((p) => formatDay(p.day, "short")));
    const hasWindow = derived(() => data.totals.activities > 0);
    $$renderer2.push(`<div class="overview svelte-afwl0r">`);
    if (!hasWindow() && !data.hasData) {
      $$renderer2.push("<!--[0-->");
      Card($$renderer2, {
        title: "Brak treningów do pokazania",
        subtitle: "Ta sekcja czyta zsynchronizowane aktywności.",
        children: ($$renderer3) => {
          $$renderer3.push(`<p class="empty svelte-afwl0r">Nie znaleziono żadnych aktywności. Uruchom synchronizację w zakładce <a href="/data" class="svelte-afwl0r">Dane</a>, a
        rower, bieg i marsz pojawią się tutaj automatycznie.</p>`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<section class="block svelte-afwl0r" aria-labelledby="window-heading"><div class="head svelte-afwl0r"><h2 class="heading svelte-afwl0r" id="window-heading">Zakres: ${escape_html(rangeLabel())}</h2> `);
      RangeBadge($$renderer2, { label: rangeLabel(), size: "sm" });
      $$renderer2.push(`<!----></div> <div class="tiles svelte-afwl0r">`);
      StatTile($$renderer2, {
        label: "Aktywności",
        value: round(data.totals.activities),
        accent: "orange"
      });
      $$renderer2.push(`<!----> `);
      StatTile($$renderer2, {
        label: "Czas",
        value: fmtHours(data.totals.durationS),
        accent: "cyan"
      });
      $$renderer2.push(`<!----> `);
      StatTile($$renderer2, {
        label: "Dystans",
        value: fmtKm(data.totals.distanceM),
        unit: "km",
        accent: "green"
      });
      $$renderer2.push(`<!----> `);
      StatTile($$renderer2, {
        label: "Przewyższenie",
        value: round(data.totals.elevationGainM),
        unit: "m",
        accent: "violet"
      });
      $$renderer2.push(`<!----></div></section> `);
      if (data.sports.length > 0) {
        $$renderer2.push("<!--[0-->");
        Card($$renderer2, {
          title: "Podział na sporty",
          subtitle: "Udział czasu treningowego w wybranym zakresie",
          range: rangeLabel(),
          children: ($$renderer3) => {
            StackedBar($$renderer3, {
              segments: mix(),
              ariaLabel: "Podział czasu treningowego na sporty",
              legend: false,
              format: fmtHours,
              thickness: "var(--space-4)"
            });
            $$renderer3.push(`<!----> <ul class="sports svelte-afwl0r"><!--[-->`);
            const each_array = ensure_array_like(data.sports);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let s = each_array[$$index];
              $$renderer3.push(`<li class="sport svelte-afwl0r"><span class="sport-name svelte-afwl0r"><span class="dot svelte-afwl0r"${attr_style(`background: ${stringify(GROUP_LANE[s.group])}`)} aria-hidden="true"></span> `);
              if (s.href) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`<a${attr("href", s.href)} class="svelte-afwl0r">${escape_html(s.label)}</a>`);
              } else {
                $$renderer3.push("<!--[-1-->");
                $$renderer3.push(`<span>${escape_html(s.label)}</span>`);
              }
              $$renderer3.push(`<!--]--></span> <span class="metric svelte-afwl0r"><span class="k svelte-afwl0r">Treningi</span><span class="v svelte-afwl0r">${escape_html(round(s.activities))}</span></span> <span class="metric svelte-afwl0r"><span class="k svelte-afwl0r">Czas</span><span class="v svelte-afwl0r">${escape_html(fmtHours(s.durationS))}</span></span> <span class="metric svelte-afwl0r"><span class="k svelte-afwl0r">Dystans</span><span class="v svelte-afwl0r">${escape_html(fmtKm(s.distanceM))} km</span></span> <span class="metric svelte-afwl0r"><span class="k svelte-afwl0r">Przewyższenie</span><span class="v svelte-afwl0r">${escape_html(round(s.elevationGainM))} m</span></span> <span class="metric svelte-afwl0r"><span class="k svelte-afwl0r">Obciążenie</span><span class="v svelte-afwl0r">${escape_html(round(s.load))}</span></span></li>`);
            }
            $$renderer3.push(`<!--]--></ul>`);
          }
        });
        $$renderer2.push(`<!----> `);
        Card($$renderer2, {
          title: "Objętość treningu",
          subtitle: `Godziny treningu w ${volumeUnit()}, z podziałem na sporty`,
          range: rangeLabel(),
          rangeBucketNoun: bucketLabel(),
          children: ($$renderer3) => {
            BarChart($$renderer3, {
              series: volumeSeries(),
              labels: weekLabels(),
              height: 220,
              unit: "godz.",
              label: "Objętość",
              formatValue: (n) => `${nf.format(n)} h`
            });
          }
        });
        $$renderer2.push(`<!---->`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <section class="block svelte-afwl0r" aria-labelledby="form-heading"><div class="head svelte-afwl0r"><h2 class="heading svelte-afwl0r" id="form-heading">Forma</h2> `);
      Badge($$renderer2, {
        tone: BAND_TONE[data.band],
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->${escape_html(BAND_LABEL[data.band])}`);
        }
      });
      $$renderer2.push(`<!----></div> <div class="tiles svelte-afwl0r">`);
      if (data.hasData) {
        $$renderer2.push("<!--[0-->");
        StatTile($$renderer2, {
          label: "CTL (forma)",
          value: round(data.ctl),
          unit: "TSS/d",
          accent: "green"
        });
        $$renderer2.push(`<!----> `);
        StatTile($$renderer2, {
          label: "ATL (zmęczenie)",
          value: round(data.atl),
          unit: "TSS/d",
          accent: "red"
        });
        $$renderer2.push(`<!----> `);
        StatTile($$renderer2, {
          label: "TSB (świeżość)",
          value: round(data.tsb),
          accent: "sky"
        });
        $$renderer2.push(`<!---->`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      StatTile($$renderer2, {
        label: "Seria",
        value: round(data.streakWeeks),
        unit: data.streakWeeks === 1 ? "tydzień" : "tygodni",
        accent: "orange"
      });
      $$renderer2.push(`<!----></div></section> `);
      Card($$renderer2, {
        title: "Rekomendacja",
        subtitle: data.ftpWatts ? `Obciążenie z mocy · FTP ${data.ftpWatts} W` : "Obciążenie z danych Garmina i tętna",
        children: ($$renderer3) => {
          $$renderer3.push(`<p class="reco svelte-afwl0r">${escape_html(data.recommendation)}</p> `);
          if (!data.hasData) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<p class="empty svelte-afwl0r">PMC potrzebuje treningów z obciążeniem, mocą lub tętnem. Uruchom synchronizację w zakładce <a href="/data" class="svelte-afwl0r">Dane</a>.</p>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]-->`);
        }
      });
      $$renderer2.push(`<!----> `);
      if (data.hasData && data.series.length > 1) {
        $$renderer2.push("<!--[0-->");
        Card($$renderer2, {
          title: "PMC — zarządzanie formą",
          subtitle: "CTL (forma), ATL (zmęczenie) i TSB (świeżość) w czasie",
          children: ($$renderer3) => {
            TrendChart($$renderer3, {
              series: pmcSeries(),
              labels: pmcLabels(),
              height: 300,
              unit: "TSS/d",
              label: "PMC",
              formatValue: (n) => round(n)
            });
          }
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (data.hasData) {
        $$renderer2.push("<!--[0-->");
        LoadRiskCard($$renderer2, { risk: data.risk, perSport: data.perSport });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      IntensityMixCard($$renderer2, { mix: data.intensityMix, weeks: data.intensityWeeks });
      $$renderer2.push(`<!---->`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function WeeklySportSummary($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    let picked = null;
    const active = derived(() => data.sports.find((s) => s.group === picked) ?? data.sports[0]);
    const options = derived(() => data.sports.map((s) => ({ value: s.group, label: s.label })));
    const nf1 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
    const nf0 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
    const km = (metres) => nf1.format(Math.round(metres / 100) / 10);
    const hours = (totalS) => {
      const h = Math.floor(totalS / 3600);
      const m = Math.round(totalS % 3600 / 60);
      return h > 0 ? `${h} h ${m} min` : `${m} min`;
    };
    const weeklyKm = derived(() => active() ? active().weekly.map((w) => Math.round(w.distanceM / 100) / 10) : []);
    const emphasisIndex = derived(() => active() ? active().weekly.findIndex((w) => w.partial) : -1);
    const currentKm = derived(() => emphasisIndex() >= 0 ? weeklyKm()[emphasisIndex()] ?? 0 : 0);
    const weekStartLabel = derived(() => formatDay(data.currentWeekStart, "short"));
    Card($$renderer2, {
      title: "Podsumowanie tygodnia",
      subtitle: "Stałe okno 12 tygodni — niezależne od zakresu wybranego u góry strony",
      children: ($$renderer3) => {
        if (active()) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<div class="chips svelte-akmp0b">`);
          FilterChips($$renderer3, {
            options: options(),
            value: active().group,
            onSelect: (value) => {
              if (value !== null) picked = value;
            },
            ariaLabel: "Sport",
            allLabel: null,
            maxVisible: 6
          });
          $$renderer3.push(`<!----></div> <section class="block svelte-akmp0b" aria-labelledby="weekly-summary-now"><div class="head svelte-akmp0b"><h4 class="heading svelte-akmp0b" id="weekly-summary-now">Ten tydzień</h4> <p class="caption svelte-akmp0b">od poniedziałku ${escape_html(weekStartLabel())} · ${escape_html(data.currentWeekDays)} z 7 dni · ${escape_html(active().label)}</p></div> <div class="tiles svelte-akmp0b">`);
          StatTile($$renderer3, {
            label: "Dystans",
            value: km(active().thisWeek.distanceM),
            unit: "km",
            accent: "green"
          });
          $$renderer3.push(`<!----> `);
          StatTile($$renderer3, {
            label: "Przewyższenie",
            value: nf0.format(active().thisWeek.elevationGainM),
            unit: "m",
            accent: "violet"
          });
          $$renderer3.push(`<!----> `);
          StatTile($$renderer3, {
            label: "Czas",
            value: hours(active().thisWeek.durationS),
            accent: "cyan"
          });
          $$renderer3.push(`<!----></div></section> <section class="block svelte-akmp0b" aria-labelledby="weekly-summary-trend"><h4 class="heading svelte-akmp0b" id="weekly-summary-trend">Ostatnie ${escape_html(data.weeks)} tygodni</h4> `);
          TrendChart($$renderer3, {
            values: weeklyKm(),
            labels: [...data.monthLabels],
            color: active().color,
            height: 200,
            showArea: true,
            label: "Dystans",
            unit: "km",
            emphasisIndex: emphasisIndex(),
            emphasisLabel: "bieżący tydzień (w toku)",
            formatValue: (n) => `${nf1.format(n)} km`
          });
          $$renderer3.push(`<!----> <p class="caption svelte-akmp0b"><span class="dot svelte-akmp0b"${attr_style(`background: ${stringify(active().color)}`)} aria-hidden="true"></span> Ostatni punkt to bieżący, niepełny tydzień: ${escape_html(nf1.format(currentKm()))} km po ${escape_html(data.currentWeekDays)}
        ${escape_html(data.currentWeekDays === 1 ? "dniu" : "dniach")}.</p></section> <p class="more svelte-akmp0b"><a href="/training/objetosc" class="svelte-akmp0b">Pełny widok objętości →</a></p>`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<p class="empty svelte-akmp0b">Brak treningów z ostatnich ${escape_html(data.weeks)} tygodni. Uruchom synchronizację w zakładce <a href="/data" class="svelte-akmp0b">Dane</a>, a rower, bieg i marsz pojawią się tutaj automatycznie.</p>`);
        }
        $$renderer3.push(`<!--]-->`);
      }
    });
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    $$renderer2.push(`<div class="page svelte-d816z7">`);
    WeeklySportSummary($$renderer2, { data: data.weekly });
    $$renderer2.push(`<!----> `);
    TrainingOverview($$renderer2, { data: data.overview });
    $$renderer2.push(`<!----></div>`);
  });
}
export {
  _page as default
};
