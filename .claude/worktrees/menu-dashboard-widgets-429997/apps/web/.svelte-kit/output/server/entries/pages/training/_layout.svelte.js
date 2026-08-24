import { h as head, g as derived, e as escape_html, s as store_get, u as unsubscribe_stores } from "../../../chunks/index.js";
import { p as page } from "../../../chunks/stores.js";
import "../../../chunks/toast.js";
/* empty css                                                 */
/* empty css                                                  */
/* empty css                                                             */
import { S as SubNav } from "../../../chunks/SubNav.js";
/* empty css                                                        */
/* empty css                                                     */
/* empty css                                                     */
/* empty css                                                       */
/* empty css                                                       */
/* empty css                                                       */
/* empty css                                                  */
/* empty css                                                       */
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/client.js";
import "../../../chunks/client2.js";
import { A as AppShell } from "../../../chunks/AppShell.js";
import { S as SyncFooter } from "../../../chunks/SyncFooter.js";
import { a as trainingTitle } from "../../../chunks/training-nav.js";
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { data, children } = $$props;
    const title = derived(() => trainingTitle(store_get($$store_subs ??= {}, "$page", page).url.pathname));
    head("9riexk", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(title())} · Vagus</title>`);
      });
    });
    {
      let footer = function($$renderer3) {
        SyncFooter($$renderer3);
      };
      AppShell($$renderer2, {
        advanced: true,
        title: title(),
        tier: "advanced",
        footer,
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="section svelte-9riexk">`);
          if (data.tabs.length > 1) {
            $$renderer3.push("<!--[0-->");
            SubNav($$renderer3, {
              items: data.tabs,
              current: store_get($$store_subs ??= {}, "$page", page).url.pathname,
              ariaLabel: "Sekcja treningu"
            });
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> `);
          children($$renderer3);
          $$renderer3.push(`<!----></div>`);
        }
      });
    }
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _layout as default
};
