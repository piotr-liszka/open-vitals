import { p as props_id, d as attr_style, c as attr, f as stringify, g as derived } from "./index.js";
/* empty css                                       */
function Sparkline($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      values,
      color = "var(--color-accent)",
      height = 40,
      label,
      showArea = false,
      baseline
    } = $$props;
    const W = 100;
    const revealId = `spark-reveal-${uid}`;
    const clean = derived(() => values.filter((v) => Number.isFinite(v)));
    const n = derived(() => clean().length);
    const latest = derived(() => n() > 0 ? clean()[n() - 1] : void 0);
    const padTop = derived(() => height * 0.14);
    const padBottom = derived(() => height * 0.14);
    const plotH = derived(() => Math.max(0, height - padTop() - padBottom()));
    const domain = derived(() => {
      const pool = baseline === void 0 ? clean() : [...clean(), baseline];
      const min = Math.min(...pool);
      const max = Math.max(...pool);
      return { min, max, flat: max === min };
    });
    function x(i) {
      return n() <= 1 ? W / 2 : i / (n() - 1) * W;
    }
    function y(v) {
      if (domain().flat) return padTop() + plotH() / 2;
      const t = (v - domain().min) / (domain().max - domain().min);
      return padTop() + (1 - t) * plotH();
    }
    const points = derived(() => clean().map((v, i) => ({ x: x(i), y: y(v) })));
    const linePath = derived(() => points().map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" "));
    const first = derived(() => points()[0] ?? { x: 0, y: height / 2 });
    const last = derived(() => points()[points().length - 1] ?? { x: W / 2, y: height / 2 });
    const areaPath = derived(() => points().length > 1 ? `${linePath()} L${last().x.toFixed(2)},${height} L${first().x.toFixed(2)},${height} Z` : "");
    const baselineY = derived(() => baseline === void 0 ? void 0 : y(baseline));
    const dotPath = derived(() => `M${last().x.toFixed(2)},${last().y.toFixed(2)} L${last().x.toFixed(2)},${last().y.toFixed(2)}`);
    const summary = derived(() => {
      const prefix = label ? `${label} trend` : "trend";
      if (n() === 0) return `${prefix}, no data`;
      return `${prefix}, ${n()} point${n() === 1 ? "" : "s"}, latest ${latest().toLocaleString()}`;
    });
    if (n() === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<svg class="spark svelte-8jognx"${attr_style(`--spark-color: ${stringify(color)}; height: ${stringify(height)}px;`)}${attr("viewBox", `0 0 100 ${stringify(height)}`)} preserveAspectRatio="none" role="img"${attr("aria-label", summary())}><line class="placeholder svelte-8jognx" x1="0"${attr("y1", height / 2)}${attr("x2", W)}${attr("y2", height / 2)} vector-effect="non-scaling-stroke"></line></svg>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<svg class="spark svelte-8jognx"${attr_style(`--spark-color: ${stringify(color)}; height: ${stringify(height)}px;`)}${attr("viewBox", `0 0 100 ${stringify(height)}`)} preserveAspectRatio="none" role="img"${attr("aria-label", summary())}>`);
      if (baselineY() !== void 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<line class="baseline svelte-8jognx" x1="0"${attr("y1", baselineY())}${attr("x2", W)}${attr("y2", baselineY())} vector-effect="non-scaling-stroke"></line>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
      if (showArea && areaPath()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<path class="area svelte-8jognx"${attr("d", areaPath())}></path>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
      if (points().length > 1) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<defs><clipPath${attr("id", revealId)} clipPathUnits="userSpaceOnUse"><rect class="reveal svelte-8jognx" x="0" y="0"${attr("width", W)}${attr("height", height)}></rect></clipPath></defs><g${attr("clip-path", `url(#${revealId})`)}><path class="line svelte-8jognx"${attr("d", linePath())} vector-effect="non-scaling-stroke"></path></g>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--><path class="dot svelte-8jognx"${attr("d", dotPath())} vector-effect="non-scaling-stroke" fill="none"></path></svg>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  Sparkline as S
};
