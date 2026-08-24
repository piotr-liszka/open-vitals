import { af as head, a5 as escape_html, Q as derived, a8 as store_get, a9 as unsubscribe_stores } from '../../../chunks/index.js-D7taQuDv.js';
import { p as page } from '../../../chunks/stores.js-pwimOGzR.js';
import { B as Button } from '../../../chunks/Button.js-B1j4uOxB.js';
import { C as Card } from '../../../chunks/Card.js-D8ZxuUNK.js';
import '../../../chunks/toast.js-D9a9Yw3o.js';
import { T as ThemeToggle } from '../../../chunks/ThemeToggle.js-T-urDE0b.js';
import '../../../chunks/exports.js-aFGE3YQF.js';
import '../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../chunks/utils.js-D6eaf5bT.js';
import '../../../chunks/root.js-DLPDgkXe.js';
import '../../../chunks/client.js-C1MYAKQX.js';
import '../../../chunks/client2.js-DKEBrJ7O.js';
import '../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../chunks/RangeBadge.js-CR-NnSex.js';
import '../../../chunks/Icon.js-D5N4FEG5.js';

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

export { _page as default };
//# sourceMappingURL=_page.svelte.js-4P6be3ti.js.map
