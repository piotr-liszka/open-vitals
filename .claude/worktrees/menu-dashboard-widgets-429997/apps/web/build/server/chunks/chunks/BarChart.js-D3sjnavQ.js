import { ag as attr_style, a6 as stringify, ab as attr, a7 as ensure_array_like, a5 as escape_html, a4 as attr_class, ae as bind_props, Q as derived } from './index.js-D7taQuDv.js';
import { C as ChartLegend, A as AXIS_GAP, a as ChartTooltip, n as niceTicks, m as maxTextWidth, b as activeIndex, c as nearestDefinedIndex, d as axisLabelIndices, e as TICK_GAP, t as textAnchorAt, r as resolveSeries, s as seriesLength, f as definedMask, g as formatTickValue } from './TrendChart.js-C2RJO89W.js';

/* empty css                                       */
function BarChart($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      values = [],
      series,
      labels,
      color = "var(--color-accent)",
      height = 140,
      formatValue = (n2) => n2.toLocaleString(),
      formatTick,
      baseline,
      label,
      unit,
      xAxis,
      yAxis = true,
      legend,
      selectedIndex = null,
      onSelect
    } = $$props;
    let radiusPx = 4;
    let axisFont = 12;
    const W = derived(() => 640);
    const resolved = derived(() => resolveSeries(series, { values, name: label ?? "", color }));
    const multi = derived(() => resolved().length > 1);
    let hiddenSeries = [];
    const visible = derived(() => resolved().filter((_, i) => !hiddenSeries.includes(i)));
    function toggleSeries(i) {
      if (hiddenSeries.includes(i)) {
        hiddenSeries = hiddenSeries.filter((h) => h !== i);
        return;
      }
      if (resolved().length - hiddenSeries.length <= 1) return;
      hiddenSeries = [...hiddenSeries, i];
    }
    const n = derived(() => seriesLength(resolved()));
    const defined = derived(() => definedMask(visible(), n()));
    const hasData = derived(() => n() > 0 && defined().some(Boolean));
    const domain = derived(() => {
      const pool = [0];
      if (baseline !== void 0 && Number.isFinite(baseline)) pool.push(baseline);
      for (const s of visible()) for (const v of s.values) if (Number.isFinite(v)) pool.push(v);
      const lo = Math.min(...pool);
      const hi = Math.max(...pool);
      return { lo, hi, span: hi - lo || 1 };
    });
    const showX = derived(() => xAxis ?? (labels !== void 0 && labels.length > 0));
    const showY = derived(() => yAxis);
    const yTicks = derived(() => showY() && hasData() ? niceTicks(domain().lo, domain().hi, 4) : []);
    const yStep = derived(() => yTicks().length > 1 ? (yTicks()[1] ?? 0) - (yTicks()[0] ?? 0) : 1);
    const tickText = derived(() => (v) => (formatTick ?? formatTickValue)(v, yStep()));
    const yTickTexts = derived(() => yTicks().map(tickText()));
    const plotL = derived(() => showY() && yTicks().length > 0 ? maxTextWidth(yTickTexts(), axisFont) + AXIS_GAP * 2 : 0);
    const padR = derived(() => showY() ? AXIS_GAP : 0);
    const plotR = derived(() => Math.max(plotL(), W() - padR()));
    const plotW = derived(() => Math.max(0, plotR() - plotL()));
    const topPad = derived(() => unit && showY() ? axisFont * 2 : axisFont * 1.2);
    const bottomPad = derived(() => showX() ? axisFont * 2 : axisFont * 0.9);
    const plotTop = derived(topPad);
    const plotBottom = derived(() => Math.max(topPad(), height - bottomPad()));
    const plotH = derived(() => Math.max(0, plotBottom() - plotTop()));
    function yOf(v) {
      return plotTop() + (1 - (v - domain().lo) / domain().span) * plotH();
    }
    const zeroY = derived(() => yOf(0));
    const baselineY = derived(() => baseline === void 0 ? void 0 : yOf(baseline));
    const bandW = derived(() => n() > 0 ? plotW() / n() : plotW());
    const groupW = derived(() => bandW() * (visible().length > 1 ? 0.78 : 0.6));
    const slotW = derived(() => visible().length > 0 ? groupW() / visible().length : groupW());
    const barW = derived(() => Math.max(1, slotW() * (visible().length > 1 ? 0.86 : 1)));
    function bandLeft(i) {
      return plotL() + i * bandW();
    }
    function bandCenter(i) {
      return bandLeft(i) + bandW() / 2;
    }
    const bars = derived(() => visible().flatMap((s, si) => s.values.flatMap((v, i) => {
      if (!Number.isFinite(v)) return [];
      const vy = yOf(v);
      const up = v >= 0;
      const x = bandLeft(i) + (bandW() - groupW()) / 2 + si * slotW() + (slotW() - barW()) / 2;
      return [
        {
          key: `${si}:${i}`,
          x,
          y: up ? vy : zeroY(),
          w: barW(),
          h: Math.abs(vy - zeroY()),
          up,
          i,
          color: s.color
        }
      ];
    })));
    function barPath(b) {
      if (b.h <= 0) return "";
      const r = Math.max(0, Math.min(radiusPx, b.w / 2, b.h));
      const { x, y, w, h } = b;
      if (b.up) {
        return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
      }
      return `M${x},${y} L${x},${y + h - r} Q${x},${y + h} ${x + r},${y + h} L${x + w - r},${y + h} Q${x + w},${y + h} ${x + w},${y + h - r} L${x + w},${y} Z`;
    }
    const xLabelW = derived(() => maxTextWidth(labels ?? [], axisFont));
    const xTicks = derived(() => {
      if (!showX() || !labels || n() === 0) return [];
      return axisLabelIndices(labels, n(), bandCenter, xLabelW() + TICK_GAP).flatMap((i) => {
        const text = labels[i];
        if (text === void 0 || text === "") return [];
        const x = bandCenter(i);
        return [{ i, x, text, anchor: textAnchorAt(x, W(), xLabelW()) }];
      });
    });
    const xLabelY = derived(() => plotBottom() + AXIS_GAP + axisFont * 0.8);
    const stats = derived(() => {
      let maxV = -Infinity;
      let minV = Infinity;
      let maxI = -1;
      let minI = -1;
      for (const s of visible()) {
        s.values.forEach((v, i) => {
          if (!Number.isFinite(v)) return;
          if (v > maxV) {
            maxV = v;
            maxI = i;
          }
          if (v < minV) {
            minV = v;
            minI = i;
          }
        });
      }
      if (maxI < 0) return void 0;
      return {
        max: maxV,
        min: minV,
        maxLabel: labels?.[maxI],
        minLabel: labels?.[minI]
      };
    });
    let hoverI = null;
    const activeI = derived(() => {
      const i = activeIndex(hoverI, selectedIndex, n());
      if (i === null) return null;
      const j = nearestDefinedIndex(i, defined());
      return j < 0 ? null : j;
    });
    const activeX = derived(() => activeI() === null ? 0 : bandCenter(activeI()));
    const activeLabel = derived(() => activeI() === null ? void 0 : labels?.[activeI()]);
    const pinned = derived(() => activeI() !== null);
    const activeValues = derived(() => {
      if (activeI() === null) return [];
      return visible().flatMap((s) => {
        const v = s.values[activeI()];
        if (v === void 0 || !Number.isFinite(v)) return [];
        return [{ name: s.name, color: s.color, value: v }];
      });
    });
    const tooltipRows = derived(() => activeValues().map((a) => ({
      label: multi() ? a.name : void 0,
      value: formatValue(a.value),
      color: a.color
    })));
    const readout = derived(() => {
      if (activeI() === null || activeValues().length === 0) return "";
      const head = activeLabel() ? `${activeLabel()}: ` : "";
      const body = activeValues().map((a) => multi() && a.name ? `${a.name} ${formatValue(a.value)}` : formatValue(a.value)).join(", ");
      return `${head}${body}`;
    });
    const legendItems = derived(() => resolved().map((s, i) => {
      const hidden = hiddenSeries.includes(i);
      const v = activeI() === null || hidden ? void 0 : s.values[activeI()];
      return {
        name: s.name,
        color: s.color,
        hidden,
        value: v !== void 0 && Number.isFinite(v) ? formatValue(v) : void 0
      };
    }));
    const showLegend = derived(() => (legend ?? multi()) && resolved().some((s) => s.name !== ""));
    const summary = derived(() => {
      if (n() === 0) return "bar chart, no data";
      const days = `${n()} day${n() === 1 ? "" : "s"}`;
      if (!stats()) return `bar chart, ${days}`;
      const hi = `high ${formatValue(stats().max)}${stats().maxLabel ? ` on ${stats().maxLabel}` : ""}`;
      const lo = `low ${formatValue(stats().min)}${stats().minLabel ? ` on ${stats().minLabel}` : ""}`;
      const who = multi() ? `bar chart, ${resolved().length} series: ${resolved().map((s) => s.name).join(", ")}` : "bar chart";
      return `${who}, ${days}, ${hi}, ${lo}`;
    });
    $$renderer2.push(`<div class="chart-block svelte-f531a3">`);
    if (showLegend()) {
      $$renderer2.push("<!--[0-->");
      ChartLegend($$renderer2, {
        items: legendItems(),
        onToggle: multi() ? toggleSeries : void 0,
        ariaLabel: label ? `${label} series` : "Chart series"
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="chart svelte-f531a3"${attr_style(`--chart-color: ${stringify(visible().length === 1 ? visible()[0]?.color ?? color : color)}; height: ${stringify(height)}px;`)}><svg class="chart-svg svelte-f531a3" width="100%"${attr("height", height)}${attr("viewBox", `0 0 ${stringify(W())} ${stringify(height)}`)} role="img"${attr("aria-label", summary())}${attr("tabindex", hasData() ? 0 : void 0)}>`);
    if (!hasData()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<line class="grid svelte-f531a3" x1="0"${attr("y1", plotBottom())}${attr("x2", W())}${attr("y2", plotBottom())} vector-effect="non-scaling-stroke"></line><text class="empty svelte-f531a3"${attr("x", W() / 2)}${attr("y", height / 2)} text-anchor="middle">No data</text>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      if (showY()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<!--[-->`);
        const each_array = ensure_array_like(yTicks());
        for (let k = 0, $$length = each_array.length; k < $$length; k++) {
          let t = each_array[k];
          $$renderer2.push(`<line class="grid svelte-f531a3"${attr("x1", plotL())}${attr("y1", yOf(t))}${attr("x2", plotR())}${attr("y2", yOf(t))} vector-effect="non-scaling-stroke"></line><text class="axis-tick y svelte-f531a3"${attr("x", plotL() - AXIS_GAP)}${attr("y", yOf(t))} text-anchor="end">${escape_html(yTickTexts()[k])}</text>`);
        }
        $$renderer2.push(`<!--]-->`);
        if (unit) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<text class="axis-unit svelte-f531a3" x="0"${attr("y", plotTop() - AXIS_GAP)} text-anchor="start">${escape_html(unit)}</text>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--><line class="grid zero svelte-f531a3"${attr("x1", plotL())}${attr("y1", zeroY())}${attr("x2", plotR())}${attr("y2", zeroY())} vector-effect="non-scaling-stroke"></line>`);
      if (baselineY() !== void 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<line class="baseline svelte-f531a3"${attr("x1", plotL())}${attr("y1", baselineY())}${attr("x2", plotR())}${attr("y2", baselineY())} vector-effect="non-scaling-stroke"></line>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
      if (activeI() !== null) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<rect${attr_class("band svelte-f531a3", void 0, { "pinned": pinned() })}${attr("x", bandLeft(activeI()))}${attr("y", plotTop())}${attr("width", bandW())}${attr("height", plotH())}></rect>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--><!--[-->`);
      const each_array_1 = ensure_array_like(bars());
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let b = each_array_1[$$index_1];
        if (b.h > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<path${attr_class("bar svelte-f531a3", void 0, {
            "down": !b.up,
            "active": activeI() === b.i,
            "dim": activeI() !== null && activeI() !== b.i
          })}${attr_style(`--i: ${stringify(b.i)}; --series: ${stringify(b.color)};`)}${attr("d", barPath(b))}></path>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]-->`);
      if (showX()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<!--[-->`);
        const each_array_2 = ensure_array_like(xTicks());
        for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
          let t = each_array_2[$$index_2];
          $$renderer2.push(`<text class="axis-tick x svelte-f531a3"${attr("x", t.x)}${attr("y", xLabelY())}${attr("text-anchor", t.anchor)}>${escape_html(t.text)}</text>`);
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--><rect class="hit svelte-f531a3" role="presentation" x="0" y="0"${attr("width", W())}${attr("height", height)}></rect>`);
    }
    $$renderer2.push(`<!--]--></svg> `);
    if (activeI() !== null && tooltipRows().length > 0) {
      $$renderer2.push("<!--[0-->");
      ChartTooltip($$renderer2, {
        x: activeX(),
        width: W(),
        title: activeLabel(),
        rows: tooltipRows()
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (hasData()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="sr-only svelte-f531a3" aria-live="polite">${escape_html(readout())}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div>`);
    bind_props($$props, { selectedIndex });
  });
}

export { BarChart as B };
//# sourceMappingURL=BarChart.js-D3sjnavQ.js.map
