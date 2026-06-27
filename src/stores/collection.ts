import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { STICKERS, TEAMS, TOTAL_STICKERS, STICKER_BY_CODE, type Sticker, type TeamSection } from "@/data/album";
import {
    createSyncCode,
    openEventStream,
    pullCollections,
    pushCollections,
    SyncError,
    type SyncCollectionDTO,
} from "@/sync/client";
import { parseCounts } from "./backup";
import {
    backfillTimestamps,
    computeStats,
    DEFAULT_ID,
    DEFAULT_NAME,
    loadState,
    makeCollection,
    makeDefaultCollection,
    mergeCollection,
    normalizeSyncCode,
    now,
    sanitizeCounts,
    sanitizeTimestamps,
    STORAGE_KEY,
    type Collection,
    type CollectionStats,
    type Counts,
    type PersistedState,
} from "./collection-model";

export type { Collection, CollectionStats } from "./collection-model";
export { normalizeSyncCode } from "./collection-model";

const AUTO_SYNC_DELAY = 800;

export interface TeamProgress {
    team: TeamSection;
    owned: number;
    total: number;
    missing: string[];
    duplicates: string[];
    complete: boolean;
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
    const activeLocked = computed(() => !!activeCollection.value?.locked);
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
        if (!c || c.locked || !STICKER_BY_CODE[code] || !Number.isFinite(n)) return;
        const value = Math.max(0, Math.floor(n));
        if (value === 0) delete c.counts[code];
        else c.counts[code] = value;
        // Stamp this sticker so its change (including removal) wins per-code merges.
        c.countsAt[code] = now();
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
        if (!c || c.locked) return;
        const t = now();
        for (const code of Object.keys(c.counts)) c.countsAt[code] = t; // tombstone each removal
        c.counts = {};
        touchActive();
    }
    function clearSwaps() {
        const c = activeCollection.value;
        if (!c || c.locked) return;
        const t = now();
        for (const [code, n] of Object.entries(c.counts))
            if (n > 1) {
                c.counts[code] = 1;
                c.countsAt[code] = t;
            }
        touchActive();
    }
    function fillSection(codes: string[]) {
        for (const code of codes) if (!has(code)) setCount(code, 1);
    }
    function clearSection(codes: string[]) {
        for (const code of codes) setCount(code, 0);
    }

    // ---- multi-collection management ---------------------------------------

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
        if (!c || c.locked || !name.trim()) return;
        c.name = name.trim();
        c.updatedAt = now();
        scheduleSync();
    }
    function toggleLock(id: string) {
        const c = collections.value.find((x) => x.id === id);
        if (!c || c.deletedAt) return;
        c.locked = !c.locked;
        // Tracked separately from updatedAt so lock toggles merge independently
        // of content edits across devices.
        c.lockedAt = now();
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
        if (!c || c.deletedAt || c.locked) return;
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
        if (c.locked) return { ok: false, error: "Collection is locked." };
        const t = now();
        for (const code of new Set([...Object.keys(c.counts), ...Object.keys(res.counts)])) c.countsAt[code] = t;
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
            countsAt: c.countsAt,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            deletedAt: c.deletedAt,
            locked: c.locked,
            lockedAt: c.lockedAt,
        };
    }

    function fromDTO(m: SyncCollectionDTO): Collection {
        const counts = sanitizeCounts(m.counts);
        const updatedAt = Number.isFinite(m.updatedAt) ? m.updatedAt : now();
        return {
            id: m.id,
            name: m.name,
            counts,
            countsAt: backfillTimestamps(counts, sanitizeTimestamps(m.countsAt), updatedAt),
            createdAt: m.createdAt,
            updatedAt,
            deletedAt: m.deletedAt ?? null,
            locked: !!m.locked,
            lockedAt: Number.isFinite(m.lockedAt) ? m.lockedAt : 0,
        };
    }

    /**
     * Merge server collections into local state by id. Same-id collections are
     * merged field-wise (per-sticker max counts, LWW name/lock), so concurrent
     * edits across devices don't clobber each other and local in-flight edits
     * survive. Local-only entries (not yet pushed) are preserved.
     */
    function adoptMerged(incoming: SyncCollectionDTO[]): void {
        const byId = new Map<string, Collection>();
        for (const c of collections.value) byId.set(c.id, c);
        for (const m of incoming) {
            const remote = fromDTO(m);
            const local = byId.get(m.id);
            byId.set(m.id, local ? mergeCollection(local, remote) : remote);
        }
        collections.value = [...byId.values()];
        ensureActive();
    }

    let syncTimer: ReturnType<typeof setTimeout> | undefined;
    let pendingPush = false;
    function scheduleSync(): void {
        if (!syncCode.value) return;
        pendingPush = true;
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => void syncNow(), AUTO_SYNC_DELAY);
    }

    let syncInFlight = false;
    /** Push local state and merge the server's response back in (outbound edits). */
    async function syncNow(): Promise<{ ok: boolean; error?: string }> {
        if (!syncCode.value) return { ok: false, error: "not-enabled" };
        if (syncInFlight) return { ok: false, error: "busy" };
        syncInFlight = true;
        pendingPush = false;
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

    /** Pull remote state and merge it locally without pushing (inbound, on a change event). */
    async function pullSync(): Promise<void> {
        if (!syncCode.value || syncInFlight) return;
        syncInFlight = true;
        try {
            const remote = await pullCollections(syncCode.value);
            adoptMerged(remote);
            lastSyncedAt.value = now();
            syncStatus.value = "ok";
        } catch (err) {
            syncError.value = err instanceof SyncError ? (err.code ?? err.message) : "unknown";
            syncStatus.value = "error";
        } finally {
            syncInFlight = false;
            // A local edit may have landed mid-pull — flush it.
            if (pendingPush) {
                clearTimeout(syncTimer);
                void syncNow();
            }
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
            startStream();
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
            startStream();
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
        stopStream();
        syncCode.value = null;
        syncStatus.value = "idle";
        syncError.value = null;
        lastSyncedAt.value = null;
    }

    // Live updates: subscribe to the server's event stream so other devices'
    // changes are pulled the instant they happen (EventSource auto-reconnects).
    let closeStream: (() => void) | undefined;
    function startStream(): void {
        stopStream();
        if (!syncCode.value) return;
        closeStream = openEventStream(syncCode.value, () => void pullSync());
    }
    function stopStream(): void {
        closeStream?.();
        closeStream = undefined;
    }

    // If a sync code was restored from a previous session, sync now and open the
    // stream. On tab hide, flush any pending push; on show, catch up + reconnect.
    if (syncCode.value) {
        void syncNow();
        startStream();
    }
    if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", () => {
            if (!syncCode.value) return;
            if (document.hidden) {
                if (pendingPush) void syncNow();
            } else {
                void pullSync();
                if (!closeStream) startStream();
            }
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
        activeLocked,
        computeStats,
        allCollectionStats,
        createCollection,
        renameCollection,
        duplicateCollection,
        deleteCollection,
        setActiveCollection,
        toggleLock,
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
