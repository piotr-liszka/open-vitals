import { ab as attr, a5 as escape_html, Q as derived } from './index.js-D7taQuDv.js';
import './toast.js-D9a9Yw3o.js';

let uidSeq = 0;
function Field($$renderer, $$props) {
  let { label, id, error, help, required = false, children } = $$props;
  const fallbackId = `gb-field-${uidSeq += 1}`;
  const controlId = derived(() => id ?? fallbackId);
  const errorId = derived(() => `${controlId()}-error`);
  const helpId = derived(() => `${controlId()}-help`);
  const describedBy = derived(() => error ? errorId() : help ? helpId() : void 0);
  const control = derived(() => ({
    id: controlId(),
    describedBy: describedBy(),
    invalid: Boolean(error)
  }));
  $$renderer.push(`<div class="field svelte-sa3gfm"><label class="label svelte-sa3gfm"${attr("for", controlId())}>${escape_html(label)} `);
  if (required) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<span class="req svelte-sa3gfm" aria-hidden="true">*</span>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></label> `);
  children($$renderer, control());
  $$renderer.push(`<!----> `);
  if (error) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<p class="error svelte-sa3gfm"${attr("id", errorId())} role="alert">${escape_html(error)}</p>`);
  } else if (help) {
    $$renderer.push("<!--[1-->");
    $$renderer.push(`<p class="help svelte-sa3gfm"${attr("id", helpId())}>${escape_html(help)}</p>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></div>`);
}

export { Field as F };
//# sourceMappingURL=Field.js-C_UPfDr-.js.map
