import { a4 as attr_class, a5 as escape_html, a6 as stringify } from './index.js-D7taQuDv.js';

/* empty css                                       */
function Toast($$renderer, $$props) {
  let { tone = "info", message, ondismiss } = $$props;
  const icons = { success: "✓", error: "✕", info: "ℹ" };
  $$renderer.push(`<div${attr_class(`toast ${stringify(tone)}`, "svelte-1fk2ial")} role="status" aria-live="polite"><span class="glyph svelte-1fk2ial" aria-hidden="true">${escape_html(icons[tone])}</span> <span class="message svelte-1fk2ial">${escape_html(message)}</span> `);
  if (ondismiss) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<button type="button" class="dismiss svelte-1fk2ial" aria-label="Dismiss notification">✕</button>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></div>`);
}

export { Toast as T };
//# sourceMappingURL=Toast2.js-CKqkRMyy.js.map
