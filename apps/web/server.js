/**
 * Production entry. One Node HTTP server:
 *   - /mcp        -> token-gated MCP over Streamable HTTP (stateless)
 *   - everything  -> the SvelteKit adapter-node request handler
 *
 * This file is deliberately thin. `/mcp` never passes through hooks.server.ts, so its auth, rate
 * limiting and response headers used to be hand-rolled here — untested JavaScript quietly drifting
 * from the modules the rest of the app is held to. Since spec 055 all of that lives in
 * src/lib/mcp/http.ts (pure, unit-tested) and arrives through the bundled entry; what remains here
 * is transport: read the socket, apply the decision, wire up the stream.
 *
 * Built assets required (produced by `pnpm run build`):
 *   ./build/handler.js    (SvelteKit handler)
 *   ./build-mcp/index.js  (bundled MCP factory + gate — see src/lib/mcp/entry.ts)
 */
import http from 'node:http';
import { handler } from './build/handler.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  clientIpOf,
  extractMcpToken,
  gateMcpRequest,
  newMcpServerForUser,
  readJsonBody,
  trustProxy
} from './build-mcp/index.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

async function handleMcp(req, res, url) {
  const decision = await gateMcpRequest({
    token: extractMcpToken({ searchParams: url.searchParams, authorization: req.headers.authorization }),
    clientIp: clientIpOf({
      forwardedFor: req.headers['x-forwarded-for'],
      remoteAddress: req.socket.remoteAddress,
      trustProxy
    }),
    https: process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https'
  });

  if (decision.action === 'reject') {
    return send(res, decision.status, decision.headers, decision.body);
  }

  for (const [name, value] of Object.entries(decision.headers)) res.setHeader(name, value);

  // Read the body BEFORE building the server, so an oversized or malformed payload cannot pin an
  // MCP server + transport for the life of the connection.
  const body = req.method === 'POST' ? await readJsonBody(req) : undefined;

  // Stateless: a fresh server + transport per request, torn down on close.
  const server = newMcpServerForUser(decision.userId);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

const app = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (url.pathname === '/mcp') {
    handleMcp(req, res, url).catch((err) => {
      console.error(JSON.stringify({ level: 'error', msg: 'mcp request failed', err: String(err) }));
      if (!res.headersSent) {
        send(res, 500, { 'content-type': 'application/json' }, JSON.stringify({ error: 'internal_error' }));
      }
    });
    return;
  }
  handler(req, res);
});

app.listen(PORT, HOST, () => {
  console.log(JSON.stringify({ level: 'info', msg: `openvitals listening on ${HOST}:${PORT}` }));
});
