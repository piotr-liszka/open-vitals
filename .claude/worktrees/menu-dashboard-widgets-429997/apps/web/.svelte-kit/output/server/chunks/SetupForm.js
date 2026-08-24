import { e as escape_html } from "./index.js";
import "@sveltejs/kit/internal";
import "./exports.js";
import "./utils2.js";
import "@sveltejs/kit/internal/server";
import "./root.js";
import "./client.js";
import { B as Button } from "./Button.js";
/* empty css                                   */
import { I as Input } from "./Input.js";
import { F as Field } from "./Field.js";
/* empty css                                    */
/* empty css                                               */
/* empty css                                       */
/* empty css                                          */
import "./toast.js";
/* empty css                                       */
/* empty css                                         */
/* empty css                                         */
/* empty css                                         */
/* empty css                                    */
/* empty css                                         */
import "./client2.js";
function SetupForm($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { onConnected } = $$props;
    let email = "";
    let password = "";
    let mfaRequired = false;
    let submitting = false;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<form novalidate="" class="svelte-yci2kr">`);
      {
        let children = function($$renderer4, control) {
          Input($$renderer4, {
            id: control.id,
            type: "email",
            autocomplete: "username",
            placeholder: "ty@example.com",
            disabled: mfaRequired,
            get value() {
              return email;
            },
            set value($$value) {
              email = $$value;
              $$settled = false;
            }
          });
        };
        Field($$renderer3, { label: "E-mail Garmin", children });
      }
      $$renderer3.push(`<!----> `);
      {
        let children = function($$renderer4, control) {
          Input($$renderer4, {
            id: control.id,
            type: "password",
            autocomplete: "current-password",
            placeholder: "Twoje hasło do Garmin Connect",
            disabled: mfaRequired,
            get value() {
              return password;
            },
            set value($$value) {
              password = $$value;
              $$settled = false;
            }
          });
        };
        Field($$renderer3, { label: "Hasło Garmin", children });
      }
      $$renderer3.push(`<!----> `);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> <div class="row svelte-yci2kr">`);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      Button($$renderer3, {
        type: "submit",
        variant: "primary",
        loading: submitting,
        disabled: email.length === 0 || password.length === 0 || mfaRequired,
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->${escape_html("Połącz Garmina")}`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----></div></form>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
export {
  SetupForm as S
};
