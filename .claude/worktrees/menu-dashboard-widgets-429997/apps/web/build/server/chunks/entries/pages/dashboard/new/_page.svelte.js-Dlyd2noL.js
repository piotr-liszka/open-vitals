import { af as head, a5 as escape_html, Q as derived } from '../../../../chunks/index.js-D7taQuDv.js';
import '../../../../chunks/toast.js-D9a9Yw3o.js';
import '../../../../chunks/exports.js-aFGE3YQF.js';
import '../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../chunks/utils.js-D6eaf5bT.js';
import '../../../../chunks/root.js-DLPDgkXe.js';
import '../../../../chunks/client.js-C1MYAKQX.js';
import '../../../../chunks/client2.js-DKEBrJ7O.js';
import { A as AppShell } from '../../../../chunks/AppShell.js-Dxd-FjMr.js';
import { S as SyncFooter } from '../../../../chunks/SyncFooter.js-VTNqeJEz.js';
import { B as Button } from '../../../../chunks/Button.js-B1j4uOxB.js';
import { C as Card } from '../../../../chunks/Card.js-D8ZxuUNK.js';
import { F as Field } from '../../../../chunks/Field.js-C_UPfDr-.js';
import { I as Input } from '../../../../chunks/Input.js-Bx-2KbvO.js';
import { M as MAX_DASHBOARD_NAME } from '../../../../chunks/dashboards.types.js-BpwEQDmq.js';
import '../../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../../chunks/Icon.js-D5N4FEG5.js';
import '../../../../chunks/ThemeToggle.js-T-urDE0b.js';
import '../../../../chunks/index2.js-DFeLIU8S.js';
import '../../../../chunks/SegmentedControl.js-vIk-Z1KL.js';
import '../../../../chunks/range.js-VDtVJAwH.js';
import '../../../../chunks/date.js-Cf0GyZI8.js';
import '../../../../chunks/stores.js-pwimOGzR.js';
import '../../../../chunks/RangeBadge.js-CR-NnSex.js';

function DashboardCreate($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let name = "";
    const trimmed = derived(() => name.trim());
    const canSubmit = derived(() => trimmed().length > 0 && true);
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<div class="wrap svelte-j3y4jj">`);
      Card($$renderer3, {
        children: ($$renderer4) => {
          $$renderer4.push(`<form><h2 class="title svelte-j3y4jj">Nowy panel</h2> <p class="lead svelte-j3y4jj">Panel to Twój własny zestaw widgetów. Widgety dodasz na następnym ekranie.</p> `);
          {
            let children = function($$renderer5, control) {
              Input($$renderer5, {
                id: control.id,
                "aria-describedby": control.describedBy,
                maxlength: MAX_DASHBOARD_NAME,
                placeholder: "np. Plan startowy",
                autocomplete: "off",
                get value() {
                  return name;
                },
                set value($$value) {
                  name = $$value;
                  $$settled = false;
                }
              });
            };
            Field($$renderer4, {
              label: "Nazwa panelu",
              help: "Pojawi się w menu. Możesz ją później zmienić.",
              children
            });
          }
          $$renderer4.push(`<!----> <div class="actions svelte-j3y4jj">`);
          Button($$renderer4, {
            type: "button",
            size: "sm",
            variant: "ghost",
            onclick: () => history.back(),
            children: ($$renderer5) => {
              $$renderer5.push(`<!---->Anuluj`);
            },
            $$slots: { default: true }
          });
          $$renderer4.push(`<!----> `);
          Button($$renderer4, {
            type: "submit",
            size: "sm",
            variant: "primary",
            disabled: !canSubmit(),
            children: ($$renderer5) => {
              $$renderer5.push(`<!---->${escape_html("Utwórz panel")}`);
            },
            $$slots: { default: true }
          });
          $$renderer4.push(`<!----></div></form>`);
        }
      });
      $$renderer3.push(`<!----></div>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    head("5ygav6", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Nowy panel · Vagus</title>`);
      });
    });
    {
      let footer = function($$renderer3) {
        SyncFooter($$renderer3);
      };
      AppShell($$renderer2, {
        title: "Nowy panel",
        tier: "advanced",
        advanced: true,
        range: "off",
        footer,
        children: ($$renderer3) => {
          DashboardCreate($$renderer3, { config: data.config });
        }
      });
    }
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte.js-Dlyd2noL.js.map
