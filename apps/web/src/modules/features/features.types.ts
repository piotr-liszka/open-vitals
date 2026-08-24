/** Client/server contracts for the feature-switch API (spec 071). */
import type { MessageKey } from '$lib/i18n';
import type { FeatureIntegration } from '$lib/server/features/types';

export type { FeatureIntegration };

export interface FeatureView {
  id: string;
  titleKey: MessageKey;
  summaryKey: MessageKey;
  integration: FeatureIntegration;
  enabled: boolean;
  defaultEnabled: boolean;
}

export interface FeatureListResponse {
  features: FeatureView[];
}

export interface FeaturePostRequest {
  featureId: string;
  enabled: boolean;
}

export interface FeaturePostResponse {
  feature: FeatureView;
}
