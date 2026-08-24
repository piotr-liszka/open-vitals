import { c as attr, b as attr_class, e as escape_html, a as ensure_array_like, g as derived } from "./index.js";
/* empty css                                          */
function FilterChips($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      options,
      value,
      onSelect,
      ariaLabel,
      allLabel = "Wszystkie",
      maxVisible = 5,
      expandLabel = (hidden2) => `+ ${hidden2} więcej`,
      collapseLabel = "Mniej"
    } = $$props;
    let expanded = false;
    const visible = derived(() => {
      if (options.length <= maxVisible) return options;
      const head = options.slice(0, Math.max(0, maxVisible));
      if (value == null || head.some((o) => o.value === value)) return head;
      const selected = options.find((o) => o.value === value);
      return selected ? [...head, selected] : head;
    });
    const hidden = derived(() => options.length - visible().length);
    $$renderer2.push(`<div class="chips svelte-1hfcioz" role="group"${attr("aria-label", ariaLabel)}>`);
    if (allLabel != null) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button type="button"${attr_class("chip svelte-1hfcioz", void 0, { "active": value == null })}${attr("aria-pressed", value == null)}>${escape_html(allLabel)}</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <!--[-->`);
    const each_array = ensure_array_like(visible());
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let option = each_array[$$index];
      $$renderer2.push(`<button type="button"${attr_class("chip svelte-1hfcioz", void 0, { "active": value === option.value })}${attr("aria-pressed", value === option.value)}>${escape_html(option.label)}</button>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (hidden() > 0 || expanded) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button type="button" class="chip more svelte-1hfcioz"${attr("aria-expanded", expanded)}>${escape_html(expandLabel(hidden()))}</button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  FilterChips as F
};
