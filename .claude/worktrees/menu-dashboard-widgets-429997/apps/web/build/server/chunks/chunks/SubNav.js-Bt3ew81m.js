import { ab as attr, a7 as ensure_array_like, a4 as attr_class, a5 as escape_html } from './index.js-D7taQuDv.js';

/* empty css                                       */
function SubNav($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { items, current, ariaLabel } = $$props;
    const numbers = new Intl.NumberFormat("pl-PL");
    const pathOf = (href) => href.split("?", 1)[0] ?? href;
    $$renderer2.push(`<nav class="subnav svelte-1lr2dsn"${attr("aria-label", ariaLabel)}><ul class="track svelte-1lr2dsn"><!--[-->`);
    const each_array = ensure_array_like(items);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let item = each_array[$$index];
      const active = pathOf(item.href) === pathOf(current);
      $$renderer2.push(`<li><a${attr_class("tab svelte-1lr2dsn", void 0, { "active": active })}${attr("href", item.href)}${attr("aria-current", active ? "page" : void 0)}><span class="label">${escape_html(item.label)}</span> `);
      if (item.count !== void 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="count svelte-1lr2dsn">${escape_html(numbers.format(item.count))}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></a></li>`);
    }
    $$renderer2.push(`<!--]--></ul></nav>`);
  });
}

export { SubNav as S };
//# sourceMappingURL=SubNav.js-Bt3ew81m.js.map
