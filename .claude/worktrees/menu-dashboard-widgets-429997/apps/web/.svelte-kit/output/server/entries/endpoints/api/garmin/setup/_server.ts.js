import { json } from "@sveltejs/kit";
import { z } from "zod";
import { G as GarminUnavailableError } from "../../../../../chunks/interfaces.js";
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  mfaCode: z.string().trim().min(1).optional()
});
async function setupGarmin(garmin, body) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: "Wymagany jest prawidłowy adres e-mail i hasło." } };
  }
  try {
    const result = await garmin.login({
      email: parsed.data.email,
      password: parsed.data.password,
      ...parsed.data.mfaCode ? { mfaCode: parsed.data.mfaCode } : {}
    });
    switch (result.outcome) {
      case "success":
        return { status: 200, body: { outcome: "success", displayName: result.status.displayName ?? null } };
      case "mfa_required":
        return { status: 202, body: { outcome: "mfa_required" } };
      case "invalid_credentials":
        return { status: 401, body: { outcome: "invalid_credentials" } };
    }
  } catch (err) {
    if (err instanceof GarminUnavailableError) {
      if (err.failure.code === "internal_key_rejected") {
        return {
          status: 503,
          body: {
            error: "Błąd konfiguracji serwera: web i sidecar nie mają wspólnego INTERNAL_API_KEY. To nie jest problem z Twoim hasłem."
          }
        };
      }
      return { status: 503, body: { error: "Usługa Garmin jest niedostępna. Spróbuj za chwilę." } };
    }
    throw err;
  }
}
const POST = async ({ request, locals }) => {
  const key = `garmin-setup:${locals.user?.id ?? "anon"}`;
  const gate = locals.container.setupRateLimiter.check(key);
  if (!gate.allowed) {
    return json(
      { error: "Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie." },
      { status: 429, headers: { "Retry-After": String(gate.retryAfterSeconds) } }
    );
  }
  const body = await request.json().catch(() => null);
  const result = await setupGarmin(locals.garmin, body);
  return json(result.body, { status: result.status });
};
export {
  POST
};
