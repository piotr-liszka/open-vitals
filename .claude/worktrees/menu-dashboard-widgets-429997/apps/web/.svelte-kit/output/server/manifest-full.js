export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["favicon.svg"]),
	mimeTypes: {".svg":"image/svg+xml"},
	_: {
		client: {start:"_app/immutable/entry/start.B-8-s0f6.js",app:"_app/immutable/entry/app.Ci1vpDMl.js",imports:["_app/immutable/entry/start.B-8-s0f6.js","_app/immutable/chunks/z8pvf9Av.js","_app/immutable/chunks/B15pK_uZ.js","_app/immutable/chunks/C8-0Nf-4.js","_app/immutable/chunks/BYVjw9lJ.js","_app/immutable/entry/app.Ci1vpDMl.js","_app/immutable/chunks/C1FmrZbK.js","_app/immutable/chunks/B15pK_uZ.js","_app/immutable/chunks/Cp0-CPbI.js","_app/immutable/chunks/hvkKsKub.js","_app/immutable/chunks/BYVjw9lJ.js","_app/immutable/chunks/CBVxy0c9.js","_app/immutable/chunks/C8-0Nf-4.js","_app/immutable/chunks/9TmiGis6.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js')),
			__memo(() => import('./nodes/7.js')),
			__memo(() => import('./nodes/8.js')),
			__memo(() => import('./nodes/9.js')),
			__memo(() => import('./nodes/10.js')),
			__memo(() => import('./nodes/11.js')),
			__memo(() => import('./nodes/12.js')),
			__memo(() => import('./nodes/13.js')),
			__memo(() => import('./nodes/14.js')),
			__memo(() => import('./nodes/15.js')),
			__memo(() => import('./nodes/16.js')),
			__memo(() => import('./nodes/17.js')),
			__memo(() => import('./nodes/18.js')),
			__memo(() => import('./nodes/19.js')),
			__memo(() => import('./nodes/20.js')),
			__memo(() => import('./nodes/21.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/activities",
				pattern: /^\/activities\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/activities/mapa",
				pattern: /^\/activities\/mapa\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/activities/[id]",
				pattern: /^\/activities\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/analytics",
				pattern: /^\/analytics\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/analytics/_server.ts.js'))
			},
			{
				id: "/api/consent",
				pattern: /^\/api\/consent\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/consent/_server.ts.js'))
			},
			{
				id: "/api/dashboards",
				pattern: /^\/api\/dashboards\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/dashboards/_server.ts.js'))
			},
			{
				id: "/api/data/coverage",
				pattern: /^\/api\/data\/coverage\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/data/coverage/_server.ts.js'))
			},
			{
				id: "/api/garmin/disconnect",
				pattern: /^\/api\/garmin\/disconnect\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/garmin/disconnect/_server.ts.js'))
			},
			{
				id: "/api/garmin/setup",
				pattern: /^\/api\/garmin\/setup\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/garmin/setup/_server.ts.js'))
			},
			{
				id: "/api/garmin/status",
				pattern: /^\/api\/garmin\/status\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/garmin/status/_server.ts.js'))
			},
			{
				id: "/api/health",
				pattern: /^\/api\/health\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/health/_server.ts.js'))
			},
			{
				id: "/api/insights",
				pattern: /^\/api\/insights\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/insights/_server.ts.js'))
			},
			{
				id: "/api/integrations/[provider]/callback",
				pattern: /^\/api\/integrations\/([^/]+?)\/callback\/?$/,
				params: [{"name":"provider","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/integrations/_provider_/callback/_server.ts.js'))
			},
			{
				id: "/api/integrations/[provider]/connect",
				pattern: /^\/api\/integrations\/([^/]+?)\/connect\/?$/,
				params: [{"name":"provider","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/integrations/_provider_/connect/_server.ts.js'))
			},
			{
				id: "/api/integrations/[provider]/disconnect",
				pattern: /^\/api\/integrations\/([^/]+?)\/disconnect\/?$/,
				params: [{"name":"provider","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/integrations/_provider_/disconnect/_server.ts.js'))
			},
			{
				id: "/api/integrations/[provider]/sync",
				pattern: /^\/api\/integrations\/([^/]+?)\/sync\/?$/,
				params: [{"name":"provider","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/integrations/_provider_/sync/_server.ts.js'))
			},
			{
				id: "/api/mcp-url",
				pattern: /^\/api\/mcp-url\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/mcp-url/_server.ts.js'))
			},
			{
				id: "/api/season/goals",
				pattern: /^\/api\/season\/goals\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/season/goals/_server.ts.js'))
			},
			{
				id: "/api/season/goals/[id]",
				pattern: /^\/api\/season\/goals\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/season/goals/_id_/_server.ts.js'))
			},
			{
				id: "/api/settings/mcp-token/rotate",
				pattern: /^\/api\/settings\/mcp-token\/rotate\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/settings/mcp-token/rotate/_server.ts.js'))
			},
			{
				id: "/api/sync",
				pattern: /^\/api\/sync\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/sync/_server.ts.js'))
			},
			{
				id: "/api/sync/diagnostics",
				pattern: /^\/api\/sync\/diagnostics\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/sync/diagnostics/_server.ts.js'))
			},
			{
				id: "/api/sync/status",
				pattern: /^\/api\/sync\/status\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/sync/status/_server.ts.js'))
			},
			{
				id: "/api/version",
				pattern: /^\/api\/version\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/version/_server.ts.js'))
			},
			{
				id: "/api/workout-templates",
				pattern: /^\/api\/workout-templates\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/workout-templates/_server.ts.js'))
			},
			{
				id: "/api/workout-templates/[id]",
				pattern: /^\/api\/workout-templates\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/workout-templates/_id_/_server.ts.js'))
			},
			{
				id: "/api/workouts",
				pattern: /^\/api\/workouts\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/workouts/_server.ts.js'))
			},
			{
				id: "/api/workouts/[id]",
				pattern: /^\/api\/workouts\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/workouts/_id_/_server.ts.js'))
			},
			{
				id: "/auth/callback",
				pattern: /^\/auth\/callback\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/auth/callback/_server.ts.js'))
			},
			{
				id: "/auth/login",
				pattern: /^\/auth\/login\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/auth/login/_server.ts.js'))
			},
			{
				id: "/auth/logout",
				pattern: /^\/auth\/logout\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/auth/logout/_server.ts.js'))
			},
			{
				id: "/dashboard",
				pattern: /^\/dashboard\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/dashboard/_server.ts.js'))
			},
			{
				id: "/dashboard/new",
				pattern: /^\/dashboard\/new\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/dashboard/[id]",
				pattern: /^\/dashboard\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/data",
				pattern: /^\/data\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 9 },
				endpoint: null
			},
			{
				id: "/heatmap",
				pattern: /^\/heatmap\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/heatmap/_server.ts.js'))
			},
			{
				id: "/insights",
				pattern: /^\/insights\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 10 },
				endpoint: null
			},
			{
				id: "/login",
				pattern: /^\/login\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 11 },
				endpoint: null
			},
			{
				id: "/power",
				pattern: /^\/power\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/power/_server.ts.js'))
			},
			{
				id: "/running",
				pattern: /^\/running\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/running/_server.ts.js'))
			},
			{
				id: "/settings",
				pattern: /^\/settings\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 12 },
				endpoint: null
			},
			{
				id: "/settings/integrations",
				pattern: /^\/settings\/integrations\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 13 },
				endpoint: null
			},
			{
				id: "/styleguide",
				pattern: /^\/styleguide\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 14 },
				endpoint: null
			},
			{
				id: "/training",
				pattern: /^\/training\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 15 },
				endpoint: null
			},
			{
				id: "/training/bieg",
				pattern: /^\/training\/bieg\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 16 },
				endpoint: null
			},
			{
				id: "/training/cele",
				pattern: /^\/training\/cele\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 17 },
				endpoint: null
			},
			{
				id: "/training/marsz",
				pattern: /^\/training\/marsz\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 18 },
				endpoint: null
			},
			{
				id: "/training/objetosc",
				pattern: /^\/training\/objetosc\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 19 },
				endpoint: null
			},
			{
				id: "/training/plan",
				pattern: /^\/training\/plan\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 20 },
				endpoint: null
			},
			{
				id: "/training/rower",
				pattern: /^\/training\/rower\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 21 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
