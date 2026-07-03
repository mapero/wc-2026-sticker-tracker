import { computed, ref, type ComputedRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ALBUM_META, TOTAL_STICKERS, INTRO_SECTION, type Sticker } from "@/data/album";
import { useCollectionStore } from "@/stores/collection";
import { textPdf, type PdfLine } from "@/utils/pdf";

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
    makePdf: () => Blob;
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

    // Compact PDF with both lists in a fixed format (grouped, codes only,
    // full album) - the on-screen format options don't apply here.
    function makePdf(): Blob {
        const lines: PdfLine[] = [{ text: ALBUM_META.title, bold: true, size: 14 }];

        const missing = store.missingStickers;
        lines.push({
            text: t("export-needs-title", { needed: missing.length, total: TOTAL_STICKERS }),
            bold: true,
            size: 10.5,
            gapBefore: 10,
        });
        if (missing.length === 0) {
            lines.push({ text: t("export-album-complete"), gapBefore: 2 });
        } else {
            for (const g of groupBySection(missing)) {
                lines.push({ text: `${g.header}: ${g.stickers.map((s) => s.code).join(", ")}`, gapBefore: 2 });
            }
        }

        const dupes = store.duplicateStickers;
        const spareTotal = dupes.reduce((sum, d) => sum + d.spare, 0);
        lines.push({
            text: t("export-swaps-title", { count: spareTotal }),
            bold: true,
            size: 10.5,
            gapBefore: 14,
        });
        if (dupes.length === 0) {
            lines.push({ text: t("export-no-duplicates"), gapBefore: 2 });
        } else {
            const spareByCode = new Map(dupes.map((d) => [d.sticker.code, d.spare]));
            for (const g of groupBySection(dupes.map((d) => d.sticker))) {
                const entries = g.stickers.map((s) => {
                    const spare = spareByCode.get(s.code) ?? 1;
                    return spare > 1 ? `${s.code} x${spare}` : s.code;
                });
                lines.push({ text: `${g.header}: ${entries.join(", ")}`, gapBefore: 2 });
            }
        }

        return textPdf(lines);
    }

    return {
        grouping,
        detail,
        compactness,
        includeIntro,
        neededCount,
        swapCount,
        needsText,
        swapsText,
        makePdf,
    };
}
