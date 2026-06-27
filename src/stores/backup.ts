import { STICKER_BY_CODE } from "@/data/album";

export type Counts = Record<string, number>;

export interface ParseResult {
    ok: boolean;
    counts?: Counts;
    imported?: number;
    error?: string;
}

/** Parse a backup file (raw counts object, or a { counts } wrapper) into valid counts. */
export function parseCounts(json: string): ParseResult {
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
