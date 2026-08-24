import { c as attr, e as escape_html, g as derived } from "./index.js";
/* empty css                                       */
function ThemeToggle($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let theme = "light";
    const isDark = derived(() => theme === "dark");
    $$renderer2.push(`<button type="button" class="theme-toggle svelte-1ihlba3" role="switch"${attr("aria-checked", isDark())} aria-label="Toggle dark mode"${attr("title", isDark() ? "Switch to light mode" : "Switch to dark mode")}><span class="glyph svelte-1ihlba3" aria-hidden="true">${escape_html(isDark() ? "☾" : "☀")}</span></button>`);
  });
}
export {
  ThemeToggle as T
};
