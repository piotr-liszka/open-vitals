import { ah as props_id, ag as attr_style, a6 as stringify, ab as attr, a7 as ensure_array_like, a5 as escape_html, a4 as attr_class, ae as bind_props, Q as derived } from './index.js-D7taQuDv.js';

/* empty css                                         */
function clampIndex(i, n) {
  if (n <= 0) return -1;
  if (!Number.isFinite(i)) return 0;
  return Math.max(0, Math.min(n - 1, Math.trunc(i)));
}
function nearestDefinedIndex(i, defined) {
  const n = defined.length;
  if (n <= 0) return -1;
  const start = clampIndex(i, n);
  if (defined[start]) return start;
  for (let d = 1; d < n; d++) {
    const left = start - d;
    if (left >= 0 && defined[left]) return left;
    const right = start + d;
    if (right < n && defined[right]) return right;
  }
  return -1;
}
function activeIndex(hover, selected, n) {
  if (hover !== null && hover >= 0 && hover < n) return Math.trunc(hover);
  if (selected !== null && selected !== void 0 && selected >= 0 && selected < n) {
    return Math.trunc(selected);
  }
  return null;
}
function tooltipAlign(x, width) {
  if (!(width > 0)) return "middle";
  const t = x / width;
  if (t < 0.2) return "start";
  if (t > 0.8) return "end";
  return "middle";
}
function ChartTooltip($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { x, width, title, rows } = $$props;
    const align = derived(() => tooltipAlign(x, width));
    const leftPct = derived(() => width > 0 ? x / width * 100 : 50);
    $$renderer2.push(`<div${attr_class(`tip ${stringify(align())}`, "svelte-1wydclz")}${attr_style(`left: ${stringify(leftPct())}%`)} aria-hidden="true">`);
    if (title) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="tip-title svelte-1wydclz">${escape_html(title)}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <!--[-->`);
    const each_array = ensure_array_like(rows);
    for (let i = 0, $$length = each_array.length; i < $$length; i++) {
      let r = each_array[i];
      $$renderer2.push(`<span class="tip-row svelte-1wydclz">`);
      if (r.color) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="swatch svelte-1wydclz"${attr_style(`--sw: ${stringify(r.color)}`)}></span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (r.label) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="k svelte-1wydclz">${escape_html(r.label)}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <span class="v svelte-1wydclz">${escape_html(r.value)}</span></span>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function ChartLegend($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { items, onToggle, ariaLabel = "Chart series" } = $$props;
    $$renderer2.push(`<ul class="legend svelte-1y3uu57"${attr("aria-label", ariaLabel)}><!--[-->`);
    const each_array = ensure_array_like(items);
    for (let i = 0, $$length = each_array.length; i < $$length; i++) {
      let item = each_array[i];
      $$renderer2.push(`<li class="svelte-1y3uu57">`);
      if (onToggle) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<button type="button"${attr_class("item svelte-1y3uu57", void 0, { "off": item.hidden })}${attr_style(`--sw: ${stringify(item.color)}`)}${attr("aria-pressed", !item.hidden)}><span class="swatch svelte-1y3uu57"></span> <span class="name svelte-1y3uu57">${escape_html(item.name)}</span> `);
        if (item.value !== void 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="value svelte-1y3uu57">${escape_html(item.value)}</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></button>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<span class="item static svelte-1y3uu57"${attr_style(`--sw: ${stringify(item.color)}`)}><span class="swatch svelte-1y3uu57"></span> <span class="name svelte-1y3uu57">${escape_html(item.name)}</span> `);
        if (item.value !== void 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span class="value svelte-1y3uu57">${escape_html(item.value)}</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></span>`);
      }
      $$renderer2.push(`<!--]--></li>`);
    }
    $$renderer2.push(`<!--]--></ul>`);
  });
}
const AXIS_GAP = 6;
const TICK_GAP = 12;
const CHAR_RATIO = 0.62;
const SERIES_COLORS = [
  "var(--chart-series-1)",
  "var(--chart-series-2)",
  "var(--chart-series-3)",
  "var(--chart-series-4)",
  "var(--chart-series-5)",
  "var(--chart-series-6)"
];
function seriesColor(index) {
  const n = SERIES_COLORS.length;
  const i = (Math.trunc(index) % n + n) % n;
  return SERIES_COLORS[i];
}
function resolveSeries(series, fallback) {
  if (series && series.length > 0) {
    return series.map((s, i) => ({
      name: s.name,
      values: s.values,
      color: s.color ?? seriesColor(i)
    }));
  }
  return [
    {
      name: fallback.name ?? "",
      values: fallback.values,
      color: fallback.color ?? seriesColor(0)
    }
  ];
}
function seriesLength(series) {
  return series.reduce((max, s) => Math.max(max, s.values.length), 0);
}
function definedMask(series, n) {
  const mask = new Array(Math.max(0, n)).fill(false);
  for (const s of series) {
    for (let i = 0; i < mask.length; i++) {
      if (Number.isFinite(s.values[i])) mask[i] = true;
    }
  }
  return mask;
}
function tidy(v) {
  return Number(v.toPrecision(12));
}
function niceStep(raw) {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const m = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return tidy(m * mag);
}
function niceTicks(lo, hi, target = 4) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return [];
  if (hi === lo) return [tidy(lo)];
  const step = niceStep((hi - lo) / Math.max(1, target));
  const first = Math.ceil(lo / step) * step;
  const out = [];
  for (let k = 0; k < 64; k++) {
    const v = tidy(first + k * step);
    if (v > hi + step * 1e-9) break;
    out.push(v);
  }
  return out;
}
function decimalsFor(step) {
  if (!Number.isFinite(step) || step <= 0) return 0;
  const s = String(tidy(step));
  if (s.includes("e")) return 0;
  const dot = s.indexOf(".");
  return dot < 0 ? 0 : Math.min(6, s.length - dot - 1);
}
function trimZeros(v, decimals) {
  const s = v.toFixed(decimals);
  return decimals > 0 ? s.replace(/\.?0+$/, "") : s;
}
function formatTickValue(v, step = 1) {
  if (!Number.isFinite(v)) return "";
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${trimZeros(v / 1e6, step >= 1e6 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${trimZeros(v / 1e3, step >= 1e3 ? 0 : 1)}k`;
  return trimZeros(v, decimalsFor(step));
}
function estimateTextWidth(text, fontPx) {
  if (!Number.isFinite(fontPx) || fontPx <= 0) return 0;
  return text.length * fontPx * CHAR_RATIO;
}
function maxTextWidth(texts, fontPx) {
  return texts.reduce((max, t) => Math.max(max, estimateTextWidth(t, fontPx)), 0);
}
function axisLabelIndices(labels, n, xOf, minGap) {
  const out = [];
  let lastX = 0;
  for (let i = Math.min(n, labels.length) - 1; i >= 0; i--) {
    const text = labels[i];
    if (text === void 0 || text === "") continue;
    const x = xOf(i);
    if (out.length > 0 && !(lastX - x >= minGap)) continue;
    out.push(i);
    lastX = x;
  }
  return out.reverse();
}
function textAnchorAt(x, width, textW) {
  const half = textW / 2;
  if (!(width > 0)) return "middle";
  if (x - half < 0) return "start";
  if (x + half > width) return "end";
  return "middle";
}
const MARKER_ABOVE_EM = 0.75;
const MARKER_BELOW_EM = 1.3;
const CAP_EM = 0.8;
const DESCENDER_EM = 0.2;
function markerLabelY(pointY, prefer, band, font) {
  const above = pointY - font * MARKER_ABOVE_EM;
  const below = pointY + font * MARKER_BELOW_EM;
  const fitsAbove = above - font * CAP_EM >= band.top;
  const fitsBelow = below + font * DESCENDER_EM <= band.bottom;
  if (prefer === "above") return fitsAbove || !fitsBelow ? above : below;
  return fitsBelow || !fitsAbove ? below : above;
}
function TrendChart($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      values = [],
      series,
      labels,
      color = "var(--color-accent)",
      height = 200,
      showArea = true,
      showAvg = false,
      formatValue = (n2) => n2.toLocaleString(),
      formatTick,
      label,
      unit,
      xAxis,
      yAxis = true,
      legend,
      selectedIndex = null,
      onSelect,
      hoverIndex = null,
      tooltip = true,
      emphasisIndex = null,
      emphasisLabel = "highlighted",
      gutterLeft = 0,
      onGutter
    } = $$props;
    let axisFont = 12;
    const W = derived(() => 640);
    const revealId = `trend-reveal-${uid}`;
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
    const definedCount = derived(() => defined().reduce((c, d) => d ? c + 1 : c, 0));
    const hasData = derived(() => definedCount() > 0);
    const stats = derived(() => {
      let min = Infinity;
      let max = -Infinity;
      let sum = 0;
      let count = 0;
      for (const s of visible()) {
        for (const v of s.values) {
          if (!Number.isFinite(v)) continue;
          if (v < min) min = v;
          if (v > max) max = v;
          sum += v;
          count++;
        }
      }
      return count === 0 ? void 0 : { min, max, avg: sum / count, count };
    });
    const flat = derived(() => !!stats() && stats().min === stats().max);
    const domain = derived(() => {
      if (!stats()) return { min: 0, max: 1, span: 1 };
      if (flat()) return { min: stats().min - 1, max: stats().max + 1, span: 2 };
      const pad = (stats().max - stats().min) * 0.15;
      const min = stats().min - pad;
      const max = stats().max + pad;
      return { min, max, span: max - min };
    });
    const showX = derived(() => xAxis ?? (labels !== void 0 && labels.length > 0));
    const showY = derived(() => yAxis);
    const yTicks = derived(() => showY() && hasData() ? niceTicks(domain().min, domain().max, 4) : []);
    const yStep = derived(() => yTicks().length > 1 ? (yTicks()[1] ?? 0) - (yTicks()[0] ?? 0) : 1);
    const tickText = derived(() => (v) => (formatTick ?? formatTickValue)(v, yStep()));
    const yTickTexts = derived(() => yTicks().map(tickText()));
    const naturalPlotL = derived(() => showY() && yTicks().length > 0 ? maxTextWidth(yTickTexts(), axisFont) + AXIS_GAP * 2 : W() * 0.04);
    const plotL = derived(() => Math.max(naturalPlotL(), gutterLeft > 0 ? gutterLeft : 0));
    const padR = derived(() => showY() ? AXIS_GAP : W() * 0.04);
    const plotR = derived(() => Math.max(plotL(), W() - padR()));
    const plotW = derived(() => Math.max(0, plotR() - plotL()));
    const topPad = derived(() => unit && showY() ? axisFont * 2.4 : axisFont * 1.5);
    const bottomPad = derived(() => showX() ? axisFont * 2 : axisFont * 0.9);
    const plotTop = derived(topPad);
    const plotBottom = derived(() => Math.max(topPad(), height - bottomPad()));
    const plotH = derived(() => Math.max(0, plotBottom() - plotTop()));
    function xOf(i) {
      return n() <= 1 ? plotL() + plotW() / 2 : plotL() + i / (n() - 1) * plotW();
    }
    function yOf(v) {
      return plotTop() + (1 - (v - domain().min) / domain().span) * plotH();
    }
    const plainGrid = derived(() => [0, 1, 2, 3].map((k) => plotTop() + k / 3 * plotH()));
    const xLabelW = derived(() => maxTextWidth(labels ?? [], axisFont));
    const xTicks = derived(() => {
      if (!showX() || !labels || n() === 0) return [];
      return axisLabelIndices(labels, n(), xOf, xLabelW() + TICK_GAP).flatMap((i) => {
        const text = labels[i];
        if (text === void 0 || text === "") return [];
        const x = xOf(i);
        return [{ i, x, text, anchor: textAnchorAt(x, W(), xLabelW()) }];
      });
    });
    const xLabelY = derived(() => plotBottom() + AXIS_GAP + axisFont * 0.8);
    function finitePoints(s) {
      return s.values.flatMap((v, i) => Number.isFinite(v) ? [{ x: xOf(i), y: yOf(v), v, i }] : []);
    }
    function linePathOf(s) {
      let d = "";
      let pen = false;
      s.values.forEach((v, i) => {
        if (!Number.isFinite(v)) {
          pen = false;
          return;
        }
        d += `${pen ? "L" : "M"}${xOf(i).toFixed(2)},${yOf(v).toFixed(2)} `;
        pen = true;
      });
      return d.trim();
    }
    function areaPathOf(s) {
      let d = "";
      let run = [];
      const flush = () => {
        const first = run[0];
        const last = run[run.length - 1];
        if (run.length > 1 && first && last) {
          d += `M${first.x.toFixed(2)},${plotBottom().toFixed(2)} `;
          d += run.map((p) => `L${p.x.toFixed(2)},${p.y.toFixed(2)} `).join("");
          d += `L${last.x.toFixed(2)},${plotBottom().toFixed(2)} Z `;
        }
        run = [];
      };
      s.values.forEach((v, i) => {
        if (!Number.isFinite(v)) {
          flush();
          return;
        }
        run.push({ x: xOf(i), y: yOf(v), v, i });
      });
      flush();
      return d.trim();
    }
    const drawn = derived(() => visible().map((s, k) => {
      const pts = finitePoints(s);
      return {
        key: s.name || `s${k}`,
        color: s.color,
        line: pts.length > 1 ? linePathOf(s) : "",
        area: showArea && !multi() && pts.length > 1 ? areaPathOf(s) : "",
        count: pts.length
      };
    }));
    const solo = derived(() => visible().length === 1 ? visible()[0] : void 0);
    const markers = derived(() => {
      if (!solo() || flat() || definedCount() <= 1) return void 0;
      const pts = finitePoints(solo());
      if (pts.length < 2) return void 0;
      let hi = pts[0];
      let lo = pts[0];
      for (const p of pts) {
        if (p.v > hi.v) hi = p;
        if (p.v < lo.v) lo = p;
      }
      return { hi, lo };
    });
    const single = derived(() => {
      if (!solo() || definedCount() !== 1) return void 0;
      return finitePoints(solo())[0];
    });
    const emphasis = derived(() => {
      if (emphasisIndex === null || !Number.isInteger(emphasisIndex)) return void 0;
      if (emphasisIndex < 0 || emphasisIndex >= n()) return void 0;
      const points = visible().flatMap((s) => {
        const v = s.values[emphasisIndex];
        return v !== void 0 && Number.isFinite(v) ? [{ key: s.name || "series", color: s.color, y: yOf(v), v }] : [];
      });
      if (points.length === 0) return void 0;
      return {
        x: xOf(emphasisIndex),
        points,
        label: labels?.[emphasisIndex] ?? ""
      };
    });
    const avgY = derived(() => stats() ? yOf(stats().avg) : 0);
    const showAvgLine = derived(() => showAvg && !!stats() && !!solo() && !flat() && definedCount() > 1);
    const markerBand = derived(() => ({ top: 0, bottom: plotBottom() }));
    function anchor(x) {
      if (x < W() * 0.14) return "start";
      if (x > W() * 0.86) return "end";
      return "middle";
    }
    const activeI = derived(() => {
      const i = activeIndex(hoverIndex, selectedIndex, n());
      if (i === null) return null;
      const j = nearestDefinedIndex(i, defined());
      return j < 0 ? null : j;
    });
    const activeX = derived(() => activeI() === null ? 0 : xOf(activeI()));
    const activeLabel = derived(() => activeI() === null ? void 0 : labels?.[activeI()]);
    const pinned = derived(() => hoverIndex === null && activeI() !== null);
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
    const activePoints = derived(() => activeI() === null ? [] : activeValues().map((a) => ({ key: a.name, color: a.color, y: yOf(a.value) })));
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
    const emphasisSummary = derived(() => {
      if (!emphasis()) return "";
      const head = emphasis().label ? `${emphasisLabel} ${emphasis().label}` : emphasisLabel;
      return `, ${head}: ${emphasis().points.map((p) => formatValue(p.v)).join(", ")}`;
    });
    const summary = derived(() => {
      const prefix = label ? `${label} trend` : "trend";
      if (!hasData() || !stats()) return `${prefix}, no data`;
      if (multi()) {
        const names = resolved().map((s) => s.name).join(", ");
        return `${prefix}, ${resolved().length} series: ${names}, ${definedCount()} points, low ${formatValue(stats().min)}, high ${formatValue(stats().max)}${emphasisSummary()}`;
      }
      if (definedCount() === 1) return `${prefix}, 1 point, value ${formatValue(stats().min)}${emphasisSummary()}`;
      const base = `${prefix}, ${definedCount()} points, low ${formatValue(stats().min)}, high ${formatValue(stats().max)}`;
      return `${showAvg ? `${base}, avg ${formatValue(stats().avg)}` : base}${emphasisSummary()}`;
    });
    $$renderer2.push(`<div class="chart-block svelte-9nr0b1">`);
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
    $$renderer2.push(`<!--]--> <div class="chart svelte-9nr0b1"${attr_style(`--chart-color: ${stringify(solo()?.color ?? color)}; height: ${stringify(height)}px;`)}><svg class="chart-svg svelte-9nr0b1" width="100%"${attr("height", height)}${attr("viewBox", `0 0 ${stringify(W())} ${stringify(height)}`)} role="img"${attr("aria-label", summary())}${attr("tabindex", hasData() ? 0 : void 0)}>`);
    if (!hasData()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<line class="placeholder svelte-9nr0b1"${attr("x1", plotL())}${attr("y1", height / 2)}${attr("x2", W() - padR())}${attr("y2", height / 2)} vector-effect="non-scaling-stroke"></line><text class="empty svelte-9nr0b1"${attr("x", W() / 2)}${attr("y", height / 2)} text-anchor="middle">No data</text>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      if (showY() && yTicks().length > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<!--[-->`);
        const each_array = ensure_array_like(yTicks());
        for (let k = 0, $$length = each_array.length; k < $$length; k++) {
          let t = each_array[k];
          $$renderer2.push(`<line class="grid svelte-9nr0b1"${attr("x1", plotL())}${attr("y1", yOf(t))}${attr("x2", plotR())}${attr("y2", yOf(t))} vector-effect="non-scaling-stroke"></line><text class="axis-tick y svelte-9nr0b1"${attr("x", plotL() - AXIS_GAP)}${attr("y", yOf(t))} text-anchor="end">${escape_html(yTickTexts()[k])}</text>`);
        }
        $$renderer2.push(`<!--]-->`);
        if (unit) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<text class="axis-unit svelte-9nr0b1" x="0"${attr("y", plotTop() - AXIS_GAP)} text-anchor="start">${escape_html(unit)}</text>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<!--[-->`);
        const each_array_1 = ensure_array_like(plainGrid());
        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
          let gy = each_array_1[$$index_1];
          $$renderer2.push(`<line class="grid svelte-9nr0b1" x1="0"${attr("y1", gy)}${attr("x2", W())}${attr("y2", gy)} vector-effect="non-scaling-stroke"></line>`);
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]-->`);
      if (showX()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<line class="axis-line svelte-9nr0b1"${attr("x1", plotL())}${attr("y1", plotBottom())}${attr("x2", plotR())}${attr("y2", plotBottom())} vector-effect="non-scaling-stroke"></line><!--[-->`);
        const each_array_2 = ensure_array_like(xTicks());
        for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
          let t = each_array_2[$$index_2];
          $$renderer2.push(`<text class="axis-tick x svelte-9nr0b1"${attr("x", t.x)}${attr("y", xLabelY())}${attr("text-anchor", t.anchor)}>${escape_html(t.text)}</text>`);
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
      if (showAvgLine() && stats()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<line class="avg svelte-9nr0b1"${attr("x1", plotL())}${attr("y1", avgY())}${attr("x2", plotR())}${attr("y2", avgY())} vector-effect="non-scaling-stroke"></line><text class="avg-label svelte-9nr0b1"${attr("x", plotR())}${attr("y", avgY() - 6)} text-anchor="end">avg ${escape_html(formatValue(stats().avg))}</text>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--><!--[-->`);
      const each_array_3 = ensure_array_like(drawn());
      for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
        let s = each_array_3[$$index_3];
        if (s.area) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<path class="area svelte-9nr0b1"${attr_style(`--series: ${stringify(s.color)}`)}${attr("d", s.area)}></path>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]--><defs><clipPath${attr("id", revealId)} clipPathUnits="userSpaceOnUse"><rect class="reveal svelte-9nr0b1" x="0" y="0"${attr("width", W())}${attr("height", height)}></rect></clipPath></defs><g${attr("clip-path", `url(#${revealId})`)}><!--[-->`);
      const each_array_4 = ensure_array_like(drawn());
      for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
        let s = each_array_4[$$index_4];
        if (s.line) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<path class="line svelte-9nr0b1"${attr_style(`--series: ${stringify(s.color)}`)}${attr("d", s.line)} vector-effect="non-scaling-stroke"></path>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]--></g>`);
      if (single()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<circle class="marker svelte-9nr0b1"${attr("cx", single().x)}${attr("cy", single().y)} r="4"></circle>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
      if (markers()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<circle class="marker svelte-9nr0b1"${attr("cx", markers().hi.x)}${attr("cy", markers().hi.y)} r="4"></circle><text${attr_class("point-label svelte-9nr0b1", void 0, { "faded": activeI() !== null })}${attr("x", markers().hi.x)}${attr("y", markerLabelY(markers().hi.y, "above", markerBand(), axisFont))}${attr("text-anchor", anchor(markers().hi.x))}>${escape_html(formatValue(markers().hi.v))}</text><circle class="marker svelte-9nr0b1"${attr("cx", markers().lo.x)}${attr("cy", markers().lo.y)} r="4"></circle><text${attr_class("point-label svelte-9nr0b1", void 0, { "faded": activeI() !== null })}${attr("x", markers().lo.x)}${attr("y", markerLabelY(markers().lo.y, "below", markerBand(), axisFont))}${attr("text-anchor", anchor(markers().lo.x))}>${escape_html(formatValue(markers().lo.v))}</text>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
      if (emphasis()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<line class="emphasis-rule svelte-9nr0b1"${attr("x1", emphasis().x)}${attr("y1", plotTop())}${attr("x2", emphasis().x)}${attr("y2", plotBottom())} vector-effect="non-scaling-stroke"></line><!--[-->`);
        const each_array_5 = ensure_array_like(emphasis().points);
        for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
          let p = each_array_5[$$index_5];
          $$renderer2.push(`<circle class="emphasis-halo svelte-9nr0b1"${attr_style(`--series: ${stringify(p.color)}`)}${attr("cx", emphasis().x)}${attr("cy", p.y)} r="9"></circle><circle class="emphasis-dot svelte-9nr0b1"${attr_style(`--series: ${stringify(p.color)}`)}${attr("cx", emphasis().x)}${attr("cy", p.y)} r="4.5"></circle>`);
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
      if (activeI() !== null) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<line${attr_class("cursor svelte-9nr0b1", void 0, { "pinned": pinned() })}${attr("x1", activeX())}${attr("y1", plotTop())}${attr("x2", activeX())}${attr("y2", plotBottom())} vector-effect="non-scaling-stroke"></line><!--[-->`);
        const each_array_6 = ensure_array_like(activePoints());
        for (let $$index_6 = 0, $$length = each_array_6.length; $$index_6 < $$length; $$index_6++) {
          let p = each_array_6[$$index_6];
          $$renderer2.push(`<circle class="cursor-dot svelte-9nr0b1"${attr_style(`--series: ${stringify(p.color)}`)}${attr("cx", activeX())}${attr("cy", p.y)} r="5"></circle>`);
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--><rect class="hit svelte-9nr0b1" role="presentation" x="0" y="0"${attr("width", W())}${attr("height", height)}></rect>`);
    }
    $$renderer2.push(`<!--]--></svg> `);
    if (tooltip && activeI() !== null && tooltipRows().length > 0) {
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
      $$renderer2.push(`<span class="sr-only svelte-9nr0b1" aria-live="polite">${escape_html(readout())}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div>`);
    bind_props($$props, { selectedIndex, hoverIndex });
  });
}

export { AXIS_GAP as A, ChartLegend as C, TrendChart as T, ChartTooltip as a, activeIndex as b, nearestDefinedIndex as c, axisLabelIndices as d, TICK_GAP as e, definedMask as f, formatTickValue as g, maxTextWidth as m, niceTicks as n, resolveSeries as r, seriesLength as s, textAnchorAt as t };
//# sourceMappingURL=TrendChart.js-C2RJO89W.js.map
