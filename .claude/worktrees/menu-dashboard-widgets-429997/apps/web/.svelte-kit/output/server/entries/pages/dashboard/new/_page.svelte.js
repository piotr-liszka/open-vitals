import { e as escape_html, g as derived, h as head } from "../../../../chunks/index.js";
import "../../../../chunks/toast.js";
/* empty css                                                    */
/* empty css                                                     */
/* empty css                                                                */
/* empty css                                                        */
/* empty css                                                           */
/* empty css                                                        */
/* empty css                                                          */
/* empty css                                                          */
/* empty css                                                          */
/* empty css                                                     */
/* empty css                                                          */
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/client.js";
import "../../../../chunks/client2.js";
import { A as AppShell } from "../../../../chunks/AppShell.js";
import { S as SyncFooter } from "../../../../chunks/SyncFooter.js";
import { B as Button } from "../../../../chunks/Button.js";
import { C as Card } from "../../../../chunks/Card.js";
import { F as Field } from "../../../../chunks/Field.js";
import { I as Input } from "../../../../chunks/Input.js";
import { M as MAX_DASHBOARD_NAME } from "../../../../chunks/dashboards.types.js";
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
export {
  _page as default
};
