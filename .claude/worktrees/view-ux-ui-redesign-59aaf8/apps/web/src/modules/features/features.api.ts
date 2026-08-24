/** Pure feature-switch handlers over the injected FeatureService (spec 071). */
import { z } from 'zod';
import { UnknownFeatureError, type FeatureService, type ResolvedFeature } from '$lib/server/features/types';
import type { FeatureListResponse, FeaturePostResponse, FeatureView } from './features.types';

function toView(f: ResolvedFeature): FeatureView {
  return {
    id: f.id,
    title: f.title,
    summary: f.summary,
    integration: f.integration,
    enabled: f.enabled,
    defaultEnabled: f.defaultEnabled
  };
}

export async function listFeatures(features: FeatureService): Promise<FeatureListResponse> {
  return { features: (await features.list()).map(toView) };
}

const postSchema = z.object({
  featureId: z.string().min(1),
  enabled: z.boolean()
});

export type FeaturePostResult =
  { ok: true; body: FeaturePostResponse } | { ok: false; status: 400; error: string };

export async function postFeature(features: FeatureService, body: unknown): Promise<FeaturePostResult> {
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, error: 'Oczekiwano pól { featureId, enabled }.' };
  }
  try {
    const feature = await features.setEnabled(parsed.data.featureId, parsed.data.enabled);
    return { ok: true, body: { feature: toView(feature) } };
  } catch (err) {
    if (err instanceof UnknownFeatureError) return { ok: false, status: 400, error: 'Nieznana funkcja.' };
    throw err;
  }
}
