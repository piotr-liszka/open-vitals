/**
 * Real Google OIDC AuthProvider (spec 012): Authorization Code + PKCE (S256) + state, id_token
 * verified against Google's JWKS via `jose`. All network goes through the INJECTED `fetch`; time
 * comes from the injected `Clock`. Never logs tokens, the client secret, or the code_verifier.
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { Clock } from '../clock';
import type { FetchLike } from '../garmin/http-adapter';
import type { Identity } from '../repo/types';
import { safeEqual } from '../crypto';
import { AuthExchangeError, type AuthProvider, type AuthorizeUrlInput, type ExchangeInput } from './types';

const DEFAULT_DISCOVERY_URL = 'https://accounts.google.com/.well-known/openid-configuration';
const SCOPE = 'openid email profile';

/** The subset of the OIDC discovery document we rely on. */
interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

interface TokenResponse {
  id_token?: string;
}

export interface OidcDeps {
  clientId: string;
  clientSecret: string;
  fetch: FetchLike;
  clock: Clock;
  /** Override the discovery URL (tests). */
  discoveryUrl?: string;
  /** Inject a JWKS key resolver (tests); defaults to Google's remote JWKS. */
  jwks?: JWTVerifyGetKey;
}

function isDiscovery(v: unknown): v is Discovery {
  if (!v || typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d.issuer === 'string' &&
    typeof d.authorization_endpoint === 'string' &&
    typeof d.token_endpoint === 'string' &&
    typeof d.jwks_uri === 'string'
  );
}

export function createOidcAuthProvider(deps: OidcDeps): AuthProvider {
  const discoveryUrl = deps.discoveryUrl ?? DEFAULT_DISCOVERY_URL;

  let discoveryPromise: Promise<Discovery> | null = null;
  let jwks: JWTVerifyGetKey | null = deps.jwks ?? null;

  const discover = async (): Promise<Discovery> => {
    if (!discoveryPromise) {
      discoveryPromise = (async () => {
        const res = await deps.fetch(discoveryUrl);
        if (!res.ok) throw new AuthExchangeError('OIDC discovery failed');
        const doc: unknown = await res.json();
        if (!isDiscovery(doc)) throw new AuthExchangeError('OIDC discovery document is malformed');
        return doc;
      })().catch((err) => {
        discoveryPromise = null; // allow retry on next request
        throw err;
      });
    }
    return discoveryPromise;
  };

  const getJwks = (jwksUri: string): JWTVerifyGetKey => {
    if (!jwks) jwks = createRemoteJWKSet(new URL(jwksUri));
    return jwks;
  };

  return {
    kind: 'oidc',

    async authorizeUrl(input: AuthorizeUrlInput): Promise<string> {
      const { authorization_endpoint } = await discover();
      const url = new URL(authorization_endpoint);
      url.searchParams.set('client_id', deps.clientId);
      url.searchParams.set('redirect_uri', input.redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', SCOPE);
      url.searchParams.set('state', input.state);
      url.searchParams.set('nonce', input.nonce);
      url.searchParams.set('code_challenge', input.codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
      return url.toString();
    },

    async exchange(input: ExchangeInput): Promise<Identity> {
      const discovery = await discover();

      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: input.code,
        redirect_uri: input.redirectUri,
        client_id: deps.clientId,
        client_secret: deps.clientSecret,
        code_verifier: input.codeVerifier
      });

      const res = await deps.fetch(discovery.token_endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: body.toString()
      });
      if (!res.ok) throw new AuthExchangeError('OIDC token exchange rejected');

      const token = (await res.json().catch(() => null)) as TokenResponse | null;
      if (!token?.id_token) throw new AuthExchangeError('OIDC token response missing id_token');

      let payload: Record<string, unknown>;
      try {
        const verified = await jwtVerify(token.id_token, getJwks(discovery.jwks_uri), {
          issuer: discovery.issuer,
          audience: deps.clientId,
          currentDate: deps.clock.now()
        });
        payload = verified.payload as Record<string, unknown>;
      } catch {
        throw new AuthExchangeError('id_token verification failed');
      }

      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        throw new AuthExchangeError('id_token missing sub');
      }
      if (typeof payload.nonce !== 'string' || !safeEqual(payload.nonce, input.expectedNonce)) {
        throw new AuthExchangeError('id_token nonce mismatch');
      }

      return {
        googleSub: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : null,
        name: typeof payload.name === 'string' ? payload.name : null,
        avatarUrl: typeof payload.picture === 'string' ? payload.picture : null
      };
    }
  };
}
