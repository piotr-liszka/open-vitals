import { r as root } from "./root.js";
import "./server.js";
let read_implementation = null;
function set_read_implementation(fn) {
  read_implementation = fn;
}
function set_manifest(_) {
}
let public_env = {};
function set_private_env(environment) {
}
function set_public_env(environment) {
  public_env = environment;
}
const error = ({ status, message }) => '<!doctype html>\n<html lang="en">\n	<head>\n		<meta charset="utf-8" />\n		<title>' + message + `</title>

		<style>
			body {
				--bg: white;
				--fg: #222;
				--divider: #ccc;
				background: var(--bg);
				color: var(--fg);
				font-family:
					system-ui,
					-apple-system,
					BlinkMacSystemFont,
					'Segoe UI',
					Roboto,
					Oxygen,
					Ubuntu,
					Cantarell,
					'Open Sans',
					'Helvetica Neue',
					sans-serif;
				display: flex;
				align-items: center;
				justify-content: center;
				height: 100vh;
				margin: 0;
			}

			.error {
				display: flex;
				align-items: center;
				max-width: 32rem;
				margin: 0 1rem;
			}

			.status {
				font-weight: 200;
				font-size: 3rem;
				line-height: 1;
				position: relative;
				top: -0.05rem;
			}

			.message {
				border-left: 1px solid var(--divider);
				padding: 0 0 0 1rem;
				margin: 0 0 0 1rem;
				min-height: 2.5rem;
				display: flex;
				align-items: center;
			}

			.message h1 {
				font-weight: 400;
				font-size: 1em;
				margin: 0;
			}

			@media (prefers-color-scheme: dark) {
				body {
					--bg: #222;
					--fg: #ddd;
					--divider: #666;
				}
			}
		</style>
	</head>
	<body>
		<div class="error">
			<span class="status">` + status + '</span>\n			<div class="message">\n				<h1>' + message + "</h1>\n			</div>\n		</div>\n	</body>\n</html>\n";
const options = {
  app_template_contains_nonce: true,
  async: false,
  csp: { "mode": "auto", "directives": { "default-src": ["self"], "connect-src": ["self"], "font-src": ["self"], "img-src": ["self", "data:", "https://lh3.googleusercontent.com", "https://*.basemaps.cartocdn.com"], "object-src": ["none"], "script-src": ["self"], "style-src": ["self", "unsafe-inline"], "base-uri": ["self"], "form-action": ["self"], "frame-ancestors": ["none"], "upgrade-insecure-requests": false, "block-all-mixed-content": false }, "reportOnly": { "upgrade-insecure-requests": false, "block-all-mixed-content": false } },
  csrf_check_origin: true,
  csrf_trusted_origins: [],
  embedded: false,
  env_public_prefix: "PUBLIC_",
  env_private_prefix: "",
  hash_routing: false,
  hooks: null,
  // added lazily, via `get_hooks`
  preload_strategy: "modulepreload",
  root,
  service_worker: false,
  service_worker_options: void 0,
  server_error_boundaries: false,
  templates: {
    app: ({ head, body, assets, nonce, env }) => '<!doctype html>\n<html lang="en" data-theme="light">\n  <head>\n    <meta charset="utf-8" />\n    <link rel="icon" href="' + assets + '/favicon.svg" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <meta name="color-scheme" content="light dark" />\n    <title>Vagus</title>\n    <!--\n      The nonce is REQUIRED, not decoration (spec 063). `kit.csp` sets `script-src \'self\'` plus a\n      per-response nonce, and SvelteKit only hashes the bootstrap IT injects — so this hand-written\n      block was being blocked by our own CSP on every single page load. It had been silently dead\n      since the policy landed: the theme below never ran, and `data-theme` on <html> above was doing\n      the whole job, which is why nobody noticed until a second pre-paint script needed to work.\n      Nothing here may be prerendered while this placeholder is used; `mode: \'auto\'` switches to\n      hashes for prerendered pages and the nonce would then be stale.\n    -->\n    <script nonce="' + nonce + "\">\n      // Apply saved/system theme before paint to avoid flash.\n      try {\n        const saved = localStorage.getItem('gb-theme');\n        const dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;\n        document.documentElement.dataset.theme = dark ? 'dark' : 'light';\n      } catch {}\n      // Same, for the sidebar collapse state (spec 063). This one is a LAYOUT change: applied after\n      // hydration it would reflow the whole page width in front of the reader on every load. Key and\n      // values mirror `$lib/ui/sidebar-state`, which this script cannot import.\n      try {\n        const s = localStorage.getItem('gb-sidebar');\n        if (s === 'icons' || s === 'hidden') document.documentElement.dataset.sidebar = s;\n      } catch {}\n    <\/script>\n    " + head + '\n  </head>\n  <body data-sveltekit-preload-data="hover">\n    <div style="display: contents">' + body + "</div>\n  </body>\n</html>\n",
    error
  },
  version_hash: "r5ovru"
};
async function get_hooks() {
  let handle;
  let handleFetch;
  let handleError;
  let handleValidationError;
  let init;
  ({ handle, handleFetch, handleError, handleValidationError, init } = await import("../entries/hooks.server.js"));
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
export {
  set_public_env as a,
  set_read_implementation as b,
  set_manifest as c,
  get_hooks as g,
  options as o,
  public_env as p,
  read_implementation as r,
  set_private_env as s
};
