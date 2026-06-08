<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { ChevronRight, Check, Star, Minus, Plus, CheckCheck, Trash2, ExternalLink } from "lucide-vue-next";
import { stickersForSection, type Sticker } from "@/data/album";
import { useCollectionStore } from "@/stores/collection";
import BaseButton from "@/components/base/BaseButton.vue";
import BaseChip from "@/components/base/BaseChip.vue";
import type { SectionRow } from "./types";

const props = defineProps<{
    row: SectionRow;
    expanded: boolean;
    matchedCode: string | null;
}>();

const emit = defineEmits<{
    (e: "toggle"): void;
    (e: "mark-all"): void;
    (e: "clear-all"): void;
}>();

const store = useCollectionStore();

const stickerCache = new Map<string, Sticker[]>();
function stickers(id: string): Sticker[] {
    let s = stickerCache.get(id);
    if (!s) {
        s = stickersForSection(id);
        stickerCache.set(id, s);
    }
    return s;
}

const cellStickers = computed<Sticker[]>(() => stickers(props.row.section.id));

function isMatchedCode(code: string): boolean {
    return props.matchedCode === code;
}
</script>

<template>
    <article class="row panel" :class="{ 'row--complete': row.complete, 'row--open': expanded }">
        <div class="row__main">
            <button
                class="row__expander"
                type="button"
                :aria-expanded="expanded"
                :aria-controls="`panel-${row.section.id}`"
                @click="emit('toggle')"
            >
                <span class="row__chevron" :class="{ 'row__chevron--open': expanded }" aria-hidden="true"
                    ><chevron-right :size="16"
                /></span>
                <span class="row__flag" aria-hidden="true">{{ row.section.flag }}</span>
                <span class="row__name">{{ row.section.name }}</span>
                <base-chip class="row__group" :class="{ 'row__group--intro': !row.group }">{{ row.tag }}</base-chip>
            </button>

            <div class="row__progress">
                <div class="row__bar" :title="$t('n-percent-complete', { n: row.pct })">
                    <div class="row__fill" :style="{ width: `${row.pct}%` }" />
                </div>
                <span class="row__pct"
                    ><span class="num">{{ row.owned }}/{{ row.total }}</span> ·
                    <span class="num">{{ row.pct }}%</span></span
                >
            </div>

            <div class="row__status">
                <span v-if="row.complete" class="badge badge--ok"
                    ><check :size="13" aria-hidden="true" /> {{ $t("complete") }}</span
                >
                <span v-else class="badge badge--need num">{{ $t("n-needed", { n: row.missing }) }}</span>
                <span
                    v-if="row.spares > 0"
                    class="badge badge--swap num"
                    :title="$t('n-spares-to-swap', { n: row.spares })"
                    >+{{ row.spares }} {{ $t("spare-plural", row.spares) }}</span
                >
            </div>

            <div class="row__actions">
                <base-button variant="primary" size="sm" :disabled="row.complete" @click="emit('mark-all')">
                    <check-check :size="14" aria-hidden="true" /> {{ $t("mark-all") }}
                </base-button>
                <base-button variant="danger" size="sm" :disabled="row.owned === 0" @click="emit('clear-all')">
                    <trash2 :size="14" aria-hidden="true" /> {{ $t("clear") }}
                </base-button>
                <router-link class="btn btn--sm" :to="`/album/${row.section.id}`">
                    <external-link :size="14" aria-hidden="true" /> {{ $t("open-in-album") }}
                </router-link>
            </div>
        </div>

        <div v-if="expanded" :id="`panel-${row.section.id}`" class="row__panel">
            <ul class="grid">
                <li
                    v-for="st in cellStickers"
                    :key="st.code"
                    class="cell"
                    :class="{
                        'cell--owned': store.has(st.code),
                        'cell--match': isMatchedCode(st.code),
                    }"
                >
                    <label class="cell__main">
                        <input
                            class="cell__check"
                            type="checkbox"
                            :checked="store.has(st.code)"
                            :aria-label="`${st.code} ${st.label}, ${store.has(st.code) ? $t('owned') : $t('needed')}`"
                            @change="store.toggle(st.code)"
                        />
                        <span class="cell__code num">
                            {{ st.code }}
                            <star
                                v-if="st.foil"
                                class="cell__foil"
                                :size="11"
                                :title="$t('foil-sticker')"
                                aria-hidden="true"
                            />
                        </span>
                        <span class="cell__label">{{ st.label }}</span>
                    </label>

                    <div v-if="store.has(st.code)" class="cell__spares" @click.stop>
                        <button
                            class="spare-btn"
                            type="button"
                            :aria-label="$t('remove-a-spare-of-code', { code: st.code })"
                            :disabled="store.duplicates(st.code) < 1"
                            @click="store.decrement(st.code)"
                        >
                            <minus :size="13" aria-hidden="true" />
                        </button>
                        <span class="spare-count num" :class="{ 'spare-count--has': store.duplicates(st.code) > 0 }">
                            {{ store.duplicates(st.code) }}
                        </span>
                        <button
                            class="spare-btn"
                            type="button"
                            :aria-label="$t('add-a-spare-of-code', { code: st.code })"
                            @click="store.increment(st.code)"
                        >
                            <plus :size="13" aria-hidden="true" />
                        </button>
                    </div>
                </li>
            </ul>
        </div>
    </article>
</template>

<style scoped>
.row {
    overflow: hidden;
    border-left: 3px solid transparent;
    transition:
        border-color var(--ease),
        background var(--ease);
}
.row:hover {
    background: var(--wc-panel-2);
}
.row--complete {
    border-left-color: var(--ok);
}
.row--open {
    background: var(--wc-panel-2);
}

.row__main {
    display: grid;
    grid-template-columns: minmax(180px, 1.4fr) minmax(150px, 1fr) minmax(150px, 1fr) auto;
    align-items: center;
    gap: 14px;
    padding: 12px 16px;
}

.row__expander {
    display: flex;
    align-items: center;
    gap: 10px;
    background: none;
    border: none;
    color: var(--wc-text);
    padding: 4px 0;
    text-align: left;
    min-width: 0;
}
.row__expander:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
}
.row__chevron {
    display: inline-flex;
    color: var(--wc-muted);
    transition:
        transform var(--ease),
        color var(--ease);
}
.row__chevron--open {
    transform: rotate(90deg);
    color: var(--accent);
}
.row__flag {
    font-size: 1.3rem;
}
.row__name {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.05rem;
    letter-spacing: -0.01em;
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.row__group {
    flex: none;
}
.row__group--intro {
    background: var(--wc-ink);
}

.row__progress {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}
.row__bar {
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--wc-ink);
    border: 1px solid var(--wc-line);
    overflow: hidden;
}
.row__fill {
    height: 100%;
    border-radius: var(--radius-pill);
    background: var(--accent);
    transition: width 0.3s var(--ease);
}
.row__pct {
    font-size: 0.76rem;
    color: var(--wc-muted);
    white-space: nowrap;
}

.row__status {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: flex-end;
}
.badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.74rem;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: var(--radius-sm);
    white-space: nowrap;
}
.badge--ok {
    background: rgba(56, 178, 107, 0.16);
    color: var(--ok);
    border: 1px solid rgba(56, 178, 107, 0.4);
}
.badge--need {
    background: rgba(224, 165, 40, 0.14);
    color: var(--warn);
    border: 1px solid rgba(224, 165, 40, 0.35);
}
.badge--swap {
    background: var(--wc-ink);
    color: var(--wc-muted);
    border: 1px solid var(--wc-line);
}

.row__actions {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
}

.row__panel {
    padding: 4px 16px 16px;
    border-top: 1px solid var(--wc-line);
}
.grid {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 8px;
}
.cell {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 9px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--wc-line);
    background: var(--wc-ink);
    transition:
        background var(--ease),
        border-color var(--ease),
        opacity var(--ease);
}
.cell--owned {
    background: rgba(56, 178, 107, 0.12);
    border-color: rgba(56, 178, 107, 0.45);
}
.cell:not(.cell--owned) {
    opacity: 0.78;
}
.cell:hover {
    border-color: var(--wc-line-strong);
    opacity: 1;
}
.cell--match {
    outline: 2px solid var(--usa-blue);
    outline-offset: 1px;
}
.cell__main {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
    cursor: pointer;
    transition: transform var(--ease);
}
.cell__main:active {
    transform: translateY(1px);
}
.cell__check {
    width: 16px;
    height: 16px;
    accent-color: var(--ok);
    flex: none;
    cursor: pointer;
}
.cell__code {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 0.82rem;
    letter-spacing: 0.02em;
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 3px;
}
.cell--owned .cell__code {
    color: var(--success);
}
.cell__foil {
    color: var(--wc-gold);
    flex: none;
}
.cell__label {
    font-size: 0.76rem;
    color: var(--wc-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.cell--owned .cell__label {
    color: var(--wc-text);
}

.cell__spares {
    display: flex;
    align-items: center;
    gap: 3px;
    flex: none;
}
.spare-btn {
    width: 20px;
    height: 20px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--wc-line-strong);
    background: var(--wc-panel-2);
    color: var(--wc-text);
    line-height: 1;
    display: grid;
    place-items: center;
    transition:
        background var(--ease),
        border-color var(--ease),
        color var(--ease);
}
.spare-btn:hover {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
}
.spare-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
}
.spare-count {
    font-size: 0.74rem;
    font-weight: 700;
    min-width: 12px;
    text-align: center;
    color: var(--wc-muted);
}
.spare-count--has {
    color: var(--swap);
}

@media (max-width: 820px) {
    .row__main {
        grid-template-columns: 1fr;
        align-items: stretch;
        gap: 10px;
    }
    .row__status,
    .row__actions {
        justify-content: flex-start;
    }
}
@media (max-width: 480px) {
    .grid {
        grid-template-columns: 1fr;
    }
}
</style>
