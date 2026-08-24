import { b as attr_class, e as escape_html, f as stringify, ah as attributes, j as clsx, g as derived } from "./index.js";
import "./toast.js";
function Spinner($$renderer, $$props) {
  let { size = "md", label = "Ładowanie" } = $$props;
  $$renderer.push(`<span${attr_class(`spinner ${stringify(size)}`, "svelte-mfr6of")} role="status" aria-live="polite"><span class="ring svelte-mfr6of" aria-hidden="true"></span> <span class="sr-only svelte-mfr6of">${escape_html(label)}</span></span>`);
}
function Button($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      variant = "primary",
      size = "md",
      loading = false,
      disabled = false,
      type = "button",
      class: className = "",
      children,
      $$slots,
      $$events,
      ...rest
    } = $$props;
    const classes = derived(() => ["btn", variant, size, className].filter((c) => c).join(" "));
    $$renderer2.push(`<button${attributes(
      {
        class: clsx(classes()),
        type,
        disabled: disabled || loading,
        "aria-busy": loading,
        ...rest
      },
      "svelte-g9c1iq",
      { "is-loading": loading }
    )}>`);
    if (loading) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="spin svelte-g9c1iq" aria-hidden="true">`);
      Spinner($$renderer2, { size: "sm", label: "" });
      $$renderer2.push(`<!----></span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <span class="label svelte-g9c1iq">`);
    children?.($$renderer2);
    $$renderer2.push(`<!----></span></button>`);
  });
}
export {
  Button as B,
  Spinner as S
};
