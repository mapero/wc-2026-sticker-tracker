<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { CornerDownLeft, Check, Copy, TriangleAlert, Undo, Trash } from "lucide-vue-next";
import BaseButton from "@/components/base/BaseButton.vue";
import { STICKER_BY_CODE, type Sticker } from "@/data/album";
import { useCollectionStore } from "@/stores/collection";

type EntryStatus = "new" | "dupe" | "unknown";

interface Entry {
    id: number;
    raw: string;
    code: string;
    status: EntryStatus;
    label?: string;
    where?: string;
    count?: number;
}

const store = useCollectionStore();

const input = ref("");
const entries = ref<Entry[]>([]);
const inputEl = ref<HTMLInputElement | null>(null);
let nextId = 1;

function normalize(raw: string): string {
    return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function whereOf(s: Sticker): string {
    return s.teamName ?? s.sectionTitle;
}

function addOne(raw: string) {
    const code = normalize(raw);
    if (!code) return;
    const sticker = STICKER_BY_CODE[code];
    if (!sticker) {
        entries.value.unshift({ id: nextId++, raw: raw.trim(), code, status: "unknown" });
        return;
    }
    const had = store.has(code);
    store.increment(code);
    entries.value.unshift({
        id: nextId++,
        raw: raw.trim(),
        code,
        status: had ? "dupe" : "new",
        label: sticker.label,
        where: whereOf(sticker),
        count: store.count(code),
    });
}

function submit() {
    const text = input.value.trim();
    if (text) {
        const tokens = text.toUpperCase().match(/[A-Z]+\s*\d+|\d+/g);
        if (tokens) {
            for (const t of tokens) addOne(t);
        } else {
            addOne(text);
        }
    }
    input.value = "";
    void nextTick(() => inputEl.value?.focus());
}

function undoLast() {
    const last = entries.value[0];
    if (!last) return;
    if (last.status !== "unknown") {
        store.setCount(last.code, Math.max(0, store.count(last.code) - 1));
    }
    entries.value.shift();
    inputEl.value?.focus();
}

function clearLog() {
    entries.value = [];
    inputEl.value?.focus();
}

const added = computed(() => entries.value.filter((e) => e.status === "new").length);
const dupes = computed(() => entries.value.filter((e) => e.status === "dupe").length);
const errors = computed(() => entries.value.filter((e) => e.status === "unknown").length);

onMounted(() => inputEl.value?.focus());
</script>

<template>
    <div class="quick">
        <header class="quick__head">
            <h1 class="quick__title">{{ $t("log-your-finds") }}</h1>
            <p class="quick__lede">
                {{ $t("type-the-code-from-the-back-of-each-sticker-and-press") }} <kbd>{{ $t("enter") }}</kbd
                >{{ $t("got-a-pile-paste-or-scan-them-all-at-once-separated-by-spaces-commas-or-new-lines") }}
            </p>
        </header>

        <form class="entry panel" @submit.prevent="submit">
            <input
                ref="inputEl"
                v-model="input"
                class="entry__input num"
                type="text"
                inputmode="text"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
                :placeholder="$t('e-g-arg5')"
                :aria-label="$t('sticker-code')"
            />
            <base-button type="submit" variant="primary"><corner-down-left :size="16" /> {{ $t("add") }}</base-button>
        </form>

        <div class="tally">
            <template v-if="entries.length">
                <span class="tally__item tally__item--new"><check :size="15" /> {{ $t("n-new", { n: added }) }}</span>
                <span class="tally__item tally__item--dupe"
                    ><copy :size="15" /> {{ $t("n-spares", { n: dupes }) }}</span
                >
                <span class="tally__item tally__item--err"
                    ><triangle-alert :size="15" /> {{ $t("n-unknown", { n: errors }) }}</span
                >
            </template>
            <span class="tally__spacer" />
            <base-button size="sm" :disabled="!entries.length" @click="undoLast"
                ><undo :size="14" /> {{ $t("undo") }}</base-button
            >
            <base-button size="sm" variant="danger" :disabled="!entries.length" @click="clearLog">
                <trash :size="14" /> {{ $t("clear-log") }}
            </base-button>
        </div>

        <ul v-if="entries.length" class="log">
            <li v-for="e in entries" :key="e.id" class="row" :class="`row--${e.status}`">
                <span class="row__icon" aria-hidden="true">
                    <check v-if="e.status === 'new'" :size="16" />
                    <copy v-else-if="e.status === 'dupe'" :size="16" />
                    <triangle-alert v-else :size="16" />
                </span>
                <span class="row__code num">{{ e.code }}</span>
                <span class="row__body">
                    <template v-if="e.status === 'unknown'">
                        <span class="row__label">{{ $t("not-in-this-album") }}</span>
                        <span class="row__where">{{ $t("nothing-logged") }}</span>
                    </template>
                    <template v-else>
                        <span class="row__label">{{ e.label }}</span>
                        <span class="row__where">{{ e.where }}</span>
                    </template>
                </span>
                <span class="row__tag">
                    <span v-if="e.status === 'new'" class="tag tag--new">{{ $t("new") }}</span>
                    <span v-else-if="e.status === 'dupe'" class="tag tag--dupe"
                        >{{ $t("spare") }} · ×{{ e.count }}</span
                    >
                    <span v-else class="tag tag--err">{{ $t("unknown") }}</span>
                </span>
            </li>
        </ul>
        <div v-else class="empty">
            <span class="empty__pocket" aria-hidden="true">?</span>
            <p class="empty__text">{{ $t("nothing-logged-yet-type-a-code-above-to-start-filling-the-album") }}</p>
        </div>
    </div>
</template>

<style scoped>
.quick {
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-width: 720px;
    margin: 0 auto;
}

.quick__title {
    font-family: var(--font-display);
    font-size: 1.6rem;
    letter-spacing: -0.01em;
}
.quick__lede {
    margin: 6px 0 0;
    color: var(--wc-muted);
    font-size: 0.92rem;
    line-height: 1.5;
}
.quick__lede kbd {
    font-family: var(--font-display);
    font-size: 0.78rem;
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    background: var(--n-800);
    border: 1px solid var(--wc-line-strong);
    color: var(--wc-text);
}

.entry {
    display: flex;
    gap: 10px;
    padding: 12px;
    align-items: stretch;
}
.entry__input {
    flex: 1;
    min-width: 0;
    background: var(--n-900);
    border: 1px solid var(--wc-line-strong);
    border-radius: var(--radius-sm);
    color: var(--wc-text);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.5rem;
    letter-spacing: 0.04em;
    padding: 10px 16px;
    text-transform: uppercase;
}
.entry__input::placeholder {
    color: var(--wc-muted);
    text-transform: none;
    font-weight: 600;
    letter-spacing: 0;
}
.entry__input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent) inset;
}
.entry .btn {
    align-self: stretch;
    padding-left: 18px;
    padding-right: 18px;
}

.tally {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
}
.tally__item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.86rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}
.tally__item--new {
    color: var(--ok);
}
.tally__item--dupe {
    color: var(--swap);
}
.tally__item--err {
    color: var(--danger);
}
.tally__spacer {
    flex: 1;
}

.log {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.row {
    display: grid;
    grid-template-columns: auto auto 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border: 1px solid var(--wc-line);
    border-left-width: 3px;
    border-radius: var(--radius-sm);
    background: var(--wc-panel);
}
.row--new {
    border-left-color: var(--ok);
}
.row--dupe {
    border-left-color: var(--swap);
}
.row--unknown {
    border-left-color: var(--danger);
    background: rgba(224, 83, 61, 0.07);
}
.row__icon {
    display: inline-flex;
}
.row--new .row__icon {
    color: var(--ok);
}
.row--dupe .row__icon {
    color: var(--swap);
}
.row--unknown .row__icon {
    color: var(--danger);
}
.row__code {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 0.95rem;
    letter-spacing: 0.02em;
    min-width: 56px;
}
.row__body {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    min-width: 0;
}
.row__label {
    font-weight: 700;
    font-size: 0.92rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.row--unknown .row__label {
    color: var(--danger);
}
.row__where {
    font-size: 0.74rem;
    color: var(--wc-muted);
}
.row__tag {
    justify-self: end;
}
.tag {
    display: inline-block;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: var(--radius-pill);
    white-space: nowrap;
}
.tag--new {
    background: rgba(62, 207, 127, 0.16);
    color: var(--ok);
}
.tag--dupe {
    background: rgba(224, 165, 40, 0.16);
    color: var(--swap);
}
.tag--err {
    background: rgba(224, 83, 61, 0.16);
    color: var(--danger);
}

.empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    color: var(--wc-muted);
    font-size: 0.9rem;
    text-align: center;
    padding: 36px 0;
}
.empty__text {
    margin: 0;
    max-width: 36ch;
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

@media (max-width: 560px) {
    .row {
        grid-template-columns: auto auto 1fr;
        row-gap: 4px;
    }
    .row__tag {
        grid-column: 3;
        justify-self: start;
    }
}
</style>
