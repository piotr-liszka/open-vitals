import * as server from '../entries/pages/training/plan/_page.server.ts.js';

export const index = 20;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/training/plan/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/training/plan/+page.server.ts";
export const imports = ["_app/immutable/nodes/20.DooT9dQ5.js","_app/immutable/chunks/hvkKsKub.js","_app/immutable/chunks/B15pK_uZ.js","_app/immutable/chunks/CBVxy0c9.js","_app/immutable/chunks/C8-0Nf-4.js","_app/immutable/chunks/Cp0-CPbI.js","_app/immutable/chunks/gIaL7xAg.js","_app/immutable/chunks/CXE_05hh.js","_app/immutable/chunks/CPgrv6jT.js","_app/immutable/chunks/C83CD1YW.js","_app/immutable/chunks/z8pvf9Av.js","_app/immutable/chunks/BYVjw9lJ.js","_app/immutable/chunks/jpYMVWJh.js","_app/immutable/chunks/DOdVZbh8.js","_app/immutable/chunks/Baggb9c1.js","_app/immutable/chunks/isSZUvs9.js","_app/immutable/chunks/DDUueMdh.js","_app/immutable/chunks/DrfMNaaD.js"];
export const stylesheets = ["_app/immutable/assets/date.CXE_nlgE.css","_app/immutable/assets/stores.PsmvzXhb.css","_app/immutable/assets/Badge.C9ADkSY6.css","_app/immutable/assets/20.A2ejnaZh.css"];
export const fonts = [];
