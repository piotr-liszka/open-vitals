import { b as attr_class, c as attr, e as escape_html, g as derived, f as stringify } from "./index.js";
import { I as Icon } from "./Icon.js";
/* empty css                                   */
function RangeBadge($$renderer, $$props) {
  let { label, bucketNoun, size = "md" } = $$props;
  const tooltip = derived(() => `Ta karta pokazuje dane z wybranego zakresu: ${label}. Zakres zmienisz przełącznikiem na górze strony.` + (bucketNoun ? ` Jeden punkt to ${bucketNoun}.` : ""));
  $$renderer.push(`<span${attr_class(`range-badge ${stringify(size)}`, "svelte-1mrucpi")}${attr("title", tooltip())}>`);
  Icon($$renderer, { name: "clock", size: size === "sm" ? 12 : 14 });
  $$renderer.push(`<!----> <span class="text svelte-1mrucpi">${escape_html(label)}</span></span>`);
}
export {
  RangeBadge as R
};
