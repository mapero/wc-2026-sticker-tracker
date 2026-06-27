<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Search as SearchIcon, LayoutGrid, CircleDashed, Copy, CheckCheck, Trash2 } from "lucide-vue-next";
import { STICKERS, SECTIONS, TEAMS, type Sticker } from "@/data/album";
import { useCollectionStore } from "@/stores/collection";
import ChecklistSummary from "@/components/checklist/ChecklistSummary.vue";
import ChecklistSticker from "@/components/checklist/ChecklistSticker.vue";

const { t } = useI18n();
const store = useCollectionStore();

type Mode = "all" | "needed" | "duplicates";

const mode = ref<Mode>("all");
const search = ref("");
const groupFilter = ref("all");

interface SectionMeta {
    name: string;
    flag: string;
    group: string | null;
    codes: string[];
}
const sectionMeta = new Map<string, SectionMeta>(
    SECTIONS.map((s) => [
        s.id,
        { name: s.name, flag: s.flag, group: s.kind === "TEAM" ? s.group : null, codes: s.stickerCodes },
    ])
);

const groupLetters = computed<string[]>(() => {
    const seen: string[] = [];
    for (const team of TEAMS) if (!seen.includes(team.group)) seen.push(team.group);
    return seen;
});

// Stickers matching search + group (but not the All/Needed/Duplicates mode), so
// the segmented control can show live counts for each mode.
const base = computed<Sticker[]>(() => {
    const q = search.value.trim().toLowerCase();
    const g = groupFilter.value;
    return STICKERS.filter((s) => {
        const meta = sectionMeta.get(s.section);
        if (g !== "all" && (!meta || meta.group !== g)) return false;
        if (q) {
            const hit =
                s.code.toLowerCase().includes(q) ||
                s.label.toLowerCase().includes(q) ||
                (meta?.name.toLowerCase().includes(q) ?? false);
            if (!hit) return false;
        }
        return true;
    });
});

const counts = computed(() => {
    let needed = 0;
    let duplicates = 0;
    for (const s of base.value) {
        const n = store.count(s.code);
        if (n === 0) needed += 1;
        else if (n > 1) duplicates += 1;
    }
    return { all: base.value.length, needed, duplicates };
});

const filtered = computed<Sticker[]>(() =>
    base.value.filter((s) => {
        const n = store.count(s.code);
        if (mode.value === "needed") return n === 0;
        if (mode.value === "duplicates") return n > 1;
        return true;
    })
);

interface Group {
    id: string;
    name: string;
    flag: string;
    tag: string | null;
    codes: string[];
    owned: number;
    total: number;
    stickers: Sticker[];
}
const grouped = computed<Group[]>(() => {
    const map = new Map<string, Group>();
    const list: Group[] = [];
    for (const s of filtered.value) {
        let g = map.get(s.section);
        if (!g) {
            const meta = sectionMeta.get(s.section);
            const codes = meta?.codes ?? [];
            g = {
                id: s.section,
                name: meta?.name ?? s.sectionTitle,
                flag: meta?.flag ?? "",
                tag: meta?.group ?? null,
                codes,
                owned: codes.filter((c) => store.has(c)).length,
                total: codes.length,
                stickers: [],
            };
            map.set(s.section, g);
            list.push(g);
        }
        g.stickers.push(s);
    }
    return list;
});

function markAll(g: Group) {
    store.fillSection(g.codes);
}
function clearAll(g: Group) {
    if (g.owned === 0) return;
    if (window.confirm(t("clear-all-n-stickers-for-name", { n: g.total, name: g.name }))) {
        store.clearSection(g.codes);
    }
}
</script>

<template>
    <div class="checklist">
        <checklist-summary />

        <section class="controls panel">
            <div class="seg" role="group" :aria-label="$t('filter')">
                <button class="seg__btn" :class="{ 'is-active': mode === 'all' }" type="button" @click="mode = 'all'">
                    <layout-grid :size="15" aria-hidden="true" />
                    <span class="seg__text">{{ $t("all") }}</span>
                    <span class="seg__count num">{{ counts.all }}</span>
                </button>
                <button
                    class="seg__btn seg__btn--need"
                    :class="{ 'is-active': mode === 'needed' }"
                    type="button"
                    @click="mode = 'needed'"
                >
                    <circle-dashed :size="15" aria-hidden="true" />
                    <span class="seg__text">{{ $t("needed") }}</span>
                    <span class="seg__count num">{{ counts.needed }}</span>
                </button>
                <button
                    class="seg__btn seg__btn--swap"
                    :class="{ 'is-active': mode === 'duplicates' }"
                    type="button"
                    @click="mode = 'duplicates'"
                >
                    <copy :size="15" aria-hidden="true" />
                    <span class="seg__text">{{ $t("duplicates") }}</span>
                    <span class="seg__count num">{{ counts.duplicates }}</span>
                </button>
            </div>

            <div class="filters">
                <div class="control control--search">
                    <label class="sr-only" for="cl-search">{{ $t("search-teams-or-sticker-code") }}</label>
                    <span class="control__icon" aria-hidden="true"><search-icon :size="16" /></span>
                    <input
                        id="cl-search"
                        v-model="search"
                        class="control__input"
                        type="search"
                        :placeholder="$t('search-team-or-code-e-g-brazil-bra7')"
                        autocomplete="off"
                    />
                </div>

                <div class="control">
                    <label class="sr-only" for="cl-group">{{ $t("group") }}</label>
                    <select id="cl-group" v-model="groupFilter" class="control__select">
                        <option value="all">{{ $t("all-groups") }}</option>
                        <option v-for="g in groupLetters" :key="g" :value="g">{{ $t("group-g", { g }) }}</option>
                    </select>
                </div>
            </div>
        </section>

        <section class="list">
            <p v-if="grouped.length === 0" class="empty panel">{{ $t("no-stickers-match-your-filters") }}</p>

            <article v-for="g in grouped" :key="g.id" class="group panel">
                <header class="group__head">
                    <span class="group__flag" aria-hidden="true">{{ g.flag }}</span>
                    <h2 class="group__name">{{ g.name }}</h2>
                    <span v-if="g.tag" class="group__tag">{{ $t("group-g", { g: g.tag }) }}</span>
                    <span class="group__prog num">{{ g.owned }}/{{ g.total }}</span>
                    <span class="group__actions">
                        <button
                            class="iconbtn"
                            type="button"
                            :title="$t('mark-all')"
                            :aria-label="$t('mark-all')"
                            :disabled="g.owned === g.total"
                            @click="markAll(g)"
                        >
                            <check-check :size="16" aria-hidden="true" />
                        </button>
                        <button
                            class="iconbtn iconbtn--danger"
                            type="button"
                            :title="$t('clear')"
                            :aria-label="$t('clear')"
                            :disabled="g.owned === 0"
                            @click="clearAll(g)"
                        >
                            <trash2 :size="16" aria-hidden="true" />
                        </button>
                    </span>
                </header>

                <div class="group__grid">
                    <checklist-sticker v-for="st in g.stickers" :key="st.code" :sticker="st" />
                </div>
            </article>
        </section>
    </div>
</template>

<style scoped>
.checklist {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px;
}

/* Segmented All / Needed / Duplicates filter */
.seg {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    background: var(--wc-ink);
    border: 1px solid var(--wc-line);
    border-radius: var(--radius-sm);
    padding: 4px;
}
.seg__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 10px 8px;
    border: none;
    border-radius: calc(var(--radius-sm) - 2px);
    background: transparent;
    color: var(--wc-muted);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
    transition:
        background var(--ease),
        color var(--ease);
}
.seg__text {
    text-transform: capitalize;
}
.seg__btn:hover {
    color: var(--wc-text);
}
.seg__btn.is-active {
    background: var(--wc-panel-2);
    color: var(--wc-text);
    box-shadow: var(--shadow-sm);
}
.seg__btn--need.is-active {
    color: var(--warn);
}
.seg__btn--swap.is-active {
    color: var(--swap);
}
.seg__count {
    font-size: 0.78rem;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: var(--radius-pill);
    background: var(--wc-ink);
    color: var(--wc-muted);
}
.seg__btn.is-active .seg__count {
    background: var(--wc-line);
    color: var(--wc-text);
}

.filters {
    display: flex;
    gap: 10px;
}
.control--search {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
}
.control__icon {
    position: absolute;
    left: 12px;
    display: inline-flex;
    color: var(--wc-muted);
    pointer-events: none;
}
.control__input {
    width: 100%;
    padding: 11px 12px 11px 36px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--wc-line-strong);
    background: var(--wc-panel-2);
    color: var(--wc-text);
    font-family: var(--font-body);
    font-size: 0.95rem;
}
.control__input:focus-visible,
.control__select:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
}
.control__select {
    padding: 11px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--wc-line-strong);
    background: var(--wc-panel-2);
    color: var(--wc-text);
    font-family: var(--font-body);
    font-size: 0.92rem;
    font-weight: 600;
}

.list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.empty {
    padding: 28px;
    text-align: center;
    color: var(--wc-muted);
}

.group {
    padding: 14px 16px;
}
.group__head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
}
.group__flag {
    font-size: 1.3rem;
    flex: none;
}
.group__name {
    flex: 1 1 auto;
    min-width: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.05rem;
    letter-spacing: -0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.group__tag {
    flex: none;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 0.7rem;
    padding: 2px 8px;
    border-radius: var(--radius-pill);
    background: var(--wc-ink);
    border: 1px solid var(--wc-line);
    color: var(--wc-muted);
}
.group__prog {
    flex: none;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--wc-muted);
}
.group__actions {
    display: flex;
    gap: 6px;
    flex: none;
}
.iconbtn {
    width: 34px;
    height: 34px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--wc-line-strong);
    background: var(--wc-panel-2);
    color: var(--wc-text);
    display: grid;
    place-items: center;
    cursor: pointer;
    transition:
        background var(--ease),
        border-color var(--ease),
        color var(--ease);
}
.iconbtn:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
}
.iconbtn--danger:hover:not(:disabled) {
    border-color: var(--danger, #e5484d);
    color: var(--danger, #e5484d);
}
.iconbtn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}
.iconbtn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
}

.group__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px;
}

@media (max-width: 560px) {
    .filters {
        flex-direction: column;
    }
    .seg__btn {
        flex-direction: column;
        gap: 3px;
        padding: 9px 4px;
        font-size: 0.82rem;
    }
    .group__grid {
        grid-template-columns: 1fr;
    }
}
</style>
