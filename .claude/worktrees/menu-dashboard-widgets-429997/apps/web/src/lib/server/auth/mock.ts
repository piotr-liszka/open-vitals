/**
 * Mock AuthProvider (spec 012): signs in a FIXED dev user with NO network so the whole flow runs on
 * Docker without Google credentials. Selected by AUTH_ADAPTER=mock (refused in production by config).
 */
import type { Identity } from '../repo/types';
import type { AuthProvider } from './types';

export const MOCK_IDENTITY: Identity = {
  googleSub: 'dev-user',
  email: 'dev@example.com',
  name: 'Dev Athlete',
  avatarUrl: null
};

export function createMockAuthProvider(identity: Identity = MOCK_IDENTITY): AuthProvider {
  return {
    kind: 'mock',
    async authorizeUrl() {
      // Never used in practice — /auth/login short-circuits in mock mode. Kept for port parity.
      return '/auth/callback?code=mock&state=mock';
    },
    async exchange() {
      return identity;
    }
  };
}
