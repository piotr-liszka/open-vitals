import { a4 as attr_class, ag as attr_style, a5 as escape_html, a6 as stringify, Q as derived } from './index.js-D7taQuDv.js';

/* empty css                                       */
const MAX_CHARS = [
  ["xl", 5],
  ["lg", 7],
  ["md", 9]
];
const UNIT_WEIGHT = 0.45;
function readoutStep(value, unit) {
  const length = String(value).length + Math.ceil((unit?.length ?? 0) * UNIT_WEIGHT);
  for (const [step, max] of MAX_CHARS) {
    if (length <= max) return step;
  }
  return "sm";
}
const VALUE_CHAR_EM = 0.67;
const NARROW_CHAR_EM = 0.3;
const NARROW_CHARS = /* @__PURE__ */ new Set([
  " ",
  " ",
  " ",
  " ",
  ",",
  ".",
  ":",
  "/",
  "-",
  "'",
  "’",
  "|"
]);
const UNIT_CHAR_EM = 0.72;
const UNIT_SIZE_RATIO = 0.45;
const LABEL_CHAR_EM = 0.84;
function advanceEm(text, charEm) {
  let em = 0;
  for (const char of text) em += NARROW_CHARS.has(char) ? NARROW_CHAR_EM : charEm;
  return em;
}
function scaleFor(widthEm) {
  return widthEm > 0 ? Math.round(1 / widthEm * 1e4) / 1e4 : 1;
}
function readoutFitScale(value, unit) {
  const valueEm = advanceEm(String(value), VALUE_CHAR_EM);
  const unitEm = advanceEm(unit ?? "", UNIT_CHAR_EM) * UNIT_SIZE_RATIO;
  return scaleFor(valueEm + unitEm);
}
function labelFitScale(label) {
  let longest = 0;
  for (const word of String(label).split(/\s+/)) {
    if (word.length > longest) longest = word.length;
  }
  return scaleFor(longest * LABEL_CHAR_EM);
}
function StatTile($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      label,
      value,
      unit,
      accent,
      delta,
      deltaSuffix = "",
      trend,
      goodWhen,
      icon,
      sparkline,
      muted = false
    } = $$props;
    const direction = derived(() => trend ?? (delta === void 0 ? void 0 : delta > 0 ? "up" : delta < 0 ? "down" : "flat"));
    const toneClass = derived(() => direction() === void 0 || goodWhen === void 0 || direction() === "flat" ? direction() : direction() === goodWhen ? "up" : "down");
    const deltaText = derived(() => delta === void 0 ? "" : `${delta > 0 ? "+" : ""}${delta}${deltaSuffix}`);
    const arrow = derived(() => direction() === "up" ? "↑" : direction() === "down" ? "↓" : "→");
    const laneVar = derived(() => accent ? `var(--lane-${accent})` : void 0);
    const step = derived(() => readoutStep(value, muted ? void 0 : unit));
    const readoutScale = derived(() => readoutFitScale(value, muted ? void 0 : unit));
    const labelScale = derived(() => labelFitScale(label));
    const tileStyle = derived(() => [
      laneVar() ? `--tile-accent: ${laneVar()}` : "",
      `--readout-scale: ${readoutScale()}`,
      `--label-scale: ${labelScale()}`
    ].filter(Boolean).join("; "));
    $$renderer2.push(`<div${attr_class("tile svelte-1itb854", void 0, { "has-accent": Boolean(accent), "has-icon": Boolean(icon) })}${attr_style(tileStyle())}><div class="top svelte-1itb854"><span class="label svelte-1itb854">`);
    if (accent) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="marker svelte-1itb854" aria-hidden="true"></span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <span class="label-text svelte-1itb854">${escape_html(label)}</span></span> `);
    if (icon) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="icon svelte-1itb854" aria-hidden="true">`);
      icon($$renderer2);
      $$renderer2.push(`<!----></span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div${attr_class(`readout step-${stringify(step())}`, "svelte-1itb854")}><span${attr_class("value svelte-1itb854", void 0, { "muted": muted })}>${escape_html(value)}</span> `);
    if (unit && !muted) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="unit svelte-1itb854">${escape_html(unit)}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (muted) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="sr-only svelte-1itb854">No data yet</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    if (direction() !== void 0 && delta !== void 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div${attr_class(`delta ${stringify(toneClass())}`, "svelte-1itb854")}><span class="arrow svelte-1itb854" aria-hidden="true">${escape_html(arrow())}</span> <span>${escape_html(deltaText())}</span></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (sparkline) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="spark svelte-1itb854">`);
      sparkline($$renderer2);
      $$renderer2.push(`<!----></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}

export { StatTile as S };
//# sourceMappingURL=StatTile.js-DDgLmTba.js.map
