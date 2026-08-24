/** Contract shared by the Garmin setup UI and API. */
export type SetupOutcome = 'success' | 'mfa_required' | 'invalid_credentials';

export interface SetupRequest {
  email: string;
  password: string;
  /** Present only when completing an MFA challenge. */
  mfaCode?: string;
}

export interface SetupSuccess {
  outcome: 'success';
  displayName: string | null;
}
export interface SetupMfaRequired {
  outcome: 'mfa_required';
}
export interface SetupInvalid {
  outcome: 'invalid_credentials';
}

export type SetupResponse = SetupSuccess | SetupMfaRequired | SetupInvalid | { error: string };
