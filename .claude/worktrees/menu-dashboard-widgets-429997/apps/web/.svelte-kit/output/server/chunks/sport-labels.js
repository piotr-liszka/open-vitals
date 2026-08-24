const SPORT_LABELS = [
  /* ---- ride ---- */
  { key: "cycling", label: "Rower", group: "ride" },
  { key: "road_biking", label: "Rower szosowy", group: "ride" },
  { key: "mountain_biking", label: "Rower górski", group: "ride" },
  { key: "gravel_cycling", label: "Gravel", group: "ride" },
  { key: "cyclocross", label: "Przełaje", group: "ride" },
  { key: "downhill_biking", label: "Rower zjazdowy", group: "ride" },
  { key: "virtual_ride", label: "Rower wirtualny", group: "ride" },
  { key: "indoor_cycling", label: "Rower stacjonarny", group: "ride" },
  { key: "track_cycling", label: "Kolarstwo torowe", group: "ride" },
  { key: "bmx", label: "BMX", group: "ride" },
  { key: "recumbent_cycling", label: "Rower poziomy", group: "ride" },
  { key: "handcycling", label: "Handbike", group: "ride" },
  { key: "indoor_handcycling", label: "Handbike stacjonarny", group: "ride" },
  { key: "e_bike_fitness", label: "Rower elektryczny", group: "ride" },
  { key: "e_bike_mountain", label: "Rower elektryczny górski", group: "ride" },
  { key: "ebikeride", label: "Rower elektryczny", group: "ride" },
  /* ---- run ---- */
  { key: "running", label: "Bieg", group: "run" },
  { key: "trail_running", label: "Bieg terenowy", group: "run" },
  { key: "street_running", label: "Bieg uliczny", group: "run" },
  { key: "track_running", label: "Bieg na stadionie", group: "run" },
  { key: "treadmill_running", label: "Bieżnia", group: "run" },
  { key: "indoor_running", label: "Bieg w hali", group: "run" },
  { key: "virtual_run", label: "Bieg wirtualny", group: "run" },
  { key: "obstacle_run", label: "Bieg z przeszkodami", group: "run" },
  { key: "ultra_run", label: "Bieg ultra", group: "run" },
  /* ---- swim ---- */
  { key: "swimming", label: "Pływanie", group: "swim" },
  { key: "lap_swimming", label: "Pływanie (basen)", group: "swim" },
  { key: "open_water_swimming", label: "Pływanie (wody otwarte)", group: "swim" },
  /* ---- walk ---- */
  { key: "walking", label: "Marsz", group: "walk" },
  { key: "casual_walking", label: "Spacer", group: "walk" },
  { key: "speed_walking", label: "Marsz szybki", group: "walk" },
  { key: "indoor_walking", label: "Marsz w pomieszczeniu", group: "walk" },
  { key: "hiking", label: "Wędrówka", group: "walk" },
  { key: "rucking", label: "Marsz z obciążeniem", group: "walk" },
  { key: "mountaineering", label: "Turystyka wysokogórska", group: "walk" },
  /* ---- strength / gym ---- */
  { key: "strength_training", label: "Siłownia", group: "strength" },
  { key: "functional_strength", label: "Trening funkcjonalny", group: "strength" },
  { key: "indoor_cardio", label: "Trening cardio", group: "strength" },
  { key: "cardio_training", label: "Trening cardio", group: "strength" },
  { key: "hiit", label: "Trening interwałowy (HIIT)", group: "strength" },
  { key: "pilates", label: "Pilates", group: "strength" },
  { key: "elliptical", label: "Orbitrek", group: "strength" },
  { key: "stair_climbing", label: "Stepper", group: "strength" },
  { key: "indoor_rowing", label: "Wioślarstwo (ergometr)", group: "strength" },
  /* ---- other ---- */
  { key: "yoga", label: "Joga", group: "other" },
  { key: "breathwork", label: "Oddech", group: "other" },
  { key: "meditation", label: "Medytacja", group: "other" },
  { key: "stretching", label: "Rozciąganie", group: "other" },
  { key: "rowing", label: "Wioślarstwo", group: "other" },
  { key: "kayaking", label: "Kajak", group: "other" },
  { key: "canoeing", label: "Kanadyjka", group: "other" },
  { key: "stand_up_paddleboarding", label: "Deska SUP", group: "other" },
  { key: "whitewater_rafting", label: "Rafting", group: "other" },
  { key: "sailing", label: "Żeglarstwo", group: "other" },
  { key: "surfing", label: "Surfing", group: "other" },
  { key: "windsurfing", label: "Windsurfing", group: "other" },
  { key: "kitesurfing", label: "Kitesurfing", group: "other" },
  { key: "inline_skating", label: "Rolki", group: "other" },
  { key: "skateboarding", label: "Deskorolka", group: "other" },
  { key: "ice_skating", label: "Łyżwy", group: "other" },
  { key: "skate_skiing", label: "Narty biegowe (łyżwa)", group: "other" },
  { key: "cross_country_skiing", label: "Narty biegowe", group: "other" },
  { key: "cross_country_skiing_ws", label: "Narty biegowe", group: "other" },
  { key: "backcountry_skiing", label: "Skitury", group: "other" },
  { key: "resort_skiing", label: "Narty zjazdowe", group: "other" },
  { key: "resort_skiing_snowboarding_ws", label: "Narty / snowboard", group: "other" },
  { key: "snowboarding", label: "Snowboard", group: "other" },
  { key: "snowshoeing", label: "Rakiety śnieżne", group: "other" },
  { key: "snowmobiling", label: "Skuter śnieżny", group: "other" },
  { key: "rock_climbing", label: "Wspinaczka skałkowa", group: "other" },
  { key: "indoor_climbing", label: "Wspinaczka (ścianka)", group: "other" },
  { key: "bouldering", label: "Bouldering", group: "other" },
  { key: "tennis", label: "Tenis", group: "other" },
  { key: "table_tennis", label: "Tenis stołowy", group: "other" },
  { key: "padel", label: "Padel", group: "other" },
  { key: "squash", label: "Squash", group: "other" },
  { key: "badminton", label: "Badminton", group: "other" },
  { key: "soccer", label: "Piłka nożna", group: "other" },
  { key: "basketball", label: "Koszykówka", group: "other" },
  { key: "volleyball", label: "Siatkówka", group: "other" },
  { key: "golf", label: "Golf", group: "other" },
  { key: "boxing", label: "Boks", group: "other" },
  { key: "horseback_riding", label: "Jazda konna", group: "other" },
  { key: "fishing", label: "Wędkarstwo", group: "other" },
  { key: "hunting", label: "Łowiectwo", group: "other" },
  { key: "triathlon", label: "Triatlon", group: "other" },
  { key: "multi_sport", label: "Multisport", group: "other" },
  { key: "transition", label: "Strefa zmian", group: "other" },
  { key: "winter_sports", label: "Sporty zimowe", group: "other" },
  { key: "other", label: "Inne", group: "other" }
];
const BY_KEY = new Map(SPORT_LABELS.map((s) => [s.key, s]));
const SPORT_GROUP_LABELS = {
  ride: "Rower",
  run: "Bieg",
  walk: "Marsz",
  swim: "Pływanie",
  strength: "Siła",
  other: "Inne"
};
const KEYS_BY_GROUP = (() => {
  const m = /* @__PURE__ */ new Map();
  for (const s of SPORT_LABELS) {
    const bucket = m.get(s.group);
    if (bucket) bucket.push(s.key);
    else m.set(s.group, [s.key]);
  }
  return m;
})();
function humanizeSportKey(key) {
  const words = key.replace(/[_-]+/g, " ").trim().toLocaleLowerCase("pl-PL");
  if (words.length === 0) return "Inne";
  return words.charAt(0).toLocaleUpperCase("pl-PL") + words.slice(1);
}
function sportLabel(key) {
  return BY_KEY.get(key)?.label ?? humanizeSportKey(key);
}
function sportMeta(key) {
  return BY_KEY.get(key);
}
function sportGroup(key) {
  return BY_KEY.get(key)?.group ?? "other";
}
function sportGroupLabel(group) {
  return SPORT_GROUP_LABELS[group];
}
function isSportGroup(value) {
  return typeof value === "string" && Object.hasOwn(SPORT_GROUP_LABELS, value);
}
const SPORT_GROUP_LANES = {
  ride: "var(--lane-cyan)",
  run: "var(--lane-orange)",
  walk: "var(--lane-green)",
  swim: "var(--lane-sky)",
  strength: "var(--lane-violet)",
  other: "var(--lane-amber)"
};
function sportGroupLane(group) {
  return SPORT_GROUP_LANES[group];
}
function sportKeysInGroup(group) {
  return KEYS_BY_GROUP.get(group) ?? [];
}
export {
  SPORT_GROUP_LANES as S,
  sportGroup as a,
  sportLabel as b,
  sportMeta as c,
  sportGroupLane as d,
  sportGroupLabel as e,
  SPORT_LABELS as f,
  isSportGroup as i,
  sportKeysInGroup as s
};
