import { ab as attr, a4 as attr_class, a6 as stringify } from './index.js-D7taQuDv.js';
import { S as Spinner } from './Button.js-B1j4uOxB.js';

/* empty css                                       */
function Toggle($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      checked = false,
      disabled = false,
      loading = false,
      size = "md",
      label,
      id,
      onchange
    } = $$props;
    $$renderer2.push(`<button${attr("id", id)} type="button" role="switch"${attr_class(`toggle ${stringify(size)}`, "svelte-14iab8y", { "on": checked })}${attr("aria-checked", checked)}${attr("aria-label", label)}${attr("aria-busy", loading)}${attr("disabled", disabled || loading, true)}><span class="track svelte-14iab8y" aria-hidden="true"><span class="thumb svelte-14iab8y">`);
    if (loading) {
      $$renderer2.push("<!--[0-->");
      Spinner($$renderer2, { size: "sm", label: "" });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></span></span></button>`);
  });
}

export { Toggle as T };
//# sourceMappingURL=Toggle.js-C9kgBFq2.js.map
