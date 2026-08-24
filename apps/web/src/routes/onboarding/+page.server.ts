/**
 * `/onboarding` — first-run admin creation (spec 094). Thin per AGENTS.md §5: the form action calls
 * the module's pure `createInitialAdmin` and only translates its result into a redirect/`fail`.
 *
 * `load` is trivial on purpose — the guard (`hooks.server.ts` + `modules/auth/guard.ts`) already
 * decides whether this route is even reachable (allow while no admin exists, redirect to /login once
 * one does) BEFORE this ever runs, for both GET and this file's own POST action (same route id).
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createInitialAdmin } from '$modules/onboarding/onboarding.api';

export const load: PageServerLoad = () => {
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals, cookies, url, getClientAddress }) => {
    const form = await request.formData();
    const result = await createInitialAdmin(locals.container, {
      email: form.get('email'),
      username: form.get('username'),
      password: form.get('password'),
      confirmPassword: form.get('confirmPassword'),
      userAgent: request.headers.get('user-agent'),
      ipAddress: getClientAddress()
    });

    if (!result.ok) {
      if (result.kind === 'already_onboarded') throw redirect(303, '/login');
      return fail(400, { fields: result.fields });
    }

    cookies.set(result.session.cookieName, result.session.id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: locals.container.config.isProd || url.protocol === 'https:',
      maxAge: result.session.maxAge
    });
    throw redirect(303, '/');
  }
};
