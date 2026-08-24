import { k as firstDayOf, s as startOfWeek, b as addDays, h as monthKeyOf } from './date.js-Cf0GyZI8.js';

const GRID_WEEKS = 6;
const DAYS_PER_WEEK = 7;
function monthGrid(month) {
  const first = firstDayOf(month);
  const start = startOfWeek(first);
  const cells = [];
  for (let i = 0; i < GRID_WEEKS * DAYS_PER_WEEK; i++) {
    const day = addDays(start, i);
    cells.push({ day, inMonth: monthKeyOf(day) === month });
  }
  return cells;
}
function monthWeeks(month) {
  const cells = monthGrid(month);
  const weeks = [];
  for (let i = 0; i < cells.length; i += DAYS_PER_WEEK) {
    weeks.push(cells.slice(i, i + DAYS_PER_WEEK));
  }
  return weeks;
}
function gridRange(month) {
  const cells = monthGrid(month);
  return { from: cells[0].day, to: cells[cells.length - 1].day };
}
function groupByDay(items, dayOf) {
  const out = /* @__PURE__ */ new Map();
  for (const item of items) {
    const day = dayOf(item);
    const bucket = out.get(day);
    if (bucket) bucket.push(item);
    else out.set(day, [item]);
  }
  return out;
}
function byTimeThenTitle(a, b) {
  if (a.time !== null && b.time !== null)
    return a.time.localeCompare(b.time) || a.title.localeCompare(b.title);
  if (a.time !== null) return -1;
  if (b.time !== null) return 1;
  return a.title.localeCompare(b.title);
}

export { groupByDay as a, byTimeThenTitle as b, gridRange as g, monthWeeks as m };
//# sourceMappingURL=planner.js-CsrGpx4j.js.map
