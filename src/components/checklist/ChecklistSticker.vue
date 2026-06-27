<script setup lang="ts">
import { computed } from "vue";
import { Check, Star, Minus, Plus } from "lucide-vue-next";
import type { Sticker } from "@/data/album";
import { useCollectionStore } from "@/stores/collection";
import { useLongPress } from "@/composables/useLongPress";

const props = defineProps<{ sticker: Sticker }>();
const store = useCollectionStore();

const owned = computed(() => store.has(props.sticker.code));
const locked = computed(() => store.activeLocked);

// Same rule as the album: tap adds, removing an owned sticker needs a long press.
const press = useLongPress(
    () => {
        store.toggle(props.sticker.code);
        navigator.vibrate?.(18);
    },
    { enabled: () => owned.value && !locked.value }
);

function onClick(e: MouseEvent) {
    if (press.consumed()) return; // long press already handled the removal
    // Keyboard activation (Enter/Space) reports detail 0 — toggle directly there
    // for accessibility; pointer taps only add (removal needs the hold).
    if (!owned.value || e.detail === 0) store.toggle(props.sticker.code);
}
</script>

<template>
    <div class="cell" :class="{ 'cell--owned': owned, 'cell--arming': press.arming.value }">
        <button
            class="cell__main"
            type="button"
            role="checkbox"
            :aria-checked="owned"
            :aria-label="`${sticker.code} ${sticker.label}, ${owned ? $t('owned') : $t('needed')}${
                owned && !locked ? ` · ${$t('long-press-to-remove')}` : ''
            }`"
            @click="onClick"
            @pointerdown="press.down"
            @pointerup="press.end"
            @pointerleave="press.end"
            @pointercancel="press.end"
            @pointermove="press.move"
        >
            <span class="cell__box" :class="{ 'cell__box--on': owned }">
                <check v-if="owned" :size="13" aria-hidden="true" />
            </span>
            <span class="cell__code num"
                >{{ sticker.code
                }}<star
                    v-if="sticker.foil"
                    class="cell__foil"
                    :size="11"
                    :title="$t('foil-sticker')"
                    aria-hidden="true"
            /></span>
            <span class="cell__label">{{ sticker.label }}</span>
        </button>

        <div v-if="owned" class="cell__spares">
            <button
                class="spare-btn"
                type="button"
                :aria-label="$t('remove-a-spare-of-code', { code: sticker.code })"
                :disabled="store.duplicates(sticker.code) < 1"
                @click="store.decrement(sticker.code)"
            >
                <minus :size="15" aria-hidden="true" />
            </button>
            <span class="spare-count num" :class="{ 'spare-count--has': store.duplicates(sticker.code) > 0 }">
                {{ store.duplicates(sticker.code) }}
            </span>
            <button
                class="spare-btn"
                type="button"
                :aria-label="$t('add-a-spare-of-code', { code: sticker.code })"
                @click="store.increment(sticker.code)"
            >
                <plus :size="15" aria-hidden="true" />
            </button>
        </div>
    </div>
</template>

<style scoped>
.cell {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 46px;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--wc-line);
    background: var(--wc-ink);
    transition:
        background var(--ease),
        border-color var(--ease),
        box-shadow var(--ease);
}
.cell--owned {
    background: rgba(56, 178, 107, 0.12);
    border-color: rgba(56, 178, 107, 0.45);
}
.cell--arming {
    box-shadow: 0 0 0 2px var(--danger, #e5484d);
}

.cell__main {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    flex: 1;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}
.cell__main:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
}
.cell__box {
    width: 20px;
    height: 20px;
    flex: none;
    border-radius: 6px;
    border: 2px solid var(--wc-line-strong);
    display: grid;
    place-items: center;
    color: #08140d;
    transition:
        background var(--ease),
        border-color var(--ease),
        transform var(--ease);
}
.cell__box--on {
    background: var(--ok);
    border-color: var(--ok);
}
.cell--arming .cell__box {
    animation: cell-arm 0.5s ease forwards;
}
@keyframes cell-arm {
    to {
        transform: scale(0.78);
    }
}
@media (prefers-reduced-motion: reduce) {
    .cell--arming .cell__box {
        animation: none;
    }
}
.cell__code {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 0.84rem;
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
    font-size: 0.8rem;
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
    gap: 4px;
    flex: none;
}
.spare-btn {
    width: 30px;
    height: 30px;
    border-radius: var(--radius-pill);
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
.spare-btn:hover {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
}
.spare-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}
.spare-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
}
.spare-count {
    font-size: 0.82rem;
    font-weight: 700;
    min-width: 14px;
    text-align: center;
    color: var(--wc-muted);
}
.spare-count--has {
    color: var(--swap);
}
</style>
