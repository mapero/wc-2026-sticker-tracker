<script setup lang="ts">
import { computed } from "vue";
import { Star } from "lucide-vue-next";
import StickerSlot from "@/components/StickerSlot.vue";
import {
    GROUPS,
    stickersForSection,
    PAGE_ONE_SLOTS,
    TEAM_GRID_COLUMNS,
    StickerType,
    type TeamSection,
} from "@/data/album";
import "@/styles/album-page.css";

const props = defineProps<{ team: TeamSection }>();

const sectionStickers = computed(() => stickersForSection(props.team.id));
const pageOneStickers = computed(() => sectionStickers.value.filter((s) => s.slot <= PAGE_ONE_SLOTS));
const pageTwoStickers = computed(() => sectionStickers.value.filter((s) => s.slot > PAGE_ONE_SLOTS));

const teamPhoto = computed(() => pageTwoStickers.value.find((s) => s.type === StickerType.TeamPhoto) ?? null);
const pageTwoPlayers = computed(() => pageTwoStickers.value.filter((s) => s.type === StickerType.Player));

const groupRivals = computed(() =>
    (GROUPS[props.team.group] ?? []).map(([name, code, flag]) => ({ name, code, flag }))
);
const groupFixtures = computed(() => groupRivals.value.filter((r) => r.code !== props.team.id));

const pageStyle = computed<Record<string, string>>(() => ({
    "--team-color": props.team.color,
    "--team-accent": props.team.accent,
}));
</script>

<template>
    <div class="spread" :style="pageStyle">
        <article class="page page--team">
            <div class="page__grid page__grid--p1" :style="{ '--cols': TEAM_GRID_COLUMNS }">
                <header class="team-hdr">
                    <span class="team-hdr__we">{{ $t("we-are") }}</span>
                    <span class="team-hdr__name">{{ team.name.toUpperCase() }}</span>
                    <span class="team-hdr__fed">
                        <span class="team-hdr__flag">{{ team.flag }}</span>
                        <span>{{ $t("group-letter", { letter: team.group }) }}</span>
                    </span>
                </header>
                <sticker-slot v-for="s in pageOneStickers" :key="s.code" :sticker="s" show-duplicates />
                <div class="strip strip--road">
                    <span class="strip__brand"
                        ><star :size="13" fill="currentColor" /> ROAD TO FIFA WORLD CUP 2026™</span
                    >
                    <span class="strip__sub">{{ $t("qualifying-record") }}</span>
                </div>
            </div>
        </article>

        <div class="spine" aria-hidden="true" />

        <article class="page page--team">
            <div class="page__grid page__grid--p2" :style="{ '--cols': TEAM_GRID_COLUMNS }">
                <div v-if="teamPhoto" class="photo-cell">
                    <sticker-slot :sticker="teamPhoto" show-duplicates />
                </div>
                <div class="group-cell">
                    <span class="group-cell__title">{{ $t("group-letter", { letter: team.group }) }}</span>
                    <span class="group-cell__rivals">
                        <span
                            v-for="r in groupRivals"
                            :key="r.code"
                            class="group-cell__rival"
                            :class="{ 'is-self': r.code === team.id }"
                            :title="r.name"
                            >{{ r.flag }}</span
                        >
                    </span>
                </div>
                <div class="strip strip--sched">
                    <span v-for="f in groupFixtures" :key="f.code" class="fixture" :title="`${team.name} v ${f.name}`">
                        <span class="fixture__flag">{{ team.flag }}</span>
                        <span class="fixture__v">v</span>
                        <span class="fixture__flag">{{ f.flag }}</span>
                    </span>
                </div>
                <sticker-slot v-for="s in pageTwoPlayers" :key="s.code" :sticker="s" show-duplicates />
            </div>
        </article>
    </div>
</template>
