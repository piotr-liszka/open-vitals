const INT = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const ONE_DP = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
function fmtSleepDuration(seconds) {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  const minutes = Math.round(total / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}
function fmtChannelValue(metric) {
  if (metric.format === "duration") return fmtSleepDuration(metric.latest) ?? "—";
  return INT.format(Math.round(metric.latest));
}
function fmtDelta(metric) {
  if (metric.deltaPct === null || metric.direction === "flat") return null;
  const sign = metric.deltaPct > 0 ? "+" : "−";
  return `${sign}${ONE_DP.format(Math.abs(metric.deltaPct))}%`;
}
function fmtBaseline(metric) {
  if (metric.baseline === null) return null;
  if (metric.format === "duration") return fmtSleepDuration(metric.baseline);
  return INT.format(Math.round(metric.baseline));
}
function fmtRecovery(hours) {
  if (!Number.isFinite(hours) || hours <= 0) return "gotowy";
  const total = Math.round(hours);
  if (total < 24) return `${total} h`;
  const days = Math.floor(total / 24);
  const rest = total % 24;
  const dayWord = days === 1 ? "dzień" : "dni";
  return rest === 0 ? `${days} ${dayWord}` : `${days} ${dayWord} ${rest} h`;
}
function fmtPercent(value) {
  return value === null || !Number.isFinite(value) ? null : `${INT.format(Math.round(value))}%`;
}

export { fmtRecovery as a, fmtChannelValue as b, fmtDelta as c, fmtBaseline as d, fmtPercent as e, fmtSleepDuration as f };
//# sourceMappingURL=condition.format.js-D1Rk637l.js.map
