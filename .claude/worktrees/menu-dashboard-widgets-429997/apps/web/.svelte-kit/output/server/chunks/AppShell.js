import { ah as attributes, f as stringify, g as derived, b as attr_class, c as attr, e as escape_html, a as ensure_array_like, s as store_get, u as unsubscribe_stores } from "./index.js";
import { I as Icon } from "./Icon.js";
import { S as Spinner, B as Button } from "./Button.js";
/* empty css                                       */
import { T as ThemeToggle } from "./ThemeToggle.js";
import { g as goto } from "./client.js";
import { p as page } from "./index2.js";
import { S as SegmentedControl } from "./SegmentedControl.js";
import { a as RANGE_OPTIONS, p as parseRange, R as RANGE_PARAM, b as RANGE_PREF_KEY, w as withRange, c as routeSupportsRange } from "./range.js";
import { p as page$1 } from "./stores.js";
import { h as formatInstant } from "./date.js";
function IconButton($$renderer, $$props) {
  let {
    icon,
    label,
    loading = false,
    size = "md",
    disabled = false,
    type = "button",
    title,
    $$slots,
    $$events,
    ...rest
  } = $$props;
  const glyphSize = derived(() => size === "sm" ? 14 : 18);
  $$renderer.push(`<button${attributes(
    {
      class: `icon-btn ${stringify(size)}`,
      type,
      disabled: disabled || loading,
      "aria-busy": loading,
      "aria-label": label,
      title: title ?? label,
      ...rest
    },
    "svelte-13o797d"
  )}>`);
  if (loading) {
    $$renderer.push("<!--[0-->");
    Spinner($$renderer, { size: "sm", label: "" });
  } else {
    $$renderer.push("<!--[-1-->");
    Icon($$renderer, { name: icon, size: glyphSize() });
  }
  $$renderer.push(`<!--]--></button>`);
}
function TierBadge($$renderer, $$props) {
  let { tier, size = "md" } = $$props;
  const label = derived(() => tier === "advanced" ? "Zaawansowany" : "Podstawowy");
  $$renderer.push(`<span${attr_class(`tier tier-${stringify(tier)} size-${stringify(size)}`, "svelte-l9s4dp")}${attr("title", tier === "advanced" ? "Tryb zaawansowany — przetwarzanie danych włączone" : "Tryb podstawowy — tylko połączenie i adres MCP")}><span class="dot svelte-l9s4dp" aria-hidden="true"></span> <span class="txt svelte-l9s4dp">${escape_html(label())}</span></span>`);
}
function ambientStorage() {
  try {
    const store = globalThis.localStorage;
    return store ?? null;
  } catch {
    return null;
  }
}
function writeBoolPref(key, value, storage = ambientStorage()) {
  writePref(key, value ? "1" : "0", storage);
}
function writePref(key, value, storage = ambientStorage()) {
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
  }
}
function RangeSwitch($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { size = "sm" } = $$props;
    const options = RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label, short: o.short }));
    const active = derived(() => parseRange(page.url.searchParams.get(RANGE_PARAM)));
    function navigate(key, replaceState) {
      const target = new URL(page.url);
      target.searchParams.set(RANGE_PARAM, key);
      void goto(target, {});
    }
    function pick(value) {
      const key = parseRange(value);
      writePref(RANGE_PREF_KEY, key);
      navigate(key);
    }
    $$renderer2.push(`<div class="range-switch svelte-rbqfcr">`);
    SegmentedControl($$renderer2, {
      /**
       * Re-apply the remembered range when arriving without an explicit one. Runs on the client only
       * (there is no `localStorage` during SSR), and rewrites history rather than pushing, so the back
       * button still leaves the page instead of bouncing between two versions of it.
       *
       * Guarded on the param being absent: once `?range=` is in the URL it wins, so a shared link always
       * shows what the sender saw, whatever this device happens to remember.
       */
      // nothing to restore; leave the URL clean
      options,
      value: active(),
      ariaLabel: "Zakres danych",
      size,
      onChange: pick
    });
    $$renderer2.push(`<!----></div>`);
  });
}
const NAV_GROUP_TRAINING = "Trening";
const NAV_GROUP_HEALTH = "Zdrowie";
const NAV_GROUP_SYSTEM = "System";
const NAV_ITEMS = [
  { href: "/", label: "Start", icon: "home" },
  // What you did. `/training` is a multi-sport section with per-sport subpages behind a SubNav
  // (spec 025); `/activities` is the same shape since spec 048, with the list and the heat map as
  // tabs — the map was a top-level item for a while, but it only ever showed the activities the list
  // already held, filtered by sport and year.
  { href: "/training", label: "Trening", icon: "flame", advanced: true, group: NAV_GROUP_TRAINING },
  { href: "/activities", label: "Aktywności", icon: "list", advanced: true, group: NAV_GROUP_TRAINING },
  // How your body is. `Analityka` used to sit beside this: same metrics, same charts, same range
  // once spec 047 unified the window — so its summary statistics moved onto these chart cards and
  // the page became a redirect (spec 048).
  { href: "/insights", label: "Wnioski", icon: "sparkle", advanced: true, group: NAV_GROUP_HEALTH },
  // The plumbing. The single `Panel` entry that used to close this group is gone (spec 064): every
  // dashboard is now its own entry in the `Panele` group, injected below `Start` by `navGroups`.
  { href: "/data", label: "Dane", icon: "database", group: NAV_GROUP_SYSTEM },
  { href: "/settings", label: "Ustawienia", icon: "settings", group: NAV_GROUP_SYSTEM }
];
function navGroups(advanced, dashboards = []) {
  const [start, ...rest] = NAV_ITEMS;
  const all = [start, ...dashboards, ...rest];
  const groups = [];
  for (const item of all) {
    if (item.advanced && !advanced) continue;
    const last = groups[groups.length - 1];
    if (last && last.group === item.group) last.items.push(item);
    else groups.push({ group: item.group, items: [item] });
  }
  return groups;
}
function NavLinks($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { advanced = false } = $$props;
    const dashboards = derived(() => store_get($$store_subs ??= {}, "$page", page$1).data.dashboardNav ?? []);
    const groups = derived(() => navGroups(advanced, dashboards()));
    function isActive(href, path) {
      return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
    }
    const headingId = (group) => `nav-group-${group.toLowerCase().replace(/\s+/g, "-")}`;
    $$renderer2.push(`<!--[-->`);
    const each_array = ensure_array_like(groups());
    for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
      let g = each_array[$$index_1];
      $$renderer2.push(`<div class="group svelte-b42fe0">`);
      if (g.group) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<h2 class="group-title svelte-b42fe0"${attr("id", headingId(g.group))}>${escape_html(g.group)}</h2>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <ul class="items svelte-b42fe0"${attr("aria-labelledby", g.group ? headingId(g.group) : void 0)}><!--[-->`);
      const each_array_1 = ensure_array_like(g.items);
      for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
        let item = each_array_1[$$index];
        $$renderer2.push(`<li><a${attr_class("nav-item svelte-b42fe0", void 0, {
          "active": isActive(item.href, store_get($$store_subs ??= {}, "$page", page$1).url.pathname)
        })}${attr("href", withRange(item.href, store_get($$store_subs ??= {}, "$page", page$1).url))}${attr("title", item.label)}${attr("aria-current", isActive(item.href, store_get($$store_subs ??= {}, "$page", page$1).url.pathname) ? "page" : void 0)}>`);
        Icon($$renderer2, { name: item.icon, size: 20 });
        $$renderer2.push(`<!----> <span class="label svelte-b42fe0">${escape_html(item.label)}</span></a></li>`);
      }
      $$renderer2.push(`<!--]--></ul></div>`);
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function LogoutButton($$renderer) {
  async function logout() {
    await fetch("/auth/logout", { method: "POST" });
    location.href = "/login";
  }
  Button($$renderer, {
    size: "sm",
    variant: "ghost",
    onclick: logout,
    children: ($$renderer2) => {
      $$renderer2.push(`<!---->Wyloguj`);
    },
    $$slots: { default: true }
  });
}
const SIDEBAR_STATES = ["expanded", "icons", "hidden"];
const DEFAULT_SIDEBAR_STATE = "expanded";
function nextSidebarState(current) {
  const i = SIDEBAR_STATES.indexOf(current);
  return SIDEBAR_STATES[(i + 1) % SIDEBAR_STATES.length];
}
const NEXT_LABELS = {
  expanded: "Rozwiń menu",
  icons: "Zwiń menu do ikon",
  hidden: "Ukryj menu"
};
function toggleLabel(current) {
  return NEXT_LABELS[nextSidebarState(current)];
}
function SidebarToggle($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { state } = $$props;
    const label = derived(() => toggleLabel(state));
    $$renderer2.push(`<button type="button" class="sidebar-toggle svelte-8gyesy"${attr("aria-label", label())}${attr("title", label())}>`);
    Icon($$renderer2, { name: "panel-left", size: 20 });
    $$renderer2.push(`<!----></button>`);
  });
}
function AppShell($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      title,
      advanced = false,
      nav,
      actions,
      brand,
      tier,
      footer,
      range = "auto",
      children
    } = $$props;
    const showRange = derived(() => range === "auto" && routeSupportsRange(page.url.pathname));
    let sidebar = DEFAULT_SIDEBAR_STATE;
    let mobileOpen = false;
    let narrow = false;
    let zone = void 0;
    const buildStamp = derived(() => formatInstant("2026-08-16T07:46:31.713Z", "dateTime", zone));
    const buildTitle = derived(() => `Zbudowano: ${formatInstant("2026-08-16T07:46:31.713Z", "dateTime", zone)}${` · commit ${"a9d13ec"}`}`);
    $$renderer2.push(`<div${attr_class("shell svelte-a5rf23", void 0, { "mobile-open": mobileOpen, "tier-base": tier === "base" })}><aside id="app-sidebar" class="sidebar svelte-a5rf23" aria-label="Primary"${attr("inert", narrow, true)}><div class="brand svelte-a5rf23">`);
    SidebarToggle($$renderer2, { state: sidebar });
    $$renderer2.push(`<!----> `);
    if (brand) {
      $$renderer2.push("<!--[0-->");
      brand($$renderer2);
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<span class="brand-lockup svelte-a5rf23"><span class="brand-text svelte-a5rf23">Vagus</span> `);
      if (tier) {
        $$renderer2.push("<!--[0-->");
        TierBadge($$renderer2, { tier, size: "sm" });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></span>`);
    }
    $$renderer2.push(`<!--]--></div> <nav class="nav svelte-a5rf23">`);
    if (nav) {
      $$renderer2.push("<!--[0-->");
      nav($$renderer2);
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      NavLinks($$renderer2, { advanced });
    }
    $$renderer2.push(`<!--]--></nav> `);
    if (footer) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="sidebar-footer svelte-a5rf23">`);
      footer($$renderer2);
      $$renderer2.push(`<!----></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="build svelte-a5rf23"${attr("title", buildTitle())}><span class="build-label svelte-a5rf23">Wersja</span> <time class="build-time svelte-a5rf23"${attr("datetime", "2026-08-16T07:46:31.713Z")}>${escape_html(buildStamp())}</time> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="build-sha svelte-a5rf23">${escape_html("a9d13ec")}</span>`);
    }
    $$renderer2.push(`<!--]--></div></aside> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="frame svelte-a5rf23"><header class="topbar svelte-a5rf23"><button type="button" class="menu-btn svelte-a5rf23"${attr("aria-label", "Otwórz menu")}${attr("aria-expanded", mobileOpen)} aria-controls="app-sidebar"><svg class="menu-glyph svelte-a5rf23" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="17" x2="20" y2="17"></line></svg></button> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (title) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<h1 class="page-title svelte-a5rf23">${escape_html(title)}</h1>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (showRange()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="range-slot svelte-a5rf23">`);
      RangeSwitch($$renderer2, {});
      $$renderer2.push(`<!----></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="topbar-actions svelte-a5rf23">`);
    if (actions) {
      $$renderer2.push("<!--[0-->");
      actions($$renderer2);
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      LogoutButton($$renderer2);
    }
    $$renderer2.push(`<!--]--> `);
    ThemeToggle($$renderer2);
    $$renderer2.push(`<!----></div></header> <main class="content svelte-a5rf23">`);
    children?.($$renderer2);
    $$renderer2.push(`<!----></main></div></div>`);
  });
}
export {
  AppShell as A,
  IconButton as I,
  writeBoolPref as a,
  writePref as w
};
