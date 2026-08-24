/** Client/server contracts for the consent API (spec 011). */

export interface ConsentFeatureView {
  id: string;
  title: string;
  summary: string;
  termsVersion: string;
  termsText: string;
  requiresConsent: boolean;
  enabled: boolean;
  acceptedAt?: string | null;
}

export interface ConsentListResponse {
  features: ConsentFeatureView[];
}

export interface ConsentPostRequest {
  featureId: string;
  termsVersion: string;
  accept: boolean;
}

export interface ConsentPostResponse {
  feature: ConsentFeatureView;
}
