import { ab as attr, a6 as stringify, ag as attr_style, a7 as ensure_array_like, a4 as attr_class, a5 as escape_html, Q as derived } from './index.js-D7taQuDv.js';

/* empty css                                         */
function RadarChart($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      axes,
      ariaLabel,
      radius = 90,
      labelSpace,
      color = "var(--color-accent)",
      levels = [0.25, 0.5, 0.75, 1]
    } = $$props;
    const PAD_Y = 26;
    const LABEL_R = 1.14;
    const LABEL_CH = 7;
    const MIN_LABEL_SPACE = 96;
    const autoLabelSpace = derived(() => Math.max(MIN_LABEL_SPACE, ...axes.map((axis, i) => {
      const angle = -Math.PI / 2 + i / Math.max(1, axes.length) * Math.PI * 2;
      const width = axis.label.length * LABEL_CH;
      const reach = Math.abs(Math.cos(angle)) < 0.05 ? width / 2 : width;
      return reach + LABEL_R * radius * Math.abs(Math.cos(angle)) - radius + 4;
    })));
    const gutter = derived(() => labelSpace ?? autoLabelSpace());
    const cx = derived(() => gutter() + radius);
    const cy = derived(() => PAD_Y + radius);
    const boxW = derived(() => 2 * (gutter() + radius));
    const boxH = derived(() => 2 * (PAD_Y + radius));
    const clamp01 = (n) => n < 0 ? 0 : n > 1 ? 1 : n;
    function point(i, frac) {
      const angle = -Math.PI / 2 + i / Math.max(1, axes.length) * Math.PI * 2;
      return {
        x: cx() + Math.cos(angle) * radius * frac,
        y: cy() + Math.sin(angle) * radius * frac
      };
    }
    const fmt = (p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    function ringPoints(level) {
      return axes.map((_, i) => fmt(point(i, level))).join(" ");
    }
    const plotted = derived(() => axes.map((a, i) => a.value == null ? null : point(i, clamp01(a.value))).filter((p) => p !== null));
    const polygon = derived(() => plotted().length >= 3 ? plotted().map(fmt).join(" ") : "");
    function labelPos(i) {
      const p = point(i, 1.14);
      return {
        x: p.x,
        y: p.y,
        anchor: p.x < cx() - 4 ? "end" : p.x > cx() + 4 ? "start" : "middle"
      };
    }
    $$renderer2.push(`<svg class="radar svelte-14w5bli"${attr("viewBox", `0 0 ${stringify(boxW())} ${stringify(boxH())}`)}${attr_style(`--radar-color: ${color}; --radar-max: ${boxW()}px`)} role="img"${attr("aria-label", ariaLabel)}><!--[-->`);
    const each_array = ensure_array_like(levels);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let level = each_array[$$index];
      $$renderer2.push(`<polygon class="ring svelte-14w5bli"${attr("points", ringPoints(level))}></polygon>`);
    }
    $$renderer2.push(`<!--]--><!--[-->`);
    const each_array_1 = ensure_array_like(axes);
    for (let i = 0, $$length = each_array_1.length; i < $$length; i++) {
      let axis = each_array_1[i];
      const end = point(i, 1);
      const label = labelPos(i);
      $$renderer2.push(`<line${attr_class("spoke svelte-14w5bli", void 0, { "missing": axis.value == null })}${attr("x1", cx())}${attr("y1", cy())}${attr("x2", end.x)}${attr("y2", end.y)}></line><text${attr_class("label svelte-14w5bli", void 0, { "missing": axis.value == null })}${attr("x", label.x)}${attr("y", label.y)}${attr("text-anchor", label.anchor)}>${escape_html(axis.label)}</text>`);
    }
    $$renderer2.push(`<!--]-->`);
    if (polygon()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<polygon class="shape svelte-14w5bli"${attr("points", polygon())}></polygon><!--[-->`);
      const each_array_2 = ensure_array_like(plotted());
      for (let i = 0, $$length = each_array_2.length; i < $$length; i++) {
        let p = each_array_2[i];
        $$renderer2.push(`<circle class="vertex svelte-14w5bli"${attr("cx", p.x)}${attr("cy", p.y)} r="2.6"></circle>`);
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></svg>`);
  });
}

export { RadarChart as R };
//# sourceMappingURL=RadarChart.js-BEKlea-O.js.map
