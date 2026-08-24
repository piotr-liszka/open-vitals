import { t as toasts } from '../../chunks/toast.js-D9a9Yw3o.js';
import { a7 as ensure_array_like, a8 as store_get, a9 as unsubscribe_stores } from '../../chunks/index.js-D7taQuDv.js';
import { T as Toast } from '../../chunks/Toast2.js-CKqkRMyy.js';
import '../../chunks/exports.js-aFGE3YQF.js';
import '../../chunks/utils2.js-BQzn9ikS.js';
import '../../chunks/utils.js-D6eaf5bT.js';
import '../../chunks/root.js-DLPDgkXe.js';
import '../../chunks/client.js-C1MYAKQX.js';
import '../../chunks/client2.js-DKEBrJ7O.js';
import '../../chunks/uneval.js-BnYgIxRU.js';

function ToastContainer($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    $$renderer2.push(`<div class="toast-container svelte-j4toak" aria-live="polite"><!--[-->`);
    const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$toasts", toasts));
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let toast = each_array[$$index];
      Toast($$renderer2, {
        tone: toast.tone,
        message: toast.message,
        ondismiss: () => toasts.dismiss(toast.id)
      });
    }
    $$renderer2.push(`<!--]--></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function _layout($$renderer, $$props) {
  let { children } = $$props;
  children?.($$renderer);
  $$renderer.push(`<!----> `);
  ToastContainer($$renderer);
  $$renderer.push(`<!---->`);
}

export { _layout as default };
//# sourceMappingURL=_layout.svelte.js-85VAvFD9.js.map
