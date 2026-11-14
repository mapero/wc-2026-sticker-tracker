# Sync backend — Node's built-in SQLite needs Node >= 22.5 (no native build).
FROM node:24-alpine

# Refresh OS packages to pick up security fixes newer than the base image
# (e.g. zlib 1.4 — flagged by image scanners).
RUN apk upgrade --no-cache

WORKDIR /app

# Install only production deps (express + cors) against the lockfile.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV PORT=8787
ENV SYNC_DB_PATH=/app/data/sync.db

# SQLite file lives here — mount a volume to persist it across restarts.
VOLUME ["/app/data"]
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8787/api/health || exit 1

CMD ["node", "src/index.js"]
