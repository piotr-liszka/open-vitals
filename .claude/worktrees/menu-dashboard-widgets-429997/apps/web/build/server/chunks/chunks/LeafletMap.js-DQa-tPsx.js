import { ag as attr_style, a6 as stringify, ab as attr } from './index.js-D7taQuDv.js';

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

export { LeafletMap as L };
//# sourceMappingURL=LeafletMap.js-DQa-tPsx.js.map
