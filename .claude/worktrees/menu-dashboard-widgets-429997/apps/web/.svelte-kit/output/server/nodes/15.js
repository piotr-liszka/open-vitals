import * as server from '../entries/pages/training/_page.server.ts.js';

export const index = 15;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/training/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/training/+page.server.ts";
export const imports = ["_app/immutable/nodes/15.BteqCEoU.js","_app/immutable/chunks/hvkKsKub.js","_app/immutable/chunks/B15pK_uZ.js","_app/immutable/chunks/Cp0-CPbI.js","_app/immutable/chunks/CBVxy0c9.js","_app/immutable/chunks/C8-0Nf-4.js","_app/immutable/chunks/gIaL7xAg.js","_app/immutable/chunks/CXE_05hh.js","_app/immutable/chunks/CPgrv6jT.js","_app/immutable/chunks/jpYMVWJh.js","_app/immutable/chunks/B4l6nXVa.js","_app/immutable/chunks/CEu09gI5.js","_app/immutable/chunks/CHG_CAku.js","_app/immutable/chunks/BbC3dkpK.js","_app/immutable/chunks/Dy5T_rBj.js","_app/immutable/chunks/isSZUvs9.js","_app/immutable/chunks/jcMAoJML.js"];
export const stylesheets = ["_app/immutable/assets/date.CXE_nlgE.css","_app/immutable/assets/Badge.C9ADkSY6.css","_app/immutable/assets/TrendChart._LOsMDiB.css","_app/immutable/assets/BarChart.qMmqKHN1.css","_app/immutable/assets/StackedBar.BBwLl61w.css","_app/immutable/assets/FilterChips.B9RzzoNx.css","_app/immutable/assets/15.B_FYr3s2.css"];
export const fonts = [];
