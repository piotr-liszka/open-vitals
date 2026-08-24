import { g as derived, a as ensure_array_like, e as escape_html, d as attr_style, b as attr_class } from "../../../../chunks/index.js";
import { C as Card } from "../../../../chunks/Card.js";
import { B as Badge } from "../../../../chunks/Badge.js";
import { T as Table } from "../../../../chunks/Table.js";
import { T as TrendChart } from "../../../../chunks/TrendChart.js";
import { R as RadarChart } from "../../../../chunks/RadarChart.js";
import { g as formatDay } from "../../../../chunks/date.js";
function PowerView($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const fmtDate = (day) => day ? formatDay(day, "shortYear") : "—";
    function fmtDur(s) {
      if (s < 60) return `${s}s`;
      if (s < 3600) return `${Math.round(s / 60)}min`;
      const h = s / 3600;
      return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
    }
    const wkg = (n) => n == null ? "—" : `${n.toFixed(2)} W/kg`;
    const REF_WKG = { sprint: 22, punch: 11.5, climb: 7.6, tt: 6.6, endurance: 5.9 };
    const maxAxisWatts = derived(() => Math.max(1, ...data.radar.map((a) => a.watts)));
    function axisFrac(key, watts, wattsPerKg) {
      const f = wattsPerKg != null ? wattsPerKg / REF_WKG[key] : watts / maxAxisWatts();
      return Math.max(0, Math.min(1, f));
    }
    const radarAxes = derived(() => data.radar.map((a) => ({
      key: a.key,
      label: a.label,
      value: axisFrac(a.key, a.watts, a.wattsPerKg)
    })));
    const LANE = [
      "--lane-orange",
      "--lane-cyan",
      "--lane-green",
      "--lane-violet",
      "--lane-amber",
      "--lane-sky",
      "--lane-teal",
      "--lane-lime"
    ];
    const yearColor = (year) => `var(${LANE[data.years.indexOf(year) % LANE.length]})`;
    const curveLabels = derived(() => data.durations.map((d) => fmtDur(d)));
    function alongLattice(points) {
      const byDuration = new Map(points.map((p) => [p.durationS, p.watts]));
      return data.durations.map((d) => byDuration.get(d) ?? Number.NaN);
    }
    const curveSeries = derived(() => [
      {
        name: "Rekord",
        values: alongLattice(data.allTimeCurve),
        color: "var(--color-text-muted)"
      },
      ...data.yearCurves.map((c) => ({
        name: String(c.year),
        values: alongLattice(c.points),
        color: yearColor(c.year)
      }))
    ]);
    const TABLE_DURS = [5, 60, 300, 1200, 3600];
    const tableCols = derived(() => TABLE_DURS.filter((d) => data.durations.includes(d)));
    function bestOfYear(year, dur) {
      return data.yearCurves.find((c) => c.year === year)?.points.find((p) => p.durationS === dur)?.watts ?? null;
    }
    const colBest = derived(() => new Map(tableCols().map((d) => [
      d,
      Math.max(0, ...data.years.map((y) => bestOfYear(y, d) ?? 0))
    ])));
    $$renderer2.push(`<div class="power svelte-a351a7">`);
    if (!data.hasPower) {
      $$renderer2.push("<!--[0-->");
      Card($$renderer2, {
        title: "Brak danych o mocy",
        subtitle: "Profil mocy wymaga aktywności z pomiarem mocy.",
        children: ($$renderer3) => {
          $$renderer3.push(`<p class="empty svelte-a351a7">Nie znaleziono strumieni mocy. Uruchom synchronizację w zakładce <a href="/data" class="svelte-a351a7">Dane</a>.</p>`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="grid-2 svelte-a351a7">`);
      Card($$renderer2, {
        title: "Analiza typu zawodnika",
        subtitle: data.weightKg ? `Masa ${data.weightKg} kg · W/kg` : "Masa nieznana · waty",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="radar-wrap svelte-a351a7">`);
          RadarChart($$renderer3, { axes: radarAxes(), ariaLabel: "Radar typu zawodnika" });
          $$renderer3.push(`<!----></div> <dl class="axis-list svelte-a351a7"><!--[-->`);
          const each_array = ensure_array_like(data.radar);
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let a = each_array[$$index];
            $$renderer3.push(`<div class="axis-row svelte-a351a7"><dt class="svelte-a351a7">${escape_html(a.label)}</dt> <dd class="svelte-a351a7">${escape_html(a.watts)} W`);
            if (a.wattsPerKg) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`· ${escape_html(a.wattsPerKg.toFixed(2))} W/kg`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--></dd></div>`);
          }
          $$renderer3.push(`<!--]--></dl>`);
        }
      });
      $$renderer2.push(`<!----> `);
      Card($$renderer2, {
        title: "FTP i strefy mocy",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="ftp svelte-a351a7"><div class="ftp-main svelte-a351a7"><span class="ftp-val svelte-a351a7">${escape_html(data.ftpWatts ?? "—")}<span class="u svelte-a351a7">W</span></span> <span class="ftp-sub svelte-a351a7">${escape_html(wkg(data.ftpWattsPerKg))} `);
          if (data.ftpSource === "settings") {
            $$renderer3.push("<!--[0-->");
            Badge($$renderer3, {
              tone: "info",
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->z ustawień`);
              }
            });
          } else if (data.ftpSource === "estimated") {
            $$renderer3.push("<!--[1-->");
            Badge($$renderer3, {
              tone: "neutral",
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->szacowane`);
              }
            });
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--></span></div> <div class="ftp-side svelte-a351a7"><div class="svelte-a351a7"><span class="k svelte-a351a7">Szac. 20 min</span><span class="v svelte-a351a7">${escape_html(data.best20MinWatts ?? "—")} W</span></div> <div class="svelte-a351a7"><span class="k svelte-a351a7">Najlepsze 60 min</span><span class="v svelte-a351a7">${escape_html(data.best60MinWatts ?? "—")} W</span></div></div></div> `);
          if (data.zones.length > 0) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<ul class="zones svelte-a351a7"><!--[-->`);
            const each_array_1 = ensure_array_like(data.zones);
            for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
              let z = each_array_1[$$index_1];
              $$renderer3.push(`<li class="zone svelte-a351a7"><span class="zbar svelte-a351a7"${attr_style(`--w: ${Math.min(100, (z.maxPct ?? 1.7) * 100 / 1.7)}%`)}></span> <span class="zname svelte-a351a7">Z${escape_html(z.zone)} · ${escape_html(z.name)}</span> <span class="zrange svelte-a351a7">${escape_html(z.minW)}${escape_html(z.maxW != null ? `–${z.maxW}` : "+")} W</span></li>`);
            }
            $$renderer3.push(`<!--]--></ul>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]-->`);
        }
      });
      $$renderer2.push(`<!----></div> `);
      Card($$renderer2, {
        title: "Rekordy mocy (all-time)",
        subtitle: "Najlepsza średnia moc dla każdego czasu trwania",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="tiles svelte-a351a7"><!--[-->`);
          const each_array_2 = ensure_array_like(data.bests);
          for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
            let b = each_array_2[$$index_2];
            $$renderer3.push(`<div class="tile svelte-a351a7"><span class="t-dur svelte-a351a7">${escape_html(fmtDur(b.durationS))}</span> <span class="t-w svelte-a351a7">${escape_html(b.watts)}<span class="u svelte-a351a7">W</span></span> <span class="t-meta svelte-a351a7">${escape_html(b.wattsPerKg != null ? `${b.wattsPerKg.toFixed(2)} W/kg · ` : "")}${escape_html(fmtDate(b.day))}</span></div>`);
          }
          $$renderer3.push(`<!--]--></div>`);
        }
      });
      $$renderer2.push(`<!----> `);
      if (data.yearCurves.length > 0) {
        $$renderer2.push("<!--[0-->");
        Card($$renderer2, {
          title: "Porównanie krzywych mocy (rocznie)",
          subtitle: "Oś X: czas wysiłku · oś Y: najlepsza średnia moc. Kliknij rok w legendzie, aby go ukryć.",
          children: ($$renderer3) => {
            TrendChart($$renderer3, {
              series: curveSeries(),
              labels: curveLabels(),
              height: 320,
              unit: "W",
              label: "Krzywa mocy",
              formatValue: (n) => `${Math.round(n)} W`
            });
          }
        });
        $$renderer2.push(`<!----> `);
        if (tableCols().length > 0) {
          $$renderer2.push("<!--[0-->");
          Card($$renderer2, {
            title: "Najlepsze wyniki wg roku",
            children: ($$renderer3) => {
              {
                let head = function($$renderer4) {
                  $$renderer4.push(`<th scope="col">Rok</th> <!--[-->`);
                  const each_array_3 = ensure_array_like(tableCols());
                  for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
                    let d = each_array_3[$$index_3];
                    $$renderer4.push(`<th scope="col">${escape_html(fmtDur(d))}</th>`);
                  }
                  $$renderer4.push(`<!--]-->`);
                };
                Table($$renderer3, {
                  zebra: true,
                  caption: "Najlepsza moc (W) dla wybranych czasów, według roku",
                  head,
                  children: ($$renderer4) => {
                    $$renderer4.push(`<!--[-->`);
                    const each_array_4 = ensure_array_like(data.years);
                    for (let $$index_5 = 0, $$length = each_array_4.length; $$index_5 < $$length; $$index_5++) {
                      let y = each_array_4[$$index_5];
                      $$renderer4.push(`<tr><td class="yr svelte-a351a7">${escape_html(y)}</td><!--[-->`);
                      const each_array_5 = ensure_array_like(tableCols());
                      for (let $$index_4 = 0, $$length2 = each_array_5.length; $$index_4 < $$length2; $$index_4++) {
                        let d = each_array_5[$$index_4];
                        const w = bestOfYear(y, d);
                        $$renderer4.push(`<td${attr_class("", void 0, { "best": w != null && w === colBest().get(d) && w > 0 })}>${escape_html(w != null ? `${w} W` : "—")}</td>`);
                      }
                      $$renderer4.push(`<!--]--></tr>`);
                    }
                    $$renderer4.push(`<!--]-->`);
                  }
                });
              }
            }
          });
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    PowerView($$renderer2, { data: data.power });
  });
}
export {
  _page as default
};
