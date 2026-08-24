import { a4 as attr_class, a6 as stringify, ab as attr, a5 as escape_html, Q as derived } from './index.js-D7taQuDv.js';
import { I as Icon } from './Icon.js-D5N4FEG5.js';

/* empty css                                   */
function RangeBadge($$renderer, $$props) {
  let { label, bucketNoun, size = "md" } = $$props;
  const tooltip = derived(() => `Ta karta pokazuje dane z wybranego zakresu: ${label}. Zakres zmienisz przełącznikiem na górze strony.` + (bucketNoun ? ` Jeden punkt to ${bucketNoun}.` : ""));
  $$renderer.push(`<span${attr_class(`range-badge ${stringify(size)}`, "svelte-1mrucpi")}${attr("title", tooltip())}>`);
  Icon($$renderer, { name: "clock", size: size === "sm" ? 12 : 14 });
  $$renderer.push(`<!----> <span class="text svelte-1mrucpi">${escape_html(label)}</span></span>`);
}

export { RangeBadge as R };
//# sourceMappingURL=RangeBadge.js-CR-NnSex.js.map
