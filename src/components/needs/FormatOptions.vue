<script setup lang="ts">
import { SlidersHorizontal } from "lucide-vue-next";
import type { Grouping, Detail, Compactness } from "@/composables/useNeedsExport";

const grouping = defineModel<Grouping>("grouping", { required: true });
const detail = defineModel<Detail>("detail", { required: true });
const compactness = defineModel<Compactness>("compactness", { required: true });
const intro = defineModel<boolean>("intro", { required: true });
</script>

<template>
    <details class="disclosure">
        <summary class="disclosure__summary">
            <sliders-horizontal :size="15" aria-hidden="true" /> {{ $t("format-options") }}
        </summary>
        <div class="disclosure__body">
            <fieldset class="opt">
                <legend>{{ $t("grouping") }}</legend>
                <label><input v-model="grouping" type="radio" value="team" /> {{ $t("by-team") }}</label>
                <label><input v-model="grouping" type="radio" value="flat" /> {{ $t("flat-list") }}</label>
            </fieldset>

            <fieldset class="opt">
                <legend>{{ $t("detail") }}</legend>
                <label><input v-model="detail" type="radio" value="codes" /> {{ $t("codes-only") }}</label>
                <label><input v-model="detail" type="radio" value="names" /> {{ $t("codes-names") }}</label>
            </fieldset>

            <fieldset class="opt">
                <legend>{{ $t("compactness") }}</legend>
                <label><input v-model="compactness" type="radio" value="lines" /> {{ $t("one-per-line") }}</label>
                <label><input v-model="compactness" type="radio" value="commas" /> {{ $t("comma-separated") }}</label>
            </fieldset>

            <label class="opt opt--check">
                <input v-model="intro" type="checkbox" />
                {{ $t("include-foil-special-section-intro") }}
            </label>
        </div>
    </details>
</template>

<style scoped>
.disclosure {
    border: 1px solid var(--wc-line);
    border-radius: var(--radius-sm);
    overflow: hidden;
}
.disclosure__summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    cursor: pointer;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 0.85rem;
    letter-spacing: 0.02em;
    color: var(--wc-text);
    user-select: none;
    list-style: none;
}
.disclosure__summary::-webkit-details-marker {
    display: none;
}
.disclosure__summary svg {
    color: var(--wc-muted);
}
.disclosure__summary::after {
    content: "";
    margin-left: auto;
    width: 7px;
    height: 7px;
    border-right: 2px solid var(--wc-muted);
    border-bottom: 2px solid var(--wc-muted);
    transform: rotate(45deg);
    transition: transform var(--ease);
}
.disclosure[open] .disclosure__summary::after {
    transform: rotate(225deg);
}
.disclosure__summary:hover {
    background: var(--wc-panel-2);
}
.disclosure[open] .disclosure__summary {
    border-bottom: 1px solid var(--wc-line);
}
.disclosure__body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
}

.opt {
    border: 1px solid var(--wc-line);
    border-radius: var(--radius-sm);
    padding: 10px 14px;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
    align-items: center;
}
.opt legend {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 0.78rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--wc-muted);
    padding: 0 6px;
}
.opt label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.9rem;
    cursor: pointer;
}
.opt input {
    accent-color: var(--success);
    cursor: pointer;
}
.opt--check {
    border-style: dashed;
}
</style>
