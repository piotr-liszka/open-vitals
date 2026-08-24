/**
 * The athlete's own three numbers (spec 090): FTP, maximum heart rate and body weight.
 *
 * These are not decorations. Every one of them is already READ somewhere in the app and, until this
 * spec, written nowhere:
 *
 * - `ftpWatts`  → IF, TSS and the power-zone donut (`activity-detail`), plus the cycling page
 *                 (`power`), the training load model (`training`) and the season verdict (`season`);
 * - `maxHrBpm`  → the heart-rate zone split (`activity-detail`), the intensity mix (`training`) and
 *                 the running page's zone aggregate (`running`);
 * - `weightKg`  → the W/kg column of the mean-max power table (`activity-detail`, `power`).
 *
 * Every one of those readers narrows the same way this module does — finite and positive, else
 * "estimate it" — so a value saved here means the same thing on every page that consumes it.
 *
 * Each may be `null`, which means "estimate it" — the fallback the app used before this screen
 * existed, and which stays in place. Setting a value replaces a guess; clearing it restores the
 * guess. No path ends up with neither.
 *
 * The field names ARE the keys of the per-user settings bag (`SettingsRepo`), so a reader elsewhere
 * looks up `settings.ftpWatts` and gets exactly what this form wrote. No new table.
 *
 * This file is client-safe: the card, the handler and the tests all share it.
 */

export interface AthleteProfile {
  /** Functional threshold power in watts, or `null` to estimate from the session's 20-min best. */
  readonly ftpWatts: number | null;
  /** Maximum heart rate in bpm, or `null` to fall back to the session's own observed peak. */
  readonly maxHrBpm: number | null;
  /** Body weight in kilograms, or `null` to leave every per-kilo figure hidden. */
  readonly weightKg: number | null;
}

export type ProfileField = keyof AthleteProfile;

/** Declaration order — also the order the card renders in and the handler validates in. */
export const PROFILE_FIELDS: readonly ProfileField[] = ['ftpWatts', 'maxHrBpm', 'weightKg'];

/**
 * Accepted range per field, with the precision the value is stored at.
 *
 * Sane rather than physiological absolutes: the point is to catch watts typed into the kilogram box
 * or a dropped digit, not to referee an outlier.
 */
export interface ProfileBound {
  readonly min: number;
  readonly max: number;
  /** Decimal places the stored value is rounded to. */
  readonly decimals: number;
}

export const PROFILE_BOUNDS: Readonly<Record<ProfileField, ProfileBound>> = {
  ftpWatts: { min: 50, max: 600, decimals: 0 },
  maxHrBpm: { min: 100, max: 230, decimals: 0 },
  weightKg: { min: 30, max: 250, decimals: 1 }
};

/**
 * Why a field was refused. A CODE, not a sentence: the handler stays free of copy, and the card
 * renders it in the reader's language with the bounds filled in from the table above.
 */
export type ProfileFieldError = 'not_a_number' | 'out_of_range';

export type ProfileFieldErrors = Readonly<Partial<Record<ProfileField, ProfileFieldError>>>;

/**
 * The 400 body: one code for the request plus the per-field reasons the card puts under each input.
 *
 * A rejected request writes NOTHING — the profile is stored as a whole, so a bad weight cannot leave
 * a half-applied FTP behind.
 */
export interface ProfileErrorResponse {
  readonly error: 'invalid_profile';
  readonly fields: ProfileFieldErrors;
}
