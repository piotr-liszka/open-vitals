import { e as escape_html, a as ensure_array_like, b as attr_class, g as derived, c as attr } from "../../../../chunks/index.js";
import { C as Card } from "../../../../chunks/Card.js";
import { S as StatTile } from "../../../../chunks/StatTile.js";
import { B as BarChart } from "../../../../chunks/BarChart.js";
import { S as StackedBar } from "../../../../chunks/StackedBar.js";
import { T as TrendChart } from "../../../../chunks/TrendChart.js";
import { R as RangeBadge } from "../../../../chunks/RangeBadge.js";
import { g as formatDay, j as formatMonth } from "../../../../chunks/date.js";
import { a as bucketNoun, c as bucketAxisLabel, v as volumeBucket } from "../../../../chunks/series.js";
import { B as Badge } from "../../../../chunks/Badge.js";
import { R as RadarChart } from "../../../../chunks/RadarChart.js";
import { D as DeltaBadge } from "../../../../chunks/DeltaBadge.js";
import { R as RankMedal } from "../../../../chunks/RankMedal.js";
function RunnerProfileCard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { profile } = $$props;
    const radarAxes = derived(() => profile.axes.map((a) => ({ key: a.key, label: a.label, value: a.score })));
    const labelOf = (key) => key === null ? "" : profile.axes.find((a) => a.key === key)?.label ?? "";
    const asScore = (score) => score === null ? "—" : String(Math.round(score * 100));
    const windowNote = derived(() => profile.window.weeks > 0 ? `z ostatnich ${profile.window.weeks} tygodni` : "dopiero wtedy, gdy uzbiera się kilka tygodni historii");
    Card($$renderer2, {
      title: "Profil biegacza",
      subtitle: "Pięć osi policzonych z Twoich zsynchronizowanych biegów",
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="profile svelte-1molctq"><div class="plot svelte-1molctq">`);
        RadarChart($$renderer3, {
          axes: radarAxes(),
          ariaLabel: "Profil biegacza — pięć osi",
          color: "var(--lane-orange)"
        });
        $$renderer3.push(`<!----></div> <div class="read svelte-1molctq"><div class="verdict svelte-1molctq"><span class="kicker svelte-1molctq">Twój typ</span> <h4 class="type svelte-1molctq">${escape_html(profile.archetype.label)}</h4> <p class="summary svelte-1molctq">${escape_html(profile.archetype.summary)}</p> `);
        if (profile.strength || profile.weakness) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<div class="marks svelte-1molctq">`);
          if (profile.strength) {
            $$renderer3.push("<!--[0-->");
            Badge($$renderer3, {
              tone: "success",
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->Mocna strona: ${escape_html(labelOf(profile.strength))}`);
              }
            });
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> `);
          if (profile.weakness) {
            $$renderer3.push("<!--[0-->");
            Badge($$renderer3, {
              tone: "neutral",
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->Do poprawy: ${escape_html(labelOf(profile.weakness))}`);
              }
            });
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--></div>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--></div> <dl class="axes svelte-1molctq"><!--[-->`);
        const each_array = ensure_array_like(profile.axes);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let axis = each_array[$$index];
          $$renderer3.push(`<div${attr_class("axis svelte-1molctq", void 0, { "missing": axis.score === null })}><dt class="svelte-1molctq"><span class="name svelte-1molctq">${escape_html(axis.label)}</span> <span class="basis svelte-1molctq">${escape_html(axis.basis)}</span></dt> <dd class="svelte-1molctq"><span class="readout svelte-1molctq">${escape_html(axis.readout ?? "brak danych")}</span> <span class="score svelte-1molctq">${escape_html(asScore(axis.score))}<span class="of svelte-1molctq">/100</span></span></dd></div>`);
        }
        $$renderer3.push(`<!--]--></dl></div></div> <p class="scale svelte-1molctq">Skala odniesienia: <strong>0</strong> to poziom początkujący, <strong>100</strong> wyczynowy — to miara <em>kształtu</em> profilu, nie test sprawności. Osie tempa liczymy z rekordów życiowych, a objętość i regularność ${escape_html(windowNote())}.
    Przerywana oś oznacza brak danych, nie zero.</p>`);
      }
    });
  });
}
function RacePredictionsCard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { predictions } = $$props;
    const nf1 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
    const fmtDur = (totalS) => {
      if (totalS == null || !Number.isFinite(totalS)) return "—";
      const s = Math.round(totalS);
      const h = Math.floor(s / 3600);
      const m = Math.floor(s % 3600 / 60);
      const sec = s % 60;
      return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
    };
    const fmtPace = (secPerKm) => {
      if (secPerKm == null || !Number.isFinite(secPerKm)) return "—";
      const t = Math.round(secPerKm);
      return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
    };
    const BASIS_LABEL = {
      measured: "zmierzony odcinek",
      projected: "projekcja z całego biegu"
    };
    Card($$renderer2, {
      title: "Przewidywane czasy",
      subtitle: "Dwie niezależne metody. Gdy się zgadzają, liczba jest coś warta; gdy się rozjeżdżają — to też jest informacja.",
      children: ($$renderer3) => {
        $$renderer3.push(`<ul class="rows svelte-sggjtk"><!--[-->`);
        const each_array = ensure_array_like(predictions);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let p = each_array[$$index];
          const delta = p.trend?.deltaS ?? null;
          $$renderer3.push(`<li${attr_class("row svelte-sggjtk", void 0, { "soft": !p.confident })}><div class="head svelte-sggjtk"><h4 class="dist svelte-sggjtk">${escape_html(p.label)}</h4> `);
          if (p.trend && delta !== null) {
            $$renderer3.push("<!--[0-->");
            DeltaBadge($$renderer3, {
              direction: delta > 0 ? "better" : delta < 0 ? "worse" : "same",
              arrow: delta > 0 ? "down" : delta < 0 ? "up" : "none",
              value: delta === 0 ? "bez zmian" : fmtDur(Math.abs(delta)),
              label: delta === 0 ? `${p.label}: bez zmian od ${formatDay(p.trend.sinceDay, "shortYear")}` : `${p.label}: ${delta > 0 ? "szybciej" : "wolniej"} o ${fmtDur(Math.abs(delta))} niż ${formatDay(p.trend.sinceDay, "shortYear")}`
            });
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--></div> <p class="time svelte-sggjtk">${escape_html(p.riegelS === null ? "—" : fmtDur(p.riegelS))}</p> <p class="pace svelte-sggjtk">${escape_html(fmtPace(p.paceSecPerKm))}<small class="svelte-sggjtk">/km</small> `);
          if (p.criticalSpeedS !== null) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<span class="sep svelte-sggjtk" aria-hidden="true">·</span> <span class="cs svelte-sggjtk">z tempa krytycznego ${escape_html(fmtDur(p.criticalSpeedS))}</span>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--></p> <p class="src svelte-sggjtk">`);
          if (p.fromLabel) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`Na podstawie: ${escape_html(p.fromLabel)} `);
            if (p.fromDay) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<span class="sep svelte-sggjtk" aria-hidden="true">·</span>${escape_html(formatDay(p.fromDay, "shortYear"))}`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            if (p.fromBasis) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<span class="sep svelte-sggjtk" aria-hidden="true">·</span>${escape_html(BASIS_LABEL[p.fromBasis])}`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            if (p.extrapolation !== null && p.extrapolation > 1) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<span class="sep svelte-sggjtk" aria-hidden="true">·</span>ekstrapolacja ×${escape_html(nf1.format(p.extrapolation))}`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            if (!p.confident) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<span class="sep svelte-sggjtk" aria-hidden="true">·</span><span class="warn svelte-sggjtk">daleka ekstrapolacja</span>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]-->`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`Tylko model tempa krytycznego — żaden rekord nie jest dość blisko tego dystansu.`);
          }
          $$renderer3.push(`<!--]--></p></li>`);
        }
        $$renderer3.push(`<!--]--></ul> <p class="note svelte-sggjtk">Duża liczba to prawo Riegela zastosowane do Twojego najbliższego wynikowo dystansu — im dalsza
    ekstrapolacja, tym mniej znaczy, dlatego pokazujemy jej krotność i nie liczymy jej wcale powyżej
    czterokrotności. Znacznik obok dystansu porównuje dzisiejszą prognozę z tą samą prognozą policzoną
    wyłącznie z wyników sprzed 90 dni; gdy nie ma czego porównać, znacznika po prostu nie ma. Dystanse, o
    których żadna metoda nie ma nic do powiedzenia, tu nie występują. Żadna z metod nie wie nic o paliwie,
    upale ani o tym, czy przebiegłeś kiedyś ten dystans.</p>`);
      }
    });
  });
}
function RunningView($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      data,
      records
      /** All-time best-efforts card, rendered where "Rekordy życiowe" used to sit. */
    } = $$props;
    const nf = new Intl.NumberFormat("pl-PL");
    const volBucket = derived(() => volumeBucket(data.range));
    const monthly = derived(() => volBucket() === "month");
    const bucketLabel = derived(() => bucketNoun(volBucket()));
    const fmtPace = (secPerKm) => {
      if (secPerKm == null || !Number.isFinite(secPerKm)) return "—";
      const t = Math.round(secPerKm);
      return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
    };
    const fmtDur = (totalS) => {
      if (totalS == null || !Number.isFinite(totalS)) return "—";
      const s = Math.round(totalS);
      const h = Math.floor(s / 3600);
      const m = Math.floor(s % 3600 / 60);
      const sec = s % 60;
      return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
    };
    const ZONE_LANES = ["cyan", "green", "amber", "orange", "red"];
    const weekLabels = derived(() => data.weekly.map((w) => bucketAxisLabel(w.week, volBucket())));
    const weekKm = derived(() => data.weekly.map((w) => w.km));
    const zoneSegments = derived(() => data.hrZones.map((z, i) => ({
      label: z.label,
      value: z.pct,
      color: `var(--lane-${ZONE_LANES[i % ZONE_LANES.length]})`
    })));
    const curveLabels = derived(() => data.speedCurve.map((p) => fmtDur(p.durationS)));
    const curvePace = derived(() => data.speedCurve.map((p) => p.paceSecPerKm));
    const nf2 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 });
    const efficiencyMonths = derived(() => data.efficiency.filter((m) => m.ef !== null).length);
    const efficiencyLabels = derived(() => data.efficiency.map((m) => m.month.endsWith("-01") ? formatMonth(m.month, "shortYear") : formatMonth(m.month)));
    const COST_SCALE = 500;
    const efficiencySeries = derived(() => [
      {
        name: "Wydolność (m/min/bpm)",
        values: data.efficiency.map((m) => m.ef ?? Number.NaN),
        color: "var(--lane-green)"
      },
      {
        name: `Koszt sercowy (÷${nf.format(COST_SCALE)} ud./km)`,
        values: data.efficiency.map((m) => m.cardiacCost === null ? Number.NaN : m.cardiacCost / COST_SCALE),
        color: "var(--lane-red)"
      }
    ]);
    if (!data.hasData) {
      $$renderer2.push("<!--[0-->");
      Card($$renderer2, {
        children: ($$renderer3) => {
          $$renderer3.push(`<p class="empty svelte-i4ywyj">Brak aktywności biegowych. Zsynchronizuj dane w zakładce <a href="/data">Dane</a>, a bieganie pojawi się
      tutaj.</p>`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="stack svelte-i4ywyj"><div class="section-head svelte-i4ywyj"><h2 class="section-title svelte-i4ywyj">Zakres: ${escape_html(data.range.label)}</h2> `);
      RangeBadge($$renderer2, { label: data.range.label, size: "sm" });
      $$renderer2.push(`<!----></div> `);
      if (!data.hasWindowData) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="empty svelte-i4ywyj">Brak biegów w tym zakresie. Rekordy życiowe i profil biegacza poniżej liczą całą historię.</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="tiles svelte-i4ywyj">`);
      StatTile($$renderer2, {
        label: "Biegi",
        value: String(data.totals.runs),
        accent: "orange"
      });
      $$renderer2.push(`<!----> `);
      StatTile($$renderer2, {
        label: "Łączny dystans",
        value: `${data.totals.totalKm} km`,
        accent: "green"
      });
      $$renderer2.push(`<!----> `);
      StatTile($$renderer2, {
        label: "Najdłuższy",
        value: `${data.totals.longestKm} km`,
        accent: "cyan"
      });
      $$renderer2.push(`<!----> `);
      StatTile($$renderer2, {
        label: "Śr. tempo",
        value: fmtPace(data.totals.avgPaceSecPerKm),
        unit: "/km",
        accent: "indigo"
      });
      $$renderer2.push(`<!----></div> `);
      RunnerProfileCard($$renderer2, { profile: data.profile });
      $$renderer2.push(`<!----> `);
      records?.($$renderer2);
      $$renderer2.push(`<!----> `);
      Card($$renderer2, {
        title: "Strefy tętna",
        subtitle: data.maxHr ? `Podział na podstawie maks. tętna ${data.maxHr} bpm` : "Brak danych o tętnie",
        range: data.range.label,
        children: ($$renderer3) => {
          if (zoneSegments().length > 0) {
            $$renderer3.push("<!--[0-->");
            StackedBar($$renderer3, {
              segments: zoneSegments(),
              ariaLabel: "Udział czasu w strefach tętna",
              format: (v) => `${nf.format(v)}%`,
              thickness: "var(--space-4)"
            });
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<p class="empty svelte-i4ywyj">Brak strumieni tętna w zsynchronizowanych biegach.</p>`);
          }
          $$renderer3.push(`<!--]-->`);
        }
      });
      $$renderer2.push(`<!----> `);
      Card($$renderer2, {
        title: `Kilometraż ${monthly() ? "miesięczny" : "tygodniowy"}`,
        subtitle: `Dystans w kolejnych ${monthly() ? "miesiącach" : "tygodniach"}`,
        range: data.range.label,
        rangeBucketNoun: bucketLabel(),
        children: ($$renderer3) => {
          BarChart($$renderer3, {
            values: weekKm(),
            labels: weekLabels(),
            color: "var(--lane-orange)",
            height: 200,
            unit: "km",
            label: "Kilometraż",
            formatValue: (n) => `${nf.format(n)} km`
          });
        }
      });
      $$renderer2.push(`<!----> `);
      if (data.predictions.length > 0) {
        $$renderer2.push("<!--[0-->");
        RacePredictionsCard($$renderer2, { predictions: data.predictions });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (data.speedCurve.length > 1) {
        $$renderer2.push("<!--[0-->");
        Card($$renderer2, {
          title: "Krzywa tempa",
          subtitle: "Najlepsze tempo utrzymane przez dany czas — obwiednia z ostatnich biegów, nie jedna sesja",
          children: ($$renderer3) => {
            if (data.criticalSpeed) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="cs svelte-i4ywyj"><div class="cs-item svelte-i4ywyj"><span class="cs-label svelte-i4ywyj">Tempo krytyczne</span> <p class="cs-value svelte-i4ywyj">${escape_html(fmtPace(data.criticalSpeed.paceSecPerKm))}<small class="svelte-i4ywyj">min/km</small></p> <p class="cs-hint svelte-i4ywyj">Tempo, do którego krzywa się wypłaszcza — najszybsze, które da się utrzymać tlenowo. Biegowy
                odpowiednik FTP.</p></div> <div class="cs-item svelte-i4ywyj"><span class="cs-label svelte-i4ywyj">Zapas beztlenowy</span> <p class="cs-value svelte-i4ywyj">${escape_html(nf.format(data.criticalSpeed.dPrimeM))}<small class="svelte-i4ywyj">m</small></p> <p class="cs-hint svelte-i4ywyj">Ile metrów da się przebiec powyżej tempa krytycznego, zanim się skończy. Duża wartość to mocny
                finisz.</p></div></div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            TrendChart($$renderer3, {
              values: curvePace(),
              labels: curveLabels(),
              color: "var(--lane-orange)",
              height: 240,
              unit: "min/km",
              label: "krzywa tempa",
              formatValue: (v) => fmtPace(v),
              formatTick: (v) => fmtPace(v)
            });
            $$renderer3.push(`<!----> <p class="note svelte-i4ywyj">Niżej na wykresie = szybciej. Krzywa to obwiednia z ostatnich biegów, przy założeniu próbkowania
          sekundowego — na zegarku zapisującym rzadziej krótki koniec krzywej będzie zawyżony. To obraz
          treningu, nie wynik testu.</p>`);
          }
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (efficiencyMonths() > 0) {
        $$renderer2.push("<!--[0-->");
        Card($$renderer2, {
          title: "Wydolność tlenowa w czasie",
          subtitle: "Średnia miesięczna. Rosnąca wydolność albo malejący koszt = lepsza forma tlenowa, niezależnie od tego, jak mocno się starało.",
          children: ($$renderer3) => {
            TrendChart($$renderer3, {
              series: efficiencySeries(),
              labels: efficiencyLabels(),
              height: 240,
              label: "wydolność tlenowa",
              formatValue: (v) => nf2.format(v)
            });
            $$renderer3.push(`<!----> <p class="note svelte-i4ywyj">Wydolność to metry na minutę na jedno uderzenie serca, koszt to uderzenia na kilometr — dlatego
          jedna linia powinna rosnąć, a druga maleć. Miesiące bez biegów są przerwą w linii, a nie zerem.
          Liczone ze średnich, więc porównuj miesiące o podobnej intensywności.</p>`);
          }
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function BestEffortsCard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const fmtTime = (totalS) => {
      if (!Number.isFinite(totalS)) return "—";
      const s = Math.round(totalS);
      const h = Math.floor(s / 3600);
      const m = Math.floor(s % 3600 / 60);
      const sec = s % 60;
      return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
    };
    const fmtPace = (secPerKm) => {
      if (!Number.isFinite(secPerKm)) return "—";
      const t = Math.round(secPerKm);
      return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
    };
    Card($$renderer2, {
      title: "Rekordy życiowe",
      subtitle: "Najszybsze odcinki z całej historii biegów — również te ukryte w środku dłuższych treningów.",
      children: ($$renderer3) => {
        if (data.hasData) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<div class="grid svelte-3oaas9"><!--[-->`);
          const each_array = ensure_array_like(data.distances);
          for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
            let distance = each_array[$$index_1];
            $$renderer3.push(`<section class="dist svelte-3oaas9"><h4 class="dist-name svelte-3oaas9">${escape_html(distance.label)}</h4> <ol class="rows svelte-3oaas9"><!--[-->`);
            const each_array_1 = ensure_array_like(distance.entries);
            for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
              let entry = each_array_1[$$index];
              $$renderer3.push(`<li><a${attr_class("row svelte-3oaas9", void 0, { "top": entry.rank === 1 })}${attr("href", `/activities/${entry.activityId}`)}><span class="rank svelte-3oaas9">`);
              RankMedal($$renderer3, {
                rank: entry.rank,
                label: entry.rank === 1 ? "PR" : void 0,
                ariaLabel: entry.rank === 1 ? "Rekord życiowy" : `${entry.rank}. najlepszy wynik`
              });
              $$renderer3.push(`<!----></span> <span class="time svelte-3oaas9">${escape_html(fmtTime(entry.durationS))}</span> <span class="pace svelte-3oaas9">${escape_html(fmtPace(entry.paceSecPerKm))}<small class="svelte-3oaas9">/km</small></span> <span class="day svelte-3oaas9">${escape_html(formatDay(entry.day, "shortYear"))}</span></a></li>`);
            }
            $$renderer3.push(`<!--]--></ol></section>`);
          }
          $$renderer3.push(`<!--]--></div> <p class="note svelte-3oaas9">Odcinek to najszybsze okno pokrywające <em>co najmniej</em> dany dystans, wyszukane w zapisanym tempie
      całej sesji — dlatego 5 km z długiego wybiegania liczy się tak samo jak 5 km z zawodów. Pokazujemy do
      ${escape_html(data.topN)} najlepszych wyników na dystans; kliknij wiersz, żeby otworzyć tę aktywność.</p>`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<p class="empty svelte-3oaas9">Brak rekordów. Odcinki liczymy z zapisanego tempa biegów — pojawią się tutaj, gdy synchronizacja
      pobierze i przeliczy strumienie aktywności (zakładka <a href="/dane">Dane</a>).</p>`);
        }
        $$renderer3.push(`<!--]-->`);
      }
    });
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    {
      let records = function($$renderer3) {
        BestEffortsCard($$renderer3, { data: data.bestEfforts });
      };
      RunningView($$renderer2, { data: data.running, records });
    }
  });
}
export {
  _page as default
};
