/** Pure consent handlers over the injected ConsentService (spec 011). */
import { z } from 'zod';
import {
  TermsVersionMismatchError,
  UnknownFeatureError,
  type ConsentService,
  type ResolvedFeature
} from '$lib/server/consent/types';
import type { ConsentFeatureView, ConsentListResponse, ConsentPostResponse } from './consent.types';

function toView(f: ResolvedFeature): ConsentFeatureView {
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

export async function listConsent(consent: ConsentService): Promise<ConsentListResponse> {
  const features = await consent.listFeatures();
  return { features: features.map(toView) };
}

const postSchema = z.object({
  featureId: z.string().min(1),
  termsVersion: z.string().min(1),
  accept: z.boolean()
});

export type ConsentPostResult =
  { ok: true; body: ConsentPostResponse } | { ok: false; status: 400 | 409; error: string };

export async function postConsent(consent: ConsentService, body: unknown): Promise<ConsentPostResult> {
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, error: 'Oczekiwano pól { featureId, termsVersion, accept }.' };
  }
  const { featureId, termsVersion, accept } = parsed.data;
  try {
    const feature = accept ? await consent.accept(featureId, termsVersion) : await consent.revoke(featureId);
    return { ok: true, body: { feature: toView(feature) } };
  } catch (err) {
    if (err instanceof UnknownFeatureError) return { ok: false, status: 400, error: 'Nieznana funkcja.' };
    if (err instanceof TermsVersionMismatchError) {
      return {
        ok: false,
        status: 409,
        error: 'Warunki się zmieniły — odśwież stronę i zapoznaj się z nową wersją.'
      };
    }
    throw err;
  }
}
