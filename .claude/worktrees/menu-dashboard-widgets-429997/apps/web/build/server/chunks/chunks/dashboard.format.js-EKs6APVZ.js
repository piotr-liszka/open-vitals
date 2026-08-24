function formatMetricValue(n, format) {
  if (n === null || !Number.isFinite(n)) return null;
  switch (format) {
    case "int":
      return Math.round(n).toLocaleString("pl-PL");
    case "decimal":
      return n.toFixed(1);
    case "duration": {
      const total = Math.max(0, Math.round(n));
      const h = Math.floor(total / 3600);
      const m = Math.floor(total % 3600 / 60);
      return `${h}h ${String(m).padStart(2, "0")}m`;
    }
    default:
      return n;
  }
}
function formatMetricText(n, format) {
  return String(formatMetricValue(n, format) ?? "—");
}

export { formatMetricText as a, formatMetricValue as f };
//# sourceMappingURL=dashboard.format.js-EKs6APVZ.js.map
