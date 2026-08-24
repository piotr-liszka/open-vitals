import { describe, it, expect } from 'vitest';
import { SignJWT, generateKeyPair, type JWTVerifyGetKey } from 'jose';
import { createOidcAuthProvider } from './oidc';
import { AuthExchangeError } from './types';
import { fixedClock } from '../clock';
import type { FetchLike } from '../garmin/http-adapter';

const ISSUER = 'https://accounts.google.com';
const CLIENT_ID = 'client-123.apps.googleusercontent.com';
const DISCOVERY_URL = 'https://accounts.google.com/.well-known/openid-configuration';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';

const discovery = {
  issuer: ISSUER,
  authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_endpoint: TOKEN_ENDPOINT,
  jwks_uri: JWKS_URI
};

function jsonResponse(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 400,
    headers: { 'content-type': 'application/json' }
  });
}

const clock = fixedClock(new Date('2026-08-07T12:00:00Z'));

describe('oidc AuthProvider', () => {
  it('builds an authorization URL with scope, state, nonce, and PKCE S256', async () => {
    const fetchImpl: FetchLike = async (input) => {
      if (input.includes('.well-known')) return jsonResponse(discovery);
      throw new Error(`unexpected fetch ${input}`);
    };
    const provider = createOidcAuthProvider({
      clientId: CLIENT_ID,
      clientSecret: 'secret',
      fetch: fetchImpl,
      clock
    });
    const url = new URL(
      await provider.authorizeUrl({
        state: 'st',
        nonce: 'no',
        codeChallenge: 'cc',
        redirectUri: 'http://localhost:3000/auth/callback'
      })
    );
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('st');
    expect(url.searchParams.get('nonce')).toBe('no');
    expect(url.searchParams.get('code_challenge')).toBe('cc');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('exchanges a code and returns the verified identity', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const idToken = await new SignJWT({
      nonce: 'expected-nonce',
      email: 'ada@example.com',
      name: 'Ada',
      picture: 'https://img/a'
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setSubject('sub-123')
      .setIssuedAt(clock.nowSeconds())
      .setExpirationTime(clock.nowSeconds() + 3600)
      .sign(privateKey);

    const fetchImpl: FetchLike = async (input) => {
      if (input.includes('.well-known')) return jsonResponse(discovery);
      if (input === TOKEN_ENDPOINT) return jsonResponse({ id_token: idToken });
      throw new Error(`unexpected fetch ${input}`);
    };
    const jwks: JWTVerifyGetKey = async () => publicKey;

    const provider = createOidcAuthProvider({
      clientId: CLIENT_ID,
      clientSecret: 'secret',
      fetch: fetchImpl,
      clock,
      jwks
    });

    const identity = await provider.exchange({
      code: 'auth-code',
      codeVerifier: 'verifier',
      redirectUri: 'http://localhost:3000/auth/callback',
      expectedNonce: 'expected-nonce'
    });
    expect(identity).toEqual({
      googleSub: 'sub-123',
      email: 'ada@example.com',
      name: 'Ada',
      avatarUrl: 'https://img/a'
    });
  });

  it('rejects a nonce mismatch', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const idToken = await new SignJWT({ nonce: 'other' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setSubject('sub-123')
      .setIssuedAt(clock.nowSeconds())
      .setExpirationTime(clock.nowSeconds() + 3600)
      .sign(privateKey);

    const fetchImpl: FetchLike = async (input) => {
      if (input.includes('.well-known')) return jsonResponse(discovery);
      if (input === TOKEN_ENDPOINT) return jsonResponse({ id_token: idToken });
      throw new Error(`unexpected fetch ${input}`);
    };
    const provider = createOidcAuthProvider({
      clientId: CLIENT_ID,
      clientSecret: 'secret',
      fetch: fetchImpl,
      clock,
      jwks: async () => publicKey
    });

    await expect(
      provider.exchange({
        code: 'c',
        codeVerifier: 'v',
        redirectUri: 'http://x/cb',
        expectedNonce: 'expected-nonce'
      })
    ).rejects.toBeInstanceOf(AuthExchangeError);
  });

  it('rejects a rejected token exchange', async () => {
    const fetchImpl: FetchLike = async (input) => {
      if (input.includes('.well-known')) return jsonResponse(discovery);
      if (input === TOKEN_ENDPOINT) return jsonResponse({ error: 'invalid_grant' }, false);
      throw new Error(`unexpected fetch ${input}`);
    };
    const provider = createOidcAuthProvider({
      clientId: CLIENT_ID,
      clientSecret: 'secret',
      fetch: fetchImpl,
      clock
    });
    await expect(
      provider.exchange({ code: 'c', codeVerifier: 'v', redirectUri: 'http://x/cb', expectedNonce: 'n' })
    ).rejects.toBeInstanceOf(AuthExchangeError);
  });
});
