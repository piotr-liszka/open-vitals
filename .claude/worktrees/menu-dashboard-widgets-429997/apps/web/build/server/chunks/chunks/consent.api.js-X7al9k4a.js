import { z } from 'zod';
import { U as UnknownFeatureError, T as TermsVersionMismatchError } from './types.js-CLJf8dL7.js';

function toView(f) {
  return {
    id: f.id,
    title: f.title,
    summary: f.summary,
    termsVersion: f.termsVersion,
    termsText: f.termsText,
    requiresConsent: f.requiresConsent,
    enabled: f.enabled,
    acceptedAt: f.acceptedAt ?? null
  };
}
async function listConsent(consent) {
  const features = await consent.listFeatures();
  return { features: features.map(toView) };
}
const postSchema = z.object({
  featureId: z.string().min(1),
  termsVersion: z.string().min(1),
  accept: z.boolean()
});
async function postConsent(consent, body) {
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Oczekiwano pól { featureId, termsVersion, accept }." };
  }
  const { featureId, termsVersion, accept } = parsed.data;
  try {
    const feature = accept ? await consent.accept(featureId, termsVersion) : await consent.revoke(featureId);
    return { ok: true, body: { feature: toView(feature) } };
  } catch (err) {
    if (err instanceof UnknownFeatureError) return { ok: false, status: 400, error: "Nieznana funkcja." };
    if (err instanceof TermsVersionMismatchError) {
      return {
        ok: false,
        status: 409,
        error: "Warunki się zmieniły — odśwież stronę i zapoznaj się z nową wersją."
      };
    }
    throw err;
  }
}

export { listConsent as l, postConsent as p };
//# sourceMappingURL=consent.api.js-X7al9k4a.js.map
