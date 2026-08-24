import * as server from '../entries/pages/training/rower/_page.server.ts.js';

export const index = 21;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/training/rower/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/training/rower/+page.server.ts";
export const imports = ["_app/immutable/nodes/21.CcHhqaoh.js","_app/immutable/chunks/hvkKsKub.js","_app/immutable/chunks/B15pK_uZ.js","_app/immutable/chunks/Cp0-CPbI.js","_app/immutable/chunks/CBVxy0c9.js","_app/immutable/chunks/C8-0Nf-4.js","_app/immutable/chunks/gIaL7xAg.js","_app/immutable/chunks/CXE_05hh.js","_app/immutable/chunks/CPgrv6jT.js","_app/immutable/chunks/jpYMVWJh.js","_app/immutable/chunks/Bu8MfUrC.js","_app/immutable/chunks/CHG_CAku.js","_app/immutable/chunks/DT3JPlgt.js"];
export const stylesheets = ["_app/immutable/assets/date.CXE_nlgE.css","_app/immutable/assets/Badge.C9ADkSY6.css","_app/immutable/assets/Table.BDK44Tgb.css","_app/immutable/assets/TrendChart._LOsMDiB.css","_app/immutable/assets/RadarChart.D1frK0He.css","_app/immutable/assets/21.BSxi4R7K.css"];
export const fonts = [];
