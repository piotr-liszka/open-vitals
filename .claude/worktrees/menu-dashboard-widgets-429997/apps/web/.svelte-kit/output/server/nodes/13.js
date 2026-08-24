import * as server from '../entries/pages/settings/integrations/_page.server.ts.js';

export const index = 13;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/settings/integrations/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/settings/integrations/+page.server.ts";
export const imports = ["_app/immutable/nodes/13.Buy4mutW.js","_app/immutable/chunks/hvkKsKub.js","_app/immutable/chunks/B15pK_uZ.js","_app/immutable/chunks/Cde6BEiq.js"];
export const stylesheets = [];
export const fonts = [];
