import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { STICKERS, TEAMS, TOTAL_STICKERS, STICKER_BY_CODE, type Sticker, type TeamSection } from "@/data/album";
import { createSyncCode, pullCollections, pushCollections, SyncError, type SyncCollectionDTO } from "@/sync/client";
import { parseCounts } from "./backup";

const STORAGE_KEY = "wc2026-collections-v1";
const LEGACY_KEY = "wc2026-collection-v1";
const DEFAULT_NAME = "My Collection";
const DEFAULT_ID = "default";
const AUTO_SYNC_DELAY = 1500;
const POLL_INTERVAL = 8000;

type Counts = Record<string, number>;

export interface Collection {
    id: string;
    name: string;
    counts: Counts;
    createdAt: number;
    updatedAt: number;
    /** Tombstone — set when deleted so the deletion propagates through sync. */
    deletedAt: number | null;
}

export interface CollectionStats {
    owned: number;
    total: number;
    missing: number;
    duplicates: number;
    percent: number;
    complete: boolean;
}

export interface TeamProgress {
    team: TeamSection;
    owned: number;
    total: number;
    missing: string[];
    duplicates: string[];
    complete: boolean;
}

type PersistedState = {
    version: 2;
    activeId: string;
    syncCode: string | null;
    collections: Collection[];
};

function now(): number {
    return Date.now();
}

function newId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return `c-${now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeCounts(raw: unknown): Counts {
    const out: Counts = {};
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        for (const [code, n] of Object.entries(raw as Record<string, unknown>)) {
            const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 0;
            if (STICKER_BY_CODE[code] && v > 0) out[code] = v;
        }
    }
    return out;
}

function makeCollection(name: string): Collection {
    const t = now();
    return { id: newId(), name: name.trim() || DEFAULT_NAME, counts: {}, createdAt: t, updatedAt: t, deletedAt: null };
}

// The bootstrap/default collection uses a stable id so independent devices
// converge on a single collection instead of each migrating to a random id and
// duplicating once they sync. An empty default keeps updatedAt=0 so it can never
// overwrite real data on another device during a last-write-wins merge.
function makeDefaultCollection(counts: Counts): Collection {
    const hasData = Object.keys(counts).length > 0;
    return {
        id: DEFAULT_ID,
        name: DEFAULT_NAME,
        counts,
        createdAt: 0,
        updatedAt: hasData ? now() : 0,
        deletedAt: null,
    };
}

/** Build the initial state, migrating from the legacy single-collection key. */
function loadState(): PersistedState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as Partial<PersistedState>;
            if (parsed && Array.isArray(parsed.collections)) {
                const collections = parsed.collections
                    .filter((c): c is Collection => !!c && typeof c.id === "string")
                    .map((c) => ({
                        id: c.id,
                        name: typeof c.name === "string" ? c.name : DEFAULT_NAME,
                        counts: sanitizeCounts(c.counts),
                        createdAt: Number.isFinite(c.createdAt) ? c.createdAt : now(),
                        updatedAt: Number.isFinite(c.updatedAt) ? c.updatedAt : now(),
                        deletedAt: Number.isFinite(c.deletedAt as number) ? (c.deletedAt as number) : null,
                    }));
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

export function normalizeSyncCode(raw: string): string {
    return raw.toUpperCase().replace(/\s+/g, "").trim();
}

export const useCollectionStore = defineStore("collection", () => {
    const initial = loadState();

    const collections = ref<Collection[]>(initial.collections);
    const activeId = ref<string>(initial.activeId);
    const syncCode = ref<string | null>(initial.syncCode);

    const syncStatus = ref<"idle" | "syncing" | "ok" | "error">("idle");
    const syncError = ref<string | null>(null);
    const lastSyncedAt = ref<number | null>(null);
    const syncEnabled = computed(() => !!syncCode.value);

    const visibleCollections = computed<Collection[]>(() => collections.value.filter((c) => !c.deletedAt));

    function ensureActive(): void {
        if (!visibleCollections.value.length) {
            // Resurrect the stable default rather than minting a new random id.
            const existing = collections.value.find((c) => c.id === DEFAULT_ID);
            if (existing) {
                existing.deletedAt = null;
                existing.updatedAt = now();
            } else {
                const c = makeDefaultCollection({});
                c.updatedAt = now();
                collections.value.push(c);
            }
            activeId.value = DEFAULT_ID;
        } else if (!visibleCollections.value.some((c) => c.id === activeId.value)) {
            activeId.value = visibleCollections.value[0].id;
        }
    }
    ensureActive();

    const activeCollection = computed<Collection>(
        () => collections.value.find((c) => c.id === activeId.value && !c.deletedAt) ?? visibleCollections.value[0]
    );
    const activeName = computed(() => activeCollection.value?.name ?? DEFAULT_NAME);
    const counts = computed<Counts>(() => activeCollection.value?.counts ?? {});

    // Persist to localStorage on any change.
    watch(
        [collections, activeId, syncCode],
        () => {
            try {
                const state: PersistedState = {
                    version: 2,
                    collections: collections.value,
                    activeId: activeId.value,
                    syncCode: syncCode.value,
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            } catch (err) {
                console.warn("Could not save collections to localStorage:", err);
            }
        },
        { deep: true }
    );

    // ---- active-collection sticker API (unchanged surface) -----------------

    const count = (code: string): number => counts.value[code] ?? 0;
    const has = (code: string): boolean => count(code) > 0;
    const duplicates = (code: string): number => Math.max(0, count(code) - 1);

    function touchActive(): void {
        const c = activeCollection.value;
        if (c) c.updatedAt = now();
        scheduleSync();
    }

    function setCount(code: string, n: number) {
        const c = activeCollection.value;
        if (!c || !STICKER_BY_CODE[code] || !Number.isFinite(n)) return;
        const value = Math.max(0, Math.floor(n));
        if (value === 0) delete c.counts[code];
        else c.counts[code] = value;
        touchActive();
    }
    function toggle(code: string) {
        setCount(code, has(code) ? 0 : 1);
    }
    function increment(code: string) {
        setCount(code, count(code) + 1);
    }
    function decrement(code: string) {
        if (count(code) > 1) setCount(code, count(code) - 1);
    }

    const ownedCount = computed(() => STICKERS.reduce((acc, s) => acc + (counts.value[s.code] ? 1 : 0), 0));
    const totalCount = TOTAL_STICKERS;
    const missingCount = computed(() => totalCount - ownedCount.value);
    const duplicateCount = computed(() => Object.values(counts.value).reduce((acc, n) => acc + Math.max(0, n - 1), 0));
    const percentComplete = computed(() => Math.round((ownedCount.value / totalCount) * 1000) / 10);
    const isComplete = computed(() => ownedCount.value === totalCount);

    function teamProgress(team: TeamSection): TeamProgress {
        const missing: string[] = [];
        const dups: string[] = [];
        let owned = 0;
        for (const code of team.stickerCodes) {
            const n = counts.value[code] ?? 0;
            if (n > 0) owned += 1;
            else missing.push(code);
            if (n > 1) dups.push(code);
        }
        return {
            team,
            owned,
            total: team.stickerCodes.length,
            missing,
            duplicates: dups,
            complete: owned === team.stickerCodes.length,
        };
    }
    const allTeamProgress = computed<TeamProgress[]>(() => TEAMS.map(teamProgress));

    const missingStickers = computed<Sticker[]>(() => STICKERS.filter((s) => !counts.value[s.code]));
    const duplicateStickers = computed<{ sticker: Sticker; spare: number }[]>(() =>
        STICKERS.filter((s) => (counts.value[s.code] ?? 0) > 1).map((s) => ({
            sticker: s,
            spare: counts.value[s.code] - 1,
        }))
    );

    function reset() {
        const c = activeCollection.value;
        if (!c) return;
        c.counts = {};
        touchActive();
    }
    function clearSwaps() {
        const c = activeCollection.value;
        if (!c) return;
        for (const [code, n] of Object.entries(c.counts)) if (n > 1) c.counts[code] = 1;
        touchActive();
    }
    function fillSection(codes: string[]) {
        for (const code of codes) if (!has(code)) setCount(code, 1);
    }
    function clearSection(codes: string[]) {
        for (const code of codes) setCount(code, 0);
    }

    // ---- multi-collection management ---------------------------------------

    function computeStats(c: Counts): CollectionStats {
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

    const allCollectionStats = computed<{ collection: Collection; stats: CollectionStats }[]>(() =>
        visibleCollections.value.map((c) => ({ collection: c, stats: computeStats(c.counts) }))
    );

    function createCollection(name: string): string {
        const c = makeCollection(name);
        collections.value.push(c);
        activeId.value = c.id;
        scheduleSync();
        return c.id;
    }
    function renameCollection(id: string, name: string) {
        const c = collections.value.find((x) => x.id === id);
        if (!c || !name.trim()) return;
        c.name = name.trim();
        c.updatedAt = now();
        scheduleSync();
    }
    function duplicateCollection(id: string): string | null {
        const src = collections.value.find((x) => x.id === id && !x.deletedAt);
        if (!src) return null;
        const copy = makeCollection(`${src.name} (copy)`);
        copy.counts = { ...src.counts };
        collections.value.push(copy);
        activeId.value = copy.id;
        scheduleSync();
        return copy.id;
    }
    function deleteCollection(id: string) {
        const c = collections.value.find((x) => x.id === id);
        if (!c || c.deletedAt) return;
        c.deletedAt = now();
        c.updatedAt = now();
        c.counts = {};
        ensureActive();
        scheduleSync();
    }
    function setActiveCollection(id: string) {
        if (collections.value.some((c) => c.id === id && !c.deletedAt)) activeId.value = id;
    }

    // ---- backup / transfer (active collection) -----------------------------

    function exportJSON(): string {
        return JSON.stringify(
            { version: 1, name: activeName.value, exportedAt: new Date().toISOString(), counts: counts.value },
            null,
            2
        );
    }
    function importJSON(json: string): { ok: boolean; error?: string; imported?: number } {
        const res = parseCounts(json);
        if (!res.ok || !res.counts) return { ok: false, error: res.error };
        const c = activeCollection.value;
        if (!c) return { ok: false, error: "No active collection." };
        c.counts = res.counts;
        touchActive();
        return { ok: true, imported: res.imported };
    }

    // ---- sync ---------------------------------------------------------------

    function toDTO(c: Collection): SyncCollectionDTO {
        return {
            id: c.id,
            name: c.name,
            counts: c.counts,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            deletedAt: c.deletedAt,
        };
    }

    /**
     * Merge server collections into local state by id (last-write-wins on
     * updatedAt). Local-only entries not yet pushed, and local edits newer than
     * the server copy, are preserved — so background polling never clobbers
     * in-flight work.
     */
    function adoptMerged(incoming: SyncCollectionDTO[]): void {
        const byId = new Map<string, Collection>();
        for (const c of collections.value) byId.set(c.id, c);
        for (const m of incoming) {
            const local = byId.get(m.id);
            if (local && local.updatedAt >= m.updatedAt) continue;
            byId.set(m.id, {
                id: m.id,
                name: m.name,
                counts: sanitizeCounts(m.counts),
                createdAt: m.createdAt,
                updatedAt: m.updatedAt,
                deletedAt: m.deletedAt ?? null,
            });
        }
        collections.value = [...byId.values()];
        ensureActive();
    }

    let syncTimer: ReturnType<typeof setTimeout> | undefined;
    function scheduleSync(): void {
        if (!syncCode.value) return;
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => void syncNow(), AUTO_SYNC_DELAY);
    }

    let syncInFlight = false;
    async function syncNow(): Promise<{ ok: boolean; error?: string }> {
        if (!syncCode.value) return { ok: false, error: "not-enabled" };
        if (syncInFlight) return { ok: false, error: "busy" };
        syncInFlight = true;
        clearTimeout(syncTimer);
        syncStatus.value = "syncing";
        syncError.value = null;
        try {
            const merged = await pushCollections(syncCode.value, collections.value.map(toDTO));
            adoptMerged(merged);
            lastSyncedAt.value = now();
            syncStatus.value = "ok";
            return { ok: true };
        } catch (err) {
            const code = err instanceof SyncError ? (err.code ?? err.message) : "unknown";
            syncError.value = code;
            syncStatus.value = "error";
            return { ok: false, error: code };
        } finally {
            syncInFlight = false;
        }
    }

    async function enableSync(): Promise<{ ok: boolean; code?: string; error?: string }> {
        syncStatus.value = "syncing";
        syncError.value = null;
        try {
            const { code } = await createSyncCode();
            syncCode.value = code;
            const merged = await pushCollections(code, collections.value.map(toDTO));
            adoptMerged(merged);
            lastSyncedAt.value = now();
            syncStatus.value = "ok";
            startPolling();
            return { ok: true, code };
        } catch (err) {
            syncCode.value = null;
            const e = err instanceof SyncError ? (err.code ?? err.message) : "unknown";
            syncError.value = e;
            syncStatus.value = "error";
            return { ok: false, error: e };
        }
    }

    async function pairWithCode(raw: string): Promise<{ ok: boolean; error?: string }> {
        const code = normalizeSyncCode(raw);
        syncStatus.value = "syncing";
        syncError.value = null;
        try {
            await pullCollections(code); // validates the code exists (404 otherwise)
            syncCode.value = code;
            const merged = await pushCollections(code, collections.value.map(toDTO));
            adoptMerged(merged);
            lastSyncedAt.value = now();
            syncStatus.value = "ok";
            startPolling();
            return { ok: true };
        } catch (err) {
            const e = err instanceof SyncError ? (err.code ?? err.message) : "unknown";
            syncError.value = e;
            syncStatus.value = "error";
            return { ok: false, error: e };
        }
    }

    function disableSync(): void {
        clearTimeout(syncTimer);
        stopPolling();
        syncCode.value = null;
        syncStatus.value = "idle";
        syncError.value = null;
        lastSyncedAt.value = null;
    }

    // Background pull: while sync is on, periodically pull remote changes so
    // other devices' edits show up without requiring a local edit first.
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    function startPolling(): void {
        stopPolling();
        if (!syncCode.value) return;
        pollTimer = setInterval(() => {
            if (syncStatus.value !== "syncing") void syncNow();
        }, POLL_INTERVAL);
    }
    function stopPolling(): void {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = undefined;
    }

    // If a sync code was restored from a previous session, sync immediately and
    // start polling. Also re-sync whenever the tab regains focus.
    if (syncCode.value) {
        void syncNow();
        startPolling();
    }
    if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden && syncCode.value && syncStatus.value !== "syncing") void syncNow();
        });
    }

    return {
        // active sticker API
        counts,
        count,
        has,
        duplicates,
        setCount,
        toggle,
        increment,
        decrement,
        fillSection,
        clearSection,
        reset,
        clearSwaps,
        ownedCount,
        totalCount,
        missingCount,
        duplicateCount,
        percentComplete,
        isComplete,
        teamProgress,
        allTeamProgress,
        missingStickers,
        duplicateStickers,
        exportJSON,
        importJSON,
        parseCounts,
        // collections
        collections: visibleCollections,
        activeId,
        activeCollection,
        activeName,
        computeStats,
        allCollectionStats,
        createCollection,
        renameCollection,
        duplicateCollection,
        deleteCollection,
        setActiveCollection,
        // sync
        syncCode,
        syncStatus,
        syncError,
        lastSyncedAt,
        syncEnabled,
        enableSync,
        pairWithCode,
        syncNow,
        disableSync,
    };
});
