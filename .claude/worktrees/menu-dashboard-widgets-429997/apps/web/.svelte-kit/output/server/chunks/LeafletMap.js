import { d as attr_style, c as attr, f as stringify } from "./index.js";
function LeafletMap($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      polylines = [],
      markers = [],
      interactive = true,
      height = "360px",
      ariaLabel = "Mapa aktywności"
    } = $$props;
    $$renderer2.push(`<div class="map svelte-ybht0l"${attr_style(`height: ${stringify(
      // Redraw when inputs change after mount.
      height
    )};`)} role="img"${attr("aria-label", ariaLabel)}></div>`);
  });
}
export {
  LeafletMap as L
};
