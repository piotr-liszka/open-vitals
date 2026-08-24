import { e as escape_html, a as ensure_array_like, d as attr_style, f as stringify, b as attr_class, g as derived, c as attr, i as spread_props, j as clsx, h as head } from "../../../../chunks/index.js";
import "../../../../chunks/toast.js";
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
import "../../../../chunks/client.js";
import "../../../../chunks/client2.js";
import { A as AppShell } from "../../../../chunks/AppShell.js";
import { S as SyncFooter } from "../../../../chunks/SyncFooter.js";
import { L as LeafletMap } from "../../../../chunks/LeafletMap.js";
import { S as StatTile } from "../../../../chunks/StatTile.js";
import { C as Card } from "../../../../chunks/Card.js";
import { B as Badge } from "../../../../chunks/Badge.js";
import { b as sportLabel, a as sportGroup } from "../../../../chunks/sport-labels.js";
import { i as isDayKey, g as formatDay } from "../../../../chunks/date.js";
import { v as verdictLabel, D as DASH, f as fmtNum, a as fmtSigned, b as bandLabel, c as fmtDuration, d as fmtKm, e as fmtPace, g as fmtClock, S as SIMILAR_METRICS, s as similarDeltaBadge, h as buildChartSet, j as chartGroupTitle, k as isNum, l as speedKmh, p as paceFromMps, m as benefitLabel, n as splitLabel } from "../../../../chunks/activity-charts.js";
import { C as COUPLED_LIMIT_PCT } from "../../../../chunks/efficiency.js";
import { S as SegmentedControl } from "../../../../chunks/SegmentedControl.js";
import { D as DeltaBadge } from "../../../../chunks/DeltaBadge.js";
import { T as TrendChart } from "../../../../chunks/TrendChart.js";
import { T as Table } from "../../../../chunks/Table.js";
import { S as StackedBar } from "../../../../chunks/StackedBar.js";
import { s as streamLength } from "../../../../chunks/stream-axes.js";
function FloatingReadout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { open, lead, secondary, items } = $$props;
    if (open) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="readout-float svelte-1tagr88" aria-hidden="true"><div class="bar svelte-1tagr88"><p class="at svelte-1tagr88"><span class="at-time">${escape_html(lead)}</span> `);
      if (secondary) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="at-sep svelte-1tagr88">·</span> <span class="at-dist svelte-1tagr88">${escape_html(secondary)}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></p> `);
      if (items.length > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<ul class="values svelte-1tagr88"><!--[-->`);
        const each_array = ensure_array_like(items);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let item = each_array[$$index];
          $$renderer2.push(`<li class="svelte-1tagr88"><span class="v-label svelte-1tagr88"${attr_style(`--lane: ${stringify(item.color ?? "var(--color-accent)")}`)}>${escape_html(item.label)}</span> <span class="v-value svelte-1tagr88">${escape_html(item.value)}`);
          if (item.unit) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<small class="svelte-1tagr88">${escape_html(item.unit)}</small>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></span></li>`);
        }
        $$renderer2.push(`<!--]--></ul>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function TrainingVerdict($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { comparison, power, ftp, ftpEstimated } = $$props;
    const TONES = {
      easy: "info",
      steady: "neutral",
      hard: "warning",
      peak: "danger",
      unknown: "neutral"
    };
    const METHODS = {
      garmin: "obciążenie z Garmina",
      power: "z mocy (TSS)",
      hr: "oszacowane z tętna",
      none: "brak źródła"
    };
    const c = derived(() => comparison);
    const headline = derived(() => c() === null || c().vsRecentPct === null ? null : `${c().vsRecentPct > 0 ? "+" : ""}${c().vsRecentPct}%`);
    const PLANNED_EMPTY = {
      "none-scheduled": "Na ten dzień nie było w kalendarzu zaplanowanego treningu w tej dyscyplinie — ta sesja była poza planem.",
      "not-synced": "Nie mamy zsynchronizowanego kalendarza treningowego w okolicy tej daty, więc nie wiemy, czy sesja realizowała jakiś plan."
    };
    function stepValue(step, value) {
      if (value === null) return DASH;
      if (step.key === "duration") return fmtDuration(value);
      if (step.key === "distance") return `${fmtKm(value, 2)} km`;
      return fmtNum(value);
    }
    Card($$renderer2, {
      title: "Ocena treningu",
      subtitle: "Wobec planu z kalendarza i Twoich własnych sesji z ostatnich 6 tygodni",
      children: ($$renderer3) => {
        if (c() === null) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<p class="empty svelte-by0nhe">Brak danych do oceny tego treningu.</p>`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<div class="verdict svelte-by0nhe"><div class="lead svelte-by0nhe">`);
          Badge($$renderer3, {
            tone: TONES[c().verdict],
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->${escape_html(verdictLabel(c().verdict))}`);
            }
          });
          $$renderer3.push(`<!----> `);
          if (headline()) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<p${attr_class("headline svelte-by0nhe", void 0, { "down": (c().vsRecentPct ?? 0) < 0 })}>${escape_html(headline())}<span class="headline-label svelte-by0nhe">wzgl. normy</span></p>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> <p class="summary svelte-by0nhe">${escape_html(c().summary)}</p></div> <dl class="metrics svelte-by0nhe"><div class="metric svelte-by0nhe"><dt class="svelte-by0nhe">Obciążenie</dt> <dd class="svelte-by0nhe">${escape_html(c().load === null ? DASH : fmtNum(c().load))}</dd> <p class="foot svelte-by0nhe">${escape_html(METHODS[c().loadMethod] ?? METHODS.none)}</p></div> <div class="metric svelte-by0nhe"><dt class="svelte-by0nhe">Norma 6 tyg.</dt> <dd class="svelte-by0nhe">${escape_html(c().recentMedianLoad === null ? DASH : fmtNum(c().recentMedianLoad))}</dd> <p class="foot svelte-by0nhe">${escape_html(c().recentCount)} porównywalnych</p></div> <div class="metric svelte-by0nhe"><dt class="svelte-by0nhe">Forma przed</dt> <dd class="svelte-by0nhe">${escape_html(c().tsbBefore === null ? DASH : fmtSigned(c().tsbBefore))}</dd> <p class="foot svelte-by0nhe">${escape_html(c().bandBefore === null ? "brak historii" : bandLabel(c().bandBefore))}</p></div> <div class="metric svelte-by0nhe"><dt class="svelte-by0nhe">Kondycja (CTL)</dt> <dd class="svelte-by0nhe">${escape_html(c().ctlBefore === null ? DASH : fmtNum(c().ctlBefore))}</dd> <p class="foot svelte-by0nhe">${escape_html(c().loadRatio === null ? "w przeddzień" : `sesja = ${fmtNum(c().loadRatio, 2)}× CTL`)}</p></div></dl></div> `);
          if (power) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<div class="stimulus svelte-by0nhe"><div class="s-item svelte-by0nhe"><span class="s-value svelte-by0nhe">${escape_html(power.if ?? DASH)}</span> <span class="s-label svelte-by0nhe">IF</span></div> <div class="s-item svelte-by0nhe"><span class="s-value svelte-by0nhe">${escape_html(power.tss ?? DASH)}</span> <span class="s-label svelte-by0nhe">TSS</span></div> <div class="s-item svelte-by0nhe"><span class="s-value svelte-by0nhe">${escape_html(power.np ?? DASH)}<small class="svelte-by0nhe">W</small></span> <span class="s-label svelte-by0nhe">NP</span></div> <div class="s-item svelte-by0nhe"><span class="s-value svelte-by0nhe">${escape_html(power.kj ?? DASH)}<small class="svelte-by0nhe">kJ</small></span> <span class="s-label svelte-by0nhe">Praca</span></div> <p class="ftp svelte-by0nhe">`);
            if (ftp !== null) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`FTP ${escape_html(ftp)} W${escape_html(ftpEstimated ? " (szacowane z krzywej mocy)" : "")}`);
            } else {
              $$renderer3.push("<!--[-1-->");
              $$renderer3.push(`Ustaw FTP w ustawieniach, aby zobaczyć IF i TSS.`);
            }
            $$renderer3.push(`<!--]--></p></div>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> `);
          if (c().plannedWorkout) {
            $$renderer3.push("<!--[0-->");
            const plan = c().plannedWorkout;
            $$renderer3.push(`<section class="plan svelte-by0nhe"><header class="plan-head svelte-by0nhe"><div class="plan-title svelte-by0nhe">`);
            Badge($$renderer3, {
              tone: "info",
              dot: false,
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->${escape_html(plan.kind === "race" ? "Start" : "Plan")}`);
              }
            });
            $$renderer3.push(`<!----> <strong class="svelte-by0nhe">${escape_html(plan.name)}</strong></div> `);
            if (plan.compliancePct !== null) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<span class="plan-score svelte-by0nhe"><span class="plan-score-value svelte-by0nhe">${escape_html(plan.compliancePct)}%</span> <span class="plan-score-label svelte-by0nhe">zgodności z planem</span></span>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--></header> `);
            if (plan.description) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<p class="plan-desc svelte-by0nhe">${escape_html(plan.description)}</p>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            if (plan.steps.length > 0) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<ul class="plan-steps svelte-by0nhe"><!--[-->`);
              const each_array = ensure_array_like(plan.steps);
              for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                let step = each_array[$$index];
                $$renderer3.push(`<li${attr_class("svelte-by0nhe", void 0, { "met": step.met === true, "missed": step.met === false })}><span class="step-label svelte-by0nhe">${escape_html(step.label)}</span> <span class="step-values svelte-by0nhe"><span class="step-actual svelte-by0nhe">${escape_html(stepValue(step, step.actual))}</span> <span class="step-sep svelte-by0nhe">z</span> <span class="step-target svelte-by0nhe">${escape_html(stepValue(step, step.target))}</span></span></li>`);
              }
              $$renderer3.push(`<!--]--></ul>`);
            } else {
              $$renderer3.push("<!--[-1-->");
              $$renderer3.push(`<p class="plan-desc svelte-by0nhe">Ten wpis w kalendarzu nie ma mierzalnych celów do porównania.</p>`);
            }
            $$renderer3.push(`<!--]--></section>`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<p class="planned svelte-by0nhe"><strong class="svelte-by0nhe">Zaplanowany trening</strong> — ${escape_html(PLANNED_EMPTY[c().plannedWorkoutStatus] ?? PLANNED_EMPTY["not-synced"])}</p>`);
          }
          $$renderer3.push(`<!--]-->`);
        }
        $$renderer3.push(`<!--]-->`);
      }
    });
  });
}
function ActivityFlags($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { highlights, suspects } = $$props;
    const has = derived(() => highlights.length > 0 || suspects.length > 0);
    if (has()) {
      $$renderer2.push("<!--[0-->");
      Card($$renderer2, {
        title: "Warto zauważyć",
        subtitle: "Rekordy i wartości, które wyglądają na błąd pomiaru",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="flags svelte-md2ahj">`);
          if (highlights.length > 0) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<ul class="list svelte-md2ahj" aria-label="Wyróżnione wyniki"><!--[-->`);
            const each_array = ensure_array_like(highlights);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let h = each_array[$$index];
              $$renderer3.push(`<li${attr_class("row svelte-md2ahj", void 0, { "record": h.kind === "record" })}><div class="head svelte-md2ahj"><span class="label svelte-md2ahj">${escape_html(h.label)}</span> `);
              Badge($$renderer3, {
                tone: h.kind === "record" ? "success" : "info",
                children: ($$renderer4) => {
                  $$renderer4.push(`<!---->${escape_html(h.kind === "record" ? "Rekord" : "Wyróżnienie")}`);
                }
              });
              $$renderer3.push(`<!----></div> <p class="value svelte-md2ahj">${escape_html(h.value)}`);
              if (h.unit) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`<span class="unit svelte-md2ahj">${escape_html(h.unit)}</span>`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--></p> <p class="text svelte-md2ahj">${escape_html(h.text)}</p> <p class="rank svelte-md2ahj">${escape_html(h.rank)} z ${escape_html(h.outOf)} porównywalnych sesji</p></li>`);
            }
            $$renderer3.push(`<!--]--></ul>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> `);
          if (suspects.length > 0) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<ul class="list suspects svelte-md2ahj" aria-label="Wartości wyglądające na błąd"><!--[-->`);
            const each_array_1 = ensure_array_like(suspects);
            for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
              let s = each_array_1[$$index_1];
              $$renderer3.push(`<li${attr_class("row svelte-md2ahj", void 0, { "warn": s.severity === "warn" })}><div class="head svelte-md2ahj"><span class="label svelte-md2ahj">${escape_html(s.label)}</span> `);
              Badge($$renderer3, {
                tone: s.severity === "warn" ? "danger" : "warning",
                children: ($$renderer4) => {
                  $$renderer4.push(`<!---->${escape_html(s.severity === "warn" ? "Podejrzana wartość" : "Do sprawdzenia")}`);
                }
              });
              $$renderer3.push(`<!----></div> <p class="value muted svelte-md2ahj">${escape_html(s.value)}</p> <p class="text svelte-md2ahj">${escape_html(s.text)}</p></li>`);
            }
            $$renderer3.push(`<!--]--></ul>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--></div>`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function ActivityEfficiency($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { efficiency, pacing } = $$props;
    const SHAPE = {
      even: {
        label: "Równo",
        tone: "success",
        text: "Obie połowy w podobnym tempie, bez dużych wahań. Tak wygląda dobrze rozłożona jednostka ciągła."
      },
      "negative-split": {
        label: "Negative split",
        tone: "success",
        text: "Druga połowa szybsza od pierwszej. To rozkład, o który walczy się na zawodach — start pod kontrolą, finisz mocniej."
      },
      faded: {
        label: "Odpadnięcie",
        tone: "warning",
        text: "Druga połowa wyraźnie wolniejsza. Klasyczny zbyt szybki start — albo dystans jeszcze poza zasięgiem obecnej formy."
      },
      variable: {
        label: "Zmienne tempo",
        tone: "info",
        text: "Duży rozrzut tempa między fragmentami. Tak wygląda trening interwałowy albo bardzo pofałdowana trasa — bilans połówek nic tu nie znaczy."
      }
    };
    const d = derived(() => efficiency.decoupling);
    const has = derived(() => d() !== null || pacing !== null || efficiency.ef !== null || efficiency.powerEf !== null || efficiency.cardiacCost !== null);
    const nf = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
    const nf1 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const nf2 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const signed = (v) => `${v > 0 ? "+" : ""}${nf1.format(v)}`;
    const verdict = derived(() => {
      if (!d()) return null;
      if (d().coupled) {
        return {
          tone: "success",
          label: "Spięty",
          text: `Tempo na uderzenie serca utrzymało się w drugiej połowie (do ${COUPLED_LIMIT_PCT}% uznajemy za stabilne). Tak wygląda dobrze rozłożony wysiłek tlenowy.`
        };
      }
      if (d().pct > 0) {
        return {
          tone: "warning",
          label: "Rozjechany",
          text: "Druga połowa kosztowała więcej uderzeń na ten sam efekt. Typowe przyczyny: zbyt szybki start, upał, za mało paliwa albo dystans jeszcze poza zasięgiem formy tlenowej."
        };
      }
      return {
        tone: "info",
        label: "Przyspieszony",
        text: "Druga połowa była tańsza niż pierwsza — zwykle znaczy to bardzo spokojny start albo długą rozgrzewkę wliczoną w zapis."
      };
    });
    if (has()) {
      $$renderer2.push("<!--[0-->");
      Card($$renderer2, {
        title: "Wydolność tlenowa",
        subtitle: "Ile kosztowało jedno uderzenie serca — i czy ten koszt rósł w trakcie",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="grid svelte-ak7017">`);
          if (d() && verdict()) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<div class="item wide svelte-ak7017"><div class="head svelte-ak7017"><span class="label svelte-ak7017">Rozejście tętna i ${escape_html(d().basis === "power" ? "mocy" : "tempa")}</span> `);
            Badge($$renderer3, {
              tone: verdict().tone,
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->${escape_html(verdict().label)}`);
              }
            });
            $$renderer3.push(`<!----></div> <p class="value svelte-ak7017">${escape_html(signed(d().pct))}<span class="unit svelte-ak7017">%</span></p> <p class="text svelte-ak7017">${escape_html(verdict().text)}</p> <p class="meta svelte-ak7017">Druga połowa vs pierwsza, po ${escape_html(nf.format(d().samples))} próbek na połowę. Liczone z całego zapisu — dla
            treningu interwałowego ta liczba nie ma sensu.</p></div>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> `);
          if (pacing) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<div class="item wide svelte-ak7017"><div class="head svelte-ak7017"><span class="label svelte-ak7017">Rozkład tempa</span> `);
            Badge($$renderer3, {
              tone: SHAPE[pacing.shape].tone,
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->${escape_html(SHAPE[pacing.shape].label)}`);
              }
            });
            $$renderer3.push(`<!----></div> <p class="value svelte-ak7017">${escape_html(signed(pacing.splitPct))}<span class="unit svelte-ak7017">% druga połowa</span></p> <p class="text svelte-ak7017">${escape_html(SHAPE[pacing.shape].text)}</p> <p class="meta svelte-ak7017">Połowy dzielone po DYSTANSIE, nie po czasie — inaczej odpadnięcie byłoby zaniżone.
            ${escape_html(fmtPace(pacing.firstHalfPaceSecPerKm))} vs ${escape_html(fmtPace(pacing.secondHalfPaceSecPerKm))} min/km. Rozrzut
            tempa między ${escape_html(nf.format(pacing.chunks))} fragmentami: ${escape_html(nf1.format(pacing.variabilityPct))}%.</p></div>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> `);
          if (efficiency.ef !== null) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<div class="item svelte-ak7017"><span class="label svelte-ak7017">Współczynnik wydolności</span> <p class="value svelte-ak7017">${escape_html(nf2.format(efficiency.ef))}</p> <p class="text svelte-ak7017">Metrów na minutę na jedno uderzenie. Rośnie, gdy to samo tempo kosztuje mniej — to sygnał formy
            tlenowej, niezależny od tego, jak mocno się starało.</p></div>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> `);
          if (efficiency.powerEf !== null) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<div class="item svelte-ak7017"><span class="label svelte-ak7017">Wydolność na mocy</span> <p class="value svelte-ak7017">${escape_html(nf2.format(efficiency.powerEf))}<span class="unit svelte-ak7017">W/bpm</span></p> <p class="text svelte-ak7017">Watów na uderzenie serca — rowerowy odpowiednik powyższego.</p></div>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> `);
          if (efficiency.cardiacCost !== null) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<div class="item svelte-ak7017"><span class="label svelte-ak7017">Koszt sercowy</span> <p class="value svelte-ak7017">${escape_html(nf.format(efficiency.cardiacCost))}<span class="unit svelte-ak7017">ud./km</span></p> <p class="text svelte-ak7017">Tyle uderzeń serca kosztował jeden kilometr. Mniej na tej samej trasie = lepsza forma.</p></div>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--></div>`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function ActivityBestEfforts($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { efforts } = $$props;
    const overshoots = derived(() => efforts.some((e) => e.actualM > e.metres * 1.02));
    if (efforts.length > 0) {
      $$renderer2.push("<!--[0-->");
      Card($$renderer2, {
        title: "Najlepsze odcinki",
        subtitle: "Najszybszy fragment tej aktywności na każdym dystansie — także wtedy, gdy był tylko jej częścią",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="table-wrap svelte-rrj70x"><table class="efforts svelte-rrj70x"><thead class="svelte-rrj70x"><tr><th scope="col" class="svelte-rrj70x">Dystans</th><th scope="col" class="num svelte-rrj70x">Czas</th><th scope="col" class="num svelte-rrj70x">Tempo</th><th scope="col" class="num svelte-rrj70x">Start</th><th scope="col" class="num svelte-rrj70x">Zmierzono</th></tr></thead><tbody class="svelte-rrj70x"><!--[-->`);
          const each_array = ensure_array_like(efforts);
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let e = each_array[$$index];
            $$renderer3.push(`<tr><th scope="row" class="svelte-rrj70x">${escape_html(e.label)}</th><td class="num strong svelte-rrj70x">${escape_html(fmtClock(e.durationS))}</td><td class="num svelte-rrj70x">${escape_html(fmtPace(e.paceSecPerKm))}<small class="svelte-rrj70x">min/km</small></td><td class="num muted svelte-rrj70x">${escape_html(fmtClock(e.startS))}</td><td class="num muted svelte-rrj70x">${escape_html(fmtNum(e.actualM))}<small class="svelte-rrj70x">m</small></td></tr>`);
          }
          $$renderer3.push(`<!--]--></tbody></table></div> <p class="note svelte-rrj70x">Okno pomiarowe pokrywa <em>co najmniej</em> zadany dystans, dlatego kolumna „zmierzono” pokazuje, ile
      metrów faktycznie objęło — tempo liczymy z tej wartości, a nie z dystansu nominalnego. `);
          if (overshoots()) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`Przy tym zapisie okna wyraźnie wychodzą poza dystans, co znaczy, że zegarek próbkował rzadko.`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> „Start” to czas od początku aktywności.</p>`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function ActivityMatchedRoute($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { route } = $$props;
    const nf = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
    const current = derived(() => route?.entries.find((e) => e.isCurrent) ?? null);
    const gapToBest = derived(() => current()?.paceSecPerKm != null && route?.bestPaceSecPerKm != null ? current().paceSecPerKm - route.bestPaceSecPerKm : null);
    const verdict = derived(() => {
      if (!route || route.currentRank === null) return null;
      if (route.currentRank === 1) {
        return {
          tone: "success",
          label: "Najszybszy raz",
          text: "To najszybsze przejście tej trasy z tych, które udało się dopasować."
        };
      }
      return {
        tone: "info",
        label: `${route.currentRank}. najszybszy raz`,
        text: gapToBest() === null ? "Tempo tego przejścia mieści się wśród pozostałych." : `Do najlepszego przejścia brakuje ${fmtPace(gapToBest())} na kilometrze.`
      };
    });
    const dayLabel = (day) => isDayKey(day) ? formatDay(day, "shortYear") : day;
    const foundLine = derived(() => route === null ? "" : `Znaleziono ${nf.format(route.previousCount)} ${route.previousCount === 1 ? "wcześniejsze przejście" : "wcześniejszych przejść"} tej trasy`);
    if (route && route.previousCount > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="matched"><div class="lead svelte-ixzwqf"><p class="found svelte-ixzwqf">${escape_html(foundLine())}</p> `);
      if (verdict()) {
        $$renderer2.push("<!--[0-->");
        Badge($$renderer2, {
          tone: verdict().tone,
          children: ($$renderer3) => {
            $$renderer3.push(`<!---->${escape_html(verdict().label)}`);
          }
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> `);
      if (verdict()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="verdict svelte-ixzwqf">${escape_html(verdict().text)}</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="table-wrap svelte-ixzwqf"><table class="runs svelte-ixzwqf"><thead class="svelte-ixzwqf"><tr><th scope="col" class="svelte-ixzwqf">#</th><th scope="col" class="svelte-ixzwqf">Data</th><th scope="col" class="num svelte-ixzwqf">Tempo</th><th scope="col" class="num svelte-ixzwqf">Czas</th><th scope="col" class="num svelte-ixzwqf">Dystans</th><th scope="col" class="num svelte-ixzwqf">Tętno</th><th scope="col" class="num svelte-ixzwqf">Zgodność</th></tr></thead><tbody class="svelte-ixzwqf"><!--[-->`);
      const each_array = ensure_array_like(route.entries);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let e = each_array[$$index];
        $$renderer2.push(`<tr${attr_class("svelte-ixzwqf", void 0, { "current": e.isCurrent })}><td class="num rank svelte-ixzwqf">${escape_html(e.rank)}</td><th scope="row" class="svelte-ixzwqf">`);
        if (e.isCurrent) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`${escape_html(dayLabel(e.day))} <span class="tag svelte-ixzwqf">ta aktywność</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<a${attr("href", `/activities/${e.activityId}`)}>${escape_html(dayLabel(e.day))}</a>`);
        }
        $$renderer2.push(`<!--]--></th><td class="num strong svelte-ixzwqf">${escape_html(e.paceSecPerKm === null ? DASH : fmtPace(e.paceSecPerKm))}</td><td class="num svelte-ixzwqf">${escape_html(fmtDuration(e.durationS))}</td><td class="num muted svelte-ixzwqf">${escape_html(fmtKm(e.distanceM, 2))}</td><td class="num muted svelte-ixzwqf">${escape_html(e.avgHr === null ? DASH : fmtNum(e.avgHr))}</td><td class="num muted svelte-ixzwqf">${escape_html(nf.format(e.similarity * 100))}%</td></tr>`);
      }
      $$renderer2.push(`<!--]--></tbody></table></div> <p class="note svelte-ixzwqf">Trasy dopasowujemy po pokryciu siatką około 50-metrowych komórek, przy zbliżonej długości — to <em>prawdopodobnie</em> ta sama trasa, nie dowód. Kolumna „zgodność” pokazuje, jak duże jest pokrycie.
      Kierunek nie ma znaczenia, więc ta sama trasa przebiegnięta na odwrót też się dopasuje. Porównano ${escape_html(nf.format(route.comparedCount))} zapisanych tras tego samego sportu.</p></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<p class="empty svelte-ixzwqf">`);
      if (route === null) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`Ten trening nie ma zapisanej trasy GPS, więc nie da się go dopasować do wcześniejszych przejść. Spróbuj
      zakładki <strong>Podobny wysiłek</strong>.`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`Nie znaleziono wcześniejszych przejść tej trasy. Trasa jest dopasowywana po nakładaniu się zapisu GPS,
      więc pierwszy przejazd nową drogą nigdy nie ma z czym się równać.`);
      }
      $$renderer2.push(`<!--]--></p>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function SimilarActivities($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { similar, route } = $$props;
    let tab = "effort";
    const dayLabel = (day) => isDayKey(day) ? formatDay(day, "shortYear") : day;
    const options = [
      { value: "effort", label: "Podobny wysiłek" },
      { value: "route", label: "Ta sama trasa" }
    ];
    const badgesFor = (e) => SIMILAR_METRICS.flatMap((m) => {
      const badge = similarDeltaBadge(e[m.key], m);
      return badge ? [{ key: m.key, badge }] : [];
    });
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      Card($$renderer3, {
        children: ($$renderer4) => {
          $$renderer4.push(`<div class="head svelte-8efn5z"><div><h2 class="title svelte-8efn5z">Porównaj z innymi treningami</h2> <p class="sub svelte-8efn5z">Dwa sposoby: podobny wysiłek albo dokładnie ta sama trasa.</p></div> `);
          SegmentedControl($$renderer4, {
            options,
            ariaLabel: "Sposób porównania",
            size: "sm",
            get value() {
              return tab;
            },
            set value($$value) {
              tab = $$value;
              $$settled = false;
            }
          });
          $$renderer4.push(`<!----></div> `);
          if (tab === "effort") {
            $$renderer4.push("<!--[0-->");
            if (similar === null) {
              $$renderer4.push("<!--[0-->");
              $$renderer4.push(`<p class="empty svelte-8efn5z">Ten trening nie ma dystansu ani czasu, więc nie da się go porównać z innymi wysiłkami. Spróbuj
        zakładki <strong>Ta sama trasa</strong>.</p>`);
            } else if (similar.entries.length === 0) {
              $$renderer4.push("<!--[1-->");
              $$renderer4.push(`<p class="empty svelte-8efn5z">Brak podobnych treningów. Szukaliśmy sesji tego samego sportu z dystansem i czasem w zakresie ±${escape_html(similar.tolerancePct)}%
        — wśród ${escape_html(fmtNum(similar.comparedCount))}
        ${escape_html(similar.comparedCount === 1 ? "porównywalnej sesji" : "porównywalnych sesji")} nie było żadnej. Ten trening
        był dla Ciebie nietypowy.</p>`);
            } else {
              $$renderer4.push("<!--[-1-->");
              $$renderer4.push(`<p class="scope svelte-8efn5z">${escape_html(fmtNum(similar.entries.length))}
        ${escape_html(similar.entries.length === 1 ? "dopasowanie" : "dopasowań")} w zakresie ±${escape_html(similar.tolerancePct)}% ·
        porównano ${escape_html(fmtNum(similar.comparedCount))}
        ${escape_html(similar.comparedCount === 1 ? "sesję" : "sesji")}${escape_html(similar.coversAllHistory ? "" : " (najnowsze)")}</p> <div class="scroller svelte-8efn5z"><table class="tbl svelte-8efn5z"><thead class="svelte-8efn5z"><tr><th scope="col" class="svelte-8efn5z">Data</th><th scope="col" class="num svelte-8efn5z">Dystans<span class="unit svelte-8efn5z">km</span></th><th scope="col" class="num svelte-8efn5z">Czas</th><th scope="col" class="num svelte-8efn5z">Tempo<span class="unit svelte-8efn5z">/km</span></th><th scope="col" class="svelte-8efn5z">Dziś vs wtedy</th></tr></thead><tbody class="svelte-8efn5z"><!--[-->`);
              const each_array = ensure_array_like(similar.entries);
              for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
                let e = each_array[$$index_1];
                const badges = badgesFor(e);
                $$renderer4.push(`<tr class="svelte-8efn5z"><th scope="row" class="day svelte-8efn5z"><a${attr("href", `/activities/${stringify(e.activityId)}`)} class="svelte-8efn5z">${escape_html(dayLabel(e.day))}</a> `);
                if (e.name) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<span class="name svelte-8efn5z">${escape_html(e.name)}</span>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                }
                $$renderer4.push(`<!--]--></th><td class="num svelte-8efn5z">${escape_html(fmtKm(e.distanceM, 1))}</td><td class="num svelte-8efn5z">${escape_html(fmtDuration(e.durationS))}</td><td class="num svelte-8efn5z">${escape_html(e.paceSecPerKm === null ? DASH : fmtPace(e.paceSecPerKm))}</td><td class="svelte-8efn5z"><div class="badges svelte-8efn5z">`);
                const each_array_1 = ensure_array_like(badges);
                if (each_array_1.length !== 0) {
                  $$renderer4.push("<!--[-->");
                  for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
                    let b = each_array_1[$$index];
                    DeltaBadge($$renderer4, spread_props([b.badge]));
                  }
                } else {
                  $$renderer4.push("<!--[!-->");
                  $$renderer4.push(`<span class="none svelte-8efn5z">${escape_html(DASH)}</span>`);
                }
                $$renderer4.push(`<!--]--></div></td></tr>`);
              }
              $$renderer4.push(`<!--]--></tbody></table></div>`);
            }
            $$renderer4.push(`<!--]-->`);
          } else {
            $$renderer4.push("<!--[-1-->");
            ActivityMatchedRoute($$renderer4, { route });
          }
          $$renderer4.push(`<!--]-->`);
        }
      });
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
function ActivityClimbs($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { climbs, totalGainM } = $$props;
    const nf = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
    const nf1 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
    const climbedM = derived(() => climbs.reduce((sum, c) => sum + c.gainM, 0));
    const sharePct = derived(() => totalGainM !== null && totalGainM > 0 ? Math.min(100, climbedM() / totalGainM * 100) : null);
    const hardest = derived(() => climbs.reduce((best, c) => best === null || c.score > best.score ? c : best, null));
    if (climbs.length > 0) {
      $$renderer2.push("<!--[0-->");
      {
        let actions = function($$renderer3) {
          if (hardest() && hardest().categoryKey !== "uncat") {
            $$renderer3.push("<!--[0-->");
            Badge($$renderer3, {
              tone: "info",
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->Najtrudniejszy: ${escape_html(hardest().categoryLabel)}`);
              }
            });
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]-->`);
        };
        Card($$renderer2, {
          title: "Podjazdy",
          subtitle: "Nie „ile przewyższenia”, a „co konkretnie wjechałem” — z VAM, czyli tempem wspinania",
          actions,
          children: ($$renderer3) => {
            $$renderer3.push(`<p class="summary svelte-1482sdw"><strong class="svelte-1482sdw">${escape_html(nf.format(climbs.length))}</strong> ${escape_html(climbs.length === 1 ? "podjazd" : "podjazdów")} · <strong class="svelte-1482sdw">${escape_html(nf.format(climbedM()))} m</strong> wspinania `);
            if (sharePct() !== null) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`· to ${escape_html(nf1.format(sharePct()))}% całego przewyższenia tej aktywności`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--></p> <div class="table-wrap svelte-1482sdw"><table class="climbs svelte-1482sdw"><thead class="svelte-1482sdw"><tr><th scope="col" class="svelte-1482sdw">#</th><th scope="col" class="num svelte-1482sdw">Przewyższenie</th><th scope="col" class="num svelte-1482sdw">Długość</th><th scope="col" class="num svelte-1482sdw">Nachylenie</th><th scope="col" class="num svelte-1482sdw">Czas</th><th scope="col" class="num svelte-1482sdw">VAM</th><th scope="col" class="num svelte-1482sdw">Start</th><th scope="col" class="svelte-1482sdw">Kategoria</th></tr></thead><tbody class="svelte-1482sdw"><!--[-->`);
            const each_array = ensure_array_like(climbs);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let c = each_array[$$index];
              $$renderer3.push(`<tr><th scope="row" class="svelte-1482sdw">${escape_html(c.index)}</th><td class="num strong svelte-1482sdw">${escape_html(fmtNum(c.gainM))}<small class="svelte-1482sdw">m</small></td><td class="num svelte-1482sdw">${escape_html(fmtKm(c.distanceM, 2))}<small class="svelte-1482sdw">km</small></td><td class="num svelte-1482sdw">${escape_html(nf1.format(c.gradePct))}<small class="svelte-1482sdw">%</small></td><td class="num muted svelte-1482sdw">${escape_html(fmtClock(c.durationS))}</td><td class="num strong svelte-1482sdw">${escape_html(nf.format(c.vam))}<small class="svelte-1482sdw">m/h</small></td><td class="num muted svelte-1482sdw">${escape_html(fmtClock(c.startS))}</td><td class="cat svelte-1482sdw">${escape_html(c.categoryLabel)}</td></tr>`);
            }
            $$renderer3.push(`<!--]--></tbody></table></div> <p class="note svelte-1482sdw">Podjazd to ciągły wzrost o co najmniej 30 m przy średnim nachyleniu od 2%; krótkie zjazdy w środku go
      nie przerywają, bo prawdziwe drogi mają fałszywe płaskie. VAM liczymy z czasu całego podjazdu — postój w
      połowie faktycznie obniża tempo wspinania. Wysokość z barometru dryfuje, a z GPS jeszcze bardziej, więc
      kategorie traktuj jako orientacyjne.</p>`);
          }
        });
      }
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function ActivityStreamsPanel($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { streams, sport } = $$props;
    let axis = "time";
    let pinned = null;
    let hovered = null;
    let gutters = {};
    const gutterLeft = derived(() => Math.max(0, ...Object.values(gutters)));
    const set = derived(() => buildChartSet(streams, sport, axis));
    const groups = derived(() => ["effort", "terrain", "physiology", "dynamics"].map((key) => ({
      key,
      title: chartGroupTitle(key),
      charts: set().charts.filter((c) => c.group === key)
    })).filter((g) => g.charts.length > 0));
    const axisOptions = [
      { value: "time", label: "Czas" },
      { value: "distance", label: "Dystans" }
    ];
    function onAxisChange(value) {
      pinned = null;
      hovered = null;
      gutters = {};
      axis = value === "distance" ? "distance" : "time";
    }
    function formatter(kind) {
      if (kind === "pace") return (n) => fmtPace(n);
      if (kind === "decimal") return (n) => fmtNum(n, 1);
      return (n) => fmtNum(Math.round(n));
    }
    function readoutOf(chart, index) {
      const fmt = formatter(chart.kind);
      if (chart.series) {
        const parts = chart.series.map((s) => {
          const v2 = s.values[index];
          return v2 !== void 0 && Number.isFinite(v2) ? `${s.name} ${fmt(v2)}` : null;
        }).filter((p) => p !== null);
        return parts.length > 0 ? parts.join(" · ") : DASH;
      }
      const v = chart.values[index];
      return v !== void 0 && Number.isFinite(v) ? fmt(v) : DASH;
    }
    const active = derived(() => hovered ?? pinned);
    const activeTime = derived(() => active() === null ? null : set().elapsedS[active()] ?? null);
    const activeDistance = derived(() => active() === null || !set().distanceM ? null : set().distanceM[active()] ?? null);
    const activeLead = derived(() => fmtClock(activeTime()));
    const activeSecondary = derived(() => activeDistance() === null ? void 0 : `${fmtNum(activeDistance() / 1e3, 2)} km`);
    const activeItems = derived(() => active() === null ? [] : set().charts.map((chart) => ({
      key: chart.key,
      label: chart.title,
      value: readoutOf(chart, active()),
      unit: chart.unit,
      color: chart.color
    })));
    const announcement = derived(() => active() === null ? "" : [
      activeLead(),
      activeSecondary(),
      ...activeItems().map((i) => [i.label, i.value, i.unit].filter(Boolean).join(" "))
    ].filter((part) => Boolean(part)).join(" · "));
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<div class="panel svelte-13vzf9z"><header class="head svelte-13vzf9z"><div class="readout svelte-13vzf9z" aria-live="polite">`);
      if (active() === null) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<p class="hint svelte-13vzf9z">Najedź na dowolny wykres — ten sam moment zaznaczy się na wszystkich. Kliknięcie przypina go na
          stałe.</p>`);
      } else {
        $$renderer3.push("<!--[-1-->");
        $$renderer3.push(`<p class="sr-only svelte-13vzf9z">${escape_html(announcement())}</p>`);
      }
      $$renderer3.push(`<!--]--></div> `);
      if (set().canUseDistance) {
        $$renderer3.push("<!--[0-->");
        SegmentedControl($$renderer3, {
          options: axisOptions,
          value: axis,
          onChange: onAxisChange,
          ariaLabel: "Oś pozioma wykresów",
          size: "sm"
        });
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></header> <!--[-->`);
      const each_array = ensure_array_like(groups());
      for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
        let group = each_array[$$index_1];
        $$renderer3.push(`<section class="group svelte-13vzf9z"><h4 class="group-title svelte-13vzf9z">${escape_html(group.title)}</h4> <!--[-->`);
        const each_array_1 = ensure_array_like(group.charts);
        for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
          let chart = each_array_1[$$index];
          $$renderer3.push(`<div class="chart-row svelte-13vzf9z"><div class="chart-head svelte-13vzf9z"><span class="chart-title svelte-13vzf9z"${attr_style(`--lane: ${stringify(chart.color)}`)}>${escape_html(chart.title)}</span> `);
          if (chart.note) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<span class="chart-note svelte-13vzf9z">${escape_html(chart.note)}</span>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--></div> `);
          TrendChart($$renderer3, spread_props([
            chart.series ? { series: chart.series.map((s) => ({ ...s })) } : { values: chart.values },
            chart.kind === "pace" ? { formatTick: (n) => fmtPace(n) } : {},
            {
              labels: [...set().labels],
              color: chart.color,
              unit: chart.unit,
              label: chart.title,
              height: chart.series ? 170 : 150,
              showArea: chart.area,
              formatValue: formatter(chart.kind),
              tooltip: false,
              gutterLeft: gutterLeft(),
              onGutter: (px) => gutters[chart.key] = px,
              get selectedIndex() {
                return pinned;
              },
              set selectedIndex($$value) {
                pinned = $$value;
                $$settled = false;
              },
              get hoverIndex() {
                return hovered;
              },
              set hoverIndex($$value) {
                hovered = $$value;
                $$settled = false;
              }
            }
          ]));
          $$renderer3.push(`<!----></div>`);
        }
        $$renderer3.push(`<!--]--></section>`);
      }
      $$renderer3.push(`<!--]--></div> `);
      FloatingReadout($$renderer3, {
        open: active() !== null,
        lead: activeLead(),
        secondary: activeSecondary(),
        items: activeItems()
      });
      $$renderer3.push(`<!---->`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
const HINTS = {
  gradeAdjusted: "Garmin nie udostępnia tempa skorygowanego o nachylenie — liczy je dopiero Strava, na podstawie własnego modelu.",
  avgTemperature: "Garmin podaje tylko minimum i maksimum. Średnią liczymy ze strumienia temperatury, a to urządzenie go nie zapisało.",
  runWalk: "Podział na bieg i marsz pochodzi z klasyfikacji Garmina (typed splits). Ta aktywność ich nie ma — zwykle znaczy to, że sport lub zegarek ich nie generuje.",
  selfEvaluation: "Odczucia po treningu wypełnia się ręcznie w zegarku lub w Garmin Connect. Ta aktywność nie ma takiego wpisu.",
  stamina: "Stamina jest raportowana tylko przez nowsze zegarki i tylko dla części sportów.",
  executionScore: "Wynik wykonania Garmin zwraca wyłącznie dla treningów wykonanych według zaplanowanego workoutu. Ta aktywność go nie ma."
};
function row(key, label, value, unit, hint) {
  return {
    key,
    label,
    value,
    ...unit === void 0 ? {} : { unit },
    ...hint === void 0 ? {} : { hint }
  };
}
const numRow = (key, label, value, unit, digits = 0) => row(key, label, isNum(value) ? fmtNum(value, digits) : null, unit);
const timeRow = (key, label, seconds) => row(key, label, isNum(seconds) ? fmtDuration(seconds) : null);
function usable(items) {
  return items.filter((i) => i.value !== null || i.hint !== void 0);
}
function section(key, title, accent, items) {
  const kept = usable(items);
  if (!kept.some((i) => i.value !== null)) return null;
  return { key, title, accent, items: kept };
}
function buildStatSections(input) {
  const { stats, sport } = input;
  const paceSport = sport === "run" || sport === "walk" || sport === "swim";
  const out = [];
  const runWalkHint = input.hasTypedSplits ? void 0 : HINTS.runWalk;
  out.push(
    section("timing", "Czas i ruch", "var(--lane-cyan)", [
      timeRow("duration", "Czas trwania", stats.timing.durationS),
      timeRow("moving", "W ruchu", stats.timing.movingS),
      timeRow("elapsed", "Czas całkowity", stats.timing.elapsedS),
      timeRow("idle", "Przestój", stats.timing.idleS),
      row(
        "run",
        "Bieg",
        isNum(stats.runWalk.runS) ? fmtDuration(stats.runWalk.runS) : null,
        void 0,
        runWalkHint
      ),
      row(
        "walk",
        "Marsz",
        isNum(stats.runWalk.walkS) ? fmtDuration(stats.runWalk.walkS) : null,
        void 0,
        runWalkHint
      ),
      row(
        "stand",
        "Stanie",
        isNum(stats.runWalk.idleS) ? fmtDuration(stats.runWalk.idleS) : null,
        void 0,
        runWalkHint
      )
    ])
  );
  const avgSpeed = speedKmh(stats.pace.avgSpeedMps ?? null);
  const maxSpeed = speedKmh(stats.pace.maxSpeedMps ?? null);
  const paceRows = paceSport ? [
    row("avgPace", "Średnie tempo", fmtPaceOrNull(stats.pace.avgSecPerKm), "min/km"),
    row("movingPace", "Tempo w ruchu", fmtPaceOrNull(stats.pace.avgMovingSecPerKm), "min/km"),
    row("bestPace", "Najlepsze tempo", fmtPaceOrNull(stats.pace.bestSecPerKm), "min/km"),
    row(
      "gap",
      "Tempo skorygowane",
      fmtPaceOrNull(stats.pace.gradeAdjustedSecPerKm),
      "min/km",
      stats.pace.gradeAdjustedSecPerKm === void 0 ? HINTS.gradeAdjusted : void 0
    ),
    numRow("avgSpeed", "Średnia prędkość", avgSpeed ?? void 0, "km/h", 1),
    numRow("maxSpeed", "Maks. prędkość", maxSpeed ?? void 0, "km/h", 1)
  ] : [
    numRow("avgSpeed", "Średnia prędkość", avgSpeed ?? void 0, "km/h", 1),
    numRow("maxSpeed", "Maks. prędkość", maxSpeed ?? void 0, "km/h", 1),
    numRow(
      "avgPaceRide",
      "Średnie tempo",
      paceFromMps(stats.pace.avgSpeedMps ?? null) ?? void 0,
      "s/km"
    )
  ];
  out.push(section("pace", "Tempo i prędkość", "var(--lane-orange)", paceRows));
  out.push(
    section("elevation", "Wysokość", "var(--lane-green)", [
      numRow("gain", "Suma podejść", stats.elevation.gainM, "m"),
      numRow("loss", "Suma zjazdów", stats.elevation.lossM, "m"),
      numRow("min", "Najniżej", stats.elevation.minM, "m"),
      numRow("max", "Najwyżej", stats.elevation.maxM, "m")
    ])
  );
  out.push(
    section("hr", "Tętno", "var(--lane-red)", [
      numRow("avg", "Średnie", stats.hr.avg, "bpm"),
      numRow("max", "Maksymalne", stats.hr.max, "bpm")
    ])
  );
  out.push(
    section("power", "Moc", "var(--lane-amber)", [
      numRow("avg", "Średnia", stats.power.avg, "W"),
      numRow("max", "Maksymalna", stats.power.max, "W"),
      numRow("np", "Znormalizowana", stats.power.normalized, "W")
    ])
  );
  const rd = stats.runningDynamics;
  const cadenceUnit = paceSport ? "kroki/min" : "obr./min";
  out.push(
    sport === "run" ? section("runningDynamics", "Dynamika biegu", "var(--lane-violet)", [
      numRow("avgCadence", "Średnia kadencja", rd.avgCadenceSpm, cadenceUnit),
      numRow("maxCadence", "Maks. kadencja", rd.maxCadenceSpm, cadenceUnit),
      numRow("stride", "Długość kroku", rd.avgStrideLengthCm, "cm", 1),
      numRow("vRatio", "Stosunek pionowy", rd.avgVerticalRatio, "%", 1),
      numRow("vOsc", "Oscylacja pionowa", rd.avgVerticalOscillationCm, "cm", 1),
      numRow("gctBalance", "Balans kontaktu", rd.avgGroundContactBalancePct, "% L", 1),
      numRow("gct", "Czas kontaktu", rd.avgGroundContactTimeMs, "ms")
    ]) : section("cadence", "Kadencja", "var(--lane-violet)", [
      numRow("avgCadence", "Średnia", rd.avgCadenceSpm, cadenceUnit),
      numRow("maxCadence", "Maksymalna", rd.maxCadenceSpm, cadenceUnit)
    ])
  );
  out.push(
    section("calories", "Kalorie i nawodnienie", "var(--lane-lime)", [
      numRow("total", "Kalorie", stats.calories.total, "kcal"),
      numRow("active", "Aktywne", stats.calories.active, "kcal"),
      numRow("resting", "Spoczynkowe", stats.calories.resting, "kcal"),
      numRow("sweat", "Utrata potu", stats.hydration.sweatLossMl, "ml")
    ])
  );
  const se = stats.selfEvaluation;
  out.push(
    section("trainingEffect", "Efekt treningowy", "var(--lane-indigo)", [
      numRow("aerobic", "Tlenowy", stats.trainingEffect.aerobic, "/ 5", 1),
      numRow("anaerobic", "Beztlenowy", stats.trainingEffect.anaerobic, "/ 5", 1),
      row("benefit", "Główna korzyść", benefitLabel(stats.trainingEffect.label)),
      numRow("load", "Obciążenie", stats.trainingEffect.load),
      row(
        "rpe",
        "Odczuwany wysiłek",
        isNum(se.perceivedEffort) ? fmtNum(se.perceivedEffort) : null,
        "/ 10",
        se.perceivedEffort === void 0 ? HINTS.selfEvaluation : void 0
      ),
      row(
        "feel",
        "Samopoczucie",
        isNum(se.feel) ? fmtNum(se.feel) : null,
        "/ 100",
        se.feel === void 0 ? HINTS.selfEvaluation : void 0
      ),
      row("execution", "Wynik wykonania", null, void 0, HINTS.executionScore)
    ])
  );
  out.push(
    section("physiology", "Fizjologia", "var(--lane-teal)", [
      numRow("respAvg", "Oddech — średni", stats.respiration.avg, "odd./min", 1),
      numRow("respMin", "Oddech — min.", stats.respiration.min, "odd./min", 1),
      numRow("respMax", "Oddech — maks.", stats.respiration.max, "odd./min", 1),
      row(
        "staminaBegin",
        "Stamina na starcie",
        isNum(stats.stamina.beginPotential) ? fmtNum(stats.stamina.beginPotential) : null,
        "%",
        stats.stamina.beginPotential === void 0 ? HINTS.stamina : void 0
      ),
      numRow("staminaEnd", "Stamina na końcu", stats.stamina.endPotential, "%"),
      numRow("staminaMin", "Stamina minimalna", stats.stamina.min, "%"),
      row(
        "bodyBattery",
        "Body Battery",
        isNum(stats.bodyBattery.difference) ? fmtSigned(stats.bodyBattery.difference) : null
      ),
      numRow("stressAvg", "Stres — średni", stats.stress.avg),
      numRow("stressMax", "Stres — maks.", stats.stress.max),
      row(
        "stressDiff",
        "Stres — zmiana",
        isNum(stats.stress.difference) ? fmtSigned(stats.stress.difference) : null
      )
    ])
  );
  out.push(
    section("temperature", "Temperatura", "var(--lane-sky)", [
      row(
        "avg",
        "Średnia",
        isNum(stats.temperature.avgC) ? fmtNum(stats.temperature.avgC, 1) : null,
        "°C",
        stats.temperature.avgC === void 0 ? HINTS.avgTemperature : void 0
      ),
      numRow("min", "Minimalna", stats.temperature.minC, "°C", 1),
      numRow("max", "Maksymalna", stats.temperature.maxC, "°C", 1)
    ])
  );
  out.push(
    section("intensityMinutes", "Minuty intensywności", "var(--lane-orange)", [
      numRow("moderate", "Umiarkowane", stats.intensityMinutes.moderate, "min"),
      numRow("vigorous", "Intensywne", stats.intensityMinutes.vigorous, "min"),
      numRow("total", "Razem (z wagą 2×)", stats.intensityMinutes.total, "min")
    ])
  );
  return out.filter((s) => s !== null);
}
function fmtPaceOrNull(secPerKm) {
  if (!isNum(secPerKm)) return null;
  const text = fmtPace(secPerKm);
  return text === "—" ? null : text;
}
const ZONE_COLORS = [
  "var(--lane-cyan)",
  "var(--lane-green)",
  "var(--lane-lime)",
  "var(--lane-amber)",
  "var(--lane-red)"
];
function buildHrZones(garminSeconds, estimated) {
  const fromGarmin = garminSeconds && garminSeconds.some((s) => isNum(s) && s > 0);
  if (fromGarmin) {
    const total = garminSeconds.reduce((sum, s) => sum + (isNum(s) ? s : 0), 0);
    return {
      source: "garmin",
      bars: garminSeconds.map((raw, i) => {
        const seconds = isNum(raw) ? raw : 0;
        return {
          zone: i + 1,
          label: `Strefa ${i + 1}`,
          seconds,
          pct: total > 0 ? Math.round(seconds / total * 100) : 0,
          color: ZONE_COLORS[i] ?? "var(--color-accent)"
        };
      })
    };
  }
  const bars = estimated.filter((z) => z.seconds > 0).map((z) => ({
    zone: z.zone,
    label: z.label,
    seconds: z.seconds,
    pct: z.pct,
    color: ZONE_COLORS[z.zone - 1] ?? "var(--color-accent)"
  }));
  return bars.length > 0 ? { source: "estimated", bars } : null;
}
function ActivityZones($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { hr, stats, power, weightKg } = $$props;
    const zones = derived(() => buildHrZones(stats.hr.timeInZoneS, hr?.zones ?? []));
    const ZONE_COLORS2 = [
      "var(--lane-cyan)",
      "var(--lane-green)",
      "var(--lane-lime)",
      "var(--lane-amber)",
      "var(--lane-orange)",
      "var(--lane-red)",
      "var(--lane-violet)"
    ];
    const R = 60;
    const CIRC = 2 * Math.PI * R;
    function arcs(buckets) {
      const total = buckets.reduce((s, z) => s + z.seconds, 0);
      if (total <= 0) return [];
      let acc = 0;
      return buckets.filter((z) => z.seconds > 0).map((z) => {
        const frac = z.seconds / total;
        const seg = {
          zone: z.zone,
          color: ZONE_COLORS2[z.zone - 1] ?? "var(--color-accent)",
          dash: frac * CIRC,
          offset: -acc * CIRC
        };
        acc += frac;
        return seg;
      });
    }
    const powerArcs = derived(() => power ? arcs(power.zones) : []);
    const topZone = derived(() => power && power.zones.length > 0 ? power.zones.reduce((m, z) => z.seconds > m.seconds ? z : m, power.zones[0]) : null);
    let activeZone = null;
    const hoveredZone = derived(
      () => null
    );
    const centreZone = derived(() => hoveredZone() ?? topZone());
    const zoneReadout = derived(() => hoveredZone() ? `${hoveredZone().label}: ${hoveredZone().pct}%, ${fmtDuration(hoveredZone().seconds)}` : "");
    function durLabel(s) {
      if (s < 60) return `${s} s`;
      if (s % 60 === 0 && s < 3600) return `${s / 60} min`;
      if (s % 3600 === 0) return `${s / 3600} h`;
      return `${Math.round(s / 60)} min`;
    }
    if (zones() || powerArcs().length > 0) {
      $$renderer2.push("<!--[0-->");
      Card($$renderer2, {
        title: "Strefy intensywności",
        subtitle: zones()?.source === "estimated" ? "Strefy tętna oszacowane z tętna maksymalnego tej aktywności" : "Czas spędzony w strefach",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="cols svelte-6nzot7">`);
          if (zones()) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<div class="block svelte-6nzot7"><h4 class="block-title svelte-6nzot7">Tętno</h4> <ul class="bars svelte-6nzot7"><!--[-->`);
            const each_array = ensure_array_like(zones().bars);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let bar = each_array[$$index];
              $$renderer3.push(`<li class="svelte-6nzot7"><span class="b-label svelte-6nzot7">${escape_html(bar.label)}</span> <span class="b-track svelte-6nzot7"><span class="b-fill svelte-6nzot7"${attr_style(`width: ${stringify(bar.pct)}%; background: ${stringify(bar.color)}`)}></span></span> <span class="b-pct svelte-6nzot7">${escape_html(bar.pct)}%</span> <span class="b-time svelte-6nzot7">${escape_html(fmtDuration(bar.seconds))}</span></li>`);
            }
            $$renderer3.push(`<!--]--></ul></div>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> `);
          if (power && powerArcs().length > 0) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<div class="block svelte-6nzot7"><h4 class="block-title svelte-6nzot7">Moc</h4>  <div class="donut-wrap svelte-6nzot7"><svg class="donut svelte-6nzot7" viewBox="0 0 160 160" role="img" aria-label="Rozkład czasu w strefach mocy"><circle class="track svelte-6nzot7" cx="80" cy="80"${attr("r", R)}></circle><!--[-->`);
            const each_array_1 = ensure_array_like(powerArcs());
            for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
              let seg = each_array_1[$$index_1];
              $$renderer3.push(`<circle${attr_class("arc svelte-6nzot7", void 0, { "dim": activeZone !== null })} cx="80" cy="80"${attr("r", R)} fill="none"${attr("stroke", seg.color)} stroke-width="18"${attr("stroke-dasharray", `${seg.dash} ${CIRC - seg.dash}`)}${attr("stroke-dashoffset", seg.offset)} transform="rotate(-90 80 80)"></circle>`);
            }
            $$renderer3.push(`<!--]-->`);
            if (centreZone()) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<text x="80" y="74" class="d-value svelte-6nzot7" text-anchor="middle">${escape_html(centreZone().label)}</text><text x="80" y="94" class="d-label svelte-6nzot7" text-anchor="middle">${escape_html(centreZone().pct)}%</text>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--></svg> <ul class="legend svelte-6nzot7"><!--[-->`);
            const each_array_2 = ensure_array_like(power.zones);
            for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
              let z = each_array_2[$$index_2];
              $$renderer3.push(`<li${attr_class("svelte-6nzot7", void 0, { "active": activeZone === z.zone })}><span class="swatch svelte-6nzot7"${attr_style(`background: ${stringify(ZONE_COLORS2[z.zone - 1])}`)}></span> <span class="z-label svelte-6nzot7">${escape_html(z.label)}</span> <span class="z-pct svelte-6nzot7">${escape_html(z.pct)}%</span> <span class="z-time svelte-6nzot7">${escape_html(fmtDuration(z.seconds))}</span></li>`);
            }
            $$renderer3.push(`<!--]--></ul> <span class="sr-only svelte-6nzot7" aria-live="polite">${escape_html(zoneReadout())}</span></div></div>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--></div>`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (power && power.curve.length > 0) {
      $$renderer2.push("<!--[0-->");
      Card($$renderer2, {
        title: "Najlepsza moc",
        subtitle: "Najwyższa średnia moc dla każdego czasu trwania",
        children: ($$renderer3) => {
          {
            let head2 = function($$renderer4) {
              $$renderer4.push(`<th>Czas</th> <th class="num svelte-6nzot7">Moc</th> `);
              if (weightKg) {
                $$renderer4.push("<!--[0-->");
                $$renderer4.push(`<th class="num svelte-6nzot7">W/kg</th>`);
              } else {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]-->`);
            };
            Table($$renderer3, {
              zebra: true,
              head: head2,
              children: ($$renderer4) => {
                $$renderer4.push(`<!--[-->`);
                const each_array_3 = ensure_array_like(power.curve);
                for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
                  let p = each_array_3[$$index_3];
                  $$renderer4.push(`<tr><td>${escape_html(durLabel(p.durationS))}</td><td class="num svelte-6nzot7">${escape_html(fmtNum(p.watts))} W</td>`);
                  if (weightKg) {
                    $$renderer4.push("<!--[0-->");
                    $$renderer4.push(`<td class="num svelte-6nzot7">${escape_html(fmtNum(p.watts / weightKg, 1))}</td>`);
                  } else {
                    $$renderer4.push("<!--[-1-->");
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
  });
}
function lapPaceSecPerKm(lap) {
  const fromSpeed = paceFromMps(lap.avgSpeedMps ?? null);
  if (fromSpeed !== null) return fromSpeed;
  if (isNum(lap.distanceM) && isNum(lap.durationS) && lap.distanceM > 0 && lap.durationS > 0) {
    return lap.durationS / lap.distanceM * 1e3;
  }
  return null;
}
function lapSpeedKmh(lap) {
  const direct = speedKmh(lap.avgSpeedMps ?? null);
  if (direct !== null) return direct;
  if (isNum(lap.distanceM) && isNum(lap.durationS) && lap.durationS > 0) {
    return lap.distanceM / lap.durationS * 3.6;
  }
  return null;
}
function buildLapTable(laps, sport) {
  if (laps.length < 2) return null;
  const paceSport = sport === "run" || sport === "walk" || sport === "swim";
  const fields = [
    {
      key: "index",
      label: "Nr",
      numeric: true,
      cell: (l) => String(l.index),
      has: () => true
    },
    {
      key: "distance",
      label: "Dystans",
      numeric: true,
      cell: (l) => isNum(l.distanceM) ? `${fmtNum(l.distanceM / 1e3, 2)} km` : null,
      has: (l) => isNum(l.distanceM)
    },
    {
      key: "duration",
      label: "Czas",
      numeric: true,
      cell: (l) => isNum(l.durationS) ? fmtDuration(l.durationS) : null,
      has: (l) => isNum(l.durationS)
    },
    paceSport ? {
      key: "pace",
      label: "Tempo",
      numeric: true,
      cell: (l) => {
        const pace = lapPaceSecPerKm(l);
        return pace === null ? null : `${fmtPace(pace)} /km`;
      },
      has: (l) => lapPaceSecPerKm(l) !== null
    } : {
      key: "speed",
      label: "Prędkość",
      numeric: true,
      cell: (l) => {
        const kmh = lapSpeedKmh(l);
        return kmh === null ? null : `${fmtNum(kmh, 1)} km/h`;
      },
      has: (l) => lapSpeedKmh(l) !== null
    },
    {
      key: "avgHr",
      label: "Śr. tętno",
      numeric: true,
      cell: (l) => isNum(l.avgHr) ? `${fmtNum(l.avgHr)} bpm` : null,
      has: (l) => isNum(l.avgHr)
    },
    {
      key: "maxHr",
      label: "Maks. tętno",
      numeric: true,
      cell: (l) => isNum(l.maxHr) ? `${fmtNum(l.maxHr)} bpm` : null,
      has: (l) => isNum(l.maxHr)
    },
    {
      key: "avgPower",
      label: "Śr. moc",
      numeric: true,
      cell: (l) => isNum(l.avgPower) ? `${fmtNum(l.avgPower)} W` : null,
      has: (l) => isNum(l.avgPower)
    },
    {
      key: "cadence",
      label: "Kadencja",
      numeric: true,
      cell: (l) => isNum(l.avgRunCadenceSpm) ? fmtNum(l.avgRunCadenceSpm) : null,
      has: (l) => isNum(l.avgRunCadenceSpm)
    },
    {
      key: "elevation",
      label: "Podejście",
      numeric: true,
      cell: (l) => isNum(l.elevationGainM) ? `${fmtNum(l.elevationGainM)} m` : null,
      has: (l) => isNum(l.elevationGainM)
    },
    {
      key: "calories",
      label: "Kalorie",
      numeric: true,
      cell: (l) => isNum(l.calories) ? `${fmtNum(l.calories)} kcal` : null,
      has: (l) => isNum(l.calories)
    }
  ];
  const kept = fields.filter((f) => laps.some((lap) => f.has(lap)));
  return {
    columns: kept.map(({ key, label, numeric }) => ({ key, label, numeric })),
    rows: laps.map((lap) => ({
      key: String(lap.index),
      cells: kept.map((f) => f.cell(lap))
    }))
  };
}
const SPLIT_COLORS = {
  RWD_RUN: "var(--lane-green)",
  RWD_WALK: "var(--lane-amber)",
  RWD_STAND: "var(--color-text-subtle)",
  INTERVAL_ACTIVE: "var(--lane-orange)",
  INTERVAL_REST: "var(--lane-cyan)",
  INTERVAL_WARMUP: "var(--lane-teal)",
  INTERVAL_COOLDOWN: "var(--lane-indigo)"
};
function buildSplitSummary(splits) {
  const byType = /* @__PURE__ */ new Map();
  for (const split of splits) {
    if (!isNum(split.durationS) || split.durationS <= 0) continue;
    const type = (split.type ?? "OTHER").toUpperCase();
    const acc = byType.get(type) ?? {
      seconds: 0,
      count: 0,
      distanceM: 0,
      hasCount: false,
      hasDistance: false
    };
    acc.seconds += split.durationS;
    if (isNum(split.count)) {
      acc.count += split.count;
      acc.hasCount = true;
    }
    if (isNum(split.distanceM)) {
      acc.distanceM += split.distanceM;
      acc.hasDistance = true;
    }
    byType.set(type, acc);
  }
  return [...byType.entries()].sort((a, b) => b[1].seconds - a[1].seconds).map(([type, acc]) => ({
    key: type,
    label: splitLabel(type),
    seconds: Math.round(acc.seconds),
    count: acc.hasCount ? acc.count : null,
    distanceM: acc.hasDistance ? acc.distanceM : null,
    paceSecPerKm: acc.hasDistance && acc.distanceM > 0 && acc.seconds > 0 ? acc.seconds / acc.distanceM * 1e3 : null,
    color: SPLIT_COLORS[type] ?? "var(--lane-violet)"
  }));
}
function ActivityLapsPanel($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { laps, typedSplits, sport } = $$props;
    const table = derived(() => buildLapTable(laps, sport));
    const splits = derived(() => buildSplitSummary(typedSplits));
    const segments = derived(() => splits().map((s) => ({ label: s.label, value: s.seconds, color: s.color })));
    if (splits().length > 0) {
      $$renderer2.push("<!--[0-->");
      Card($$renderer2, {
        title: "Bieg, marsz i postoje",
        subtitle: "Klasyfikacja Garmina — udział czasu",
        children: ($$renderer3) => {
          StackedBar($$renderer3, {
            segments: segments(),
            ariaLabel: "Podział czasu na bieg, marsz i postoje",
            format: (v) => fmtDuration(v),
            thickness: "var(--space-4)"
          });
          $$renderer3.push(`<!----> <ul class="splits svelte-mioisi"><!--[-->`);
          const each_array = ensure_array_like(splits());
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let split = each_array[$$index];
            $$renderer3.push(`<li class="svelte-mioisi"><span class="s-swatch svelte-mioisi"${attr_style(`background: ${stringify(split.color)}`)}></span> <span class="s-label svelte-mioisi">${escape_html(split.label)}</span> <span class="s-time svelte-mioisi">${escape_html(fmtDuration(split.seconds))}</span> <span class="s-meta svelte-mioisi">`);
            if (split.count !== null) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`${escape_html(split.count)}×`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            if (split.distanceM !== null) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<span class="s-dot svelte-mioisi">·</span>${escape_html(fmtNum(split.distanceM / 1e3, 2))} km`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            if (split.paceSecPerKm !== null) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<span class="s-dot svelte-mioisi">·</span>${escape_html(fmtPace(split.paceSecPerKm))} /km`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--></span></li>`);
          }
          $$renderer3.push(`<!--]--></ul>`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (table()) {
      $$renderer2.push("<!--[0-->");
      Card($$renderer2, {
        title: "Okrążenia",
        subtitle: `${table().rows.length} odcinków zapisanych przez zegarek`,
        children: ($$renderer3) => {
          {
            let head2 = function($$renderer4) {
              $$renderer4.push(`<!--[-->`);
              const each_array_1 = ensure_array_like(table().columns);
              for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
                let col = each_array_1[$$index_1];
                $$renderer4.push(`<th${attr_class(clsx(col.numeric ? "num" : ""), "svelte-mioisi")}>${escape_html(col.label)}</th>`);
              }
              $$renderer4.push(`<!--]-->`);
            };
            Table($$renderer3, {
              zebra: true,
              caption: "Statystyki poszczególnych okrążeń",
              head: head2,
              children: ($$renderer4) => {
                $$renderer4.push(`<!--[-->`);
                const each_array_2 = ensure_array_like(table().rows);
                for (let $$index_3 = 0, $$length = each_array_2.length; $$index_3 < $$length; $$index_3++) {
                  let row2 = each_array_2[$$index_3];
                  $$renderer4.push(`<tr><!--[-->`);
                  const each_array_3 = ensure_array_like(row2.cells);
                  for (let i = 0, $$length2 = each_array_3.length; i < $$length2; i++) {
                    let cell = each_array_3[i];
                    $$renderer4.push(`<td${attr_class(clsx(table().columns[i]?.numeric ? "num" : ""), "svelte-mioisi")}>${escape_html(cell ?? DASH)}</td>`);
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
  });
}
function StatSections($$renderer, $$props) {
  let { sections } = $$props;
  $$renderer.push(`<div class="groups svelte-ab2szl"><!--[-->`);
  const each_array = ensure_array_like(sections);
  for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
    let group = each_array[$$index_1];
    $$renderer.push(`<section class="group svelte-ab2szl"${attr_style(`--lane: ${stringify(group.accent)}`)}><h3 class="group-title svelte-ab2szl">${escape_html(group.title)}</h3> <dl class="readouts svelte-ab2szl"><!--[-->`);
    const each_array_1 = ensure_array_like(group.items);
    for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
      let item = each_array_1[$$index];
      $$renderer.push(`<div class="readout svelte-ab2szl"><dt class="label svelte-ab2szl">${escape_html(item.label)}</dt> <dd${attr_class("value svelte-ab2szl", void 0, { "absent": item.value === null })}>`);
      if (item.value === null) {
        $$renderer.push("<!--[0-->");
        $$renderer.push(`<span class="dash svelte-ab2szl"${attr("title", item.hint)}>${escape_html(DASH)}</span> `);
        if (item.hint) {
          $$renderer.push("<!--[0-->");
          $$renderer.push(`<span class="sr-only svelte-ab2szl">Brak danych: ${escape_html(item.hint)}</span>`);
        } else {
          $$renderer.push("<!--[-1-->");
        }
        $$renderer.push(`<!--]-->`);
      } else {
        $$renderer.push("<!--[-1-->");
        $$renderer.push(`${escape_html(item.value)}`);
        if (item.unit) {
          $$renderer.push("<!--[0-->");
          $$renderer.push(`<span class="unit svelte-ab2szl">${escape_html(item.unit)}</span>`);
        } else {
          $$renderer.push("<!--[-1-->");
        }
        $$renderer.push(`<!--]-->`);
      }
      $$renderer.push(`<!--]--></dd></div>`);
    }
    $$renderer.push(`<!--]--></dl></section>`);
  }
  $$renderer.push(`<!--]--></div>`);
}
function ActivityDetail($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const a = derived(() => data.activity);
    const family = derived(() => sportGroup(a().sport));
    const paceSport = derived(() => family() === "run" || family() === "walk" || family() === "swim");
    const day = derived(() => a().startTimeLocal.slice(0, 10));
    const timeOfDay = derived(() => a().startTimeLocal.slice(11, 16));
    const when = derived(() => isDayKey(day()) ? formatDay(day(), "weekday") : day());
    const elapsed = derived(() => a().movingS ?? a().durationS);
    const avgSpeedMps = derived(() => isNum(a().distanceM) && isNum(elapsed()) && elapsed() > 0 ? a().distanceM / elapsed() : null);
    const avgPace = derived(() => data.stats.pace.avgMovingSecPerKm ?? paceFromMps(avgSpeedMps()));
    const sections = derived(() => buildStatSections({
      stats: data.stats,
      sport: family(),
      hasTypedSplits: data.typedSplits.length > 0
    }));
    const hasStreams = derived(() => streamLength(data.streams) > 0);
    const polylines = derived(() => data.gps ? [{ points: data.gps, weight: 4, opacity: 0.95 }] : []);
    function routeMarkers(gps) {
      const start = gps[0];
      const end = gps[gps.length - 1];
      if (!start || !end) return [];
      return [
        {
          lat: start[0],
          lng: start[1],
          color: "var(--lane-green, #24c67e)"
        },
        { lat: end[0], lng: end[1], color: "var(--lane-red, #fb3b5e)" }
      ];
    }
    const markers = derived(() => data.gps && data.gps.length > 0 ? routeMarkers(data.gps) : []);
    $$renderer2.push(`<div class="detail svelte-gdvi5v"><header class="hero svelte-gdvi5v"><div class="titles"><div class="crumbs svelte-gdvi5v"><a href="/activities" class="svelte-gdvi5v">← Aktywności</a></div> <h1 class="name svelte-gdvi5v">${escape_html(a().name ?? sportLabel(a().sport))}</h1> <div class="meta svelte-gdvi5v">`);
    Badge($$renderer2, {
      tone: "neutral",
      dot: false,
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->${escape_html(sportLabel(a().sport))}`);
      }
    });
    $$renderer2.push(`<!----> <span class="date svelte-gdvi5v">${escape_html(when())}, ${escape_html(timeOfDay())}</span></div></div> `);
    if (data.stravaUrl) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<a class="strava svelte-gdvi5v"${attr("href", data.stravaUrl)} rel="noopener noreferrer external" target="_blank">Zobacz na Strava →</a>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></header> <section class="tiles svelte-gdvi5v" aria-label="Kluczowe liczby">`);
    if (isNum(a().distanceM)) {
      $$renderer2.push("<!--[0-->");
      StatTile($$renderer2, {
        label: "Dystans",
        value: fmtKm(a().distanceM, 2),
        unit: "km",
        accent: "orange"
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    StatTile($$renderer2, {
      label: "Czas w ruchu",
      value: fmtDuration(elapsed()),
      accent: "cyan"
    });
    $$renderer2.push(`<!----> `);
    if (paceSport()) {
      $$renderer2.push("<!--[0-->");
      StatTile($$renderer2, {
        label: "Średnie tempo",
        value: fmtPace(avgPace()),
        unit: "min/km",
        accent: "lime"
      });
    } else {
      $$renderer2.push("<!--[-1-->");
      StatTile($$renderer2, {
        label: "Średnia prędkość",
        value: fmtNum(speedKmh(avgSpeedMps()), 1),
        unit: "km/h",
        accent: "lime"
      });
    }
    $$renderer2.push(`<!--]--> `);
    if (isNum(a().avgHr)) {
      $$renderer2.push("<!--[0-->");
      StatTile($$renderer2, {
        label: "Średnie tętno",
        value: fmtNum(a().avgHr),
        unit: "bpm",
        accent: "red"
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (data.power) {
      $$renderer2.push("<!--[0-->");
      StatTile($$renderer2, {
        label: "Średnia moc",
        value: fmtNum(data.power.avg),
        unit: "W",
        accent: "amber"
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (isNum(a().elevationGainM)) {
      $$renderer2.push("<!--[0-->");
      StatTile($$renderer2, {
        label: "Przewyższenie",
        value: fmtNum(a().elevationGainM),
        unit: "m",
        accent: "green"
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (isNum(a().calories)) {
      $$renderer2.push("<!--[0-->");
      StatTile($$renderer2, {
        label: "Kalorie",
        value: fmtNum(a().calories),
        unit: "kcal",
        accent: "violet"
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (isNum(a().trainingLoad)) {
      $$renderer2.push("<!--[0-->");
      StatTile($$renderer2, {
        label: "Obciążenie",
        value: fmtNum(a().trainingLoad),
        accent: "indigo"
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></section> `);
    TrainingVerdict($$renderer2, {
      comparison: data.trainingComparison,
      power: data.power,
      ftp: data.ftp,
      ftpEstimated: data.ftpEstimated
    });
    $$renderer2.push(`<!----> `);
    ActivityFlags($$renderer2, { highlights: data.highlights, suspects: data.suspects });
    $$renderer2.push(`<!----> `);
    ActivityBestEfforts($$renderer2, { efforts: data.bestEfforts });
    $$renderer2.push(`<!----> `);
    ActivityEfficiency($$renderer2, { efficiency: data.efficiency, pacing: data.pacing });
    $$renderer2.push(`<!----> `);
    if (data.gps) {
      $$renderer2.push("<!--[0-->");
      Card($$renderer2, {
        title: "Trasa",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="map svelte-gdvi5v">`);
          LeafletMap($$renderer3, {
            polylines: polylines(),
            markers: markers(),
            height: "380px",
            ariaLabel: `Trasa: ${a().name ?? sportLabel(a().sport)}`
          });
          $$renderer3.push(`<!----></div>`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    SimilarActivities($$renderer2, { similar: data.similarActivities, route: data.matchedRoute });
    $$renderer2.push(`<!----> `);
    ActivityClimbs($$renderer2, { climbs: data.climbs, totalGainM: a().elevationGainM });
    $$renderer2.push(`<!----> `);
    if (hasStreams()) {
      $$renderer2.push("<!--[0-->");
      Card($$renderer2, {
        title: "Przebieg",
        subtitle: "Zapis z zegarka — kliknij, aby przypiąć ten sam moment na wszystkich wykresach",
        children: ($$renderer3) => {
          ActivityStreamsPanel($$renderer3, { streams: data.streams, sport: family() });
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    ActivityZones($$renderer2, {
      hr: data.hr,
      stats: data.stats,
      power: data.power,
      weightKg: data.weightKg
    });
    $$renderer2.push(`<!----> `);
    ActivityLapsPanel($$renderer2, {
      laps: data.laps,
      typedSplits: data.typedSplits,
      sport: family()
    });
    $$renderer2.push(`<!----> `);
    if (sections().length > 0) {
      $$renderer2.push("<!--[0-->");
      Card($$renderer2, {
        title: "Szczegóły",
        subtitle: "Wszystko, co Garmin zapisał dla tej aktywności",
        children: ($$renderer3) => {
          StatSections($$renderer3, { sections: sections() });
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
      Card($$renderer2, {
        title: "Szczegóły",
        children: ($$renderer3) => {
          $$renderer3.push(`<p class="empty svelte-gdvi5v">Ta aktywność nie ma jeszcze szczegółowych danych. ${escape_html(DASH)} zwykle znaczy, że zegarek ich nie zapisał.</p>`);
        }
      });
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const title = derived(() => data.detail.activity.name ?? "Aktywność");
    head("1vb1e6", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(title())} · Vagus</title>`);
      });
    });
    {
      let footer = function($$renderer3) {
        SyncFooter($$renderer3);
      };
      AppShell($$renderer2, {
        advanced: true,
        title: "Aktywność",
        tier: "advanced",
        footer,
        children: ($$renderer3) => {
          ActivityDetail($$renderer3, { data: data.detail });
        }
      });
    }
  });
}
export {
  _page as default
};
