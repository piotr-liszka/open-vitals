import { a4 as attr_class, ab as attr, ag as attr_style, a6 as stringify, Q as derived } from './index.js-D7taQuDv.js';

/* empty css                                       */
function Skeleton($$renderer, $$props) {
  let {
    width = "100%",
    height = "var(--space-4)",
    radius = "sm",
    circle = false
  } = $$props;
  const dimension = derived(() => circle ? height : width);
  $$renderer.push(`<span${attr_class("skeleton svelte-19vyxbv", void 0, { "circle": circle })}${attr("data-radius", radius)} aria-hidden="true"${attr_style(`--sk-w: ${stringify(dimension())}; --sk-h: ${stringify(height)};`)}></span>`);
}

export { Skeleton as S };
//# sourceMappingURL=Skeleton.js-CIiszAAg.js.map
