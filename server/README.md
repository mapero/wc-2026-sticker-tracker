# Sticker tracker sync server

A tiny self-hosted sync backend for the World Cup 2026 sticker tracker. It lets
you sync your named collections across devices using a **sync code** — no
accounts, no passwords.

- **Express** HTTP API
- **SQLite** (`better-sqlite3`) for storage — a single file, zero config
- Merge strategy: **last-write-wins per collection** (by `updatedAt`), with
  tombstones so deletions propagate

## Run it

```bash
cd server
npm install
npm start          # http://localhost:8787  (npm run dev for --watch)
```

Environment variables:

| Var            | Default                | Purpose                          |
| -------------- | ---------------------- | -------------------------------- |
| `PORT`         | `8787`                 | Port to listen on                |
| `SYNC_DB_PATH` | `server/data/sync.db`  | SQLite file location             |

## How pairing works

1. On device A, open **Collections → Sync** and click **Enable sync**. The app
   calls `POST /api/sync/create` and shows a code like `XK4P-92ZT-7HMD`.
2. On device B, open **Collections → Sync**, choose **Pair with a code**, and
   paste the code. The app pulls and merges the shared data.
3. Both devices now push/pull against the same code. Newest edit per collection
   wins.

## API

| Method | Path                | Body                       | Returns                       |
| ------ | ------------------- | -------------------------- | ----------------------------- |
| GET    | `/api/health`       | —                          | `{ ok: true }`                |
| POST   | `/api/sync/create`  | —                          | `{ code, collections: [] }`   |
| GET    | `/api/sync/:code`   | —                          | `{ code, collections }`       |
| POST   | `/api/sync/:code`   | `{ collections: [...] }`   | `{ code, collections }` (merged) |

A collection has the shape:

```jsonc
{
  "id": "uuid",
  "name": "My Collection",
  "counts": { "FWC1": 2, "FWC2": 1 },
  "createdAt": 1719400000000,
  "updatedAt": 1719400000000,
  "deletedAt": null
}
```

## Pointing the frontend at this server

The frontend reads `VITE_SYNC_URL` (see the root README / `.env`). In dev the
Vite proxy forwards `/api` to `http://localhost:8787`, so no config is needed
when running both locally.
