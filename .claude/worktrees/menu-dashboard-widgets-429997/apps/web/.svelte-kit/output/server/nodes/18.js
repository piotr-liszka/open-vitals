import * as server from '../entries/pages/training/marsz/_page.server.ts.js';

export const index = 18;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/training/marsz/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/training/marsz/+page.server.ts";
export const imports = ["_app/immutable/nodes/18.G6lSzDwY.js","_app/immutable/chunks/hvkKsKub.js","_app/immutable/chunks/B15pK_uZ.js","_app/immutable/chunks/Cp0-CPbI.js","_app/immutable/chunks/CBVxy0c9.js","_app/immutable/chunks/C8-0Nf-4.js","_app/immutable/chunks/gIaL7xAg.js","_app/immutable/chunks/CXE_05hh.js","_app/immutable/chunks/CPgrv6jT.js","_app/immutable/chunks/B4l6nXVa.js","_app/immutable/chunks/CEu09gI5.js","_app/immutable/chunks/CHG_CAku.js","_app/immutable/chunks/Dy5T_rBj.js"];
export const stylesheets = ["_app/immutable/assets/date.CXE_nlgE.css","_app/immutable/assets/TrendChart._LOsMDiB.css","_app/immutable/assets/BarChart.qMmqKHN1.css","_app/immutable/assets/18.Yg-Af236.css"];
export const fonts = [];
