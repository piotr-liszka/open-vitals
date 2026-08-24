const ACTIVITIES_TABS = [
  { href: "/activities", label: "Lista" },
  { href: "/activities/mapa", label: "Mapa" }
];
function activitiesTitle(pathname) {
  const tab = ACTIVITIES_TABS.find((t) => t.href === pathname);
  return tab && tab.href !== "/activities" ? `Aktywności · ${tab.label}` : "Aktywności";
}

export { ACTIVITIES_TABS as A, activitiesTitle as a };
//# sourceMappingURL=activities-nav.js-DnDyVTYo.js.map
