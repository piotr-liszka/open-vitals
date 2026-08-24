import { ag as attr_style, a6 as stringify, ab as attr, a7 as ensure_array_like, a5 as escape_html, Q as derived } from './index.js-D7taQuDv.js';

/* empty css                                         */
function StackedBar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      segments,
      ariaLabel,
      legend = true,
      format = (v) => String(v),
      thickness = "var(--space-3)"
    } = $$props;
    const shown = derived(() => segments.filter((s) => Number.isFinite(s.value) && s.value > 0));
    const total = derived(() => shown().reduce((sum, s) => sum + s.value, 0));
    function pct(value, sum) {
      return sum > 0 ? value / sum * 100 : 0;
    }
    const summary = derived(() => shown().map((s) => `${s.label} ${format(s.value)} (${Math.round(pct(s.value, total()))}%)`).join(", "));
    if (shown().length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="stack svelte-1fyeonc"${attr_style(`--track: ${stringify(thickness)}`)}><div class="track svelte-1fyeonc" role="img"${attr("aria-label", `${ariaLabel}: ${summary()}`)}><!--[-->`);
      const each_array = ensure_array_like(shown());
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let s = each_array[$$index];
        $$renderer2.push(`<span class="seg svelte-1fyeonc"${attr_style(`width: ${stringify(pct(s.value, total()))}%; background: ${stringify(s.color)}`)}></span>`);
      }
      $$renderer2.push(`<!--]--></div> `);
      if (legend) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<ul class="legend svelte-1fyeonc"><!--[-->`);
        const each_array_1 = ensure_array_like(shown());
        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
          let s = each_array_1[$$index_1];
          $$renderer2.push(`<li class="item svelte-1fyeonc"><span class="swatch svelte-1fyeonc"${attr_style(`background: ${stringify(s.color)}`)} aria-hidden="true"></span> <span class="label svelte-1fyeonc">${escape_html(s.label)}</span> <span class="value svelte-1fyeonc">${escape_html(format(s.value))}</span></li>`);
        }
        $$renderer2.push(`<!--]--></ul>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}

export { StackedBar as S };
//# sourceMappingURL=StackedBar.js-B5eUCO7y.js.map
