// See https://svelte.dev/docs/kit/types#app.d.ts
import type { AppContainer } from '$lib/server/container';
import type { User } from '$lib/server/repo/types';
import type { GarminService } from '$lib/server/interfaces';
import type { ConsentService } from '$lib/server/consent/types';
import type { NavItem } from '$lib/nav';

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
       * Garmin service scoped to the authenticated user (their `X-User-Id`). Set only when authed;
       * every consumer runs behind the auth guard, so protected handlers can rely on it.
       */
      garmin: GarminService;
      /** Consent service scoped to the authenticated user. Set only when authed (see `garmin`). */
      consent: ConsentService;
    }
    // interface Error {}
    /**
     * Data every page inherits from the root layout load. `dashboardNav` is here rather than being
     * cast at the point of use: `NavLinks` reads it straight off `page.data` on every page, and a
     * cast there would be the component asserting a shape the layout is the only one who knows
     * (spec 064). Optional because the load returns nothing for a signed-out or Base-tier reader.
     */
    interface PageData {
      dashboardNav?: NavItem[];
    }
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
