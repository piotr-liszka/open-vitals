import { a7 as ensure_array_like, Q as derived, a6 as stringify, a5 as escape_html, ag as attr_style, a4 as attr_class, am as run } from '../../../../chunks/index.js-D7taQuDv.js';
import { i as invalidateAll } from '../../../../chunks/client.js-C1MYAKQX.js';
import { B as Button } from '../../../../chunks/Button.js-B1j4uOxB.js';
import { C as Card } from '../../../../chunks/Card.js-D8ZxuUNK.js';
import { t as toasts } from '../../../../chunks/toast.js-D9a9Yw3o.js';
import { B as Banner } from '../../../../chunks/Banner.js-fddbOwaW.js';
import '../../../../chunks/client2.js-DKEBrJ7O.js';
import { i as formatDay } from '../../../../chunks/date.js-Cf0GyZI8.js';
import { B as Badge } from '../../../../chunks/Badge.js-Bcg4u8Go.js';
import { P as ProgressBar } from '../../../../chunks/ProgressBar.js-BeUew8Nr.js';
import '../../../../chunks/exports.js-aFGE3YQF.js';
import '../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../chunks/utils.js-D6eaf5bT.js';
import '../../../../chunks/root.js-DLPDgkXe.js';
import { I as Input } from '../../../../chunks/Input.js-Bx-2KbvO.js';
import { F as Field } from '../../../../chunks/Field.js-C_UPfDr-.js';
import '../../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../../chunks/RangeBadge.js-CR-NnSex.js';
import '../../../../chunks/Icon.js-D5N4FEG5.js';

function GoalCard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { status, onDelete } = $$props;
    const BAND_LABEL = {
      "on-track": "Zgodnie z planem",
      ahead: "Przed planem",
      behind: "Poniżej planu",
      "at-risk": "Ryzyko przeciążenia",
      unknown: "Brak oceny"
    };
    const BAND_TONE = {
      "on-track": "success",
      ahead: "info",
      behind: "warning",
      "at-risk": "danger",
      unknown: "neutral"
    };
    const PRIORITY_LABEL = { a: "Cel A", b: "Cel B", c: "Cel C" };
    const nf1 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const signed = (v) => `${v > 0 ? "+" : ""}${nf1.format(v)}`;
    function hms(totalS) {
      const s = Math.max(0, Math.round(totalS));
      const h = Math.floor(s / 3600);
      const m = Math.floor(s % 3600 / 60);
      const sec = s % 60;
      const pad = (n) => String(n).padStart(2, "0");
      return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
    }
    const km = (m) => m >= 1e3 ? `${nf1.format(m / 1e3)} km` : `${Math.round(m)} m`;
    const past = derived(() => status.daysOut < 0);
    const daysLabel = derived(() => past() ? `${Math.abs(status.daysOut)} dni temu` : status.daysOut === 0 ? "dziś" : `za ${status.daysOut} dni`);
    const progress = derived(() => {
      const target = status.goal.targetCtl;
      if (target === null || status.ctl === null || status.projectedCtl === null) return null;
      if (status.ctl >= target) return 1;
      const start = Math.min(status.ctl, status.projectedCtl);
      const span = target - start;
      if (span <= 0) return 1;
      return Math.max(0, Math.min(1, (status.ctl - start) / span));
    });
    const prediction = derived(() => status.prediction);
    const predictedS = derived(() => prediction()?.riegelS ?? prediction()?.criticalSpeedS ?? null);
    {
      let actions = function($$renderer3) {
        $$renderer3.push(`<span class="badges svelte-1imxrps">`);
        Badge($$renderer3, {
          tone: "neutral",
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->${escape_html(PRIORITY_LABEL[status.goal.priority] ?? "Cel")}`);
          }
        });
        $$renderer3.push(`<!----> `);
        if (!past()) {
          $$renderer3.push("<!--[0-->");
          Badge($$renderer3, {
            tone: BAND_TONE[status.status],
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->${escape_html(BAND_LABEL[status.status])}`);
            }
          });
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--></span>`);
      };
      Card($$renderer2, {
        title: status.goal.title,
        subtitle: `${stringify(status.sportLabel)} · ${stringify(formatDay(status.goal.day, "longYear"))}`,
        actions,
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="head svelte-1imxrps"${attr_style(`--lane: ${stringify(status.color)}`)}><p class="countdown svelte-1imxrps"><span class="days svelte-1imxrps">${escape_html(daysLabel())}</span> <span class="phase svelte-1imxrps">${escape_html(status.phaseLabel)}</span></p> `);
          if (status.goal.distanceM !== null) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<p class="distance svelte-1imxrps">${escape_html(km(status.goal.distanceM))}</p>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--></div> <p class="verdict svelte-1imxrps">${escape_html(status.note)}</p> `);
          if (!past()) {
            $$renderer3.push("<!--[0-->");
            if (status.ctl !== null) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="numbers svelte-1imxrps"><div class="item svelte-1imxrps"><span class="label svelte-1imxrps">Forma dziś</span> <p class="value svelte-1imxrps">${escape_html(nf1.format(status.ctl))}<span class="unit svelte-1imxrps">CTL</span></p></div> `);
              if (status.goal.targetCtl !== null) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`<div class="item svelte-1imxrps"><span class="label svelte-1imxrps">Cel na start taperingu</span> <p class="value svelte-1imxrps">${escape_html(nf1.format(status.goal.targetCtl))}<span class="unit svelte-1imxrps">CTL</span></p></div>`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--> `);
              if (status.projectedCtl !== null) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`<div class="item svelte-1imxrps"><span class="label svelte-1imxrps">Dojdziesz do</span> <p class="value svelte-1imxrps">${escape_html(nf1.format(status.projectedCtl))}<span class="unit svelte-1imxrps">CTL</span></p> <p class="hint svelte-1imxrps">W obecnym tempie, licząc do początku taperingu — nie do dnia startu.</p></div>`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--> `);
              if (status.rampPerWeek !== null) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`<div class="item svelte-1imxrps"><span class="label svelte-1imxrps">Tempo teraz</span> <p class="value svelte-1imxrps">${escape_html(signed(status.rampPerWeek))}<span class="unit svelte-1imxrps">CTL/tyg.</span></p> `);
                if (status.requiredRampPerWeek !== null) {
                  $$renderer3.push("<!--[0-->");
                  $$renderer3.push(`<p class="hint svelte-1imxrps">Potrzebne: ${escape_html(signed(status.requiredRampPerWeek))} CTL/tyg.</p>`);
                } else {
                  $$renderer3.push("<!--[-1-->");
                }
                $$renderer3.push(`<!--]--></div>`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--></div> `);
              if (progress() !== null) {
                $$renderer3.push("<!--[0-->");
                ProgressBar($$renderer3, {
                  value: progress(),
                  label: "Droga do docelowej formy",
                  accent: status.color
                });
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]-->`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            if (status.taper) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="taper svelte-1imxrps"><span class="label svelte-1imxrps">Tapering</span> <p class="hint svelte-1imxrps">Ostatnie 7 dni: ${escape_html(nf1.format(status.taper.recentDailyLoad))} TSS/dzień wobec
          ${escape_html(nf1.format(status.taper.baselineDailyLoad))} w czterech tygodniach przed nimi.</p></div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            if (prediction() && predictedS() !== null) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="prediction svelte-1imxrps"><span class="label svelte-1imxrps">Prognoza czasu</span> <p class="value svelte-1imxrps">${escape_html(hms(predictedS()))}</p> <p class="hint svelte-1imxrps">`);
              if (prediction().fromLabel) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`Z Twojego wyniku na ${escape_html(prediction().fromLabel)}`);
                if (prediction().fromDay) {
                  $$renderer3.push("<!--[0-->");
                  $$renderer3.push(` (${escape_html(formatDay(prediction().fromDay, "short"))})`);
                } else {
                  $$renderer3.push("<!--[-1-->");
                }
                $$renderer3.push(`<!--]-->.`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--> `);
              if (!prediction().confident) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`Ekstrapolacja jest daleka — traktuj tę liczbę jako kierunek, nie prognozę.`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--> `);
              if (prediction().criticalSpeedS !== null && prediction().riegelS !== null) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`Model prędkości krytycznej daje ${escape_html(hms(prediction().criticalSpeedS))}; rozbieżność między metodami sama
            w sobie jest informacją.`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--></p> `);
              if (status.goal.targetTimeS !== null && prediction().gapS !== null) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`<p${attr_class("gap svelte-1imxrps", void 0, { "ahead": prediction().gapS > 0 })}>Cel ${escape_html(hms(status.goal.targetTimeS))} —
            ${escape_html(prediction().gapS > 0 ? `prognoza jest o ${hms(prediction().gapS)} szybsza` : `brakuje ${hms(-prediction().gapS)}`)}</p>`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--></div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]-->`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> `);
          if (status.goal.note) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<p class="own-note svelte-1imxrps">${escape_html(status.goal.note)}</p>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> `);
          if (onDelete) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<div class="foot svelte-1imxrps">`);
            if (status.goal.source === "garmin") {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<span class="hint svelte-1imxrps">Zaimportowany z kalendarza Garmin.</span>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            Button($$renderer3, {
              variant: "ghost",
              onclick: () => onDelete(status.goal.id),
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->Usuń cel`);
              },
              $$slots: { default: true }
            });
            $$renderer3.push(`<!----></div>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]-->`);
        }
      });
    }
  });
}
function GoalForm($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { sports, today } = $$props;
    let open = false;
    let day = "";
    let sport = run(() => sports[0]?.group ?? "run");
    let title = "";
    let kind = "race";
    let priority = "a";
    let distanceKm = "";
    let targetTime = "";
    let targetCtl = "";
    let note = "";
    let error = void 0;
    let submitting = false;
    function reset() {
      day = "";
      title = "";
      distanceKm = "";
      targetTime = "";
      targetCtl = "";
      note = "";
      kind = "race";
      priority = "a";
      error = void 0;
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (!open) {
        $$renderer3.push("<!--[0-->");
        Button($$renderer3, {
          onclick: () => open = true,
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->Dodaj cel`);
          },
          $$slots: { default: true }
        });
      } else {
        $$renderer3.push("<!--[-1-->");
        $$renderer3.push(`<form novalidate="" class="svelte-1aj34aw"><div class="grid svelte-1aj34aw">`);
        {
          let children = function($$renderer4, control) {
            Input($$renderer4, {
              id: control.id,
              invalid: control.invalid,
              placeholder: "np. Maraton Warszawski",
              maxlength: 120,
              required: true,
              get value() {
                return title;
              },
              set value($$value) {
                title = $$value;
                $$settled = false;
              }
            });
          };
          Field($$renderer3, {
            label: "Nazwa",
            required: true,
            children
          });
        }
        $$renderer3.push(`<!----> `);
        {
          let children = function($$renderer4, control) {
            Input($$renderer4, {
              id: control.id,
              type: "date",
              min: today,
              required: true,
              get value() {
                return day;
              },
              set value($$value) {
                day = $$value;
                $$settled = false;
              }
            });
          };
          Field($$renderer3, {
            label: "Data",
            required: true,
            help: "Dzień startu, albo dzień, na który chcesz mieć formę.",
            children
          });
        }
        $$renderer3.push(`<!----> `);
        {
          let children = function($$renderer4, control) {
            $$renderer4.select(
              { id: control.id, class: "select", value: sport },
              ($$renderer5) => {
                $$renderer5.push(`<!--[-->`);
                const each_array = ensure_array_like(sports);
                for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                  let s = each_array[$$index];
                  $$renderer5.option({ value: s.group }, ($$renderer6) => {
                    $$renderer6.push(`${escape_html(s.label)}`);
                  });
                }
                $$renderer5.push(`<!--]-->`);
              },
              "svelte-1aj34aw"
            );
          };
          Field($$renderer3, {
            label: "Dyscyplina",
            help: "Trajektoria liczona jest z formy w tej właśnie dyscyplinie.",
            children
          });
        }
        $$renderer3.push(`<!----> `);
        {
          let children = function($$renderer4, control) {
            $$renderer4.select(
              { id: control.id, class: "select", value: kind },
              ($$renderer5) => {
                $$renderer5.option({ value: "race" }, ($$renderer6) => {
                  $$renderer6.push(`Start`);
                });
                $$renderer5.option({ value: "fitness" }, ($$renderer6) => {
                  $$renderer6.push(`Forma`);
                });
              },
              "svelte-1aj34aw"
            );
          };
          Field($$renderer3, { label: "Rodzaj", children });
        }
        $$renderer3.push(`<!----> `);
        {
          let children = function($$renderer4, control) {
            $$renderer4.select(
              { id: control.id, class: "select", value: priority },
              ($$renderer5) => {
                $$renderer5.option({ value: "a" }, ($$renderer6) => {
                  $$renderer6.push(`A`);
                });
                $$renderer5.option({ value: "b" }, ($$renderer6) => {
                  $$renderer6.push(`B`);
                });
                $$renderer5.option({ value: "c" }, ($$renderer6) => {
                  $$renderer6.push(`C`);
                });
              },
              "svelte-1aj34aw"
            );
          };
          Field($$renderer3, {
            label: "Priorytet",
            help: "A to cel sezonu; B i C to starty po drodze.",
            children
          });
        }
        $$renderer3.push(`<!----> `);
        {
          let children = function($$renderer4, control) {
            Input($$renderer4, {
              id: control.id,
              inputmode: "decimal",
              placeholder: "21,1",
              get value() {
                return distanceKm;
              },
              set value($$value) {
                distanceKm = $$value;
                $$settled = false;
              }
            });
          };
          Field($$renderer3, {
            label: "Dystans (km)",
            help: "Potrzebny, żeby policzyć prognozę czasu.",
            children
          });
        }
        $$renderer3.push(`<!----> `);
        {
          let children = function($$renderer4, control) {
            Input($$renderer4, {
              id: control.id,
              placeholder: "1:30:00",
              get value() {
                return targetTime;
              },
              set value($$value) {
                targetTime = $$value;
                $$settled = false;
              }
            });
          };
          Field($$renderer3, {
            label: "Czas docelowy",
            help: "Format g:mm:ss, np. 1:30:00.",
            children
          });
        }
        $$renderer3.push(`<!----> `);
        {
          let children = function($$renderer4, control) {
            Input($$renderer4, {
              id: control.id,
              inputmode: "decimal",
              placeholder: "70",
              get value() {
                return targetCtl;
              },
              set value($$value) {
                targetCtl = $$value;
                $$settled = false;
              }
            });
          };
          Field($$renderer3, {
            label: "Docelowa forma (CTL)",
            help: "Opcjonalna. Bez niej dostajesz odliczanie i fazę, ale bez oceny trajektorii.",
            children
          });
        }
        $$renderer3.push(`<!----> <div class="wide svelte-1aj34aw">`);
        {
          let children = function($$renderer4, control) {
            Input($$renderer4, {
              id: control.id,
              maxlength: 500,
              get value() {
                return note;
              },
              set value($$value) {
                note = $$value;
                $$settled = false;
              }
            });
          };
          Field($$renderer3, { label: "Notatka", children });
        }
        $$renderer3.push(`<!----></div></div> `);
        if (error) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<p class="error svelte-1aj34aw" role="alert">${escape_html(error)}</p>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> <div class="actions svelte-1aj34aw">`);
        Button($$renderer3, {
          type: "submit",
          disabled: submitting,
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->${escape_html("Zapisz cel")}`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----> `);
        Button($$renderer3, {
          variant: "ghost",
          type: "button",
          onclick: () => (open = false, reset()),
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->Anuluj`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----></div></form>`);
      }
      $$renderer3.push(`<!--]-->`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
function SeasonView($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    let busy = null;
    const future = derived(() => data.goals.filter((g) => g.daysOut >= 0));
    const past = derived(() => data.goals.filter((g) => g.daysOut < 0));
    const nf1 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
    async function remove(id) {
      busy = id;
      try {
        const res = await fetch(`/api/season/goals/${id}`, { method: "DELETE" });
        if (!res.ok) {
          toasts.error("Nie udało się usunąć celu.");
          return;
        }
        toasts.success("Cel usunięty.");
        await invalidateAll();
      } catch {
        toasts.error("Nie udało się połączyć z serwerem.");
      } finally {
        busy = null;
      }
    }
    async function adopt(s) {
      busy = s.eventId;
      try {
        const res = await fetch("/api/season/goals", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            day: s.day,
            sport: s.sport,
            title: s.title,
            kind: "race",
            priority: "a",
            distanceM: s.distanceM,
            garminEventId: s.eventId
          })
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toasts.error(body.error ?? "Nie udało się dodać celu.");
          return;
        }
        toasts.success("Start dodany jako cel.");
        await invalidateAll();
      } catch {
        toasts.error("Nie udało się połączyć z serwerem.");
      } finally {
        busy = null;
      }
    }
    if (!data.enabled) {
      $$renderer2.push("<!--[0-->");
      Banner($$renderer2, {
        tone: "info",
        title: "Ta sekcja wymaga trybu zaawansowanego",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Cele sezonu liczone są z Twojej historii treningowej, więc wymagają zgody na przetwarzanie danych.`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="page svelte-icljjb">`);
      Card($$renderer2, {
        title: "Cele sezonu",
        subtitle: "Jedyne miejsce w aplikacji, które patrzy do przodu — reszta opisuje to, co już było",
        children: ($$renderer3) => {
          $$renderer3.push(`<p class="intro svelte-icljjb">Podaj datę i dyscyplinę, a odliczanie, faza przygotowań i trajektoria formy policzą się z danych,
        które już tu są. Cele bez docelowej formy też mają sens — dostaniesz odliczanie i fazę, tylko bez
        oceny „czy zdążę”.</p> `);
          GoalForm($$renderer3, { sports: data.sports, today: data.today });
          $$renderer3.push(`<!---->`);
        }
      });
      $$renderer2.push(`<!----> `);
      if (data.suggestions.length > 0) {
        $$renderer2.push("<!--[0-->");
        Card($$renderer2, {
          title: "Starty z kalendarza Garmin",
          subtitle: "Już je synchronizujemy — jeden klik i stają się celem",
          children: ($$renderer3) => {
            $$renderer3.push(`<ul class="suggestions svelte-icljjb"><!--[-->`);
            const each_array = ensure_array_like(data.suggestions);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let s = each_array[$$index];
              $$renderer3.push(`<li class="suggestion svelte-icljjb"><div><p class="s-title svelte-icljjb">${escape_html(s.title)}</p> <p class="s-meta svelte-icljjb">${escape_html(s.sportLabel)} · ${escape_html(formatDay(s.day, "longYear"))} `);
              if (s.distanceM !== null) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`· ${escape_html(nf1.format(s.distanceM / 1e3))} km`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--></p></div> `);
              Button($$renderer3, {
                variant: "secondary",
                disabled: busy === s.eventId,
                onclick: () => adopt(s),
                children: ($$renderer4) => {
                  $$renderer4.push(`<!---->Dodaj jako cel`);
                },
                $$slots: { default: true }
              });
              $$renderer3.push(`<!----></li>`);
            }
            $$renderer3.push(`<!--]--></ul>`);
          }
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (future().length === 0 && past().length === 0) {
        $$renderer2.push("<!--[0-->");
        Card($$renderer2, {
          title: "Jeszcze nic tu nie ma",
          children: ($$renderer3) => {
            $$renderer3.push(`<p class="empty svelte-icljjb">Nie masz jeszcze żadnego celu. Dodaj start albo datę, na którą chcesz mieć formę — od tego momentu
          wszystkie liczby w aplikacji dostają kierunek.</p>`);
          }
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (!data.hasData && (future().length > 0 || past().length > 0)) {
        $$renderer2.push("<!--[0-->");
        Banner($$renderer2, {
          tone: "info",
          title: "Brak historii treningowej",
          children: ($$renderer3) => {
            $$renderer3.push(`<!---->Cele są zapisane, ale bez zsynchronizowanych aktywności nie ma z czego policzyć trajektorii.`);
          }
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <!--[-->`);
      const each_array_1 = ensure_array_like(future());
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let status = each_array_1[$$index_1];
        GoalCard($$renderer2, {
          status,
          onDelete: busy === status.goal.id ? void 0 : remove
        });
      }
      $$renderer2.push(`<!--]--> `);
      if (past().length > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<h2 class="section svelte-icljjb">Za Tobą</h2> <!--[-->`);
        const each_array_2 = ensure_array_like(past());
        for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
          let status = each_array_2[$$index_2];
          GoalCard($$renderer2, {
            status,
            onDelete: busy === status.goal.id ? void 0 : remove
          });
        }
        $$renderer2.push(`<!--]-->`);
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
    SeasonView($$renderer2, { data: data.season });
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte.js-Can0DcPo.js.map
