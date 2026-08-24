import { describe, it, expect } from 'vitest';
import { loadConfig } from './config';

const base = {
  PUBLIC_BASE_URL: 'http://192.168.1.10:3000/',
  GARMIN_SIDECAR_URL: 'http://garmin:8081/',
  DATABASE_URL: 'postgres://garmin:garmin@db:5432/garmin_bridge',
  AUTH_ADAPTER: 'mock'
} satisfies NodeJS.ProcessEnv;

describe('loadConfig', () => {
  it('parses a valid env and strips trailing slashes', () => {
    const cfg = loadConfig(base);
    expect(cfg.publicBaseUrl).toBe('http://192.168.1.10:3000');
    expect(cfg.garminSidecarUrl).toBe('http://garmin:8081');
    expect(cfg.databaseUrl).toBe('postgres://garmin:garmin@db:5432/garmin_bridge');
    expect(cfg.authAdapter).toBe('mock');
    expect(cfg.sessionTtlSeconds).toBe(60 * 60 * 12);
    expect(cfg.isProd).toBe(false);
  });

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _omit, ...rest } = base;
    expect(() => loadConfig(rest as NodeJS.ProcessEnv)).toThrowError(/DATABASE_URL/);
  });

  it('defaults AUTH_ADAPTER to oidc and then requires Google credentials', () => {
    const { AUTH_ADAPTER: _omit, ...rest } = base;
    expect(() => loadConfig(rest as NodeJS.ProcessEnv)).toThrowError(/GOOGLE_CLIENT_ID/);
  });

  it('accepts the oidc adapter when Google credentials are present', () => {
    const cfg = loadConfig({
      ...base,
      AUTH_ADAPTER: 'oidc',
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret'
    });
    expect(cfg.authAdapter).toBe('oidc');
    expect(cfg.googleClientId).toBe('client-id');
  });

  it('defaults APP_TIMEZONE to Europe/Warsaw and accepts an override (spec 018)', () => {
    expect(loadConfig(base).appTimeZone).toBe('Europe/Warsaw');
    expect(loadConfig({ ...base, APP_TIMEZONE: 'America/New_York' }).appTimeZone).toBe('America/New_York');
  });

  it('rejects an unknown APP_TIMEZONE instead of silently shifting every day', () => {
    expect(() => loadConfig({ ...base, APP_TIMEZONE: 'Mars/Olympus' })).toThrowError(/APP_TIMEZONE/);
  });

  it('refuses the mock auth adapter in production (mirrors GARMIN_ADAPTER)', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', AUTH_ADAPTER: 'mock' })).toThrowError(
      /AUTH_ADAPTER.*mock.*production/
    );
  });
});
