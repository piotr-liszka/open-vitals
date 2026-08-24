
import root from '../root.js';
import { set_building, set_prerendering } from '$app/env/internal';
import { set_assets } from '$app/paths/internal/server';
import { set_manifest, set_read_implementation } from '__sveltekit/server';
import { set_private_env, set_public_env } from '../../../node_modules/.pnpm/@sveltejs+kit@2.70.2_@sveltejs+vite-plugin-svelte@4.0.4_svelte@5.56.8_vite@5.4.21_@types+node_o3ekahsndvl2k2tiyhmdgapo7q/node_modules/@sveltejs/kit/src/runtime/shared-server.js';
import error from '../shared/error-template.js';

export const options = {
	app_template_contains_nonce: true,
	async: false,
	csp: {"mode":"auto","directives":{"default-src":["self"],"connect-src":["self"],"font-src":["self"],"img-src":["self","data:","https://lh3.googleusercontent.com","https://*.basemaps.cartocdn.com"],"object-src":["none"],"script-src":["self"],"style-src":["self","unsafe-inline"],"base-uri":["self"],"form-action":["self"],"frame-ancestors":["none"],"upgrade-insecure-requests":false,"block-all-mixed-content":false},"reportOnly":{"upgrade-insecure-requests":false,"block-all-mixed-content":false}},
	csrf_check_origin: true,
	csrf_trusted_origins: [],
	embedded: false,
	env_public_prefix: 'PUBLIC_',
	env_private_prefix: '',
	hash_routing: false,
	hooks: null, // added lazily, via `get_hooks`
	preload_strategy: "modulepreload",
	root,
	service_worker: false,
	service_worker_options: undefined,
	server_error_boundaries: false,
	templates: {
		app: ({ head, body, assets, nonce, env }) => "<!doctype html>\n<html lang=\"en\" data-theme=\"light\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <link rel=\"icon\" href=\"" + assets + "/favicon.svg\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n    <meta name=\"color-scheme\" content=\"light dark\" />\n    <title>Vagus</title>\n    <!--\n      The nonce is REQUIRED, not decoration (spec 063). `kit.csp` sets `script-src 'self'` plus a\n      per-response nonce, and SvelteKit only hashes the bootstrap IT injects — so this hand-written\n      block was being blocked by our own CSP on every single page load. It had been silently dead\n      since the policy landed: the theme below never ran, and `data-theme` on <html> above was doing\n      the whole job, which is why nobody noticed until a second pre-paint script needed to work.\n      Nothing here may be prerendered while this placeholder is used; `mode: 'auto'` switches to\n      hashes for prerendered pages and the nonce would then be stale.\n    -->\n    <script nonce=\"" + nonce + "\">\n      // Apply saved/system theme before paint to avoid flash.\n      try {\n        const saved = localStorage.getItem('gb-theme');\n        const dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;\n        document.documentElement.dataset.theme = dark ? 'dark' : 'light';\n      } catch {}\n      // Same, for the sidebar collapse state (spec 063). This one is a LAYOUT change: applied after\n      // hydration it would reflow the whole page width in front of the reader on every load. Key and\n      // values mirror `$lib/ui/sidebar-state`, which this script cannot import.\n      try {\n        const s = localStorage.getItem('gb-sidebar');\n        if (s === 'icons' || s === 'hidden') document.documentElement.dataset.sidebar = s;\n      } catch {}\n    </script>\n    " + head + "\n  </head>\n  <body data-sveltekit-preload-data=\"hover\">\n    <div style=\"display: contents\">" + body + "</div>\n  </body>\n</html>\n",
		error
	},
	version_hash: "f61n5o"
};

export async function get_hooks() {
	let handle;
	let handleFetch;
	let handleError;
	let handleValidationError;
	let init;
	({ handle, handleFetch, handleError, handleValidationError, init } = await import("../../../src/hooks.server.ts"));

	let reroute;
	let transport;
	

	return {
		handle,
		handleFetch,
		handleError,
		handleValidationError,
		init,
		reroute,
		transport
	};
}

export { set_assets, set_building, set_manifest, set_prerendering, set_private_env, set_public_env, set_read_implementation };
