import { af as head, Q as derived, a8 as store_get, a5 as escape_html, a9 as unsubscribe_stores } from '../../../chunks/index.js-D7taQuDv.js';
import { p as page } from '../../../chunks/stores.js-pwimOGzR.js';
import '../../../chunks/toast.js-D9a9Yw3o.js';
import { S as SubNav } from '../../../chunks/SubNav.js-Bt3ew81m.js';
import '../../../chunks/exports.js-aFGE3YQF.js';
import '../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../chunks/utils.js-D6eaf5bT.js';
import '../../../chunks/root.js-DLPDgkXe.js';
import '../../../chunks/client.js-C1MYAKQX.js';
import '../../../chunks/client2.js-DKEBrJ7O.js';
import { A as AppShell } from '../../../chunks/AppShell.js-Dxd-FjMr.js';
import { S as SyncFooter } from '../../../chunks/SyncFooter.js-VTNqeJEz.js';
import { a as trainingTitle } from '../../../chunks/training-nav.js-D-TPJLDl.js';
import '../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../chunks/Icon.js-D5N4FEG5.js';
import '../../../chunks/Button.js-B1j4uOxB.js';
import '../../../chunks/ThemeToggle.js-T-urDE0b.js';
import '../../../chunks/index2.js-DFeLIU8S.js';
import '../../../chunks/SegmentedControl.js-vIk-Z1KL.js';
import '../../../chunks/range.js-VDtVJAwH.js';
import '../../../chunks/date.js-Cf0GyZI8.js';
import '../../../chunks/sport-labels.js-BKqMzU19.js';

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

export { _layout as default };
//# sourceMappingURL=_layout.svelte.js-OktbWXhI.js.map
