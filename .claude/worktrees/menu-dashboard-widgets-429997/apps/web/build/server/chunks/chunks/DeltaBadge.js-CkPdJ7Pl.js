import { a4 as attr_class, a6 as stringify, a5 as escape_html } from './index.js-D7taQuDv.js';
import { I as Icon } from './Icon.js-D5N4FEG5.js';

/* empty css                                         */
function DeltaBadge($$renderer, $$props) {
  let { direction, arrow = "none", value, label } = $$props;
  $$renderer.push(`<span${attr_class(`delta ${stringify(direction)}`, "svelte-kbbv4x")}>`);
  if (arrow !== "none") {
    $$renderer.push("<!--[0-->");
    Icon($$renderer, { name: arrow === "down" ? "arrow-down" : "arrow-up", size: 14 });
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--> <span class="value svelte-kbbv4x" aria-hidden="true">${escape_html(value)}</span> <span class="sr-only svelte-kbbv4x">${escape_html(label)}</span></span>`);
}

export { DeltaBadge as D };
//# sourceMappingURL=DeltaBadge.js-CkPdJ7Pl.js.map
