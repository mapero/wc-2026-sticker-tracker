# --- Build the static SPA -------------------------------------------------
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Root-served deploy (override the GitHub Pages sub-path). Leave VITE_SYNC_URL
# empty so the app calls /api on its own origin — nginx proxies it to the
# backend, so no cross-origin config is needed.
ARG VITE_BASE=/
ARG VITE_SYNC_URL=
ENV VITE_BASE=$VITE_BASE
ENV VITE_SYNC_URL=$VITE_SYNC_URL

RUN npm run build

# --- Serve with nginx -----------------------------------------------------
FROM nginx:alpine

# Refresh OS packages to pick up security fixes newer than the base image
# (e.g. libxslt 1.1.43-r4, zlib 1.4 — flagged by image scanners).
RUN apk upgrade --no-cache

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
