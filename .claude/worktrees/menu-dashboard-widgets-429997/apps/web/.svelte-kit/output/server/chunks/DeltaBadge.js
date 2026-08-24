import { b as attr_class, e as escape_html, f as stringify } from "./index.js";
import { I as Icon } from "./Icon.js";
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
export {
  DeltaBadge as D
};
