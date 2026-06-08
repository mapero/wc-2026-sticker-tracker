<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Search as SearchIcon } from "lucide-vue-next";
import { TEAMS, INTRO_SECTION, type Section } from "@/data/album";
import { useCollectionStore } from "@/stores/collection";
import BaseButton from "@/components/base/BaseButton.vue";
import ChecklistSummary from "@/components/checklist/ChecklistSummary.vue";
import ChecklistRow from "@/components/checklist/ChecklistRow.vue";
import type { SectionRow } from "@/components/checklist/types";

const { t } = useI18n();
const store = useCollectionStore();

type StatusFilter = "all" | "complete" | "incomplete" | "started";
type SortMode = "album" | "most" | "least" | "az";

const search = ref("");
const groupFilter = ref("all");
const statusFilter = ref<StatusFilter>("all");
const sortMode = ref<SortMode>("album");

const expanded = reactive(new Set<string>());

const ALL_SECTIONS: Section[] = [INTRO_SECTION, ...TEAMS];

const groupLetters = computed<string[]>(() => {
    const seen: string[] = [];
    for (const t of TEAMS) if (!seen.includes(t.group)) seen.push(t.group);
    return seen;
});

const rows = computed<SectionRow[]>(() =>
    ALL_SECTIONS.map((section, albumIndex) => {
        const codes = section.stickerCodes;
        let owned = 0;
        let spares = 0;
        for (const code of codes) {
            const n = store.count(code);
            if (n > 0) owned += 1;
            if (n > 1) spares += n - 1;
        }
        const total = codes.length;
        const isTeam = section.kind === "TEAM";
        const isIntro = section.kind === "INTRO";
        return {
            section,
            isIntro,
            group: isTeam ? section.group : null,
            tag: isTeam ? section.group : t("intro"),
            owned,
            total,
            missing: total - owned,
            spares,
            complete: total > 0 && owned === total,
            pct: total === 0 ? 0 : Math.round((owned / total) * 100),
            albumIndex,
        };
    })
);

const codeMatch = computed<{ section: string; code: string } | null>(() => {
    const q = search.value.trim().toUpperCase();
    if (!q) return null;
    const m = /^([A-Z]+)(\d+)$/.exec(q);
    if (m) {
        const found = ALL_SECTIONS.find((s) => s.stickerCodes.includes(q));
        if (found) return { section: found.id, code: q };
    }
    if (/^\d+$/.test(q)) {
        const found = ALL_SECTIONS.find((s) => s.stickerCodes.includes(q));
        if (found) return { section: found.id, code: q };
    }
    return null;
});

const visibleRows = computed<SectionRow[]>(() => {
    const q = search.value.trim().toLowerCase();
    const cm = codeMatch.value;

    let list = rows.value.filter((r) => {
        if (q) {
            const nameHit = r.section.name.toLowerCase().includes(q);
            const codeHit = cm !== null && cm.section === r.section.id;
            if (!nameHit && !codeHit) return false;
        }
        if (groupFilter.value !== "all") {
            if (r.isIntro || r.group !== groupFilter.value) return false;
        }
        switch (statusFilter.value) {
            case "complete":
                if (!r.complete) return false;
                break;
            case "incomplete":
                if (r.complete) return false;
                break;
            case "started":
                if (r.owned === 0 || r.complete) return false;
                break;
        }
        return true;
    });

    list = [...list];
    switch (sortMode.value) {
        case "most":
            list.sort((a, b) => b.pct - a.pct || a.albumIndex - b.albumIndex);
            break;
        case "least":
            list.sort((a, b) => a.pct - b.pct || a.albumIndex - b.albumIndex);
            break;
        case "az":
            list.sort((a, b) => a.section.name.localeCompare(b.section.name));
            break;
        default:
            list.sort((a, b) => a.albumIndex - b.albumIndex);
    }
    return list;
});

function toggleExpand(id: string) {
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
}
function expandAll() {
    for (const r of visibleRows.value) expanded.add(r.section.id);
}
function collapseAll() {
    expanded.clear();
}

function markAll(row: SectionRow) {
    store.fillSection(row.section.stickerCodes);
}
function clearAll(row: SectionRow) {
    if (row.owned === 0) return;
    if (window.confirm(t("clear-all-n-stickers-for-name", { n: row.total, name: row.section.name }))) {
        store.clearSection(row.section.stickerCodes);
    }
}

function focusMatchedSection() {
    const cm = codeMatch.value;
    if (cm) expanded.add(cm.section);
}
</script>

<template>
    <div class="checklist">
        <checklist-summary />

        <section class="controls panel">
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
                    @keydown.enter="focusMatchedSection"
                />
            </div>

            <div class="control">
                <label class="control__label" for="cl-group">{{ $t("group") }}</label>
                <select id="cl-group" v-model="groupFilter" class="control__select">
                    <option value="all">{{ $t("all-groups") }}</option>
                    <option v-for="g in groupLetters" :key="g" :value="g">{{ $t("group-g", { g }) }}</option>
                </select>
            </div>

            <div class="control">
                <label class="control__label" for="cl-status">{{ $t("status") }}</label>
                <select id="cl-status" v-model="statusFilter" class="control__select">
                    <option value="all">{{ $t("all") }}</option>
                    <option value="complete">{{ $t("complete") }}</option>
                    <option value="incomplete">{{ $t("incomplete") }}</option>
                    <option value="started">{{ $t("started") }}</option>
                </select>
            </div>

            <div class="control">
                <label class="control__label" for="cl-sort">{{ $t("sort") }}</label>
                <select id="cl-sort" v-model="sortMode" class="control__select">
                    <option value="album">{{ $t("album-order") }}</option>
                    <option value="most">{{ $t("most-complete") }}</option>
                    <option value="least">{{ $t("least-complete") }}</option>
                    <option value="az">{{ $t("a-z") }}</option>
                </select>
            </div>

            <div class="control control--actions">
                <base-button @click="expandAll">{{ $t("expand-all") }}</base-button>
                <base-button @click="collapseAll">{{ $t("collapse-all") }}</base-button>
            </div>
        </section>

        <p class="resultcount">
            {{ $t("showing") }} <strong class="num">{{ visibleRows.length }}</strong>
            {{ $t("section-plural", visibleRows.length) }}
            <span v-if="codeMatch" class="resultcount__hint"
                >· {{ $t("matched-code") }} <code class="num">{{ codeMatch.code }}</code></span
            >
        </p>

        <section class="list">
            <p v-if="visibleRows.length === 0" class="empty panel">{{ $t("no-teams-match-your-filters") }}</p>

            <checklist-row
                v-for="row in visibleRows"
                :key="row.section.id"
                :row="row"
                :expanded="expanded.has(row.section.id)"
                :matched-code="codeMatch && codeMatch.section === row.section.id ? codeMatch.code : null"
                @toggle="toggleExpand(row.section.id)"
                @mark-all="markAll(row)"
                @clear-all="clearAll(row)"
            />
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
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 12px;
    padding: 14px 16px;
}
.control {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.control--search {
    flex: 1 1 260px;
    position: relative;
    flex-direction: row;
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
    padding: 10px 12px 10px 34px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--wc-line-strong);
    background: var(--wc-panel-2);
    color: var(--wc-text);
    font-family: var(--font-body);
    font-size: 0.92rem;
}
.control__input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
}
.control__label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--wc-muted);
}
.control__select {
    padding: 9px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--wc-line-strong);
    background: var(--wc-panel-2);
    color: var(--wc-text);
    font-family: var(--font-body);
    font-size: 0.9rem;
    font-weight: 600;
}
.control__select:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
}
.control--actions {
    flex-direction: row;
    margin-left: auto;
}

.resultcount {
    margin: -2px 0 0;
    font-size: 0.82rem;
    color: var(--wc-muted);
}
.resultcount strong {
    color: var(--wc-text);
}
.resultcount__hint code {
    color: var(--wc-text);
    font-family: var(--font-display);
}

.list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.empty {
    padding: 28px;
    text-align: center;
    color: var(--wc-muted);
}

@media (max-width: 820px) {
    .control--actions {
        margin-left: 0;
        width: 100%;
    }
}
</style>
