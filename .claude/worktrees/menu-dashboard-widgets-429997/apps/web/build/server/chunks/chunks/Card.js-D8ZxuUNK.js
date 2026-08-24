import { a5 as escape_html, Q as derived } from './index.js-D7taQuDv.js';
import { R as RangeBadge } from './RangeBadge.js-CR-NnSex.js';

/* empty css                                   */
function Card($$renderer, $$props) {
  let { title, subtitle, actions, range, rangeBucketNoun, children } = $$props;
  const hasHeader = derived(() => Boolean(title || subtitle || actions || range));
  $$renderer.push(`<section class="card svelte-14efj7c">`);
  if (hasHeader()) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<header class="card-header svelte-14efj7c"><div class="titles svelte-14efj7c">`);
    if (title) {
      $$renderer.push("<!--[0-->");
      $$renderer.push(`<h3 class="title svelte-14efj7c">${escape_html(title)}</h3>`);
    } else {
      $$renderer.push("<!--[-1-->");
    }
    $$renderer.push(`<!--]--> `);
    if (subtitle) {
      $$renderer.push("<!--[0-->");
      $$renderer.push(`<p class="subtitle svelte-14efj7c">${escape_html(subtitle)}</p>`);
    } else {
      $$renderer.push("<!--[-1-->");
    }
    $$renderer.push(`<!--]--></div> `);
    if (range || actions) {
      $$renderer.push("<!--[0-->");
      $$renderer.push(`<div class="actions svelte-14efj7c">`);
      if (range) {
        $$renderer.push("<!--[0-->");
        RangeBadge($$renderer, { label: range, bucketNoun: rangeBucketNoun });
      } else {
        $$renderer.push("<!--[-1-->");
      }
      $$renderer.push(`<!--]--> `);
      actions?.($$renderer);
      $$renderer.push(`<!----></div>`);
    } else {
      $$renderer.push("<!--[-1-->");
    }
    $$renderer.push(`<!--]--></header>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--> <div class="card-body svelte-14efj7c">`);
  children?.($$renderer);
  $$renderer.push(`<!----></div></section>`);
}

export { Card as C };
//# sourceMappingURL=Card.js-D8ZxuUNK.js.map
