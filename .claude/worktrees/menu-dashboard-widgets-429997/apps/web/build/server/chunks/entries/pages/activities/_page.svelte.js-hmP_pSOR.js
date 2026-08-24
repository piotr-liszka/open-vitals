import { af as head, Q as derived, a8 as store_get, a5 as escape_html, a9 as unsubscribe_stores, a4 as attr_class, a7 as ensure_array_like, a6 as stringify, ab as attr } from '../../../chunks/index.js-D7taQuDv.js';
import { p as page } from '../../../chunks/stores.js-pwimOGzR.js';
import '../../../chunks/toast.js-D9a9Yw3o.js';
import { S as SubNav } from '../../../chunks/SubNav.js-Bt3ew81m.js';
import '../../../chunks/exports.js-aFGE3YQF.js';
import '../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../chunks/utils.js-D6eaf5bT.js';
import '../../../chunks/root.js-DLPDgkXe.js';
import { g as goto } from '../../../chunks/client.js-C1MYAKQX.js';
import '../../../chunks/client2.js-DKEBrJ7O.js';
import { A as AppShell } from '../../../chunks/AppShell.js-Dxd-FjMr.js';
import { S as SyncFooter } from '../../../chunks/SyncFooter.js-VTNqeJEz.js';
import { I as Input } from '../../../chunks/Input.js-Bx-2KbvO.js';
import { B as Button } from '../../../chunks/Button.js-B1j4uOxB.js';
import { S as SegmentedControl } from '../../../chunks/SegmentedControl.js-vIk-Z1KL.js';
import { F as FilterChips } from '../../../chunks/FilterChips.js-CTWRFRaS.js';
import { R as RangeBadge } from '../../../chunks/RangeBadge.js-CR-NnSex.js';
import { R as RANGE_PARAM } from '../../../chunks/range.js-VDtVJAwH.js';
import { d as sportLabel } from '../../../chunks/sport-labels.js-BKqMzU19.js';
import { L as LeafletMap } from '../../../chunks/LeafletMap.js-DQa-tPsx.js';
import { B as Badge } from '../../../chunks/Badge.js-Bcg4u8Go.js';
import { j as isDayKey, i as formatDay } from '../../../chunks/date.js-Cf0GyZI8.js';
import { a as activitiesTitle, A as ACTIVITIES_TABS } from '../../../chunks/activities-nav.js-DnDyVTYo.js';
import '../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../chunks/Icon.js-D5N4FEG5.js';
import '../../../chunks/ThemeToggle.js-T-urDE0b.js';
import '../../../chunks/index2.js-DFeLIU8S.js';

function ActivityCard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { item, view = "grid" } = $$props;
    const km = (m) => m == null ? "—" : `${(m / 1e3).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} km`;
    const meters = (m) => m == null ? "—" : `${Math.round(m).toLocaleString("pl-PL")} m`;
    function hms(s) {
      if (s == null) return "—";
      const h = Math.floor(s / 3600);
      const m = Math.floor(s % 3600 / 60);
      const sec = Math.floor(s % 60);
      return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
    }
    function dateLabel(local) {
      const head2 = local.slice(0, 10);
      return isDayKey(head2) ? formatDay(head2, "shortYear") : head2;
    }
    const polylines = derived(() => item.gps ? [{ points: item.gps, weight: 3, opacity: 0.95 }] : []);
    const power = derived(() => item.normPower ?? item.avgPower);
    $$renderer2.push(`<a${attr_class(`card ${stringify(view)}`, "svelte-zcbbu2")}${attr("href", `/activities/${item.id}`)}><div class="thumb svelte-zcbbu2">`);
    if (item.gps) {
      $$renderer2.push("<!--[0-->");
      LeafletMap($$renderer2, {
        polylines: polylines(),
        interactive: false,
        height: "100%",
        ariaLabel: `Trasa: ${item.name ?? sportLabel(item.sport)}`
      });
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="glyph svelte-zcbbu2" aria-hidden="true"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17l5-9 4 6 3-4 4 7"></path><circle cx="4" cy="17" r="1"></circle><circle cx="20" cy="17" r="1"></circle></svg></div>`);
    }
    $$renderer2.push(`<!--]--> <span class="sport svelte-zcbbu2">`);
    Badge($$renderer2, {
      tone: "neutral",
      dot: false,
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->${escape_html(sportLabel(item.sport))}`);
      }
    });
    $$renderer2.push(`<!----></span></div> <div class="body svelte-zcbbu2"><div class="head svelte-zcbbu2"><h3 class="name svelte-zcbbu2">${escape_html(item.name ?? sportLabel(item.sport))}</h3> <span class="date svelte-zcbbu2">${escape_html(dateLabel(item.startTimeLocal))}</span></div> <dl class="stats svelte-zcbbu2"><div class="svelte-zcbbu2"><dt class="svelte-zcbbu2">Dystans</dt> <dd class="svelte-zcbbu2">${escape_html(km(item.distanceM))}</dd></div> <div class="svelte-zcbbu2"><dt class="svelte-zcbbu2">Czas</dt> <dd class="svelte-zcbbu2">${escape_html(hms(item.movingS ?? item.durationS))}</dd></div> <div class="svelte-zcbbu2"><dt class="svelte-zcbbu2">Przewyższenie</dt> <dd class="svelte-zcbbu2">${escape_html(meters(item.elevationGainM))}</dd></div></dl> `);
    if (power() != null || item.avgHr != null) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="tags svelte-zcbbu2">`);
      if (power() != null) {
        $$renderer2.push("<!--[0-->");
        Badge($$renderer2, {
          tone: "warning",
          dot: false,
          children: ($$renderer3) => {
            $$renderer3.push(`<!---->${escape_html(Math.round(power()))} W`);
          }
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (item.avgHr != null) {
        $$renderer2.push("<!--[0-->");
        Badge($$renderer2, {
          tone: "danger",
          dot: false,
          children: ($$renderer3) => {
            $$renderer3.push(`<!---->${escape_html(Math.round(item.avgHr))} bpm`);
          }
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></a>`);
  });
}
function ActivitiesView($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const sportChips = derived(() => data.facets.sports.map((s) => ({ value: s.sport, label: sportLabel(s.sport) })));
    let searchTerm = "";
    const view = { mode: "grid" };
    const km = derived(() => `${(data.facets.totalDistanceM / 1e3).toLocaleString("pl-PL", { maximumFractionDigits: 0 })} km`);
    const hours = derived(() => `${Math.round(data.facets.totalDurationS / 3600).toLocaleString("pl-PL")} h`);
    function apply(next) {
      const q = new URLSearchParams();
      const sport = next.sport === void 0 ? data.query.sport : next.sport;
      const search = next.search === void 0 ? data.query.search : next.search;
      const sort = next.sort ?? data.query.sort;
      const dir = next.dir ?? data.query.dir;
      const page2 = next.page ?? 1;
      if (sport) q.set("sport", sport);
      if (search) q.set("search", search);
      if (sort !== "date") q.set("sort", sort);
      if (dir !== "desc") q.set("dir", dir);
      if (page2 > 1) q.set("page", String(page2));
      if (data.range) q.set(RANGE_PARAM, data.range.key);
      void goto(`/activities${q.toString() ? `?${q}` : ""}`, {});
    }
    const sortOptions = [
      { value: "date", label: "Data" },
      { value: "distance", label: "Dystans" },
      { value: "duration", label: "Czas" }
    ];
    const viewOptions = [
      { value: "grid", label: "Siatka" },
      { value: "list", label: "Lista" }
    ];
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<div class="wrap svelte-aallyz"><header class="summary svelte-aallyz"><div class="metric svelte-aallyz"><span class="m-value svelte-aallyz">${escape_html(data.facets.total)}</span><span class="m-label svelte-aallyz">Aktywności</span></div> <div class="metric svelte-aallyz"><span class="m-value svelte-aallyz">${escape_html(km())}</span><span class="m-label svelte-aallyz">Dystans</span></div> <div class="metric svelte-aallyz"><span class="m-value svelte-aallyz">${escape_html(hours())}</span><span class="m-label svelte-aallyz">Czas</span></div> `);
      if (data.range) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="summary-range svelte-aallyz">`);
        RangeBadge($$renderer3, { label: data.range.label, size: "sm" });
        $$renderer3.push(`<!----></div>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></header> <div class="controls svelte-aallyz"><form class="search svelte-aallyz">`);
      Input($$renderer3, {
        type: "search",
        placeholder: "Szukaj po nazwie lub sporcie…",
        "aria-label": "Szukaj aktywności",
        get value() {
          return searchTerm;
        },
        set value($$value) {
          searchTerm = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> `);
      Button($$renderer3, {
        type: "submit",
        size: "sm",
        variant: "secondary",
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->Szukaj`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----></form> <div class="right svelte-aallyz"><div class="sort svelte-aallyz">`);
      SegmentedControl($$renderer3, {
        options: sortOptions,
        value: data.query.sort,
        size: "sm",
        ariaLabel: "Sortuj według",
        onChange: (v) => apply({ sort: v })
      });
      $$renderer3.push(`<!----> `);
      Button($$renderer3, {
        size: "sm",
        variant: "ghost",
        onclick: () => apply({ dir: data.query.dir === "asc" ? "desc" : "asc" }),
        title: data.query.dir === "asc" ? "Rosnąco" : "Malejąco",
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->${escape_html(data.query.dir === "asc" ? "↑" : "↓")}`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----></div> `);
      SegmentedControl($$renderer3, {
        options: viewOptions,
        value: view.mode,
        size: "sm",
        ariaLabel: "Widok",
        onChange: (v) => view.mode = v
      });
      $$renderer3.push(`<!----></div></div> `);
      FilterChips($$renderer3, {
        options: sportChips(),
        value: data.query.sport,
        ariaLabel: "Filtruj po sporcie",
        onSelect: (sport) => apply({ sport })
      });
      $$renderer3.push(`<!----> `);
      if (data.items.length === 0) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<p class="empty svelte-aallyz">Brak aktywności`);
        if (data.range) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(` w zakresie: ${escape_html(data.range.label)}`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> dla tego filtra. Zmień zakres u góry
      strony lub uruchom synchronizację w zakładce <a href="/data">Dane</a>.</p>`);
      } else {
        $$renderer3.push("<!--[-1-->");
        $$renderer3.push(`<div${attr_class("grid svelte-aallyz", void 0, { "list": view.mode === "list" })}><!--[-->`);
        const each_array = ensure_array_like(data.items);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let item = each_array[$$index];
          ActivityCard($$renderer3, { item, view: view.mode });
        }
        $$renderer3.push(`<!--]--></div>`);
      }
      $$renderer3.push(`<!--]--> `);
      if (data.pageCount > 1) {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<nav class="pager svelte-aallyz" aria-label="Strony">`);
        Button($$renderer3, {
          size: "sm",
          variant: "secondary",
          disabled: data.query.page <= 1,
          onclick: () => apply({ page: data.query.page - 1 }),
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->Poprzednia`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----> <span class="page-label svelte-aallyz">Strona ${escape_html(data.query.page)} z ${escape_html(data.pageCount)}</span> `);
        Button($$renderer3, {
          size: "sm",
          variant: "secondary",
          disabled: data.query.page >= data.pageCount,
          onclick: () => apply({ page: data.query.page + 1 }),
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->Następna`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----></nav>`);
      } else {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></div>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { data } = $$props;
    const title = derived(() => activitiesTitle(store_get($$store_subs ??= {}, "$page", page).url.pathname));
    head("geza2u", $$renderer2, ($$renderer3) => {
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
          $$renderer3.push(`<div class="section svelte-geza2u">`);
          SubNav($$renderer3, {
            items: [...ACTIVITIES_TABS],
            current: store_get($$store_subs ??= {}, "$page", page).url.pathname,
            ariaLabel: "Sekcja aktywności"
          });
          $$renderer3.push(`<!----> `);
          ActivitiesView($$renderer3, { data: data.activities });
          $$renderer3.push(`<!----></div>`);
        }
      });
    }
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte.js-hmP_pSOR.js.map
