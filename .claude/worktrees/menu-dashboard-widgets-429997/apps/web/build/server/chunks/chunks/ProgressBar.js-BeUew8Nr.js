import { a5 as escape_html, ab as attr, a4 as attr_class, ag as attr_style, a6 as stringify, Q as derived } from './index.js-D7taQuDv.js';

function ProgressBar($$renderer, $$props) {
  let {
    value = null,
    label,
    showPct = true,
    accent = "var(--color-accent)"
  } = $$props;
  const pct = derived(() => value === null || value === void 0 ? null : Math.max(0, Math.min(1, value)));
  const isIndeterminate = derived(() => pct() === null);
  $$renderer.push(`<div class="wrap svelte-fnn7li">`);
  if (label || showPct && pct() !== null) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<div class="row svelte-fnn7li">`);
    if (label) {
      $$renderer.push("<!--[0-->");
      $$renderer.push(`<span class="label svelte-fnn7li">${escape_html(label)}</span>`);
    } else {
      $$renderer.push("<!--[-1-->");
    }
    $$renderer.push(`<!--]--> `);
    if (showPct && pct() !== null) {
      $$renderer.push("<!--[0-->");
      $$renderer.push(`<span class="pct svelte-fnn7li">${escape_html(Math.round(pct() * 100))}%</span>`);
    } else {
      $$renderer.push("<!--[-1-->");
    }
    $$renderer.push(`<!--]--></div>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--> <div class="track svelte-fnn7li" role="progressbar"${attr("aria-valuemin", 0)}${attr("aria-valuemax", 100)}${attr("aria-valuenow", pct() === null ? void 0 : Math.round(pct() * 100))}><div${attr_class("fill svelte-fnn7li", void 0, { "indeterminate": isIndeterminate() })}${attr_style(`--accent: ${stringify(accent)}; ${pct() === null ? "" : `width: ${pct() * 100}%`}`)}></div></div></div>`);
}

export { ProgressBar as P };
//# sourceMappingURL=ProgressBar.js-BeUew8Nr.js.map
