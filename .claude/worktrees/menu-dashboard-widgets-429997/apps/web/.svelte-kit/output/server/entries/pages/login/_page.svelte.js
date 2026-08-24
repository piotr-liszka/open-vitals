import { h as head, e as escape_html, g as derived, s as store_get, u as unsubscribe_stores } from "../../../chunks/index.js";
import { p as page } from "../../../chunks/stores.js";
import { B as Button } from "../../../chunks/Button.js";
import { C as Card } from "../../../chunks/Card.js";
import "../../../chunks/toast.js";
/* empty css                                                  */
/* empty css                                                             */
/* empty css                                                     */
/* empty css                                                        */
/* empty css                                                     */
/* empty css                                                 */
/* empty css                                                       */
/* empty css                                                       */
/* empty css                                                       */
/* empty css                                                  */
import { T as ThemeToggle } from "../../../chunks/ThemeToggle.js";
/* empty css                                                       */
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/client.js";
import "../../../chunks/client2.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const error = derived(() => store_get($$store_subs ??= {}, "$page", page).url.searchParams.get("error"));
    function signIn() {
      location.href = "/auth/login";
    }
    head("1x05zx6", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Zaloguj się · Vagus</title>`);
      });
    });
    $$renderer2.push(`<div class="page svelte-1x05zx6"><div class="corner svelte-1x05zx6">`);
    ThemeToggle($$renderer2);
    $$renderer2.push(`<!----></div> <div class="panel svelte-1x05zx6"><div class="brand svelte-1x05zx6"><span class="dot svelte-1x05zx6" aria-hidden="true"></span> <span class="name svelte-1x05zx6">Vagus</span></div> `);
    Card($$renderer2, {
      title: "Zaloguj się",
      subtitle: "Podłącz swoje dane z Garmina do narzędzi AI",
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="body svelte-1x05zx6">`);
        if (error()) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<p class="error svelte-1x05zx6" role="alert">${escape_html(error())}</p>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        Button($$renderer3, {
          variant: "primary",
          onclick: signIn,
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->Kontynuuj z Google`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----> <p class="hint svelte-1x05zx6">Nie potrzebujesz konta — logowanie przez Google rejestruje Cię i tworzy Twoją prywatną przestrzeń.</p></div>`);
      }
    });
    $$renderer2.push(`<!----></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
