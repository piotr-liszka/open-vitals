import { a4 as attr_class, ab as attr, a5 as escape_html, Q as derived } from './index.js-D7taQuDv.js';

/* empty css                                         */
function RankMedal($$renderer, $$props) {
  let { rank, label, ariaLabel } = $$props;
  const tone = derived(() => rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "plain");
  const text = derived(() => label ?? String(rank));
  $$renderer.push(`<span${attr_class(`medal ${tone()}`, "svelte-11uybjn", { "wide": text().length > 1 })}${attr("aria-label", ariaLabel ?? `${rank}. miejsce`)}>${escape_html(text())}</span>`);
}

export { RankMedal as R };
//# sourceMappingURL=RankMedal.js-JeRQiGJr.js.map
