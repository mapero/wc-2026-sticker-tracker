import { computed, ref, type ComputedRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ALBUM_META, TOTAL_STICKERS, INTRO_SECTION, type Sticker } from "@/data/album";
import { useCollectionStore } from "@/stores/collection";

export type Grouping = "team" | "flat";
export type Detail = "codes" | "names";
export type Compactness = "lines" | "commas";

interface SectionGroup {
    key: string;
    header: string;
    stickers: Sticker[];
}

export interface UseNeedsExport {
    grouping: Ref<Grouping>;
    detail: Ref<Detail>;
    compactness: Ref<Compactness>;
    includeIntro: Ref<boolean>;
    neededCount: ComputedRef<number>;
    swapCount: ComputedRef<number>;
    needsText: ComputedRef<string>;
    swapsText: ComputedRef<string>;
}

function groupBySection(stickers: Sticker[]): SectionGroup[] {
    const groups: SectionGroup[] = [];
    const byKey = new Map<string, SectionGroup>();
    for (const s of stickers) {
        let bucket = byKey.get(s.section);
        if (!bucket) {
            const header = s.teamCode != null ? `${s.teamName} (${s.teamCode})` : s.sectionTitle;
            bucket = { key: s.section, header, stickers: [] };
            byKey.set(s.section, bucket);
            groups.push(bucket);
        }
        bucket.stickers.push(s);
    }
    return groups;
}

export function useNeedsExport(): UseNeedsExport {
    const store = useCollectionStore();
    const { t } = useI18n();

    const grouping = ref<Grouping>("team");
    const detail = ref<Detail>("codes");
    const compactness = ref<Compactness>("lines");
    const includeIntro = ref<boolean>(true);

    function renderSticker(s: Sticker): string {
        if (detail.value === "names") {
            return `${s.code} · ${s.label}`;
        }
        return s.code;
    }

    function applyIntroFilter(stickers: Sticker[]): Sticker[] {
        if (includeIntro.value) return stickers;
        return stickers.filter((s) => s.section !== "intro");
    }

    // Shared renderer for both lists: applies grouping, detail and compactness.
    function renderList(list: Sticker[], title: string, emptyText: string): string {
        if (list.length === 0) {
            return `${title}\n\n${emptyText}`;
        }

        const lines: string[] = [title, ""];

        if (grouping.value === "flat") {
            const entries = list.map(renderSticker);
            if (compactness.value === "commas") lines.push(entries.join(", "));
            else lines.push(...entries);
            return lines.join("\n");
        }

        const groups = groupBySection(list);
        groups.forEach((g, i) => {
            const entries = g.stickers.map(renderSticker);
            if (compactness.value === "commas") {
                lines.push(`${g.header}: ${entries.join(", ")}`);
            } else {
                lines.push(g.header);
                lines.push(...entries);
                if (i < groups.length - 1) lines.push("");
            }
        });

        return lines.join("\n");
    }

    const neededStickers = computed<Sticker[]>(() => applyIntroFilter(store.missingStickers));

    const neededCount = computed<number>(() => neededStickers.value.length);

    const scopeTotal = computed<number>(() =>
        includeIntro.value ? TOTAL_STICKERS : TOTAL_STICKERS - INTRO_SECTION.stickerCodes.length
    );
    const scopeComplete = computed<string>(() =>
        includeIntro.value ? t("export-album-complete") : t("export-teams-complete")
    );

    const needsText = computed<string>(() => {
        const title = `${ALBUM_META.title} · ${t("export-needs-title", { needed: neededCount.value, total: scopeTotal.value })}`;
        return renderList(neededStickers.value, title, scopeComplete.value);
    });

    // Each spare is listed individually — a sticker with N duplicates appears N times.
    const swapStickers = computed<Sticker[]>(() => {
        const out: Sticker[] = [];
        for (const { sticker, spare } of store.duplicateStickers) {
            if (!includeIntro.value && sticker.section === "intro") continue;
            for (let i = 0; i < spare; i++) out.push(sticker);
        }
        return out;
    });

    const swapCount = computed<number>(() => swapStickers.value.length);

    const swapsText = computed<string>(() => {
        const title = `${ALBUM_META.title} · ${t("export-swaps-title", { count: swapCount.value })}`;
        return renderList(swapStickers.value, title, t("export-no-duplicates"));
    });

    return {
        grouping,
        detail,
        compactness,
        includeIntro,
        neededCount,
        swapCount,
        needsText,
        swapsText,
    };
}
