// See https://svelte.dev/docs/kit/types#app.d.ts
import type { AppContainer } from '$lib/server/container';
import type { User } from '$lib/server/repo/types';
import type { GarminService } from '$lib/server/interfaces';
import type { FeatureService } from '$lib/server/features/types';
import type { Locale } from '$lib/i18n';

declare global {
  /**
   * ISO-8601 UTC instant of when this bundle was built, injected by Vite `define` (see
   * vite.config.ts). Stays UTC in the bundle on purpose; the UI formats it into local time
   * (spec 018). Shown at the bottom of the sidebar as a deploy/version marker.
   */
  const __BUILD_TIME__: string;
  /**
   * Short git commit the bundle was built from, injected by Vite `define`. Empty string when git is
   * unavailable (e.g. building from a tarball) — never fails the build.
   */
  const __BUILD_SHA__: string;

  namespace App {
    interface Locals {
      /** Per-request dependency container (ports & adapters). Populated in hooks. */
      container: AppContainer;
      /** The signed-in user, or null when unauthenticated. Populated in hooks. */
      user: User | null;
      /** True when the request carries a valid session cookie. */
      authenticated: boolean;
      /**
       * The raw session cookie value for this request, or null (spec 094) — so the account module
       * can identify "this device"/"this session" without a second cookie read. Set in hooks
       * regardless of whether the session resolved to a user.
       */
      sessionId: string | null;
      /**
       * Garmin service scoped to the authenticated user (their `X-User-Id`). Set only when authed;
       * every consumer runs behind the auth guard, so protected handlers can rely on it.
       */
      garmin: GarminService;
      /** Feature switches scoped to the authenticated user. Set only when authed (see `garmin`). */
      features: FeatureService;
      /**
       * Language this request renders in (spec 076): the user's stored setting, else the `gb-lang`
       * cookie, else `Accept-Language`, else Polish. Always set — server code builds a translator
       * from it with `createTranslator`, and the root layout hands it to the component tree.
       */
      locale: Locale;
    }
    // interface Error {}
    /** Data every page inherits from the root layout load. */
    interface PageData {
      /** True when the signed-in user is an admin (spec 094) — gates the "Admin" nav link. */
      isAdmin?: boolean;
    }
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
