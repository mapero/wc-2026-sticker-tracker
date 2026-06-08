<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Upload, X, ArrowRight, ArrowLeft } from "lucide-vue-next";
import { STICKERS, type Sticker } from "@/data/album";
import { useCollectionStore } from "@/stores/collection";
import BaseButton from "@/components/base/BaseButton.vue";
import BaseChip from "@/components/base/BaseChip.vue";

const { t } = useI18n();
const store = useCollectionStore();

const pastePlaceholder = computed(
    () => `${t("paste-their-backup-json-placeholder")} { "version": 1, "counts": { ... } }`
);

const theirText = ref("");
const theirCounts = ref<Record<string, number> | null>(null);
const message = ref("");
const messageOk = ref<boolean | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

function setMessage(ok: boolean, text: string) {
    messageOk.value = ok;
    message.value = text;
}

function load() {
    const res = store.parseCounts(theirText.value);
    if (!res.ok || !res.counts) {
        theirCounts.value = null;
        setMessage(false, res.error ?? t("could-not-read-that-collection"));
        return;
    }
    theirCounts.value = res.counts;
    setMessage(true, t("loaded-their-collection-n-stickers", { n: res.imported }));
}

async function onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
        theirText.value = await file.text();
        load();
    } catch {
        setMessage(false, t("could-not-read-that-file"));
    } finally {
        input.value = "";
    }
}

function clear() {
    theirText.value = "";
    theirCounts.value = null;
    message.value = "";
    messageOk.value = null;
}

const theirCount = (code: string): number => theirCounts.value?.[code] ?? 0;

interface Match {
    sticker: Sticker;
    spare: number;
}
interface MatchGroup {
    key: string;
    header: string;
    rows: Match[];
}

function groupBySection(matches: Match[]): MatchGroup[] {
    const groups: MatchGroup[] = [];
    const byKey = new Map<string, MatchGroup>();
    for (const m of matches) {
        const s = m.sticker;
        let bucket = byKey.get(s.section);
        if (!bucket) {
            const header = s.teamCode != null ? `${s.teamName}` : s.sectionTitle;
            bucket = { key: s.section, header, rows: [] };
            byKey.set(s.section, bucket);
            groups.push(bucket);
        }
        bucket.rows.push(m);
    }
    return groups;
}

const youGive = computed<Match[]>(() => {
    if (!theirCounts.value) return [];
    return STICKERS.filter((s) => store.count(s.code) >= 2 && theirCount(s.code) === 0).map((s) => ({
        sticker: s,
        spare: store.count(s.code) - 1,
    }));
});

const youGet = computed<Match[]>(() => {
    if (!theirCounts.value) return [];
    return STICKERS.filter((s) => theirCount(s.code) >= 2 && store.count(s.code) === 0).map((s) => ({
        sticker: s,
        spare: theirCount(s.code) - 1,
    }));
});

const giveGroups = computed(() => groupBySection(youGive.value));
const getGroups = computed(() => groupBySection(youGet.value));
const hasMatches = computed(() => youGive.value.length > 0 || youGet.value.length > 0);
</script>

<template>
    <div class="swap container">
        <header class="swap__head">
            <h1 class="swap__title">{{ $t("trade") }}</h1>
            <p class="swap__sub">
                {{ $t("trade-intro") }}
            </p>
        </header>

        <section class="panel import">
            <div class="import__row">
                <textarea
                    v-model="theirText"
                    class="import__text"
                    spellcheck="false"
                    :placeholder="pastePlaceholder"
                ></textarea>
            </div>
            <div class="import__actions">
                <base-button variant="primary" :disabled="!theirText.trim()" @click="load">{{
                    $t("compare-collections")
                }}</base-button>
                <button type="button" class="btn" @click="fileInput?.click()">
                    <upload :size="16" /> {{ $t("load-json") }}
                </button>
                <input ref="fileInput" type="file" accept="application/json,.json" class="sr-only" @change="onFile" />
                <base-button v-if="theirCounts" variant="danger" @click="clear"
                    ><x :size="16" /> {{ $t("clear") }}</base-button
                >
                <span
                    class="import__msg"
                    role="status"
                    aria-live="polite"
                    :class="messageOk === null ? '' : messageOk ? 'is-ok' : 'is-err'"
                    >{{ message }}</span
                >
            </div>
        </section>

        <div v-if="!theirCounts" class="empty">
            <span class="empty__pocket" aria-hidden="true">?</span>
            <p class="empty__text">{{ $t("no-collection-loaded-yet") }}</p>
        </div>

        <div v-else-if="!hasMatches" class="empty">
            <span class="empty__pocket" aria-hidden="true">=</span>
            <p class="empty__text">{{ $t("no-swaps-found") }}</p>
        </div>

        <section v-else class="results">
            <div class="panel col">
                <header class="col__head col__head--give">
                    <span class="col__title"><arrow-right :size="16" /> {{ $t("you-can-give") }}</span>
                    <base-chip variant="swap" class="num">{{ youGive.length }}</base-chip>
                </header>
                <p v-if="!youGive.length" class="col__empty">{{ $t("nothing-of-theirs-to-fill") }}</p>
                <div v-for="g in giveGroups" :key="g.key" class="grp">
                    <div class="grp__head">{{ g.header }}</div>
                    <ul class="grp__list">
                        <li v-for="m in g.rows" :key="m.sticker.code" class="match">
                            <span class="match__code num">{{ m.sticker.code }}</span>
                            <span class="match__name">{{ m.sticker.label }}</span>
                            <span v-if="m.spare > 1" class="match__spare num">×{{ m.spare }}</span>
                        </li>
                    </ul>
                </div>
            </div>

            <div class="panel col">
                <header class="col__head col__head--get">
                    <span class="col__title"><arrow-left :size="16" /> {{ $t("they-can-give") }}</span>
                    <base-chip variant="done" class="num">{{ youGet.length }}</base-chip>
                </header>
                <p v-if="!youGet.length" class="col__empty">{{ $t("they-have-no-spare-you-need") }}</p>
                <div v-for="g in getGroups" :key="g.key" class="grp">
                    <div class="grp__head">{{ g.header }}</div>
                    <ul class="grp__list">
                        <li v-for="m in g.rows" :key="m.sticker.code" class="match">
                            <span class="match__code num">{{ m.sticker.code }}</span>
                            <span class="match__name">{{ m.sticker.label }}</span>
                            <span v-if="m.spare > 1" class="match__spare num">×{{ m.spare }}</span>
                        </li>
                    </ul>
                </div>
            </div>
        </section>
    </div>
</template>

<style scoped>
.swap {
    display: flex;
    flex-direction: column;
    gap: 18px;
}
.swap__title {
    font-size: 1.6rem;
}
.swap__sub {
    margin: 6px 0 0;
    max-width: 64ch;
    color: var(--wc-muted);
    line-height: 1.5;
}

.import {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 820px;
}
.import__text {
    width: 100%;
    min-height: 90px;
    resize: vertical;
    background: var(--n-900);
    border: 1px solid var(--wc-line-strong);
    border-radius: var(--radius-sm);
    color: var(--wc-text);
    font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
    font-size: 0.82rem;
    padding: 10px 12px;
}
.import__text:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent) inset;
}
.import__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
}
.import__msg {
    font-size: 0.84rem;
    font-weight: 600;
}
.import__msg.is-ok {
    color: var(--success);
}
.import__msg.is-err {
    color: var(--danger);
}

.empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    color: var(--wc-muted);
    text-align: center;
    padding: 40px 0;
}
.empty__text {
    margin: 0;
    max-width: 42ch;
}
.empty__pocket {
    display: grid;
    place-items: center;
    width: 58px;
    height: 81px;
    border: 1px dashed var(--wc-line-strong);
    border-radius: 9px;
    background: rgba(0, 0, 0, 0.2);
    box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.45);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.9rem;
    color: rgba(255, 255, 255, 0.3);
}

.results {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    align-items: start;
}
.col {
    padding: 14px 16px;
}
.col__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding-bottom: 10px;
    margin-bottom: 10px;
    border-bottom: 1px solid var(--wc-line);
}
.col__title {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.02rem;
}
.col__head--give .col__title {
    color: var(--swap);
}
.col__head--get .col__title {
    color: var(--success);
}
.col__empty {
    color: var(--wc-muted);
    font-size: 0.88rem;
}

.grp {
    margin-bottom: 12px;
}
.grp__head {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 0.74rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--wc-muted);
    margin-bottom: 5px;
}
.grp__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.match {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 5px 8px;
    border: 1px solid var(--wc-line);
    border-radius: var(--radius-sm);
    background: var(--wc-ink);
    transition:
        background var(--ease),
        border-color var(--ease);
}
.match:hover {
    background: var(--wc-panel-2);
    border-color: var(--wc-line-strong);
}
.match__code {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 0.78rem;
    flex: none;
    min-width: 48px;
}
.match__name {
    font-size: 0.82rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
}
.match__spare {
    flex: none;
    font-size: 0.74rem;
    font-weight: 700;
    color: var(--swap);
}

@media (max-width: 760px) {
    .results {
        grid-template-columns: 1fr;
    }
}
</style>
