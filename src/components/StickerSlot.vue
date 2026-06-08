<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { StickerType, type Sticker } from "@/data/album";
import { useCollectionStore } from "@/stores/collection";

const props = withDefaults(
    defineProps<{
        sticker: Sticker;
        showDuplicates?: boolean;
        size?: "sm" | "md";
    }>(),
    { showDuplicates: false, size: "md" }
);

const emit = defineEmits<{ (e: "select", sticker: Sticker): void }>();

const { t } = useI18n();
const store = useCollectionStore();

const owned = computed(() => store.has(props.sticker.code));
const spares = computed(() => store.duplicates(props.sticker.code));

const popping = ref(false);
let popTimer: ReturnType<typeof setTimeout> | undefined;
watch(owned, (now, prev) => {
    if (now && !prev) {
        popping.value = true;
        clearTimeout(popTimer);
        popTimer = setTimeout(() => (popping.value = false), 420);
    }
});
onBeforeUnmount(() => clearTimeout(popTimer));

const toggleLabel = computed(() => {
    const s = props.sticker;
    const status = owned.value ? t("status-owned") : t("status-needed");
    return `${s.code} ${s.label}${status}`;
});

const title = computed(() => {
    const s = props.sticker;
    const parts = [`${s.code} · ${s.label}`];
    if (s.position) parts.push(s.position);
    return parts.join(" · ");
});

function onClick() {
    store.toggle(props.sticker.code);
    emit("select", props.sticker);
}
</script>

<template>
    <div
        class="slot"
        :class="[
            `slot--${size}`,
            owned ? 'slot--filled' : 'slot--empty',
            sticker.foil ? 'slot--foilable' : '',
            sticker.foil && owned ? 'foil' : '',
            sticker.type === StickerType.TeamPhoto ? 'slot--photo' : '',
            popping ? 'slot--pop' : '',
        ]"
    >
        <button
            class="slot__toggle"
            type="button"
            :aria-pressed="owned"
            :aria-label="toggleLabel"
            :title="title"
            @click="onClick"
        />

        <div class="slot__top">
            <span class="slot__code"
                ><span v-if="owned" class="slot__code-tick" aria-hidden="true">✓</span>{{ sticker.code }}</span
            >
            <span class="slot__badges">
                <span v-if="sticker.position" class="slot__pos" :class="`slot__pos--${sticker.position}`">{{
                    sticker.position
                }}</span>
                <span v-if="sticker.foil" class="slot__foilmark" :title="$t('foil-sticker')">★</span>
            </span>
        </div>

        <div class="slot__center">
            <span class="slot__glyph">{{ sticker.slot }}</span>
        </div>

        <div class="slot__foot">
            <span class="slot__name">{{ sticker.label }}</span>

            <div v-if="showDuplicates && owned" class="slot__dupes">
                <button
                    type="button"
                    class="dupe-btn"
                    :aria-label="$t('remove-a-duplicate')"
                    :disabled="spares < 1"
                    @click="store.decrement(sticker.code)"
                >
                    −
                </button>
                <span class="dupe-count" :class="{ 'dupe-count--has': spares > 0 }">{{ spares }}</span>
                <button
                    type="button"
                    class="dupe-btn"
                    :aria-label="$t('add-a-duplicate')"
                    @click="store.increment(sticker.code)"
                >
                    +
                </button>
            </div>
            <span v-else-if="spares > 0" class="slot__spare" :title="$t('n-spares-to-swap', { n: spares })"
                >×{{ spares + 1 }}</span
            >
        </div>
    </div>
</template>

<style scoped>
.slot {
    position: relative;
    min-width: 0;
    aspect-ratio: 50 / 70;
    border-radius: 9px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    text-align: center;
    padding: 7px 4px 6px;
    user-select: none;
    transition:
        transform 0.08s ease,
        box-shadow 0.15s ease,
        background 0.15s ease;
    overflow: visible;
}
.slot__toggle {
    position: absolute;
    inset: 0;
    z-index: 1;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    border-radius: inherit;
    cursor: pointer;
}
.slot__toggle:focus-visible {
    outline: 3px solid var(--usa-blue);
    outline-offset: 2px;
}
.slot:hover {
    transform: translateY(-2px);
}
.slot--filled:hover {
    box-shadow:
        0 7px 16px rgba(0, 0, 0, 0.5),
        inset 0 2px 2px rgba(255, 255, 255, 0.32),
        0 0 0 1px rgba(0, 0, 0, 0.3);
}
.slot:active {
    transform: translateY(1px);
}
.slot--pop {
    animation: slot-pop 0.4s ease;
    z-index: 2;
}
@keyframes slot-pop {
    0% {
        transform: scale(1);
    }
    35% {
        transform: scale(1.13);
    }
    100% {
        transform: scale(1);
    }
}
@media (prefers-reduced-motion: reduce) {
    .slot--pop {
        animation: none;
    }
}

.slot--empty {
    background: rgba(0, 0, 0, 0.4);
    border: 1px dashed rgba(255, 255, 255, 0.45);
    box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.5);
    color: #fff;
}
.slot--empty:hover {
    background: rgba(0, 0, 0, 0.28);
    border-color: rgba(255, 255, 255, 0.8);
}

.slot--filled {
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(0, 0, 0, 0.42)),
        linear-gradient(160deg, var(--team-color, #2a6cc0), var(--team-accent, #16324f));
    border: 3px solid #fff;
    box-shadow:
        0 1px 2px rgba(0, 0, 0, 0.4),
        inset 0 2px 2px rgba(255, 255, 255, 0.32),
        inset 0 -16px 22px rgba(0, 0, 0, 0.3),
        0 0 0 1px rgba(0, 0, 0, 0.3);
    color: #fff;
}
.slot--filled.foil {
    border-color: #fbe9b0;
    border-radius: 9px;
    background: linear-gradient(135deg, #f4e3aa 0%, #d9b552 55%, #ecd28e 100%);
    box-shadow:
        0 2px 4px rgba(0, 0, 0, 0.45),
        inset 0 1px 2px rgba(255, 255, 255, 0.7),
        0 0 0 1px rgba(216, 178, 74, 0.85),
        0 0 16px rgba(216, 178, 74, 0.4);
    color: #4a3a12;
}
.slot__top,
.slot__center,
.slot__foot {
    position: relative;
    z-index: 2;
    pointer-events: none;
}
.slot--photo.slot--filled {
    background:
        linear-gradient(180deg, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.55)),
        linear-gradient(160deg, var(--team-accent, #2c3550), var(--team-color, #161a26));
}
.slot--photo.slot--filled::after {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    width: 26px;
    height: 26px;
    clip-path: polygon(0 0, 100% 0, 100% 100%);
    background: linear-gradient(
        225deg,
        rgba(255, 255, 255, 0.9),
        rgba(214, 214, 214, 0.55) 46%,
        rgba(0, 0, 0, 0.4) 56%
    );
    border-bottom-left-radius: 5px;
    box-shadow: -2px 2px 5px rgba(0, 0, 0, 0.35);
    pointer-events: none;
    z-index: 3;
}

.slot__top {
    position: relative;
    z-index: 2;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 4px;
}
.slot__badges {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 2px 2px 0 0;
}

.slot__code {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 0.6rem;
    letter-spacing: 0.02em;
    line-height: 1;
    padding: 3px 5px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    gap: 3px;
}
.slot__code-tick {
    color: var(--success);
    font-weight: 900;
}
.slot--empty .slot__code {
    background: #1a1a1a;
    color: #fff;
}
.slot--filled .slot__code {
    background: rgba(255, 255, 255, 0.92);
    color: #14141b;
}
.foil .slot__code {
    background: #2a2206;
    color: var(--wc-gold-lt);
}

.slot__center {
    flex: 1;
    display: grid;
    place-items: center;
    width: 100%;
}
.slot__glyph {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.5rem;
    line-height: 1;
    letter-spacing: -0.01em;
}
.slot--empty .slot__glyph {
    color: rgba(255, 255, 255, 0.8);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
}
.slot--filled .slot__glyph {
    color: #fff;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}
.foil .slot__glyph {
    color: #4a3a12;
    text-shadow: none;
}

.slot__foot {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 5px;
    width: 100%;
    padding: 4px 3px;
    border-radius: 5px;
}
.slot--filled .slot__foot {
    background: rgba(0, 0, 0, 0.6);
}
.foil .slot__foot {
    background: rgba(0, 0, 0, 0.72);
}
.slot--sm .slot__foot {
    background: none;
    padding: 0;
}

.slot__name {
    text-align: center;
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1.12;
    letter-spacing: -0.01em;
    text-transform: uppercase;
    min-height: 2.24em;
    overflow-wrap: break-word;
    word-break: normal;
    hyphens: none;
    text-wrap: balance;
}
.slot--empty .slot__name {
    color: rgba(255, 255, 255, 0.92);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
.slot--filled .slot__name {
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
.slot--sm .slot__name {
    display: none;
}
.slot--sm .slot__glyph {
    font-size: 1.2rem;
}

.slot__foilmark {
    font-size: 0.7rem;
    line-height: 1;
    color: var(--wc-gold);
}
.foil .slot__foilmark {
    color: #6b551b;
}
.slot--filled:not(.foil) .slot__foilmark {
    color: var(--wc-gold-lt);
}

.slot__pos {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 0.58rem;
    letter-spacing: 0.03em;
    padding: 2px 5px;
    border-radius: 6px;
    color: #fff;
    line-height: 1.2;
}
.slot--foilable .slot__pos {
    display: none;
}
.slot__pos--GK {
    background: #9a5a12;
}
.slot__pos--DEF {
    background: #245a9e;
}
.slot__pos--MID {
    background: #1f7a42;
}
.slot__pos--FWD {
    background: #a8322a;
}
.slot--empty .slot__pos {
    opacity: 0.85;
}

.slot__spare {
    align-self: center;
    background: var(--swap);
    color: #2a2206;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 0.62rem;
    padding: 2px 7px;
    border-radius: 7px;
}

.slot__dupes {
    align-self: center;
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.55);
    border-radius: 999px;
    padding: 2px;
}
.dupe-btn {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.22);
    color: #fff;
    font-size: 1.05rem;
    line-height: 1;
    display: grid;
    place-items: center;
    cursor: pointer;
}
.dupe-btn:hover {
    background: var(--success);
}
.dupe-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}
.dupe-count {
    font-size: 0.8rem;
    font-weight: 700;
    min-width: 14px;
    text-align: center;
    color: rgba(255, 255, 255, 0.7);
}
.dupe-count--has {
    color: var(--swap);
}
</style>
