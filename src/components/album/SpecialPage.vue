<script setup lang="ts">
import { computed } from "vue";
import StickerSlot from "@/components/StickerSlot.vue";
import { stickersForSection, type IntroSection } from "@/data/album";
import "@/styles/album-page.css";

const props = defineProps<{ section: IntroSection }>();

const sectionStickers = computed(() => stickersForSection(props.section.id));
const pageStyle = computed<Record<string, string>>(() => ({
    "--team-color": props.section.color,
    "--team-accent": props.section.accent,
}));
</script>

<template>
    <div class="spread spread--single">
        <article class="page page--intro" :style="pageStyle">
            <div class="page__grid page__grid--intro">
                <sticker-slot v-for="s in sectionStickers" :key="s.code" :sticker="s" show-duplicates />
            </div>
        </article>
    </div>
</template>
