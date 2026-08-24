import { e as escape_html, a as ensure_array_like, c as attr, b as attr_class, g as derived, f as stringify, s as store_get, u as unsubscribe_stores } from "../../../../chunks/index.js";
import { C as Card } from "../../../../chunks/Card.js";
import { B as Button } from "../../../../chunks/Button.js";
import { B as Badge } from "../../../../chunks/Badge.js";
import { B as Banner } from "../../../../chunks/Banner.js";
import { C as ConfirmDialog } from "../../../../chunks/ConfirmDialog.js";
import { t as toasts } from "../../../../chunks/toast.js";
import { i as invalidateAll, g as goto } from "../../../../chunks/client.js";
import { p as page } from "../../../../chunks/stores.js";
import { j as formatMonth, g as formatDay } from "../../../../chunks/date.js";
import { f as SPORT_LABELS, a as sportGroup, b as sportLabel } from "../../../../chunks/sport-labels.js";
import { m as monthWeeks, a as groupByDay, b as byTimeThenTitle } from "../../../../chunks/planner.js";
import { b as WORKOUT_TARGET_UNITS, c as WORKOUT_LIMITS, d as WORKOUT_DURATION_TYPES, f as WORKOUT_STEP_KINDS, g as WORKOUT_TARGETS_BY_GROUP } from "../../../../chunks/workouts.js";
import { F as Field } from "../../../../chunks/Field.js";
import { I as Input } from "../../../../chunks/Input.js";
function PlannerCalendar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      month,
      today,
      selected,
      authoredByDay,
      plannedByDay,
      dropActive = false
    } = $$props;
    let overDay = null;
    const weeks = derived(() => monthWeeks(month));
    const WEEKDAYS = [
      { short: "Pn", long: "Poniedziałek" },
      { short: "Wt", long: "Wtorek" },
      { short: "Śr", long: "Środa" },
      { short: "Cz", long: "Czwartek" },
      { short: "Pt", long: "Piątek" },
      { short: "So", long: "Sobota" },
      { short: "Nd", long: "Niedziela" }
    ];
    const dayNumber = (day) => String(Number(day.slice(8, 10)));
    $$renderer2.push(`<div class="cal svelte-1s4nf40"><div class="bar svelte-1s4nf40"><button type="button" class="nav svelte-1s4nf40" aria-label="Poprzedni miesiąc">←</button> <h3 class="month svelte-1s4nf40">${escape_html(formatMonth(month, "longYear"))}</h3> <button type="button" class="nav svelte-1s4nf40" aria-label="Następny miesiąc">→</button></div> <table class="grid svelte-1s4nf40"><thead><tr><!--[-->`);
    const each_array = ensure_array_like(WEEKDAYS);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let d = each_array[$$index];
      $$renderer2.push(`<th scope="col" class="svelte-1s4nf40"><abbr${attr("title", d.long)} class="svelte-1s4nf40">${escape_html(d.short)}</abbr></th>`);
    }
    $$renderer2.push(`<!--]--></tr></thead><tbody><!--[-->`);
    const each_array_1 = ensure_array_like(weeks());
    for (let $$index_4 = 0, $$length = each_array_1.length; $$index_4 < $$length; $$index_4++) {
      let week = each_array_1[$$index_4];
      $$renderer2.push(`<tr><!--[-->`);
      const each_array_2 = ensure_array_like(week);
      for (let $$index_3 = 0, $$length2 = each_array_2.length; $$index_3 < $$length2; $$index_3++) {
        let cell = each_array_2[$$index_3];
        const authored = authoredByDay.get(cell.day) ?? 0;
        const planned = plannedByDay.get(cell.day) ?? 0;
        $$renderer2.push(`<td${attr_class("svelte-1s4nf40", void 0, {
          "outside": !cell.inMonth,
          "drop-target": dropActive,
          "drop-over": overDay === cell.day
        })}><button type="button"${attr_class("day svelte-1s4nf40", void 0, {
          "today": cell.day === today,
          "selected": cell.day === selected,
          "has": authored + planned > 0
        })}${attr("aria-current", cell.day === today ? "date" : void 0)}${attr("aria-pressed", cell.day === selected)}><span class="n">${escape_html(dayNumber(cell.day))}</span> <span class="dots svelte-1s4nf40" aria-hidden="true"><!--[-->`);
        const each_array_3 = ensure_array_like({ length: Math.min(authored, 3) });
        for (let i = 0, $$length3 = each_array_3.length; i < $$length3; i++) {
          each_array_3[i];
          $$renderer2.push(`<span class="dot mine svelte-1s4nf40"></span>`);
        }
        $$renderer2.push(`<!--]--> <!--[-->`);
        const each_array_4 = ensure_array_like({ length: Math.min(planned, 3) });
        for (let i = 0, $$length3 = each_array_4.length; i < $$length3; i++) {
          each_array_4[i];
          $$renderer2.push(`<span class="dot theirs svelte-1s4nf40"></span>`);
        }
        $$renderer2.push(`<!--]--></span> <span class="sr svelte-1s4nf40">${escape_html(formatDay(cell.day, "long"))}${escape_html(authored > 0 ? `, ${authored} zaplanowanych treningów` : "")}${escape_html(planned > 0 ? `, ${planned} z kalendarza Garmina` : "")}</span></button></td>`);
      }
      $$renderer2.push(`<!--]--></tr>`);
    }
    $$renderer2.push(`<!--]--></tbody></table> <p class="legend svelte-1s4nf40"><span class="dot mine svelte-1s4nf40"></span> Twój plan <span class="dot theirs svelte-1s4nf40"></span> Z Garmina</p></div>`);
  });
}
const STEP_KIND_LABELS = {
  warmup: "Rozgrzewka",
  work: "Praca",
  recovery: "Przerwa",
  rest: "Odpoczynek",
  cooldown: "Schłodzenie",
  repeat: "Powtórz"
};
const DURATION_TYPE_LABELS = {
  time: "Czas",
  distance: "Dystans",
  lap: "Przycisk lap",
  calories: "Kalorie"
};
const DURATION_UNITS = {
  time: "s",
  distance: "m",
  calories: "kcal",
  lap: ""
};
const DURATION_VALUE_LABELS = {
  time: "Sekundy",
  distance: "Metry",
  calories: "Kalorie",
  lap: "Wartość"
};
const TARGET_TYPE_LABELS = {
  none: "Bez celu",
  pace: "Tempo",
  speed: "Prędkość",
  power: "Moc",
  hr: "Tętno",
  cadence: "Kadencja"
};
const nf = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
function fmtClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s % 3600 / 60);
  const sec = s % 60;
  const two = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}
function fmtDistance(metres) {
  return metres >= 1e3 ? `${nf.format(metres / 1e3)} km` : `${nf.format(metres)} m`;
}
function describeDuration(step) {
  const value = step.durationValue;
  switch (step.durationType) {
    case "time":
      return value === null ? "—" : fmtClock(value);
    case "distance":
      return value === null ? "—" : fmtDistance(value);
    case "calories":
      return value === null ? "—" : `${nf.format(value)} kcal`;
    case "lap":
      return "do przycisku lap";
    default:
      return "—";
  }
}
function describeTarget(target) {
  if (!target || target.type === "none") return null;
  const { low, high } = target;
  if (low === null && high === null) return null;
  const unit = WORKOUT_TARGET_UNITS[target.type];
  const one = (v) => target.type === "pace" ? `${fmtClock(v)}/km` : `${nf.format(v)} ${unit}`;
  if (low !== null && high !== null) {
    return low === high ? one(low) : `${one(low)}–${one(high)}`;
  }
  return low !== null ? `od ${one(low)}` : `do ${one(high)}`;
}
function describeStep(step) {
  if (step.kind === "repeat") {
    const children = (step.steps ?? []).map(describeStep).join(" + ");
    return `${step.repeats ?? 0}× (${children})`;
  }
  const target = describeTarget(step.target);
  const duration = describeDuration(step);
  return target ? `${duration} @ ${target}` : duration;
}
function describeSteps(steps) {
  return steps.map(describeStep).join(" · ");
}
function WorkoutSteps($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { steps } = $$props;
    $$renderer2.push(`<ol class="steps svelte-1n5xjl8"><!--[-->`);
    const each_array = ensure_array_like(steps);
    for (let i = 0, $$length = each_array.length; i < $$length; i++) {
      let step = each_array[i];
      $$renderer2.push(`<li${attr_class("step svelte-1n5xjl8", void 0, { "repeat": step.kind === "repeat" })}>`);
      if (step.kind === "repeat") {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="row svelte-1n5xjl8"><span class="kind svelte-1n5xjl8">${escape_html(STEP_KIND_LABELS.repeat)}</span> <span class="reps svelte-1n5xjl8">×${escape_html(step.repeats ?? 0)}</span></div> <ol class="children svelte-1n5xjl8"><!--[-->`);
        const each_array_1 = ensure_array_like(step.steps ?? []);
        for (let j = 0, $$length2 = each_array_1.length; j < $$length2; j++) {
          let child = each_array_1[j];
          $$renderer2.push(`<li class="step child"><div class="row svelte-1n5xjl8"><span${attr_class(`kind kind-${stringify(child.kind)}`, "svelte-1n5xjl8")}>${escape_html(STEP_KIND_LABELS[child.kind])}</span> <span class="dur svelte-1n5xjl8">${escape_html(describeDuration(child))}</span> `);
          if (describeTarget(child.target)) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span class="target svelte-1n5xjl8">${escape_html(describeTarget(child.target))}</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div> `);
          if (child.note) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<p class="note svelte-1n5xjl8">${escape_html(child.note)}</p>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></li>`);
        }
        $$renderer2.push(`<!--]--></ol>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<div class="row svelte-1n5xjl8"><span${attr_class(`kind kind-${stringify(step.kind)}`, "svelte-1n5xjl8")}>${escape_html(STEP_KIND_LABELS[step.kind])}</span> <span class="dur svelte-1n5xjl8">${escape_html(describeDuration(step))}</span> `);
        if (describeTarget(step.target)) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="target svelte-1n5xjl8">${escape_html(describeTarget(step.target))}</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div> `);
        if (step.note) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<p class="note svelte-1n5xjl8">${escape_html(step.note)}</p>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]--></li>`);
    }
    $$renderer2.push(`<!--]--></ol>`);
  });
}
function WorkoutEditor($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { workout, day, mode = "plan", saving, error, onsave, oncancel } = $$props;
    const isLibrary = derived(() => mode === "library");
    const emptyStep = (kind = "work") => ({
      kind,
      durationType: "time",
      durationValue: 300,
      targetType: "none",
      targetLow: null,
      targetHigh: null,
      repeats: 4,
      steps: [],
      note: ""
    });
    function toDraft(step) {
      return {
        kind: step.kind,
        durationType: step.durationType ?? "time",
        durationValue: step.durationValue,
        targetType: step.target?.type ?? "none",
        targetLow: step.target?.low ?? null,
        targetHigh: step.target?.high ?? null,
        repeats: step.repeats ?? 4,
        steps: (step.steps ?? []).map(toDraft),
        note: step.note ?? ""
      };
    }
    let title = workout?.title ?? "";
    let sport = workout?.sport ?? "running";
    let time = (workout && "time" in workout ? workout.time : null) ?? "";
    let note = workout?.note ?? "";
    let steps = workout ? workout.steps.map(toDraft) : [
      emptyStep("warmup"),
      emptyStep("work"),
      emptyStep("cooldown")
    ];
    const group = derived(() => sportGroup(sport));
    const allowedTargets = derived(() => WORKOUT_TARGETS_BY_GROUP[group()]);
    const canSubmit = derived(() => title.trim().length > 0 && steps.length > 0 && !saving);
    const unitOf = (t) => WORKOUT_TARGET_UNITS[t] || "";
    const kindsFor = (child) => child ? WORKOUT_STEP_KINDS.filter((k) => k !== "repeat") : WORKOUT_STEP_KINDS;
    function addStep(list, kind = "work") {
      list.push(emptyStep(kind));
    }
    function addRepeat() {
      const block = emptyStep("repeat");
      block.steps = [emptyStep("work"), emptyStep("recovery")];
      steps.push(block);
    }
    function stepRow($$renderer3, s, list, i, child) {
      $$renderer3.push(`<div${attr_class("step-bar svelte-1tjog9k", void 0, { "child": child })}>`);
      $$renderer3.select(
        {
          class: "select kind",
          value: s.kind,
          "aria-label": "Rodzaj kroku"
        },
        ($$renderer4) => {
          $$renderer4.push(`<!--[-->`);
          const each_array_1 = ensure_array_like(kindsFor(child));
          for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
            let k = each_array_1[$$index_1];
            $$renderer4.option({ value: k }, ($$renderer5) => {
              $$renderer5.push(`${escape_html(STEP_KIND_LABELS[k])}`);
            });
          }
          $$renderer4.push(`<!--]-->`);
        },
        "svelte-1tjog9k"
      );
      $$renderer3.push(` `);
      if (s.kind === "repeat") {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<label class="inline svelte-1tjog9k"><span class="lbl svelte-1tjog9k">Powtórzeń</span> <input class="num svelte-1tjog9k" type="number" min="1"${attr("max", WORKOUT_LIMITS.maxRepeats)}${attr("value", s.repeats)}/></label>`);
      } else {
        $$renderer3.push("<!--[-1-->");
        $$renderer3.select(
          {
            class: "select",
            value: s.durationType,
            "aria-label": "Zakończ krok po"
          },
          ($$renderer4) => {
            $$renderer4.push(`<!--[-->`);
            const each_array_2 = ensure_array_like(WORKOUT_DURATION_TYPES);
            for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
              let t = each_array_2[$$index_2];
              $$renderer4.option({ value: t }, ($$renderer5) => {
                $$renderer5.push(`${escape_html(DURATION_TYPE_LABELS[t])}`);
              });
            }
            $$renderer4.push(`<!--]-->`);
          },
          "svelte-1tjog9k"
        );
        $$renderer3.push(` `);
        if (s.durationType !== "lap") {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<input class="num svelte-1tjog9k" type="number" min="1"${attr("value", s.durationValue)}${attr("aria-label", DURATION_VALUE_LABELS[s.durationType])}/> <span class="unit svelte-1tjog9k">${escape_html(DURATION_UNITS[s.durationType])}</span>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        $$renderer3.select(
          { class: "select", value: s.targetType, "aria-label": "Cel" },
          ($$renderer4) => {
            $$renderer4.push(`<!--[-->`);
            const each_array_3 = ensure_array_like(allowedTargets());
            for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
              let t = each_array_3[$$index_3];
              $$renderer4.option({ value: t }, ($$renderer5) => {
                $$renderer5.push(`${escape_html(TARGET_TYPE_LABELS[t] ?? t)}`);
              });
            }
            $$renderer4.push(`<!--]-->`);
          },
          "svelte-1tjog9k"
        );
        $$renderer3.push(` `);
        if (s.targetType !== "none") {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<input class="num svelte-1tjog9k" type="number"${attr("value", s.targetLow)} aria-label="Cel od"/> <span class="dash svelte-1tjog9k">–</span> <input class="num svelte-1tjog9k" type="number"${attr("value", s.targetHigh)} aria-label="Cel do"/> <span class="unit svelte-1tjog9k">${escape_html(unitOf(s.targetType))}</span>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]-->`);
      }
      $$renderer3.push(`<!--]--> <div class="ctrl svelte-1tjog9k"><button type="button" aria-label="W górę"${attr("disabled", i === 0, true)} class="svelte-1tjog9k">↑</button> <button type="button" aria-label="W dół"${attr("disabled", i === list.length - 1, true)} class="svelte-1tjog9k">↓</button> <button type="button" class="del svelte-1tjog9k" aria-label="Usuń krok">✕</button></div></div>`);
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<form class="editor svelte-1tjog9k">`);
      if (error) {
        $$renderer3.push("<!--[0-->");
        Banner($$renderer3, {
          tone: "danger",
          title: "Nie zapisano",
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->${escape_html(error)}`);
          }
        });
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> <div class="meta svelte-1tjog9k">`);
      {
        let children = function($$renderer4, control) {
          Input($$renderer4, {
            id: control.id,
            maxlength: WORKOUT_LIMITS.maxTitle,
            placeholder: "np. Interwały 5×1 km",
            autocomplete: "off",
            get value() {
              return title;
            },
            set value($$value) {
              title = $$value;
              $$settled = false;
            }
          });
        };
        Field($$renderer3, { label: "Nazwa", children });
      }
      $$renderer3.push(`<!----> `);
      {
        let children = function($$renderer4, control) {
          $$renderer4.select(
            { id: control.id, class: "select", value: sport },
            ($$renderer5) => {
              $$renderer5.push(`<!--[-->`);
              const each_array = ensure_array_like(SPORT_LABELS);
              for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                let s = each_array[$$index];
                $$renderer5.option({ value: s.key }, ($$renderer6) => {
                  $$renderer6.push(`${escape_html(s.label)}`);
                });
              }
              $$renderer5.push(`<!--]-->`);
            },
            "svelte-1tjog9k"
          );
        };
        Field($$renderer3, { label: "Sport", children });
      }
      $$renderer3.push(`<!----> `);
      if (!isLibrary()) {
        $$renderer3.push("<!--[0-->");
        {
          let children = function($$renderer4, control) {
            Input($$renderer4, {
              id: control.id,
              type: "time",
              get value() {
                return time;
              },
              set value($$value) {
                time = $$value;
                $$settled = false;
              }
            });
          };
          Field($$renderer3, {
            label: "Godzina",
            help: "Puste = kiedykolwiek tego dnia",
            children
          });
        }
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></div> `);
      if (isLibrary() && workout) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<p class="scope-note svelte-1tjog9k">Zmiany dotyczą tylko biblioteki. Treningi już zaplanowane w kalendarzu zostaną bez zmian.</p>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> <div class="steps svelte-1tjog9k"><div class="steps-head svelte-1tjog9k"><h4 class="svelte-1tjog9k">Kroki</h4> <span class="count svelte-1tjog9k">${escape_html(steps.length)} / ${escape_html(WORKOUT_LIMITS.maxSteps)}</span></div>  <!--[-->`);
      const each_array_4 = ensure_array_like(steps);
      for (let i = 0, $$length = each_array_4.length; i < $$length; i++) {
        let step = each_array_4[i];
        $$renderer3.push(`<div${attr_class("step svelte-1tjog9k", void 0, { "block": step.kind === "repeat" })}>`);
        stepRow($$renderer3, step, steps, i, false);
        $$renderer3.push(`<!----> `);
        if (step.kind === "repeat") {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<div class="children svelte-1tjog9k"><!--[-->`);
          const each_array_5 = ensure_array_like(step.steps);
          for (let j = 0, $$length2 = each_array_5.length; j < $$length2; j++) {
            let child = each_array_5[j];
            stepRow($$renderer3, child, step.steps, j, true);
          }
          $$renderer3.push(`<!--]--> `);
          Button($$renderer3, {
            size: "sm",
            variant: "ghost",
            onclick: () => addStep(step.steps),
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->+ Krok w bloku`);
            },
            $$slots: { default: true }
          });
          $$renderer3.push(`<!----></div>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--></div>`);
      }
      $$renderer3.push(`<!--]--> <div class="adders svelte-1tjog9k">`);
      Button($$renderer3, {
        size: "sm",
        variant: "secondary",
        onclick: () => addStep(steps),
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->+ Krok`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> `);
      Button($$renderer3, {
        size: "sm",
        variant: "secondary",
        onclick: addRepeat,
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->+ Powtórzenie`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----></div></div> `);
      {
        let children = function($$renderer4, control) {
          $$renderer4.push(`<textarea${attr("id", control.id)} class="note svelte-1tjog9k" rows="2"${attr("maxlength", WORKOUT_LIMITS.maxNote)} placeholder="Opcjonalny opis sesji">`);
          const $$body = escape_html(note);
          if ($$body) {
            $$renderer4.push(`${$$body}`);
          }
          $$renderer4.push(`</textarea>`);
        };
        Field($$renderer3, { label: "Notatka", children });
      }
      $$renderer3.push(`<!----> <div class="actions svelte-1tjog9k">`);
      Button($$renderer3, {
        type: "button",
        size: "sm",
        variant: "ghost",
        onclick: oncancel,
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->Anuluj`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----> `);
      Button($$renderer3, {
        type: "submit",
        size: "sm",
        variant: "primary",
        disabled: !canSubmit(),
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->${escape_html(saving ? "Zapisuję…" : workout ? "Zapisz zmiany" : "Dodaj trening")}`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----></div></form>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
function WorkoutLibrary($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      templates,
      selectedDay,
      canWrite,
      onschedule,
      onedit,
      ondelete,
      oncreate
    } = $$props;
    let draggingId = null;
    const summary = (t) => {
      const bits = [];
      if (t.estimatedDurationS !== null) bits.push(fmtClock(t.estimatedDurationS));
      if (t.estimatedDistanceM !== null) bits.push(fmtDistance(t.estimatedDistanceM));
      return bits.join(" · ");
    };
    $$renderer2.push(`<section class="library svelte-1m8vvxw"><div class="head svelte-1m8vvxw"><h3 class="title svelte-1m8vvxw">Biblioteka treningów</h3> `);
    if (canWrite) {
      $$renderer2.push("<!--[0-->");
      Button($$renderer2, {
        size: "sm",
        variant: "secondary",
        onclick: oncreate,
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->+ Nowy`);
        },
        $$slots: { default: true }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    if (templates.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="empty svelte-1m8vvxw">Biblioteka jest pusta. Zapisz tu treningi, które powtarzasz — potem przeciągniesz je na kalendarz.${escape_html(canWrite ? "" : " Włącz zgodę „Tworzenie treningów”, aby dodawać.")}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<p class="hint svelte-1m8vvxw">Przeciągnij trening na dzień w kalendarzu albo użyj przycisku „Zaplanuj”.</p> <ul class="list svelte-1m8vvxw"><!--[-->`);
      const each_array = ensure_array_like(templates);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let t = each_array[$$index];
        $$renderer2.push(`<li${attr_class("item svelte-1m8vvxw", void 0, { "dragging": draggingId === t.id })}${attr("draggable", canWrite)}><div class="row svelte-1m8vvxw"><div class="who svelte-1m8vvxw">`);
        Badge($$renderer2, {
          tone: "neutral",
          children: ($$renderer3) => {
            $$renderer3.push(`<!---->${escape_html(sportLabel(t.sport))}`);
          }
        });
        $$renderer2.push(`<!----> <span class="name svelte-1m8vvxw">${escape_html(t.title)}</span></div> `);
        if (summary(t)) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="est svelte-1m8vvxw">${escape_html(summary(t))}</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div> <p class="steps svelte-1m8vvxw">${escape_html(describeSteps(t.steps))}</p> `);
        if (canWrite) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="actions svelte-1m8vvxw">`);
          Button($$renderer2, {
            size: "sm",
            variant: "ghost",
            onclick: () => onschedule(t, selectedDay),
            children: ($$renderer3) => {
              $$renderer3.push(`<!---->Zaplanuj na ${escape_html(formatDay(selectedDay, "short"))}`);
            },
            $$slots: { default: true }
          });
          $$renderer2.push(`<!----> `);
          Button($$renderer2, {
            size: "sm",
            variant: "ghost",
            onclick: () => onedit(t),
            children: ($$renderer3) => {
              $$renderer3.push(`<!---->Edytuj`);
            },
            $$slots: { default: true }
          });
          $$renderer2.push(`<!----> `);
          Button($$renderer2, {
            size: "sm",
            variant: "ghost",
            onclick: () => ondelete(t),
            children: ($$renderer3) => {
              $$renderer3.push(`<!---->Usuń`);
            },
            $$slots: { default: true }
          });
          $$renderer2.push(`<!----></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></li>`);
      }
      $$renderer2.push(`<!--]--></ul>`);
    }
    $$renderer2.push(`<!--]--></section>`);
  });
}
function PlannerView($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { data, month, today, selected } = $$props;
    const day = derived(() => selected ?? today);
    const authoredByDay = derived(() => new Map([...groupByDay(data.workouts, (w) => w.day)].map(([k, v]) => [k, v.length])));
    const plannedByDay = derived(() => new Map([...groupByDay(data.planned, (p) => p.day)].map(([k, v]) => [k, v.length])));
    const dayWorkouts = derived(() => data.workouts.filter((w) => w.day === day()).sort(byTimeThenTitle));
    const dayPlanned = derived(() => data.planned.filter((p) => p.day === day()));
    let editing = null;
    let composing = false;
    let saving = false;
    let error = null;
    let confirming = null;
    let editingTemplate = null;
    let composingTemplate = false;
    let draggedTemplate = null;
    let confirmingTemplate = null;
    const PUSH_TONE = {
      pending: { tone: "neutral", label: "W kolejce" },
      pushed: { tone: "success", label: "Na zegarku" },
      failed: { tone: "danger", label: "Błąd wysyłki" },
      unsupported: { tone: "warning", label: "Niewspierane" }
    };
    function navigate(next) {
      const url = new URL(store_get($$store_subs ??= {}, "$page", page).url);
      if (next.month) url.searchParams.set("month", next.month);
      if (next.day) url.searchParams.set("day", next.day);
      return goto(`${url.pathname}${url.search}`, {});
    }
    function startCompose() {
      editing = null;
      composing = true;
      error = null;
    }
    function startEdit(w) {
      editing = w;
      composing = true;
      error = null;
    }
    function cancel() {
      composing = false;
      editing = null;
      composingTemplate = false;
      editingTemplate = null;
      error = null;
    }
    function startComposeTemplate() {
      cancel();
      composingTemplate = true;
    }
    function startEditTemplate(t) {
      cancel();
      editingTemplate = t;
      composingTemplate = true;
    }
    async function saveTemplate(draft) {
      saving = true;
      error = null;
      try {
        const res = await fetch(
          editingTemplate ? `/api/workout-templates/${editingTemplate.id}` : "/api/workout-templates",
          {
            method: editingTemplate ? "PATCH" : "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              sport: draft.sport,
              title: draft.title,
              steps: draft.steps,
              note: draft.note
            })
          }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          error = body?.error ?? "Nie udało się zapisać treningu";
          return;
        }
        const wasEdit = editingTemplate !== null;
        cancel();
        await invalidateAll();
        toasts.success(wasEdit ? "Zapisano w bibliotece" : "Dodano do biblioteki");
      } finally {
        saving = false;
      }
    }
    async function removeTemplate() {
      const target = confirmingTemplate;
      confirmingTemplate = null;
      if (!target) return;
      const res = await fetch(`/api/workout-templates/${target.id}`, { method: "DELETE" });
      if (!res.ok) {
        toasts.error("Nie udało się usunąć treningu");
        return;
      }
      await invalidateAll();
      toasts.success("Usunięto z biblioteki");
    }
    async function schedule(template, onDay) {
      const res = await fetch("/api/workouts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateId: template.id, day: onDay })
      });
      if (!res.ok) {
        toasts.error("Nie udało się zaplanować treningu");
        return;
      }
      if (onDay === day()) await invalidateAll();
      else await navigate({ day: onDay });
      toasts.success(`Zaplanowano „${template.title}” na ${formatDay(onDay, "short")}`);
    }
    async function save(draft) {
      saving = true;
      error = null;
      try {
        const res = await fetch(editing ? `/api/workouts/${editing.id}` : "/api/workouts", {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft)
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          error = body?.error ?? "Nie udało się zapisać treningu";
          return;
        }
        cancel();
        await invalidateAll();
        toasts.success(editing ? "Zapisano zmiany" : "Dodano trening");
      } finally {
        saving = false;
      }
    }
    async function remove() {
      const target = confirming;
      confirming = null;
      if (!target) return;
      const res = await fetch(`/api/workouts/${target.id}`, { method: "DELETE" });
      if (!res.ok) {
        toasts.error("Nie udało się usunąć treningu");
        return;
      }
      await invalidateAll();
      toasts.success("Usunięto trening");
    }
    const summary = (w) => {
      const bits = [];
      if (w.estimatedDurationS !== null) bits.push(fmtClock(w.estimatedDurationS));
      if (w.estimatedDistanceM !== null) bits.push(fmtDistance(w.estimatedDistanceM));
      return bits.join(" · ");
    };
    $$renderer2.push(`<div class="planner svelte-1o9rdkv">`);
    Card($$renderer2, {
      children: ($$renderer3) => {
        PlannerCalendar($$renderer3, {
          month,
          today,
          selected: day(),
          authoredByDay: authoredByDay(),
          plannedByDay: plannedByDay(),
          dropActive: draggedTemplate !== null
        });
      }
    });
    $$renderer2.push(`<!----> `);
    Card($$renderer2, {
      children: ($$renderer3) => {
        WorkoutLibrary($$renderer3, {
          templates: data.templates,
          selectedDay: day(),
          canWrite: data.canWrite,
          onschedule: (t, d) => void schedule(t, d),
          onedit: startEditTemplate,
          ondelete: (t) => confirmingTemplate = t,
          oncreate: startComposeTemplate
        });
      }
    });
    $$renderer2.push(`<!----> `);
    Card($$renderer2, {
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="day-head svelte-1o9rdkv"><h3 class="day-title svelte-1o9rdkv">${escape_html(formatDay(day(), "long"))}</h3> `);
        if (data.canWrite && !composing) {
          $$renderer3.push("<!--[0-->");
          Button($$renderer3, {
            size: "sm",
            variant: "primary",
            onclick: startCompose,
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->+ Trening`);
            },
            $$slots: { default: true }
          });
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--></div> `);
        if (!data.canWrite) {
          $$renderer3.push("<!--[0-->");
          Banner($$renderer3, {
            tone: "info",
            title: "Tryb tylko do odczytu",
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->Zapis treningów wymaga zgody „Tworzenie treningów”. Włącz ją w <a href="/settings">Ustawieniach</a>, aby dodawać i edytować sesje tutaj.`);
            }
          });
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        if (composingTemplate) {
          $$renderer3.push("<!--[0-->");
          WorkoutEditor($$renderer3, {
            workout: editingTemplate,
            day: day(),
            mode: "library",
            saving,
            error,
            onsave: saveTemplate,
            oncancel: cancel
          });
        } else if (composing) {
          $$renderer3.push("<!--[1-->");
          WorkoutEditor($$renderer3, {
            workout: editing,
            day: day(),
            saving,
            error,
            onsave: save,
            oncancel: cancel
          });
        } else {
          $$renderer3.push("<!--[-1-->");
          if (dayWorkouts().length === 0 && dayPlanned().length === 0) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<p class="empty svelte-1o9rdkv">Nic nie zaplanowano na ten dzień.${escape_html(data.canWrite ? " Dodaj trening przyciskiem powyżej albo przez asystenta (MCP)." : "")}</p>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> <!--[-->`);
          const each_array = ensure_array_like(dayWorkouts());
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let w = each_array[$$index];
            $$renderer3.push(`<article class="session svelte-1o9rdkv"><div class="session-head svelte-1o9rdkv"><div class="who"><span class="sport svelte-1o9rdkv">${escape_html(sportLabel(w.sport))}</span> <h4 class="name svelte-1o9rdkv">${escape_html(w.title)}</h4></div> <div class="meta svelte-1o9rdkv">`);
            if (w.time) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<span class="time svelte-1o9rdkv">${escape_html(w.time)}</span>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            Badge($$renderer3, {
              tone: PUSH_TONE[w.pushState].tone,
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->${escape_html(PUSH_TONE[w.pushState].label)}`);
              }
            });
            $$renderer3.push(`<!----></div></div> `);
            if (summary(w)) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<p class="summary svelte-1o9rdkv">${escape_html(summary(w))}</p>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            if (w.pushError) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<p class="push-error svelte-1o9rdkv">${escape_html(w.pushError)}</p>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            WorkoutSteps($$renderer3, { steps: w.steps });
            $$renderer3.push(`<!----> `);
            if (w.note) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<p class="note svelte-1o9rdkv">${escape_html(w.note)}</p>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--> `);
            if (data.canWrite) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="session-actions svelte-1o9rdkv">`);
              Button($$renderer3, {
                size: "sm",
                variant: "ghost",
                onclick: () => startEdit(w),
                children: ($$renderer4) => {
                  $$renderer4.push(`<!---->Edytuj`);
                },
                $$slots: { default: true }
              });
              $$renderer3.push(`<!----> `);
              Button($$renderer3, {
                size: "sm",
                variant: "ghost",
                onclick: () => confirming = w,
                children: ($$renderer4) => {
                  $$renderer4.push(`<!---->Usuń`);
                },
                $$slots: { default: true }
              });
              $$renderer3.push(`<!----></div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--></article>`);
          }
          $$renderer3.push(`<!--]--> <!--[-->`);
          const each_array_1 = ensure_array_like(dayPlanned());
          for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
            let p = each_array_1[$$index_1];
            $$renderer3.push(`<article class="session synced svelte-1o9rdkv"><div class="session-head svelte-1o9rdkv"><div class="who"><span class="sport svelte-1o9rdkv">${escape_html(p.sport ? sportLabel(p.sport) : "Z kalendarza")}</span> <h4 class="name svelte-1o9rdkv">${escape_html(p.title)}</h4></div> `);
            Badge($$renderer3, {
              tone: "neutral",
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->Z Garmina`);
              }
            });
            $$renderer3.push(`<!----></div> `);
            if (p.description) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<p class="note svelte-1o9rdkv">${escape_html(p.description)}</p>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]--></article>`);
          }
          $$renderer3.push(`<!--]-->`);
        }
        $$renderer3.push(`<!--]-->`);
      }
    });
    $$renderer2.push(`<!----></div> `);
    ConfirmDialog($$renderer2, {
      open: confirming !== null,
      title: `Usunąć „${stringify(confirming?.title ?? "")}”?`,
      body: confirming?.onGarmin ? "Trening zniknie z tej listy od razu. Z zegarka usunie go dopiero najbliższa synchronizacja." : "Ten trening nie trafił jeszcze do Garmina, więc zostanie usunięty bez śladu.",
      onconfirm: remove,
      oncancel: () => confirming = null
    });
    $$renderer2.push(`<!----> `);
    ConfirmDialog($$renderer2, {
      open: confirmingTemplate !== null,
      title: `Usunąć „${stringify(confirmingTemplate?.title ?? "")}” z biblioteki?`,
      body: "Treningi już zaplanowane w kalendarzu zostaną — usuwasz tylko wzorzec, z którego powstały.",
      onconfirm: removeTemplate,
      oncancel: () => confirmingTemplate = null
    });
    $$renderer2.push(`<!---->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    PlannerView($$renderer2, {
      data: data.planner,
      month: data.month,
      today: data.today,
      selected: data.selected
    });
  });
}
export {
  _page as default
};
