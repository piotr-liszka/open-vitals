import { g as derived, h as head, e as escape_html, s as store_get, u as unsubscribe_stores } from "../../../../chunks/index.js";
import { p as page } from "../../../../chunks/stores.js";
import "../../../../chunks/toast.js";
/* empty css                                                    */
/* empty css                                                     */
/* empty css                                                                */
import { S as SubNav } from "../../../../chunks/SubNav.js";
/* empty css                                                           */
/* empty css                                                        */
/* empty css                                                        */
/* empty css                                                          */
/* empty css                                                          */
/* empty css                                                          */
/* empty css                                                     */
/* empty css                                                          */
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import { g as goto } from "../../../../chunks/client.js";
import "../../../../chunks/client2.js";
import { A as AppShell } from "../../../../chunks/AppShell.js";
import { S as SyncFooter } from "../../../../chunks/SyncFooter.js";
import { L as LeafletMap } from "../../../../chunks/LeafletMap.js";
import { S as StatTile } from "../../../../chunks/StatTile.js";
import { F as FilterChips } from "../../../../chunks/FilterChips.js";
import { b as sportLabel } from "../../../../chunks/sport-labels.js";
import { A as ACTIVITIES_TABS, a as activitiesTitle } from "../../../../chunks/activities-nav.js";
function HeatmapView($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const sportChips = derived(() => data.sports.map((s) => ({ value: s.sport, label: sportLabel(s.sport) })));
    const yearChips = derived(() => data.years.map((y) => ({ value: String(y), label: String(y) })));
    const polylines = derived(() => data.tracks.map((t) => ({ points: t.gps, weight: 2, opacity: 0.35 })));
    const km = derived(() => `${(data.totalDistanceM / 1e3).toLocaleString("pl-PL", { maximumFractionDigits: 0 })} km`);
    function apply(next) {
      const sport = next.sport === void 0 ? data.sport : next.sport;
      const year = next.year === void 0 ? data.year : next.year;
      const q = new URLSearchParams();
      if (sport) q.set("sport", sport);
      if (year) q.set("year", String(year));
      void goto(`/activities/mapa${q.toString() ? `?${q}` : ""}`, {});
    }
    $$renderer2.push(`<div class="layout svelte-tjkxtv"><aside class="rail svelte-tjkxtv"><div class="tiles svelte-tjkxtv">`);
    StatTile($$renderer2, {
      label: "Aktywności",
      value: String(data.count),
      accent: "orange"
    });
    $$renderer2.push(`<!----> `);
    StatTile($$renderer2, { label: "Dystans", value: km(), accent: "green" });
    $$renderer2.push(`<!----> `);
    StatTile($$renderer2, {
      label: "Z trasą GPS",
      value: String(data.tracks.length),
      accent: "cyan"
    });
    $$renderer2.push(`<!----></div> <div class="filter svelte-tjkxtv"><span class="flabel svelte-tjkxtv">Sport</span> `);
    FilterChips($$renderer2, {
      options: sportChips(),
      value: data.sport,
      ariaLabel: "Filtruj po sporcie",
      onSelect: (sport) => apply({ sport })
    });
    $$renderer2.push(`<!----></div> `);
    if (data.years.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="filter svelte-tjkxtv"><span class="flabel svelte-tjkxtv">Rok</span> `);
      FilterChips($$renderer2, {
        options: yearChips(),
        value: data.year == null ? null : String(data.year),
        ariaLabel: "Filtruj po roku",
        maxVisible: 8,
        onSelect: (y) => apply({ year: y == null ? null : Number(y) })
      });
      $$renderer2.push(`<!----></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (data.tracks.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="empty svelte-tjkxtv">Brak tras GPS dla tego filtra. Uruchom synchronizację w zakładce <a href="/data">Dane</a>.</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></aside> <div class="map svelte-tjkxtv">`);
    LeafletMap($$renderer2, {
      polylines: polylines(),
      height: "100%",
      ariaLabel: "Mapa ciepła tras"
    });
    $$renderer2.push(`<!----></div></div>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { data } = $$props;
    const title = derived(() => activitiesTitle(store_get($$store_subs ??= {}, "$page", page).url.pathname));
    head("18qmgco", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(title())} · Vagus</title>`);
      });
    });
    {
      let footer = function($$renderer3) {
        SyncFooter($$renderer3);
      };
      AppShell($$renderer2, {
        advanced: true,
        title: title(),
        tier: "advanced",
        footer,
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="section svelte-18qmgco">`);
          SubNav($$renderer3, {
            items: [...ACTIVITIES_TABS],
            current: store_get($$store_subs ??= {}, "$page", page).url.pathname,
            ariaLabel: "Sekcja aktywności"
          });
          $$renderer3.push(`<!----> `);
          HeatmapView($$renderer3, { data: data.heatmap });
          $$renderer3.push(`<!----></div>`);
        }
      });
    }
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
