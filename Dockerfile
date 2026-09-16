# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# better-sqlite3 compiles a native addon when no prebuild matches the platform.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable
# pnpm-workspace.yaml carries allowBuilds/onlyBuiltDependencies. Without it
# pnpm refuses to run better-sqlite3's install script, so the native addon is
# never built and pnpm 11 fails the install outright.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ─── Build ────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# JWT_SECRET is validated at runtime, not build time; a placeholder keeps the
# production build from tripping the required-env check during prerendering.
ENV NODE_ENV=production
ENV JWT_SECRET=build-time-placeholder
RUN pnpm build

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app

# Supplied by docker-build.mjs. Declared here so the values land on the image as
# standard OCI labels: `docker inspect` on a running container then answers
# "which build is this?" without shelling in or guessing from the tag.
ARG BUILD_DATE
ARG GIT_REVISION
ARG BUILD_NUMBER
ARG BUILDER_HOSTNAME

LABEL org.opencontainers.image.title="wa-chat-flow" \
      org.opencontainers.image.source="https://github.com/boonpin/wa-chat-flow" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${GIT_REVISION}" \
      org.opencontainers.image.version="${BUILD_NUMBER}" \
      com.wa-chat-flow.built-by="${BUILDER_HOSTNAME}"

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATA_DIR=/storage/app

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs \
    && mkdir -p /storage/app \
    && chown -R nextjs:nodejs /storage

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Migrations are read from disk at startup, so they must ship with the image.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

USER nextjs
EXPOSE 3000
VOLUME ["/storage/app"]

CMD ["node", "server.js"]
