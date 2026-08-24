import { Q as derived, a5 as escape_html, a7 as ensure_array_like, ab as attr } from '../../../../chunks/index.js-D7taQuDv.js';
import { C as Card } from '../../../../chunks/Card.js-D8ZxuUNK.js';
import { S as StatTile } from '../../../../chunks/StatTile.js-DDgLmTba.js';
import { B as BarChart } from '../../../../chunks/BarChart.js-D3sjnavQ.js';
import { T as TrendChart } from '../../../../chunks/TrendChart.js-C2RJO89W.js';
import { i as formatDay } from '../../../../chunks/date.js-Cf0GyZI8.js';
import { d as bucketNoun, v as volumeBucket, e as bucketAxisLabel } from '../../../../chunks/series.js-BlIzPiOH.js';
import '../../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../../chunks/RangeBadge.js-CR-NnSex.js';
import '../../../../chunks/Icon.js-D5N4FEG5.js';

function WalkingView($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const nf = new Intl.NumberFormat("pl-PL");
    const volBucket = derived(() => volumeBucket(data.range));
    const monthly = derived(() => volBucket() === "month");
    const bucketAdjective = derived(() => monthly() ? "miesięczny" : "tygodniowy");
    const bucketPlural = derived(() => monthly() ? "miesiącach" : "tygodniach");
    const bucketLocative = derived(() => monthly() ? "miesiącu" : "tygodniu");
    const bucketLabel = derived(() => bucketNoun(volBucket()));
    function fmtPace(secPerKm) {
      if (secPerKm == null || !Number.isFinite(secPerKm)) return "—";
      const t = Math.round(secPerKm);
      return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
    }
    function fmtDur(totalS) {
      const s = Math.round(totalS);
      const h = Math.floor(s / 3600);
      const m = Math.floor(s % 3600 / 60);
      return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
    }
    const weekLabels = derived(() => data.weekly.map((w) => bucketAxisLabel(w.week, volBucket())));
    const weekKm = derived(() => data.weekly.map((w) => w.km));
    const weekElevation = derived(() => data.weekly.map((w) => w.elevationM));
    const stepLabels = derived(() => data.steps.map((s) => formatDay(s.day, "short")));
    const stepValues = derived(() => data.steps.map((s) => s.steps ?? Number.NaN));
    if (!data.hasData && !data.hasSteps) {
      $$renderer2.push("<!--[0-->");
      Card($$renderer2, {
        title: "Brak marszów i wędrówek",
        subtitle: "Ta strona czyta zsynchronizowane aktywności typu marsz.",
        children: ($$renderer3) => {
          $$renderer3.push(`<p class="empty svelte-ovcd3v">Nie znaleziono marszów, spacerów ani wędrówek w zakresie: ${escape_html(data.range.label)}. Zmień zakres u góry strony
      lub uruchom synchronizację w zakładce <a href="/data" class="svelte-ovcd3v">Dane</a>.</p>`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="stack svelte-ovcd3v"><div class="tiles svelte-ovcd3v">`);
      StatTile($$renderer2, {
        label: "Marsze",
        value: nf.format(data.totals.sessions),
        accent: "green"
      });
      $$renderer2.push(`<!----> `);
      StatTile($$renderer2, {
        label: "Dystans",
        value: nf.format(data.totals.totalKm),
        unit: "km",
        accent: "cyan"
      });
      $$renderer2.push(`<!----> `);
      StatTile($$renderer2, {
        label: "Czas",
        value: fmtDur(data.totals.totalTimeS),
        accent: "indigo"
      });
      $$renderer2.push(`<!----> `);
      StatTile($$renderer2, {
        label: "Przewyższenie",
        value: nf.format(data.totals.totalElevationM),
        unit: "m",
        accent: "violet"
      });
      $$renderer2.push(`<!----> `);
      StatTile($$renderer2, {
        label: "Najdłuższy",
        value: nf.format(data.totals.longestKm),
        unit: "km",
        accent: "teal"
      });
      $$renderer2.push(`<!----> `);
      StatTile($$renderer2, {
        label: "Śr. tempo",
        value: fmtPace(data.totals.avgPaceSecPerKm),
        unit: "/km",
        accent: "orange"
      });
      $$renderer2.push(`<!----></div> `);
      if (data.hasData) {
        $$renderer2.push("<!--[0-->");
        Card($$renderer2, {
          title: `Kilometraż ${bucketAdjective()}`,
          subtitle: `Dystans pokonany w kolejnych ${bucketPlural()}`,
          range: data.range.label,
          rangeBucketNoun: bucketLabel(),
          children: ($$renderer3) => {
            BarChart($$renderer3, {
              values: weekKm(),
              labels: weekLabels(),
              color: "var(--lane-green)",
              height: 200,
              unit: "km",
              label: "Kilometraż",
              formatValue: (n) => `${nf.format(n)} km`
            });
          }
        });
        $$renderer2.push(`<!----> <div class="cols svelte-ovcd3v">`);
        Card($$renderer2, {
          title: `Przewyższenie ${monthly() ? "miesięczne" : "tygodniowe"}`,
          subtitle: `Suma podejść w ${bucketLocative()}`,
          range: data.range.label,
          rangeBucketNoun: bucketLabel(),
          children: ($$renderer3) => {
            BarChart($$renderer3, {
              values: weekElevation(),
              labels: weekLabels(),
              color: "var(--lane-violet)",
              height: 180,
              unit: "m",
              label: "Przewyższenie",
              formatValue: (n) => `${nf.format(n)} m`
            });
          }
        });
        $$renderer2.push(`<!----> `);
        Card($$renderer2, {
          title: "Najdłuższe trasy",
          subtitle: "Największy dystans w zakresie",
          range: data.range.label,
          children: ($$renderer3) => {
            $$renderer3.push(`<ul class="list svelte-ovcd3v"><!--[-->`);
            const each_array = ensure_array_like(data.highlights);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let h = each_array[$$index];
              $$renderer3.push(`<li class="svelte-ovcd3v"><a class="row svelte-ovcd3v"${attr("href", `/activities/${h.activityId}`)}><span class="primary svelte-ovcd3v">${escape_html(h.name ?? h.sportLabel)}</span> <span class="muted svelte-ovcd3v">${escape_html(formatDay(h.day, "shortYear"))}</span> <span class="num svelte-ovcd3v">${escape_html(nf.format(h.km))} km</span> <span class="num svelte-ovcd3v">${escape_html(fmtDur(h.durationS))}</span> <span class="num svelte-ovcd3v">${escape_html(nf.format(h.elevationM))} m</span></a></li>`);
            }
            $$renderer3.push(`<!--]--></ul>`);
          }
        });
        $$renderer2.push(`<!----></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (data.hasSteps) {
        $$renderer2.push("<!--[0-->");
        Card($$renderer2, {
          title: "Kroki dzienne",
          range: data.range.label,
          subtitle: data.avgSteps ? `Średnio ${nf.format(data.avgSteps)} kroków dziennie` : "Dzienna liczba kroków",
          children: ($$renderer3) => {
            TrendChart($$renderer3, {
              values: stepValues(),
              labels: stepLabels(),
              color: "var(--lane-orange)",
              height: 200,
              unit: "kroki",
              label: "Kroki",
              showAvg: true,
              formatValue: (n) => nf.format(Math.round(n))
            });
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
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    WalkingView($$renderer2, { data: data.walking });
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte.js-DS-WH0Ox.js.map
