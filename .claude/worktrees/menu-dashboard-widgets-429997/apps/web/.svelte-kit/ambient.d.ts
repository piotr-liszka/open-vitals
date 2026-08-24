
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/private';
 * 
 * console.log(ENVIRONMENT); // => "production"
 * console.log(PUBLIC_BASE_URL); // => throws error during build
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/private' {
	export const SVELTEKIT_FORK: string;
	export const npm_node_execpath: string;
	export const USE_STAGING_OAUTH: string;
	export const CLAUDECODE: string;
	export const OSLogRateLimit: string;
	export const npm_package_devDependencies__types_node: string;
	export const npm_config_user_agent: string;
	export const npm_package_scripts_preview: string;
	export const CLAUDE_CODE_SDK_HAS_HOST_AUTH_REFRESH: string;
	export const npm_lifecycle_script: string;
	export const npm_package_dependencies_zod: string;
	export const CLAUDE_CODE_EXECPATH: string;
	export const SHLVL: string;
	export const npm_package_scripts_test: string;
	export const HOME: string;
	export const XPC_SERVICE_NAME: string;
	export const NODE_USE_SYSTEM_CA: string;
	export const NoDefaultCurrentDirectoryInExePath: string;
	export const npm_package_scripts_build: string;
	export const npm_package_devDependencies__sveltejs_vite_plugin_svelte: string;
	export const npm_package_version: string;
	export const CLAUDE_CODE_DISABLE_CRON: string;
	export const npm_package_packageManager: string;
	export const npm_package_name: string;
	export const npm_package_devDependencies_vitest: string;
	export const CLAUDE_CODE_SESSION_ID: string;
	export const npm_package_devDependencies_jsdom: string;
	export const DISABLE_MICROCOMPACT: string;
	export const XPC_FLAGS: string;
	export const npm_command: string;
	export const npm_package_dependencies_jose: string;
	export const npm_package_dependencies__modelcontextprotocol_sdk: string;
	export const npm_config_node_gyp: string;
	export const BAGGAGE: string;
	export const PWD: string;
	export const COREPACK_ENABLE_DOWNLOAD_PROMPT: string;
	export const COREPACK_ROOT: string;
	export const npm_package_scripts_format: string;
	export const PATH: string;
	export const npm_package_devDependencies__testing_library_svelte: string;
	export const __CF_USER_TEXT_ENCODING: string;
	export const npm_config_registry: string;
	export const PNPM_SCRIPT_SRC_DIR: string;
	export const npm_package_scripts_test_watch: string;
	export const API_TIMEOUT_MS: string;
	export const npm_package_scripts_verify: string;
	export const CLAUDE_PREVIEW_CLASSIFIER_FLOOR: string;
	export const AI_AGENT: string;
	export const npm_package_dependencies_postgres: string;
	export const TMPDIR: string;
	export const MallocNanoZone: string;
	export const npm_package_devDependencies__sveltejs_kit: string;
	export const DISABLE_AUTOUPDATER: string;
	export const npm_package_scripts_start: string;
	export const COMMAND_MODE: string;
	export const CLAUDE_CODE_SDK_HAS_OAUTH_REFRESH: string;
	export const CLAUDE_AGENT_SDK_VERSION: string;
	export const __CFBundleIdentifier: string;
	export const CLAUDE_CODE_ENABLE_ASK_USER_QUESTION_TOOL: string;
	export const GIT_EDITOR: string;
	export const USER: string;
	export const MCP_CONNECTION_NONBLOCKING: string;
	export const npm_package_private: string;
	export const SSH_AUTH_SOCK: string;
	export const npm_config_frozen_lockfile: string;
	export const USE_LOCAL_OAUTH: string;
	export const npm_package_devDependencies__types_leaflet: string;
	export const npm_package_scripts_lint: string;
	export const NODE_ENV: string;
	export const COREPACK_ENABLE_AUTO_PIN: string;
	export const npm_package_devDependencies_esbuild: string;
	export const npm_package_dependencies_leaflet: string;
	export const npm_package_scripts_check: string;
	export const SHELL: string;
	export const CLAUDE_CODE_CHILD_SESSION: string;
	export const CLAUDE_PID: string;
	export const NODE: string;
	export const NODE_PATH: string;
	export const npm_package_devDependencies_vite: string;
	export const CLAUDE_CODE_EMIT_TOOL_USE_SUMMARIES: string;
	export const CLAUDE_CODE_ENTRYPOINT: string;
	export const npm_package_devDependencies_prettier_plugin_svelte: string;
	export const INIT_CWD: string;
	export const CLAUDE_EFFORT: string;
	export const npm_execpath: string;
	export const npm_package_scripts_dev: string;
	export const CLAUDE_CODE_REPORT_FINDINGS: string;
	export const CLAUDE_CODE_EAGER_FLUSH: string;
	export const CLAUDE_CODE_OAUTH_SCOPES: string;
	export const npm_lifecycle_event: string;
	export const ANTHROPIC_BASE_URL: string;
	export const CLAUDE_CODE_HOST_SESSION_ID: string;
	export const CLAUDE_CODE_MESSAGING_SOCKET: string;
	export const npm_package_devDependencies__sveltejs_adapter_node: string;
	export const npm_package_devDependencies_typescript: string;
	export const npm_package_scripts_build_mcp: string;
	export const npm_package_devDependencies_svelte: string;
	export const npm_package_type: string;
	export const npm_package_devDependencies_svelte_check: string;
	export const LOGNAME: string;
	export const npm_package_devDependencies_prettier: string;
}

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/public';
 * 
 * console.log(ENVIRONMENT); // => throws error during build
 * console.log(PUBLIC_BASE_URL); // => "http://site.com"
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * 
 * console.log(env.ENVIRONMENT); // => "production"
 * console.log(env.PUBLIC_BASE_URL); // => undefined
 * ```
 */
declare module '$env/dynamic/private' {
	export const env: {
		SVELTEKIT_FORK: string;
		npm_node_execpath: string;
		USE_STAGING_OAUTH: string;
		CLAUDECODE: string;
		OSLogRateLimit: string;
		npm_package_devDependencies__types_node: string;
		npm_config_user_agent: string;
		npm_package_scripts_preview: string;
		CLAUDE_CODE_SDK_HAS_HOST_AUTH_REFRESH: string;
		npm_lifecycle_script: string;
		npm_package_dependencies_zod: string;
		CLAUDE_CODE_EXECPATH: string;
		SHLVL: string;
		npm_package_scripts_test: string;
		HOME: string;
		XPC_SERVICE_NAME: string;
		NODE_USE_SYSTEM_CA: string;
		NoDefaultCurrentDirectoryInExePath: string;
		npm_package_scripts_build: string;
		npm_package_devDependencies__sveltejs_vite_plugin_svelte: string;
		npm_package_version: string;
		CLAUDE_CODE_DISABLE_CRON: string;
		npm_package_packageManager: string;
		npm_package_name: string;
		npm_package_devDependencies_vitest: string;
		CLAUDE_CODE_SESSION_ID: string;
		npm_package_devDependencies_jsdom: string;
		DISABLE_MICROCOMPACT: string;
		XPC_FLAGS: string;
		npm_command: string;
		npm_package_dependencies_jose: string;
		npm_package_dependencies__modelcontextprotocol_sdk: string;
		npm_config_node_gyp: string;
		BAGGAGE: string;
		PWD: string;
		COREPACK_ENABLE_DOWNLOAD_PROMPT: string;
		COREPACK_ROOT: string;
		npm_package_scripts_format: string;
		PATH: string;
		npm_package_devDependencies__testing_library_svelte: string;
		__CF_USER_TEXT_ENCODING: string;
		npm_config_registry: string;
		PNPM_SCRIPT_SRC_DIR: string;
		npm_package_scripts_test_watch: string;
		API_TIMEOUT_MS: string;
		npm_package_scripts_verify: string;
		CLAUDE_PREVIEW_CLASSIFIER_FLOOR: string;
		AI_AGENT: string;
		npm_package_dependencies_postgres: string;
		TMPDIR: string;
		MallocNanoZone: string;
		npm_package_devDependencies__sveltejs_kit: string;
		DISABLE_AUTOUPDATER: string;
		npm_package_scripts_start: string;
		COMMAND_MODE: string;
		CLAUDE_CODE_SDK_HAS_OAUTH_REFRESH: string;
		CLAUDE_AGENT_SDK_VERSION: string;
		__CFBundleIdentifier: string;
		CLAUDE_CODE_ENABLE_ASK_USER_QUESTION_TOOL: string;
		GIT_EDITOR: string;
		USER: string;
		MCP_CONNECTION_NONBLOCKING: string;
		npm_package_private: string;
		SSH_AUTH_SOCK: string;
		npm_config_frozen_lockfile: string;
		USE_LOCAL_OAUTH: string;
		npm_package_devDependencies__types_leaflet: string;
		npm_package_scripts_lint: string;
		NODE_ENV: string;
		COREPACK_ENABLE_AUTO_PIN: string;
		npm_package_devDependencies_esbuild: string;
		npm_package_dependencies_leaflet: string;
		npm_package_scripts_check: string;
		SHELL: string;
		CLAUDE_CODE_CHILD_SESSION: string;
		CLAUDE_PID: string;
		NODE: string;
		NODE_PATH: string;
		npm_package_devDependencies_vite: string;
		CLAUDE_CODE_EMIT_TOOL_USE_SUMMARIES: string;
		CLAUDE_CODE_ENTRYPOINT: string;
		npm_package_devDependencies_prettier_plugin_svelte: string;
		INIT_CWD: string;
		CLAUDE_EFFORT: string;
		npm_execpath: string;
		npm_package_scripts_dev: string;
		CLAUDE_CODE_REPORT_FINDINGS: string;
		CLAUDE_CODE_EAGER_FLUSH: string;
		CLAUDE_CODE_OAUTH_SCOPES: string;
		npm_lifecycle_event: string;
		ANTHROPIC_BASE_URL: string;
		CLAUDE_CODE_HOST_SESSION_ID: string;
		CLAUDE_CODE_MESSAGING_SOCKET: string;
		npm_package_devDependencies__sveltejs_adapter_node: string;
		npm_package_devDependencies_typescript: string;
		npm_package_scripts_build_mcp: string;
		npm_package_devDependencies_svelte: string;
		npm_package_type: string;
		npm_package_devDependencies_svelte_check: string;
		LOGNAME: string;
		npm_package_devDependencies_prettier: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://example.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.ENVIRONMENT); // => undefined, not public
 * console.log(env.PUBLIC_BASE_URL); // => "http://example.com"
 * ```
 * 
 * ```
 * 
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
