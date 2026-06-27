import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Database lives in server/data/sync.db by default. Override with SYNC_DB_PATH.
const dbPath = process.env.SYNC_DB_PATH || join(__dirname, "..", "data", "sync.db");
mkdirSync(dirname(dbPath), { recursive: true });

// Uses Node's built-in SQLite (Node >= 22.5) — no native build step required.
export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
    CREATE TABLE IF NOT EXISTS sync_codes (
        code        TEXT PRIMARY KEY,
        created_at  INTEGER NOT NULL,
        synced_at   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS collections (
        code        TEXT NOT NULL,
        id          TEXT NOT NULL,
        name        TEXT NOT NULL,
        counts      TEXT NOT NULL,            -- JSON object { stickerCode: qty }
        counts_at   TEXT NOT NULL DEFAULT '{}', -- JSON object { stickerCode: lastChangeTs }
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL,
        deleted_at  INTEGER,                  -- tombstone timestamp, NULL if live
        locked      INTEGER NOT NULL DEFAULT 0,
        locked_at   INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (code, id)
    );
`);

// Add columns to databases created before they existed (ignore if present).
for (const ddl of [
    "ALTER TABLE collections ADD COLUMN counts_at TEXT NOT NULL DEFAULT '{}'",
    "ALTER TABLE collections ADD COLUMN locked INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE collections ADD COLUMN locked_at INTEGER NOT NULL DEFAULT 0",
]) {
    try {
        db.exec(ddl);
    } catch {
        /* column already exists */
    }
}

// Deterministic JSON (sorted keys) so unchanged maps compare equal and we don't
// re-write / re-broadcast on key-order differences.
function stable(obj) {
    const out = {};
    for (const k of Object.keys(obj || {}).sort()) out[k] = obj[k];
    return JSON.stringify(out);
}

const statements = {
    codeExists: db.prepare("SELECT 1 FROM sync_codes WHERE code = ?"),
    insertCode: db.prepare("INSERT INTO sync_codes (code, created_at, synced_at) VALUES (?, ?, ?)"),
    touchCode: db.prepare("UPDATE sync_codes SET synced_at = ? WHERE code = ?"),
    selectCollections: db.prepare(
        "SELECT id, name, counts, counts_at, created_at, updated_at, deleted_at, locked, locked_at FROM collections WHERE code = ?"
    ),
    selectOne: db.prepare(
        "SELECT id, name, counts, counts_at, created_at, updated_at, deleted_at, locked, locked_at FROM collections WHERE code = ? AND id = ?"
    ),
    upsert: db.prepare(`
        INSERT INTO collections (code, id, name, counts, counts_at, created_at, updated_at, deleted_at, locked, locked_at)
        VALUES (@code, @id, @name, @counts, @counts_at, @created_at, @updated_at, @deleted_at, @locked, @locked_at)
        ON CONFLICT(code, id) DO UPDATE SET
            name = excluded.name,
            counts = excluded.counts,
            counts_at = excluded.counts_at,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at,
            locked = excluded.locked,
            locked_at = excluded.locked_at
    `),
};

export function codeExists(code) {
    return !!statements.codeExists.get(code);
}

export function createCode(code) {
    const now = Date.now();
    statements.insertCode.run(code, now, now);
}

/** Read all collections for a sync code, in the client-facing shape. */
export function getCollections(code) {
    return statements.selectCollections.all(code).map(rowToCollection);
}

/**
 * Merge two versions of the same collection. Must mirror the client's
 * mergeCollection (src/stores/collection-model.ts):
 *  - counts: per-sticker last-write-wins by each code's own timestamp (so
 *    different stickers both persist and a decrement/removal propagates);
 *    equal timestamps keep the higher count
 *  - name / deletedAt: last-write-wins by updatedAt
 *  - locked: last-write-wins by lockedAt (independent of content edits)
 */
function mergeCollection(a, b) {
    const counts = {};
    const countsAt = {};
    const codes = new Set([
        ...Object.keys(a.countsAt || {}),
        ...Object.keys(b.countsAt || {}),
        ...Object.keys(a.counts || {}),
        ...Object.keys(b.counts || {}),
    ]);
    for (const code of codes) {
        const aAt = a.countsAt?.[code] ?? 0;
        const bAt = b.countsAt?.[code] ?? 0;
        let n;
        let t;
        if (aAt > bAt) {
            n = a.counts?.[code] ?? 0;
            t = aAt;
        } else if (bAt > aAt) {
            n = b.counts?.[code] ?? 0;
            t = bAt;
        } else {
            n = Math.max(a.counts?.[code] ?? 0, b.counts?.[code] ?? 0);
            t = aAt;
        }
        if (t > 0) countsAt[code] = t;
        if (n > 0) counts[code] = n;
    }
    const aNewer = a.updatedAt >= b.updatedAt;
    const aLockNewer = (a.lockedAt ?? 0) >= (b.lockedAt ?? 0);
    return {
        id: a.id,
        name: aNewer ? a.name : b.name,
        counts,
        countsAt,
        createdAt: Math.min(a.createdAt, b.createdAt),
        updatedAt: Math.max(a.updatedAt, b.updatedAt),
        deletedAt: aNewer ? a.deletedAt : b.deletedAt,
        locked: aLockNewer ? a.locked : b.locked,
        lockedAt: Math.max(a.lockedAt ?? 0, b.lockedAt ?? 0),
    };
}

function sameStored(existing, merged) {
    return (
        existing.name === merged.name &&
        (existing.deleted_at ?? null) === (merged.deletedAt ?? null) &&
        (existing.locked ? 1 : 0) === (merged.locked ? 1 : 0) &&
        (existing.locked_at ?? 0) === merged.lockedAt &&
        existing.updated_at === merged.updatedAt &&
        existing.counts === stable(merged.counts) &&
        existing.counts_at === stable(merged.countsAt)
    );
}

/**
 * Merge an incoming array of collections into storage. Returns { collections,
 * changed } where changed is true only if a row actually changed — used to
 * decide whether to notify other devices (and avoid sync ping-pong on no-ops).
 */
export function mergeCollections(code, incoming) {
    let changed = false;
    db.exec("BEGIN");
    try {
        for (const c of incoming) {
            const existingRow = statements.selectOne.get(code, c.id);
            const merged = existingRow ? mergeCollection(rowToCollection(existingRow), c) : c;
            if (existingRow && sameStored(existingRow, merged)) continue;
            statements.upsert.run({
                code,
                id: merged.id,
                name: merged.name,
                counts: stable(merged.counts ?? {}),
                counts_at: stable(merged.countsAt ?? {}),
                created_at: merged.createdAt,
                updated_at: merged.updatedAt,
                deleted_at: merged.deletedAt ?? null,
                locked: merged.locked ? 1 : 0,
                locked_at: merged.lockedAt ?? 0,
            });
            changed = true;
        }
        statements.touchCode.run(Date.now(), code);
        db.exec("COMMIT");
    } catch (err) {
        db.exec("ROLLBACK");
        throw err;
    }
    return { collections: getCollections(code), changed };
}

function rowToCollection(row) {
    const parse = (s) => {
        try {
            return JSON.parse(s) || {};
        } catch {
            return {};
        }
    };
    return {
        id: row.id,
        name: row.name,
        counts: parse(row.counts),
        countsAt: parse(row.counts_at),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at ?? null,
        locked: !!row.locked,
        lockedAt: row.locked_at ?? 0,
    };
}
