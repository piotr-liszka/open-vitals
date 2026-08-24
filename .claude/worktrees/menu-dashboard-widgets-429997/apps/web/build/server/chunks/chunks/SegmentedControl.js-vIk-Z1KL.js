import { a4 as attr_class, a6 as stringify, ab as attr, a7 as ensure_array_like, a5 as escape_html, ae as bind_props, Q as derived } from './index.js-D7taQuDv.js';

/* empty css                                               */
function SegmentedControl($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { options, value = void 0, ariaLabel, onChange, size = "md" } = $$props;
    const selectedIndex = derived(() => options.findIndex((o) => o.value === value));
    $$renderer2.push(`<div${attr_class(`segmented ${stringify(size)}`, "svelte-1ux49fp")} role="radiogroup"${attr("aria-label", ariaLabel)}><!--[-->`);
    const each_array = ensure_array_like(options);
    for (let index = 0, $$length = each_array.length; index < $$length; index++) {
      let option = each_array[index];
      const active = option.value === value;
      $$renderer2.push(`<button type="button" role="radio"${attr_class("segment svelte-1ux49fp", void 0, { "active": active })}${attr("aria-checked", active)}${attr("aria-label", option.short ? option.label : void 0)}${attr("tabindex", active || selectedIndex() === -1 && index === 0 ? 0 : -1)}>`);
      if (option.short) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="label long svelte-1ux49fp">${escape_html(option.label)}</span> <span class="label short svelte-1ux49fp" aria-hidden="true">${escape_html(option.short)}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<span class="label">${escape_html(option.label)}</span>`);
      }
      $$renderer2.push(`<!--]--></button>`);
    }
    $$renderer2.push(`<!--]--></div>`);
    bind_props($$props, { value });
  });
}

export { SegmentedControl as S };
//# sourceMappingURL=SegmentedControl.js-vIk-Z1KL.js.map
