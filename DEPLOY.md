# Deployment

Run the sticker tracker with Docker: the **web** container (static SPA on nginx)
plus the **sync** container (Node + SQLite backend). nginx proxies `/api` to the
backend, so the whole app lives behind one origin/port — no cross-origin or
build-time URL configuration needed.

```
browser ──▶ web (nginx :80) ──/api──▶ sync (node :8787) ──▶ /app/data/sync.db (volume)
            └ serves dist/ (SPA)
```

## Quick start

`docker-compose.yml` pulls the prebuilt images from GitHub Container Registry:

```bash
docker compose pull
docker compose up -d
# open http://localhost:8080
```

To build the images locally instead of pulling (e.g. for development), add
`--build`:

```bash
docker compose up -d --build
```

Then go to **Collections → Sync → Enable sync** on one device and **Pair with a
code** on the others.

Stop / remove:

```bash
docker compose down            # keep data
docker compose down -v         # also delete the sync volume (wipes all synced data)
```

## Configuration

| Setting        | Where                                  | Default               | Purpose                                            |
| -------------- | -------------------------------------- | --------------------- | -------------------------------------------------- |
| `WEB_PORT`     | env at `up` time / `.env`              | `8080`                | Host port for the web UI                           |
| `VITE_BASE`    | `web` build arg (compose)              | `/`                   | Public base path of the SPA                        |
| `VITE_SYNC_URL`| `web` build arg (compose)              | empty                 | API origin; empty = same-origin `/api` via nginx   |
| `PORT`         | `sync` env (compose)                   | `8787`                | Backend listen port (inside the network)           |
| `SYNC_DB_PATH` | `sync` env (compose)                   | `/app/data/sync.db`   | SQLite file path (on the persisted volume)         |

Examples:

```bash
WEB_PORT=9000 docker compose up -d --build      # serve UI on :9000
```

`VITE_*` are **build-time** (baked into the static bundle), so changing them
requires a rebuild: `docker compose build web`.

## Data & backups

The SQLite database lives in the named volume `sync-data` (mounted at
`/app/data`). It survives `docker compose down` and container restarts; only
`down -v` or an explicit `docker volume rm` deletes it.

Back it up while running:

```bash
docker compose cp sync:/app/data/sync.db ./sync-backup-$(date +%F).db
```

Restore:

```bash
docker compose stop sync
docker compose cp ./sync-backup.db sync:/app/data/sync.db
docker compose start sync
```

> Note: every device also keeps its own copy in browser `localStorage`, so the
> server DB is a sync hub, not the only copy. A user can always re-push from a
> device that still has the data.

## HTTPS / public hosting

The bundled nginx serves plain HTTP on port 80. For a public deployment put a
TLS-terminating reverse proxy (Caddy, Traefik, or another nginx) in front of the
`web` container and point it at `WEB_PORT`. Sync codes are unguessable but grant
access to whoever holds them, so **serve over HTTPS** in production. The backend
needs no direct exposure — keep it internal to the compose network.

Minimal Caddy example:

```
stickers.example.com {
    reverse_proxy localhost:8080
}
```

## Running the two images separately

If you don't want compose, the backend points the SPA at any origin via
`VITE_SYNC_URL` at build time:

```bash
# backend
docker build -t sticker-sync ./server
docker run -d --name sticker-sync -v sticker-data:/app/data -p 8787:8787 sticker-sync

# frontend talking to that backend on another host
docker build -t sticker-web --build-arg VITE_SYNC_URL=https://sync.example.com .
docker run -d --name sticker-web -p 8080:80 sticker-web
```

When `VITE_SYNC_URL` is set, the SPA calls that origin directly — make sure the
backend allows it (CORS is open by default in `server/src/index.js`).

## Prebuilt images (GitHub Container Registry)

The [`Publish Docker images`](.github/workflows/docker-publish.yml) workflow
builds and pushes both images to `ghcr.io` on every push to `main`, on `v*` tags,
or manually (Actions → Run workflow):

- `ghcr.io/<owner>/<repo>-web`
- `ghcr.io/<owner>/<repo>-sync`

Tags include `latest` (default branch), the branch name, a `sha-<commit>` tag,
and semver tags (`1.2.3`, `1.2`) when you push a `vX.Y.Z` git tag.

`docker-compose.yml` already references these images and pulls `latest` by
default. Pin a specific tag with `IMAGE_TAG`:

```bash
IMAGE_TAG=v1.2.3 docker compose up -d
```

> Packages inherit the repo's visibility intent but are created **private** by
> default. Either make them public (Package settings → Change visibility) or
> `docker login ghcr.io` with a PAT that has `read:packages` before pulling.
> Because `VITE_*` are baked in at build time, the published `web` image is
> root-served (`VITE_BASE=/`) and same-origin (`VITE_SYNC_URL` empty) — fork the
> workflow's build args if you need different values.

## Updating

```bash
git pull
docker compose up -d --build        # rebuilds changed images, keeps the volume
```

## Troubleshooting

- **Port already in use** — set `WEB_PORT` to a free port.
- **UI loads but sync fails** — check `docker compose logs sync`; verify
  `curl http://localhost:8080/api/health` returns `{"ok":true}`.
- **"Sync code not found"** — the code only exists on the server it was created
  on; both devices must point at the same backend / volume.
- **Blank page / 404 on assets** — the bundle was built with the wrong base.
  Rebuild with `VITE_BASE=/` (the compose default) for a root-served deploy.
