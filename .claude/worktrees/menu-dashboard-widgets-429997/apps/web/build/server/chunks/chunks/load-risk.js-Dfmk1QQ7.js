const MIN_HISTORY_DAYS = 28;
const ACWR_LOW = 0.8;
const ACWR_HIGH = 1.3;
const ACWR_VERY_HIGH = 1.5;
const RAMP_HIGH = 7;
const RAMP_LOW = -7;
const RAMP_WINDOW_DAYS = 14;
const ADVICE = {
  detraining: "Obciążenie spadło wyraźnie poniżej tego, do czego jesteś przygotowany. Jeśli to nie zaplanowane roztrenowanie ani choroba, wróć do regularnych jednostek — forma tlenowa cofa się szybciej, niż narasta.",
  steady: "Obciążenie ostatniego tygodnia mieści się w tym, do czego jesteś przygotowany. To zakres, w którym można bezpiecznie budować.",
  building: "Budujesz formę w rozsądnym tempie — obciążenie rośnie, ale nie ucieka bazie. Utrzymaj ten kierunek i pilnuj tygodni odciążających.",
  overreaching: "Ostatni tydzień jest wyraźnie mocniejszy od Twojej bazy. Jeden taki tydzień to normalny bodziec; dwa lub trzy pod rząd to najczęstsza droga do kontuzji przeciążeniowej.",
  spike: "Skok obciążenia: ostatni tydzień znacznie przewyższa to, do czego jesteś przygotowany. Najbezpieczniejszy ruch to lżejszy tydzień, zanim wróci normalny plan."
};
function bandFor(acwr, rampPerWeek) {
  if (acwr >= ACWR_VERY_HIGH) return "spike";
  if (acwr > ACWR_HIGH) return "overreaching";
  if (acwr < ACWR_LOW) return rampPerWeek <= RAMP_LOW ? "detraining" : "steady";
  if (rampPerWeek > RAMP_HIGH) return "overreaching";
  if (rampPerWeek <= RAMP_LOW) return "detraining";
  return rampPerWeek > 0 ? "building" : "steady";
}
function loadRisk(series) {
  const historyDays = series.length;
  const last = series[historyDays - 1];
  if (!last || historyDays < MIN_HISTORY_DAYS || last.ctl <= 0) {
    return {
      acwr: null,
      rampRatePerWeek: null,
      band: "steady",
      advice: "Za mało historii, aby ocenić tempo narastania obciążenia. Potrzebne są około cztery tygodnie ciągłych danych — wcześniej wskaźniki liczone z niepełnej bazy tylko straszą.",
      historyDays
    };
  }
  const acwr = round2(last.atl / last.ctl);
  const backIndex = Math.max(0, historyDays - 1 - RAMP_WINDOW_DAYS);
  const back = series[backIndex];
  const spanDays = historyDays - 1 - backIndex;
  const rampRatePerWeek = back && spanDays > 0 ? round1((last.ctl - back.ctl) / spanDays * 7) : null;
  const band = bandFor(acwr, rampRatePerWeek ?? 0);
  return { acwr, rampRatePerWeek, band, advice: ADVICE[band], historyDays };
}
function round1(v) {
  return Math.round(v * 10) / 10;
}
function round2(v) {
  return Math.round(v * 100) / 100;
}

export { MIN_HISTORY_DAYS as M, RAMP_HIGH as R, loadRisk as l };
//# sourceMappingURL=load-risk.js-Dfmk1QQ7.js.map
