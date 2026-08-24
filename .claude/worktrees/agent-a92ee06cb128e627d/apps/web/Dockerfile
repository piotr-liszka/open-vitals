# ---- build stage ----
FROM node:22-alpine AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# Plain install (no BuildKit cache mount): Synology's Docker uses the legacy
# builder, which doesn't support `RUN --mount`. Docker's normal layer cache
# still skips this step on rebuilds whenever pnpm-lock.yaml is unchanged.
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build && pnpm prune --prod

# ---- runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
# Run as the built-in unprivileged 'node' user.
COPY --from=build --chown=node:node /app/build ./build
COPY --from=build --chown=node:node /app/build-mcp ./build-mcp
COPY --from=build --chown=node:node /app/server.js ./server.js
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 3000
CMD ["node", "server.js"]
