<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { ChevronLeft, ChevronRight, CheckCheck, Eraser, Check } from "lucide-vue-next";
import BaseButton from "@/components/base/BaseButton.vue";
import BaseChip from "@/components/base/BaseChip.vue";
import AlbumRail from "@/components/album/AlbumRail.vue";
import TeamSpread from "@/components/album/TeamSpread.vue";
import SpecialPage from "@/components/album/SpecialPage.vue";
import { useCollectionStore } from "@/stores/collection";
import { SECTIONS, INTRO_SECTION, type Section, type TeamSection, type IntroSection } from "@/data/album";

const props = defineProps<{ section?: string }>();

const route = useRoute();
const router = useRouter();
const store = useCollectionStore();
const { t } = useI18n();

const requestedId = computed<string>(() => {
    const fromProp = props.section;
    const fromRoute = route.params.section;
    const raw = fromProp ?? (Array.isArray(fromRoute) ? fromRoute[0] : fromRoute);
    return (raw ?? INTRO_SECTION.id).toString();
});

const sectionById = computed<Record<string, Section>>(() => Object.fromEntries(SECTIONS.map((s) => [s.id, s])));
const activeSection = computed<Section>(() => sectionById.value[requestedId.value] ?? INTRO_SECTION);
const activeTeamSection = computed<TeamSection | null>(() => {
    const section = activeSection.value;
    return section.kind === "TEAM" ? section : null;
});
const activeIntroSection = computed<IntroSection | null>(() => {
    const section = activeSection.value;
    return section.kind === "INTRO" ? section : null;
});

const activeIndex = computed(() => SECTIONS.findIndex((s) => s.id === activeSection.value.id));
const prevSection = computed<Section | null>(() => (activeIndex.value > 0 ? SECTIONS[activeIndex.value - 1] : null));
const nextSection = computed<Section | null>(() =>
    activeIndex.value < SECTIONS.length - 1 ? SECTIONS[activeIndex.value + 1] : null
);

const sectionTitle = computed<string>(() => {
    const s = activeSection.value;
    return s.kind === "TEAM" ? s.name : s.title;
});

const sectionOwned = computed(() => activeSection.value.stickerCodes.filter((c) => store.has(c)).length);
const sectionTotal = computed(() => activeSection.value.stickerCodes.length);
const sectionPct = computed(() =>
    sectionTotal.value === 0 ? 0 : Math.round((sectionOwned.value / sectionTotal.value) * 100)
);
const sectionComplete = computed(() => sectionTotal.value > 0 && sectionOwned.value === sectionTotal.value);

const celebrating = ref(false);
let celebrateTimer: ReturnType<typeof setTimeout> | undefined;
const confetti = Array.from({ length: 14 }, (_, i) => ({
    id: i,
    x: (i * 53) % 100,
    delay: (i % 5) * 70,
    hue: i % 3,
}));

watch(
    () => [activeSection.value.id, sectionComplete.value] as const,
    ([id, complete], [prevId, prevComplete]) => {
        if (id === prevId && complete && !prevComplete) {
            celebrating.value = true;
            clearTimeout(celebrateTimer);
            celebrateTimer = setTimeout(() => (celebrating.value = false), 2600);
        }
    }
);

onBeforeUnmount(() => clearTimeout(celebrateTimer));

function go(id: string) {
    if (id === activeSection.value.id) return;
    router.push(`/album/${id}`);
}
function markAll() {
    store.fillSection(activeSection.value.stickerCodes);
}
function clearAll() {
    if (window.confirm(t("clear-all-stickers-for-section-confirm", { section: sectionTitle.value }))) {
        store.clearSection(activeSection.value.stickerCodes);
    }
}
</script>

<template>
    <div class="album">
        <album-rail :active-id="activeSection.id" @select="go" />

        <section class="stage">
            <div class="toolbar panel">
                <div class="toolbar__head">
                    <h1 class="toolbar__title">{{ sectionTitle }}</h1>
                    <div class="toolbar__meta">
                        <base-chip v-if="activeTeamSection">Group {{ activeTeamSection.group }}</base-chip>
                        <base-chip
                            ><span class="num">{{ sectionOwned }}/{{ sectionTotal }}</span>
                            {{ $t("stickers") }}</base-chip
                        >
                        <base-chip v-if="sectionComplete" variant="done"
                            ><check :size="14" /> {{ $t("complete") }}</base-chip
                        >
                    </div>
                </div>

                <div class="toolbar__progress" :title="$t('pct-of-this-section', { pct: sectionPct })">
                    <div
                        class="toolbar__bar"
                        role="progressbar"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        :aria-valuenow="sectionPct"
                        :aria-label="$t('section-pct-complete', { section: sectionTitle, pct: sectionPct })"
                    >
                        <div class="toolbar__bar-fill" :style="{ width: `${sectionPct}%` }" />
                    </div>
                    <span class="toolbar__pct num">{{ sectionPct }}%</span>
                </div>

                <div class="toolbar__actions">
                    <base-button variant="primary" @click="markAll">
                        <check-check :size="16" /> {{ $t("mark-all") }}
                    </base-button>
                    <base-button variant="danger" @click="clearAll">
                        <eraser :size="16" /> {{ $t("clear-all") }}
                    </base-button>
                </div>
            </div>

            <team-spread v-if="activeTeamSection" :team="activeTeamSection" />
            <special-page v-else-if="activeIntroSection" :section="activeIntroSection" />

            <nav class="pager" :aria-label="$t('section-pagination')">
                <base-button class="pager__btn" :disabled="!prevSection" @click="prevSection && go(prevSection.id)">
                    <chevron-left :size="18" />
                    <span class="pager__label">{{ prevSection ? prevSection.name : $t("start") }}</span>
                </base-button>
                <span class="pager__pos num">{{ activeIndex + 1 }} / {{ SECTIONS.length }}</span>
                <base-button
                    class="pager__btn pager__btn--next"
                    :disabled="!nextSection"
                    @click="nextSection && go(nextSection.id)"
                >
                    <span class="pager__label">{{ nextSection ? nextSection.name : $t("end") }}</span>
                    <chevron-right :size="18" />
                </base-button>
            </nav>

            <transition name="celebrate">
                <div v-if="celebrating" class="celebrate" aria-live="polite" @click="celebrating = false">
                    <div class="celebrate__card foil">
                        <span class="celebrate__emoji" aria-hidden="true">🎉</span>
                        <span class="celebrate__title">{{
                            $t("section-complete-celebration", { section: sectionTitle })
                        }}</span>
                        <span class="celebrate__sub num">{{
                            $t("count-of-total-collected", { count: sectionTotal, total: sectionTotal })
                        }}</span>
                    </div>
                    <span
                        v-for="c in confetti"
                        :key="c.id"
                        class="confetti"
                        :class="`confetti--${c.hue}`"
                        :style="{ left: `${c.x}%`, animationDelay: `${c.delay}ms` }"
                        aria-hidden="true"
                    />
                </div>
            </transition>
        </section>
    </div>
</template>

<style scoped>
.album {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 18px;
    align-items: start;
}

.stage {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 18px;
    min-width: 0;
}

.celebrate {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: grid;
    place-items: center;
    overflow: hidden;
    cursor: pointer;
}
.celebrate__card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 20px 34px;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    text-align: center;
    animation: celebrate-pop 0.45s cubic-bezier(0.2, 1.3, 0.4, 1) both;
}
.celebrate__emoji {
    font-size: 2.2rem;
    line-height: 1;
}
.celebrate__title {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.3rem;
    letter-spacing: -0.01em;
    color: var(--brand-ink);
}
.celebrate__sub {
    font-weight: 700;
    font-size: 0.8rem;
    color: var(--brand-ink);
    opacity: 0.8;
}
@keyframes celebrate-pop {
    from {
        transform: scale(0.7);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}

.confetti {
    position: absolute;
    top: -16px;
    width: 9px;
    height: 14px;
    border-radius: 2px;
    animation: confetti-fall 2.4s linear forwards;
}
.confetti--0 {
    background: var(--wc-gold);
}
.confetti--1 {
    background: var(--success);
}
.confetti--2 {
    background: var(--usa-blue);
}
@keyframes confetti-fall {
    from {
        transform: translateY(0) rotate(0deg);
        opacity: 1;
    }
    to {
        transform: translateY(360px) rotate(540deg);
        opacity: 0;
    }
}

.celebrate-enter-active,
.celebrate-leave-active {
    transition: opacity 0.3s ease;
}
.celebrate-enter-from,
.celebrate-leave-to {
    opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
    .celebrate__card {
        animation: none;
    }
    .confetti {
        display: none;
    }
}

.toolbar {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 14px 20px;
    padding: 14px 18px;
}
.toolbar__head {
    min-width: 0;
}
.toolbar__title {
    font-family: var(--font-display);
    font-size: 1.6rem;
    line-height: 1.1;
    letter-spacing: -0.01em;
    margin-bottom: 8px;
}
.toolbar__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.toolbar__progress {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 180px;
}
.toolbar__bar {
    flex: 1;
    height: 9px;
    border-radius: var(--radius-pill);
    background: var(--wc-panel-2);
    border: 1px solid var(--wc-line);
    overflow: hidden;
}
.toolbar__bar-fill {
    height: 100%;
    border-radius: var(--radius-pill);
    background: var(--accent);
    transition: width 0.4s var(--ease);
}
.toolbar__pct {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 0.95rem;
    letter-spacing: -0.01em;
    min-width: 42px;
    text-align: right;
}
.toolbar__actions {
    display: flex;
    gap: 8px;
}
.toolbar__actions .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.pager {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}
.pager__btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 44%;
    border: 1px solid var(--wc-line);
    border-radius: var(--radius-sm);
    transition:
        background var(--ease),
        border-color var(--ease);
}
.pager__btn--next {
    margin-left: auto;
}
.pager__label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.pager__btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}
.pager__pos {
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--wc-muted);
    white-space: nowrap;
}

@media (max-width: 860px) {
    .album {
        grid-template-columns: 1fr;
        gap: 16px;
    }
    .toolbar {
        grid-template-columns: 1fr;
    }
    .toolbar__progress {
        min-width: 0;
    }
}
</style>
