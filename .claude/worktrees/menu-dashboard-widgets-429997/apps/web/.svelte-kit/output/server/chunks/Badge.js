import { b as attr_class, f as stringify } from "./index.js";
/* empty css                                    */
function Badge($$renderer, $$props) {
  let { tone = "neutral", dot = true, children } = $$props;
  $$renderer.push(`<span${attr_class(`badge ${stringify(tone)}`, "svelte-eex7hx")}>`);
  if (dot) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<span class="dot svelte-eex7hx" aria-hidden="true"></span>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--> `);
  children?.($$renderer);
  $$renderer.push(`<!----></span>`);
}
export {
  Badge as B
};
