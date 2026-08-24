import { b as attr_class, c as attr, e as escape_html, g as derived, f as stringify } from "./index.js";
import "./toast.js";
function Banner($$renderer, $$props) {
  let { tone = "info", title, children, actions } = $$props;
  const live = derived(() => tone === "danger" || tone === "warning" ? "assertive" : "polite");
  const role = derived(() => tone === "danger" || tone === "warning" ? "alert" : "status");
  $$renderer.push(`<div${attr_class(`banner ${stringify(tone)}`, "svelte-i0iz3s")}${attr("role", role())}${attr("aria-live", live())}><span class="dot svelte-i0iz3s" aria-hidden="true"></span> <div class="content svelte-i0iz3s">`);
  if (title) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<p class="title svelte-i0iz3s">${escape_html(title)}</p>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--> `);
  if (children) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<div class="message svelte-i0iz3s">`);
    children($$renderer);
    $$renderer.push(`<!----></div>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></div> `);
  if (actions) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<div class="actions svelte-i0iz3s">`);
    actions($$renderer);
    $$renderer.push(`<!----></div>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></div>`);
}
export {
  Banner as B
};
