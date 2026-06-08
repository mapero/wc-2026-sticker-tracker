import type { Section } from "@/data/album";

export interface SectionRow {
    section: Section;
    isIntro: boolean;
    group: string | null;
    tag: string;
    owned: number;
    total: number;
    missing: number;
    spares: number;
    complete: boolean;
    pct: number;
    albumIndex: number;
}
