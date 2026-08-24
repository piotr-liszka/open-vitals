import { t as toasts } from "../../chunks/toast.js";
/* empty css                                              */
/* empty css                                               */
/* empty css                                                          */
/* empty css                                                  */
/* empty css                                                     */
/* empty css                                                  */
/* empty css                                                    */
/* empty css                                                    */
/* empty css                                                    */
/* empty css                                               */
import { a as ensure_array_like, s as store_get, u as unsubscribe_stores } from "../../chunks/index.js";
import { T as Toast } from "../../chunks/Toast2.js";
/* empty css                                                    */
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../chunks/root.js";
import "../../chunks/client.js";
import "../../chunks/client2.js";
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
export {
  _layout as default
};
