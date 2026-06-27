import { STICKERS, TOTAL_STICKERS, STICKER_BY_CODE } from "@/data/album";

export type Counts = Record<string, number>;
/** Per-sticker last-change timestamps (kept for removed stickers too, as tombstones). */
export type CountsAt = Record<string, number>;

export const DEFAULT_NAME = "My Collection";
export const DEFAULT_ID = "default";

export interface Collection {
    id: string;
    name: string;
    /** Effective owned counts (code -> qty >= 1). */
    counts: Counts;
    /** Last-change timestamp per code, including codes set back to 0 (tombstones). */
    countsAt: CountsAt;
    createdAt: number;
    updatedAt: number;
    /** Tombstone — set when deleted so the deletion propagates through sync. */
    deletedAt: number | null;
    /** When true, the collection is locked against edits on every device. */
    locked: boolean;
    /** Timestamp of the last lock-state change (merged independently of edits). */
    lockedAt: number;
}

export interface CollectionStats {
    owned: number;
    total: number;
    missing: number;
    duplicates: number;
    percent: number;
    complete: boolean;
}

export function now(): number {
    return Date.now();
}

export function newId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return `c-${now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeSyncCode(raw: string): string {
    return raw.toUpperCase().replace(/\s+/g, "").trim();
}

export function sanitizeCounts(raw: unknown): Counts {
    const out: Counts = {};
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        for (const [code, n] of Object.entries(raw as Record<string, unknown>)) {
            const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 0;
            if (STICKER_BY_CODE[code] && v > 0) out[code] = v;
        }
    }
    return out;
}

export function sanitizeTimestamps(raw: unknown): CountsAt {
    const out: CountsAt = {};
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        for (const [code, t] of Object.entries(raw as Record<string, unknown>)) {
            if (typeof t === "number" && Number.isFinite(t) && t > 0) out[code] = t;
        }
    }
    return out;
}

/** Backfill a timestamp for every owned code that lacks one (legacy/imported data). */
export function backfillTimestamps(counts: Counts, countsAt: CountsAt, fallback: number): CountsAt {
    const t = fallback > 0 ? fallback : now();
    const out: CountsAt = { ...countsAt };
    for (const code of Object.keys(counts)) if (!(out[code] > 0)) out[code] = t;
    return out;
}

export function makeCollection(name: string): Collection {
    const t = now();
    return {
        id: newId(),
        name: name.trim() || DEFAULT_NAME,
        counts: {},
        countsAt: {},
        createdAt: t,
        updatedAt: t,
        deletedAt: null,
        locked: false,
        lockedAt: 0,
    };
}

// The bootstrap/default collection uses a stable id so independent devices
// converge on a single collection instead of each migrating to a random id and
// duplicating once they sync.
export function makeDefaultCollection(counts: Counts): Collection {
    const hasData = Object.keys(counts).length > 0;
    const t = hasData ? now() : 0;
    const countsAt: CountsAt = {};
    for (const code of Object.keys(counts)) countsAt[code] = t;
    return {
        id: DEFAULT_ID,
        name: DEFAULT_NAME,
        counts,
        countsAt,
        createdAt: 0,
        updatedAt: t,
        deletedAt: null,
        locked: false,
        lockedAt: 0,
    };
}

/**
 * Merge two versions of the same collection so concurrent edits on different
 * devices stay consistent without clobbering each other:
 *  - counts: per-sticker last-write-wins by each code's own timestamp, so editing
 *    different stickers both persist and a decrement/removal propagates (newer
 *    change to that code wins). Equal timestamps keep the higher count.
 *  - name / deletedAt: last-write-wins by updatedAt
 *  - locked: last-write-wins by lockedAt (independent of content edits)
 */
export function mergeCollection(a: Collection, b: Collection): Collection {
    const counts: Counts = {};
    const countsAt: CountsAt = {};
    const codes = new Set([
        ...Object.keys(a.countsAt),
        ...Object.keys(b.countsAt),
        ...Object.keys(a.counts),
        ...Object.keys(b.counts),
    ]);
    for (const code of codes) {
        const aAt = a.countsAt[code] ?? 0;
        const bAt = b.countsAt[code] ?? 0;
        let n: number;
        let t: number;
        if (aAt > bAt) {
            n = a.counts[code] ?? 0;
            t = aAt;
        } else if (bAt > aAt) {
            n = b.counts[code] ?? 0;
            t = bAt;
        } else {
            n = Math.max(a.counts[code] ?? 0, b.counts[code] ?? 0);
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

export const STORAGE_KEY = "wc2026-collections-v1";
const LEGACY_KEY = "wc2026-collection-v1";

export type PersistedState = {
    version: 2;
    activeId: string;
    syncCode: string | null;
    collections: Collection[];
};

/** Build the initial state, migrating from the legacy single-collection key. */
export function loadState(): PersistedState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as Partial<PersistedState>;
            if (parsed && Array.isArray(parsed.collections)) {
                const collections = parsed.collections
                    .filter((c): c is Collection => !!c && typeof c.id === "string")
                    .map((c) => {
                        const counts = sanitizeCounts(c.counts);
                        const updatedAt = Number.isFinite(c.updatedAt) ? c.updatedAt : now();
                        return {
                            id: c.id,
                            name: typeof c.name === "string" ? c.name : DEFAULT_NAME,
                            counts,
                            countsAt: backfillTimestamps(counts, sanitizeTimestamps(c.countsAt), updatedAt),
                            createdAt: Number.isFinite(c.createdAt) ? c.createdAt : now(),
                            updatedAt,
                            deletedAt: Number.isFinite(c.deletedAt as number) ? (c.deletedAt as number) : null,
                            locked: !!c.locked,
                            lockedAt: Number.isFinite(c.lockedAt) ? c.lockedAt : 0,
                        };
                    });
                if (collections.some((c) => !c.deletedAt)) {
                    return {
                        version: 2,
                        collections,
                        activeId: typeof parsed.activeId === "string" ? parsed.activeId : "",
                        syncCode: typeof parsed.syncCode === "string" ? parsed.syncCode : null,
                    };
                }
            }
        }
    } catch (err) {
        console.warn("Could not load collections from localStorage:", err);
    }

    // Bootstrap a stable default collection, migrating legacy data if present.
    let counts: Counts = {};
    try {
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy) counts = sanitizeCounts(JSON.parse(legacy));
    } catch (err) {
        console.warn("Could not migrate legacy collection:", err);
    }
    const fallback = makeDefaultCollection(counts);
    return { version: 2, collections: [fallback], activeId: fallback.id, syncCode: null };
}

export function computeStats(c: Counts): CollectionStats {
    let owned = 0;
    let dups = 0;
    for (const s of STICKERS) {
        const n = c[s.code] ?? 0;
        if (n > 0) owned += 1;
        if (n > 1) dups += n - 1;
    }
    return {
        owned,
        total: TOTAL_STICKERS,
        missing: TOTAL_STICKERS - owned,
        duplicates: dups,
        percent: Math.round((owned / TOTAL_STICKERS) * 1000) / 10,
        complete: owned === TOTAL_STICKERS,
    };
}
