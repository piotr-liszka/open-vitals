
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/activities" | "/activities/mapa" | "/activities/[id]" | "/analytics" | "/api" | "/api/consent" | "/api/dashboards" | "/api/data" | "/api/data/coverage" | "/api/garmin" | "/api/garmin/disconnect" | "/api/garmin/setup" | "/api/garmin/status" | "/api/health" | "/api/insights" | "/api/integrations" | "/api/integrations/[provider]" | "/api/integrations/[provider]/callback" | "/api/integrations/[provider]/connect" | "/api/integrations/[provider]/disconnect" | "/api/integrations/[provider]/sync" | "/api/mcp-url" | "/api/season" | "/api/season/goals" | "/api/season/goals/[id]" | "/api/settings" | "/api/settings/mcp-token" | "/api/settings/mcp-token/rotate" | "/api/sync" | "/api/sync/diagnostics" | "/api/sync/status" | "/api/version" | "/api/workout-templates" | "/api/workout-templates/[id]" | "/api/workouts" | "/api/workouts/[id]" | "/auth" | "/auth/callback" | "/auth/login" | "/auth/logout" | "/dashboard" | "/dashboard/new" | "/dashboard/[id]" | "/data" | "/heatmap" | "/insights" | "/login" | "/power" | "/running" | "/settings" | "/settings/integrations" | "/styleguide" | "/training" | "/training/bieg" | "/training/cele" | "/training/marsz" | "/training/objetosc" | "/training/plan" | "/training/rower";
		RouteParams(): {
			"/activities/[id]": { id: string };
			"/api/integrations/[provider]": { provider: string };
			"/api/integrations/[provider]/callback": { provider: string };
			"/api/integrations/[provider]/connect": { provider: string };
			"/api/integrations/[provider]/disconnect": { provider: string };
			"/api/integrations/[provider]/sync": { provider: string };
			"/api/season/goals/[id]": { id: string };
			"/api/workout-templates/[id]": { id: string };
			"/api/workouts/[id]": { id: string };
			"/dashboard/[id]": { id: string }
		};
		LayoutParams(): {
			"/": { id?: string | undefined; provider?: string | undefined };
			"/activities": { id?: string | undefined };
			"/activities/mapa": Record<string, never>;
			"/activities/[id]": { id: string };
			"/analytics": Record<string, never>;
			"/api": { provider?: string | undefined; id?: string | undefined };
			"/api/consent": Record<string, never>;
			"/api/dashboards": Record<string, never>;
			"/api/data": Record<string, never>;
			"/api/data/coverage": Record<string, never>;
			"/api/garmin": Record<string, never>;
			"/api/garmin/disconnect": Record<string, never>;
			"/api/garmin/setup": Record<string, never>;
			"/api/garmin/status": Record<string, never>;
			"/api/health": Record<string, never>;
			"/api/insights": Record<string, never>;
			"/api/integrations": { provider?: string | undefined };
			"/api/integrations/[provider]": { provider: string };
			"/api/integrations/[provider]/callback": { provider: string };
			"/api/integrations/[provider]/connect": { provider: string };
			"/api/integrations/[provider]/disconnect": { provider: string };
			"/api/integrations/[provider]/sync": { provider: string };
			"/api/mcp-url": Record<string, never>;
			"/api/season": { id?: string | undefined };
			"/api/season/goals": { id?: string | undefined };
			"/api/season/goals/[id]": { id: string };
			"/api/settings": Record<string, never>;
			"/api/settings/mcp-token": Record<string, never>;
			"/api/settings/mcp-token/rotate": Record<string, never>;
			"/api/sync": Record<string, never>;
			"/api/sync/diagnostics": Record<string, never>;
			"/api/sync/status": Record<string, never>;
			"/api/version": Record<string, never>;
			"/api/workout-templates": { id?: string | undefined };
			"/api/workout-templates/[id]": { id: string };
			"/api/workouts": { id?: string | undefined };
			"/api/workouts/[id]": { id: string };
			"/auth": Record<string, never>;
			"/auth/callback": Record<string, never>;
			"/auth/login": Record<string, never>;
			"/auth/logout": Record<string, never>;
			"/dashboard": { id?: string | undefined };
			"/dashboard/new": Record<string, never>;
			"/dashboard/[id]": { id: string };
			"/data": Record<string, never>;
			"/heatmap": Record<string, never>;
			"/insights": Record<string, never>;
			"/login": Record<string, never>;
			"/power": Record<string, never>;
			"/running": Record<string, never>;
			"/settings": Record<string, never>;
			"/settings/integrations": Record<string, never>;
			"/styleguide": Record<string, never>;
			"/training": Record<string, never>;
			"/training/bieg": Record<string, never>;
			"/training/cele": Record<string, never>;
			"/training/marsz": Record<string, never>;
			"/training/objetosc": Record<string, never>;
			"/training/plan": Record<string, never>;
			"/training/rower": Record<string, never>
		};
		Pathname(): "/" | "/activities" | "/activities/mapa" | `/activities/${string}` & {} | "/analytics" | "/api/consent" | "/api/dashboards" | "/api/data/coverage" | "/api/garmin/disconnect" | "/api/garmin/setup" | "/api/garmin/status" | "/api/health" | "/api/insights" | `/api/integrations/${string}/callback` & {} | `/api/integrations/${string}/connect` & {} | `/api/integrations/${string}/disconnect` & {} | `/api/integrations/${string}/sync` & {} | "/api/mcp-url" | "/api/season/goals" | `/api/season/goals/${string}` & {} | "/api/settings/mcp-token/rotate" | "/api/sync" | "/api/sync/diagnostics" | "/api/sync/status" | "/api/version" | "/api/workout-templates" | `/api/workout-templates/${string}` & {} | "/api/workouts" | `/api/workouts/${string}` & {} | "/auth/callback" | "/auth/login" | "/auth/logout" | "/dashboard" | "/dashboard/new" | `/dashboard/${string}` & {} | "/data" | "/heatmap" | "/insights" | "/login" | "/power" | "/running" | "/settings" | "/settings/integrations" | "/styleguide" | "/training" | "/training/bieg" | "/training/cele" | "/training/marsz" | "/training/objetosc" | "/training/plan" | "/training/rower";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/favicon.svg" | string & {};
	}
}