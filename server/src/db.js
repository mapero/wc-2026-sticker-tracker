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
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL,
        deleted_at  INTEGER,                  -- tombstone timestamp, NULL if live
        PRIMARY KEY (code, id)
    );
`);

const statements = {
    codeExists: db.prepare("SELECT 1 FROM sync_codes WHERE code = ?"),
    insertCode: db.prepare("INSERT INTO sync_codes (code, created_at, synced_at) VALUES (?, ?, ?)"),
    touchCode: db.prepare("UPDATE sync_codes SET synced_at = ? WHERE code = ?"),
    selectCollections: db.prepare("SELECT id, name, counts, created_at, updated_at, deleted_at FROM collections WHERE code = ?"),
    selectOne: db.prepare("SELECT updated_at FROM collections WHERE code = ? AND id = ?"),
    upsert: db.prepare(`
        INSERT INTO collections (code, id, name, counts, created_at, updated_at, deleted_at)
        VALUES (@code, @id, @name, @counts, @created_at, @updated_at, @deleted_at)
        ON CONFLICT(code, id) DO UPDATE SET
            name = excluded.name,
            counts = excluded.counts,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at
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
 * Merge an incoming array of collections into storage using last-write-wins per
 * collection id (by updated_at). Returns the full merged set.
 */
export function mergeCollections(code, incoming) {
    db.exec("BEGIN");
    try {
        for (const c of incoming) {
            const existing = statements.selectOne.get(code, c.id);
            // Only overwrite when the incoming record is strictly newer.
            if (existing && existing.updated_at >= c.updatedAt) continue;
            statements.upsert.run({
                code,
                id: c.id,
                name: c.name,
                counts: JSON.stringify(c.counts ?? {}),
                created_at: c.createdAt,
                updated_at: c.updatedAt,
                deleted_at: c.deletedAt ?? null,
            });
        }
        statements.touchCode.run(Date.now(), code);
        db.exec("COMMIT");
    } catch (err) {
        db.exec("ROLLBACK");
        throw err;
    }
    return getCollections(code);
}

function rowToCollection(row) {
    let counts = {};
    try {
        counts = JSON.parse(row.counts) || {};
    } catch {
        counts = {};
    }
    return {
        id: row.id,
        name: row.name,
        counts,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at ?? null,
    };
}
