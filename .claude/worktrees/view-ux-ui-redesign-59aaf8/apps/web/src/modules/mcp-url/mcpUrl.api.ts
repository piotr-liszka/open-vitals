/** Build (and rotate) the per-user MCP URL the signed-in user pastes into their AI client (spec 012). */
import type { AppContainer } from '$lib/server/container';

function urlFor(container: AppContainer, token: string): string {
  return `${container.config.publicBaseUrl}/mcp?token=${encodeURIComponent(token)}`;
}

/** The CURRENT user's MCP URL — mints their token on first access (get-or-create). */
export async function getMcpUrl(container: AppContainer, userId: string): Promise<string> {
  const token = await container.repo.mcpTokens.getOrCreate(userId);
  return urlFor(container, token);
}

/** Issue a fresh token for the user (invalidating the old one) and return the new URL. */
export async function rotateMcpUrl(container: AppContainer, userId: string): Promise<string> {
  const token = await container.repo.mcpTokens.rotate(userId);
  return urlFor(container, token);
}
