<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Trophy, Check } from "lucide-vue-next";
import { SECTIONS, GROUPS, INTRO_SECTION, type TeamSection, type IntroSection } from "@/data/album";
import { useCollectionStore } from "@/stores/collection";

defineProps<{ activeId: string }>();
const emit = defineEmits<{ (e: "select", id: string): void }>();

const store = useCollectionStore();
const { t } = useI18n();

interface RailTeam {
    team: TeamSection;
    owned: number;
    total: number;
    complete: boolean;
}
interface RailGroup {
    letter: string;
    teams: RailTeam[];
}

const teamById = computed<Record<string, TeamSection>>(() =>
    Object.fromEntries(SECTIONS.filter((s): s is TeamSection => s.kind === "TEAM").map((s) => [s.id, s]))
);

const railGroups = computed<RailGroup[]>(() =>
    Object.entries(GROUPS).map(([letter, tuples]) => ({
        letter,
        teams: tuples
            .map(([, code]) => teamById.value[code])
            .filter((t): t is TeamSection => Boolean(t))
            .map((team) => {
                const p = store.teamProgress(team);
                return { team, owned: p.owned, total: p.total, complete: p.complete };
            }),
    }))
);

// Special (non-team) sections shown after the team groups, e.g. extra/sponsor
// stickers. The intro section keeps its own pinned button at the top.
const extraSections = computed<IntroSection[]>(() =>
    SECTIONS.filter((s): s is IntroSection => s.kind === "INTRO" && s.id !== INTRO_SECTION.id)
);

const flatSections = computed(() =>
    SECTIONS.map((s) => ({
        id: s.id,
        label:
            s.kind === "TEAM"
                ? `${s.flag}  ${t("group-letter", { letter: s.group })} · ${s.name}`
                : `${s.flag}  ${s.title}`,
    }))
);

function onSelectChange(e: Event) {
    emit("select", (e.target as HTMLSelectElement).value);
}
</script>

<template>
    <aside class="rail" :aria-label="$t('album-sections')">
        <div class="rail__mobile">
            <label class="rail__mobile-label" for="section-select">{{ $t("jump-to-section") }}</label>
            <select id="section-select" class="rail__select" :value="activeId" @change="onSelectChange">
                <option v-for="opt in flatSections" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
            </select>
        </div>

        <nav class="rail__list">
            <button
                class="rail__intro"
                :class="{ 'is-active': activeId === INTRO_SECTION.id }"
                type="button"
                @click="emit('select', INTRO_SECTION.id)"
            >
                <span class="rail__intro-icon" aria-hidden="true"><trophy :size="18" /></span>
                <span class="rail__name">{{ $t("introduction-fifa-museum") }}</span>
            </button>

            <div v-for="g in railGroups" :key="g.letter" class="rail__group">
                <div class="rail__group-head">{{ $t("group-letter", { letter: g.letter }) }}</div>
                <button
                    v-for="rt in g.teams"
                    :key="rt.team.id"
                    class="rail__team"
                    :class="{ 'is-active': activeId === rt.team.id, 'is-done': rt.complete }"
                    type="button"
                    :style="{ '--team-color': rt.team.color, '--team-accent': rt.team.accent }"
                    @click="emit('select', rt.team.id)"
                >
                    <span class="rail__swatch" aria-hidden="true" />
                    <span class="rail__flag">{{ rt.team.flag }}</span>
                    <span class="rail__name">{{ rt.team.name }}</span>
                    <span class="rail__prog">
                        <span
                            v-if="rt.complete"
                            class="rail__check"
                            :title="$t('complete')"
                            :aria-label="$t('complete')"
                            ><check :size="15"
                        /></span>
                        <span v-else class="rail__count num">{{ rt.owned }}/{{ rt.total }}</span>
                    </span>
                    <span class="rail__bar" aria-hidden="true">
                        <span
                            class="rail__bar-fill"
                            :style="{ width: `${rt.total ? (rt.owned / rt.total) * 100 : 0}%` }"
                        />
                    </span>
                </button>
            </div>

            <button
                v-for="sp in extraSections"
                :key="sp.id"
                class="rail__intro rail__intro--extra"
                :class="{ 'is-active': activeId === sp.id }"
                type="button"
                @click="emit('select', sp.id)"
            >
                <span class="rail__intro-icon" aria-hidden="true">{{ sp.flag }}</span>
                <span class="rail__name">{{ sp.title }}</span>
            </button>
        </nav>
    </aside>
</template>

<style scoped>
.rail {
    position: sticky;
    top: 80px;
    max-height: calc(100dvh - 104px);
    overflow-y: auto;
    padding-right: 6px;
    scrollbar-width: thin;
}
.rail__mobile {
    display: none;
}

.rail__list {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.rail__intro,
.rail__team {
    width: 100%;
    text-align: left;
    border: 1px solid var(--wc-line);
    background: transparent;
    color: var(--wc-text);
    border-radius: var(--radius-sm);
    display: grid;
    align-items: center;
    gap: 0 8px;
    transition:
        background var(--ease),
        border-color var(--ease),
        transform var(--ease);
}
.rail__intro:active,
.rail__team:active {
    transform: translateY(1px);
}

.rail__intro {
    grid-template-columns: auto 1fr;
    padding: 11px 12px;
    margin-bottom: 6px;
    background: var(--wc-panel);
    border-color: var(--wc-line-strong);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 0.98rem;
    letter-spacing: -0.01em;
}
.rail__intro:hover {
    background: var(--wc-panel-2);
}
.rail__intro--extra {
    margin-top: 12px;
}
.rail__intro.is-active {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent) inset;
}
.rail__intro-icon {
    display: inline-flex;
    align-items: center;
    color: var(--accent);
}
.rail__group {
    margin-top: 10px;
}
.rail__group-head {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--wc-muted);
    padding: 4px 12px;
    border-bottom: 1px solid var(--wc-line);
    margin-bottom: 4px;
}

.rail__team {
    grid-template-columns: 4px auto 1fr auto;
    grid-template-rows: auto auto;
    padding: 8px 10px 8px 8px;
    min-height: 44px;
    position: relative;
}
.rail__team:hover {
    background: var(--wc-panel);
}
.rail__team.is-active {
    background: var(--wc-panel-2);
    border-color: var(--team-color, var(--wc-line));
    box-shadow: -3px 0 0 0 var(--team-accent, var(--wc-gold)) inset;
}
.rail__swatch {
    grid-row: 1 / span 2;
    width: 4px;
    height: 100%;
    min-height: 22px;
    border-radius: 4px;
    background: linear-gradient(var(--team-color), var(--team-accent));
}
.rail__flag {
    font-size: 1.15rem;
    line-height: 1;
}
.rail__intro .rail__flag {
    font-size: 1.3rem;
}
.rail__name {
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.2;
    overflow-wrap: break-word;
    min-width: 0;
}
.rail__prog {
    justify-self: end;
    font-size: 0.74rem;
    font-weight: 700;
}
.rail__count {
    color: var(--wc-muted);
}
.rail__check {
    display: inline-flex;
    align-items: center;
    color: var(--ok);
}
.rail__team.is-done .rail__name {
    color: var(--wc-gold-lt);
}
.rail__bar {
    grid-column: 2 / 5;
    grid-row: 2;
    height: 3px;
    margin-top: 4px;
    border-radius: var(--radius-pill);
    background: var(--wc-line);
    overflow: hidden;
}
.rail__bar-fill {
    display: block;
    height: 100%;
    border-radius: var(--radius-pill);
    background: var(--accent);
    transition: width 0.35s var(--ease);
}

@media (max-width: 860px) {
    .rail {
        position: static;
        max-height: none;
        overflow: visible;
        padding-right: 0;
    }
    .rail__list {
        display: none;
    }
    .rail__mobile {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .rail__mobile-label {
        font-family: var(--font-display);
        font-weight: 700;
        font-size: 0.78rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--wc-muted);
    }
    .rail__select {
        width: 100%;
        padding: 11px 12px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--wc-line);
        background: var(--wc-panel);
        color: var(--wc-text);
        font-family: inherit;
        font-size: 0.95rem;
        font-weight: 600;
    }
}
</style>
