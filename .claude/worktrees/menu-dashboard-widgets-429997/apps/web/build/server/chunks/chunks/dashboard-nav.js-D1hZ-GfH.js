const NAV_GROUP_DASHBOARDS = "Panele";
const NEW_DASHBOARD_HREF = "/dashboard/new";
const dashboardHref = (id) => `/dashboard/${id}`;
function dashboardNavItems(entries) {
  const items = entries.map((d) => ({
    href: dashboardHref(d.id),
    label: d.name,
    icon: "grid",
    advanced: true,
    group: NAV_GROUP_DASHBOARDS
  }));
  items.push({
    href: NEW_DASHBOARD_HREF,
    label: "Nowy panel",
    icon: "plus",
    advanced: true,
    group: NAV_GROUP_DASHBOARDS
  });
  return items;
}

export { dashboardHref as a, dashboardNavItems as d };
//# sourceMappingURL=dashboard-nav.js-D1hZ-GfH.js.map
