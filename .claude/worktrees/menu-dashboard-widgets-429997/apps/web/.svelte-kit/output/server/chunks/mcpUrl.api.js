function urlFor(container, token) {
  return `${container.config.publicBaseUrl}/mcp?token=${encodeURIComponent(token)}`;
}
async function getMcpUrl(container, userId) {
  const token = await container.repo.mcpTokens.getOrCreate(userId);
  return urlFor(container, token);
}
async function rotateMcpUrl(container, userId) {
  const token = await container.repo.mcpTokens.rotate(userId);
  return urlFor(container, token);
}
export {
  getMcpUrl as g,
  rotateMcpUrl as r
};
