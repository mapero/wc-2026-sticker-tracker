<script setup lang="ts">
import { computed } from "vue";
import { ALBUM_META } from "@/data/album";
import { useCollectionStore } from "@/stores/collection";

const store = useCollectionStore();

const summaryPct = computed(() => store.percentComplete);
</script>

<template>
    <section class="summary panel">
        <div class="summary__head">
            <h1 class="summary__title">{{ $t("checklist") }}</h1>
            <p class="summary__sub">
                {{ ALBUM_META.title }} · {{ $t("n-teams", { n: ALBUM_META.teamCount }) }} ·
                {{ $t("mark-off-every-sticker-as-you-collect-it") }}
            </p>
        </div>

        <div
            class="summary__bar"
            :title="$t('n-percent-complete', { n: summaryPct })"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="summaryPct"
            :aria-label="$t('overall-collection-progress')"
        >
            <div class="summary__fill" :style="{ width: `${summaryPct}%` }" />
        </div>

        <div class="stats">
            <div class="stat stat--hero">
                <span class="stat__num num">{{ summaryPct }}<span class="stat__pct">%</span></span>
                <span class="stat__label">{{ $t("complete") }}</span>
            </div>
            <div class="stats__rest">
                <div class="stat">
                    <span class="stat__num num"
                        >{{ store.ownedCount }}<span class="stat__den num">/{{ store.totalCount }}</span></span
                    >
                    <span class="stat__label">{{ $t("owned-label") }}</span>
                </div>
                <div class="stat">
                    <span class="stat__num stat__num--needed num">{{ store.missingCount }}</span>
                    <span class="stat__label">{{ $t("still-needed") }}</span>
                </div>
                <div class="stat">
                    <span class="stat__num stat__num--swap num">{{ store.duplicateCount }}</span>
                    <span class="stat__label">{{ $t("spares-swaps") }}</span>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.summary {
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
    padding: 18px 20px;
}
.summary__title {
    font-family: var(--font-display);
    font-size: 1.6rem;
    letter-spacing: -0.01em;
    line-height: 1.1;
}
.summary__sub {
    margin: 2px 0 0;
    color: var(--wc-muted);
    font-size: 0.86rem;
}
.summary__bar {
    height: 12px;
    border-radius: var(--radius-pill);
    background: var(--wc-panel-2);
    border: 1px solid var(--wc-line);
    overflow: hidden;
}
.summary__fill {
    height: 100%;
    border-radius: var(--radius-pill);
    background: var(--accent);
    transition: width 0.4s var(--ease);
}
.stats {
    display: grid;
    grid-template-columns: minmax(150px, 0.9fr) 1.6fr;
    gap: 12px;
    align-items: stretch;
}
.stats__rest {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
}
.stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px;
    background: var(--wc-panel-2);
    border: 1px solid var(--wc-line);
    border-radius: var(--radius-sm);
}
.stat--hero {
    justify-content: center;
    gap: 0;
    padding: 14px 18px;
    background: radial-gradient(120% 120% at 0% 0%, rgba(216, 178, 74, 0.14), transparent 60%), var(--wc-panel-2);
    border-color: rgba(216, 178, 74, 0.32);
}
.stat__num {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.45rem;
    line-height: 1.1;
    letter-spacing: -0.01em;
}
.stat--hero .stat__num {
    font-size: 2.8rem;
    color: var(--wc-gold-lt);
}
.stat--hero .stat__pct {
    font-size: 1.4rem;
    margin-left: 1px;
    color: var(--wc-gold);
}
.stat--hero .stat__label {
    font-size: 0.78rem;
}
.stat__den {
    color: var(--wc-muted);
    font-size: 1rem;
    font-weight: 600;
}
.stat__num--needed {
    color: var(--needed);
}
.stat__num--swap {
    color: var(--swap);
}
.stat__label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--wc-muted);
}

@media (max-width: 820px) {
    .stats {
        grid-template-columns: 1fr;
    }
}
</style>
