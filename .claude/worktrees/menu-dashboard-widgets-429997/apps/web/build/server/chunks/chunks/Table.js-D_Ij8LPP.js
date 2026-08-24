import { a4 as attr_class, a5 as escape_html } from './index.js-D7taQuDv.js';

/* empty css                                    */
function Table($$renderer, $$props) {
  let { head, children, zebra = false, caption } = $$props;
  $$renderer.push(`<div class="table-wrap svelte-1yer0de"><table${attr_class("table svelte-1yer0de", void 0, { "zebra": zebra })}>`);
  if (caption) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<caption class="svelte-1yer0de">${escape_html(caption)}</caption>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]-->`);
  if (head) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<thead><tr>`);
    head($$renderer);
    $$renderer.push(`<!----></tr></thead>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--><tbody>`);
  children?.($$renderer);
  $$renderer.push(`<!----></tbody></table></div>`);
}

export { Table as T };
//# sourceMappingURL=Table.js-D_Ij8LPP.js.map
