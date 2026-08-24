import { e as escape_html } from "./index.js";
import { B as Button } from "./Button.js";
import "./toast.js";
function ConfirmDialog($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      open,
      title,
      body,
      confirmLabel = "Usuń",
      cancelLabel = "Anuluj",
      onconfirm,
      oncancel
    } = $$props;
    $$renderer2.push(`<dialog class="confirm svelte-1ohlqe6" aria-labelledby="confirm-title"><h2 class="title svelte-1ohlqe6" id="confirm-title">${escape_html(
      /*
       * `showModal()` is a method, not an attribute, so the open prop has to be driven into the element.
       * Guarded on `el.open` because calling `showModal()` on an already-open dialog throws.
       */
      title
    )}</h2> <p class="body svelte-1ohlqe6">${escape_html(body)}</p> <div class="actions svelte-1ohlqe6">`);
    Button($$renderer2, {
      size: "sm",
      variant: "secondary",
      onclick: oncancel,
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->${escape_html(cancelLabel)}`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    Button($$renderer2, {
      size: "sm",
      variant: "danger",
      onclick: onconfirm,
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->${escape_html(confirmLabel)}`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----></div></dialog>`);
  });
}
export {
  ConfirmDialog as C
};
