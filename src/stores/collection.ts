import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { STICKERS, TEAMS, TOTAL_STICKERS, STICKER_BY_CODE, type Sticker, type TeamSection } from "@/data/album";

const STORAGE_KEY = "wc2026-collection-v1";

type Counts = Record<string, number>;

function loadCounts(): Counts {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
            const out: Counts = {};
            for (const [code, n] of Object.entries(parsed)) {
                const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 0;
                if (STICKER_BY_CODE[code] && v > 0) {
                    out[code] = v;
                }
            }
            return out;
        }
    } catch (err) {
        console.warn("Could not load collection from localStorage:", err);
    }
    return {};
}

export interface TeamProgress {
    team: TeamSection;
    owned: number;
    total: number;
    missing: string[];
    duplicates: string[];
    complete: boolean;
}

export const useCollectionStore = defineStore("collection", () => {
    const counts = ref<Counts>(loadCounts());

    watch(
        counts,
        (value) => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
            } catch (err) {
                console.warn("Could not save collection to localStorage:", err);
            }
        },
        { deep: true }
    );

    const count = (code: string): number => counts.value[code] ?? 0;
    const has = (code: string): boolean => count(code) > 0;
    const duplicates = (code: string): number => Math.max(0, count(code) - 1);

    function setCount(code: string, n: number) {
        if (!STICKER_BY_CODE[code] || !Number.isFinite(n)) return;
        const value = Math.max(0, Math.floor(n));
        if (value === 0) {
            delete counts.value[code];
        } else {
            counts.value[code] = value;
        }
    }
    function toggle(code: string) {
        setCount(code, has(code) ? 0 : 1);
    }
    function increment(code: string) {
        setCount(code, count(code) + 1);
    }
    function decrement(code: string) {
        if (count(code) > 1) {
            setCount(code, count(code) - 1);
        }
    }

    const ownedCount = computed(() => STICKERS.reduce((acc, s) => acc + (counts.value[s.code] ? 1 : 0), 0));
    const totalCount = TOTAL_STICKERS;
    const missingCount = computed(() => totalCount - ownedCount.value);
    const duplicateCount = computed(() =>
        Object.entries(counts.value).reduce((acc, [, n]) => acc + Math.max(0, n - 1), 0)
    );
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
        counts.value = {};
    }
    function fillSection(codes: string[]) {
        for (const code of codes) if (!has(code)) setCount(code, 1);
    }
    function clearSection(codes: string[]) {
        for (const code of codes) setCount(code, 0);
    }

    function exportJSON(): string {
        return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), counts: counts.value }, null, 2);
    }
    function parseCounts(json: string): { ok: boolean; counts?: Counts; imported?: number; error?: string } {
        try {
            const parsed = JSON.parse(json);
            const isBackup = !!parsed && typeof parsed === "object" && !Array.isArray(parsed) && "counts" in parsed;
            const incoming: unknown = isBackup ? (parsed as { counts: unknown }).counts : parsed;
            if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
                return { ok: false, error: "No counts object found in file." };
            }
            const entries = Object.entries(incoming as Record<string, unknown>);
            const next: Counts = {};
            let imported = 0;
            for (const [code, n] of entries) {
                const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 0;
                if (STICKER_BY_CODE[code] && v > 0) {
                    next[code] = v;
                    imported += 1;
                }
            }
            if (imported === 0 && !(isBackup && entries.length === 0)) {
                return { ok: false, error: "No recognised sticker codes in file." };
            }
            return { ok: true, counts: next, imported };
        } catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : "Invalid JSON." };
        }
    }

    function importJSON(json: string): { ok: boolean; error?: string; imported?: number } {
        const res = parseCounts(json);
        if (!res.ok || !res.counts) return { ok: false, error: res.error };
        counts.value = res.counts;
        return { ok: true, imported: res.imported };
    }

    return {
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
    };
});
