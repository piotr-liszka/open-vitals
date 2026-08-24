import { ah as attributes, j as clsx, ai as bind_props, g as derived } from "./index.js";
import "./toast.js";
function Input($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      value = "",
      invalid = false,
      type = "text",
      class: className = "",
      $$slots,
      $$events,
      ...rest
    } = $$props;
    const classes = derived(() => ["input", className].filter((c) => c).join(" "));
    $$renderer2.push(`<input${attributes(
      {
        class: clsx(classes()),
        type,
        value,
        "aria-invalid": invalid ? "true" : void 0,
        ...rest
      },
      "svelte-1wwkhju",
      { invalid },
      void 0,
      4
    )}/>`);
    bind_props($$props, { value });
  });
}
export {
  Input as I
};
