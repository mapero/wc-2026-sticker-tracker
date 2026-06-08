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
        const list = neededStickers.value;

        if (list.length === 0) {
            return `${title}\n\n${scopeComplete.value}`;
        }

        const lines: string[] = [title, ""];

        if (grouping.value === "flat") {
            const entries = list.map(renderSticker);
            if (compactness.value === "commas") {
                lines.push(entries.join(", "));
            } else {
                lines.push(...entries);
            }
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
    });

    const swapEntries = computed(() => store.duplicateStickers);

    const swapCount = computed<number>(() => store.duplicateCount);

    const swapsText = computed<string>(() => {
        const entries = swapEntries.value;
        const title = `${ALBUM_META.title} · ${t("export-swaps-title", { count: swapCount.value })}`;

        if (entries.length === 0) {
            return `${title}\n\n${t("export-no-duplicates")}`;
        }

        const lines: string[] = [title, ""];
        const groups = new Map<string, { header: string; rows: string[] }>();
        const order: string[] = [];

        for (const { sticker: s, spare } of entries) {
            let bucket = groups.get(s.section);
            if (!bucket) {
                const header = s.teamCode != null ? `${s.teamName} (${s.teamCode})` : s.sectionTitle;
                bucket = { header, rows: [] };
                groups.set(s.section, bucket);
                order.push(s.section);
            }
            bucket.rows.push(`${s.code} · ${s.label} ${t("export-spare-count", { n: spare })}`);
        }

        order.forEach((key, i) => {
            const g = groups.get(key);
            if (!g) return;
            lines.push(g.header);
            lines.push(...g.rows);
            if (i < order.length - 1) lines.push("");
        });

        return lines.join("\n");
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
