/** Request/response contract for the language switch (spec 076). Shared by the UI and the handler. */
import type { Locale } from '$lib/i18n';

export interface SetLocaleRequest {
  locale: Locale;
}

export interface SetLocaleResponse {
  locale: Locale;
  /**
   * True when the choice was written to the user's account (and so follows them to other devices),
   * false when it is cookie-only — the case for a visitor switching language before signing in.
   */
  persisted: boolean;
}
