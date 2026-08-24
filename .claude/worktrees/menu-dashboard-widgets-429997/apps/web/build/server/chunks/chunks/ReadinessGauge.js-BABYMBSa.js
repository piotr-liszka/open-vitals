import { a4 as attr_class, a5 as escape_html, a7 as ensure_array_like, ag as attr_style, a6 as stringify } from './index.js-D7taQuDv.js';
import './toast.js-D9a9Yw3o.js';
import { B as Badge } from './Badge.js-Bcg4u8Go.js';
import './exports.js-aFGE3YQF.js';
import './utils2.js-BQzn9ikS.js';
import './utils.js-D6eaf5bT.js';
import './root.js-DLPDgkXe.js';
import './client.js-C1MYAKQX.js';
import './client2.js-DKEBrJ7O.js';

const BAND_TONE = {
  low: "danger",
  moderate: "warning",
  high: "info",
  peak: "success"
};
const BAND_LABEL = {
  low: "Niska",
  moderate: "Umiarkowana",
  high: "Wysoka",
  peak: "Szczytowa"
};
function ReadinessGauge($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { readiness, size = "md" } = $$props;
    function arrow(direction) {
      return direction === "up" ? "↑" : "↓";
    }
    $$renderer2.push(`<div${attr_class("gauge svelte-5supq", void 0, { "lg": size === "lg" })}><div class="score-block svelte-5supq"><span class="score svelte-5supq">${escape_html(readiness.score)}</span> <div class="band svelte-5supq">`);
    Badge($$renderer2, {
      tone: BAND_TONE[readiness.band],
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->${escape_html(BAND_LABEL[readiness.band])}`);
      }
    });
    $$renderer2.push(`<!----> <span class="basis svelte-5supq">na podstawie ${escape_html(readiness.basisDays)} dni</span></div></div> <ul class="drivers svelte-5supq" aria-label="Czynniki gotowości"><!--[-->`);
    const each_array = ensure_array_like(readiness.drivers);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let d = each_array[$$index];
      $$renderer2.push(`<li class="chip svelte-5supq"${attr_style(`--m: var(--lane-${stringify(d.accent)})`)}><span class="marker svelte-5supq" aria-hidden="true"></span> <span class="chip-label svelte-5supq">${escape_html(d.label)}</span> <span${attr_class("chip-dir svelte-5supq", void 0, { "up": d.direction === "up", "down": d.direction === "down" })}>${escape_html(arrow(d.direction))}</span> <span class="chip-contrib svelte-5supq">${escape_html(d.contribution)}</span></li>`);
    }
    $$renderer2.push(`<!--]--></ul></div>`);
  });
}

export { ReadinessGauge as R };
//# sourceMappingURL=ReadinessGauge.js-BABYMBSa.js.map
