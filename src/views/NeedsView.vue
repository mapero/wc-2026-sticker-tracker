<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { PartyPopper, Copy, ClipboardCheck, Download } from "lucide-vue-next";
import { useNeedsExport } from "@/composables/useNeedsExport";
import { downloadText, copyText } from "@/utils/download";
import BaseButton from "@/components/base/BaseButton.vue";
import BaseChip from "@/components/base/BaseChip.vue";
import BackupCard from "@/components/needs/BackupCard.vue";
import FormatOptions from "@/components/needs/FormatOptions.vue";

const { grouping, detail, compactness, includeIntro, neededCount, swapCount, needsText, swapsText } = useNeedsExport();

type Toast = "needs" | "swaps";
const copied = ref<Record<Toast, boolean>>({ needs: false, swaps: false });
const copyTimers: Record<Toast, ReturnType<typeof setTimeout> | undefined> = { needs: undefined, swaps: undefined };

async function onCopy(which: Toast): Promise<void> {
    const text = which === "needs" ? needsText.value : swapsText.value;
    const ok = await copyText(text);
    if (!ok) return;
    copied.value[which] = true;
    clearTimeout(copyTimers[which]);
    copyTimers[which] = window.setTimeout(() => {
        copied.value[which] = false;
    }, 1800);
}

function onDownloadNeeds(): void {
    downloadText("wc2026-needs.txt", needsText.value, "text/plain;charset=utf-8");
}

function onDownloadSwaps(): void {
    downloadText("wc2026-swaps.txt", swapsText.value, "text/plain;charset=utf-8");
}

onBeforeUnmount(() => {
    clearTimeout(copyTimers.needs);
    clearTimeout(copyTimers.swaps);
});
</script>

<template>
    <div class="needs container">
        <header class="needs__head">
            <h1 class="needs__title">{{ $t("needs-swaps-backup") }}</h1>
            <p class="needs__sub">
                {{ $t("needs-intro") }}
            </p>
        </header>

        <section class="grid">
            <div class="panel card">
                <h2 class="card__title">{{ $t("needs-list") }}</h2>
                <p class="card__hint">
                    <base-chip v-if="neededCount > 0" variant="need" class="num">{{
                        $t("n-stickers-needed", { n: neededCount })
                    }}</base-chip>
                    <base-chip v-else variant="done">
                        <party-popper :size="14" /> {{ includeIntro ? $t("album-complete") : $t("teams-complete") }}
                    </base-chip>
                </p>

                <format-options
                    v-model:grouping="grouping"
                    v-model:detail="detail"
                    v-model:compactness="compactness"
                    v-model:intro="includeIntro"
                />

                <div class="actions">
                    <base-button variant="primary" @click="onCopy('needs')">
                        <clipboard-check v-if="copied.needs" :size="16" />
                        <copy v-else :size="16" />
                        {{ copied.needs ? $t("copied") : $t("copy-to-clipboard") }}
                    </base-button>
                    <base-button @click="onDownloadNeeds">
                        <download :size="16" /> {{ $t("download-txt") }}
                    </base-button>
                </div>
            </div>

            <div class="panel card card--preview">
                <h2 class="card__title">{{ $t("preview") }}</h2>
                <textarea
                    class="out"
                    readonly
                    spellcheck="false"
                    :value="needsText"
                    :aria-label="$t('needs-list-preview')"
                ></textarea>
            </div>
        </section>

        <section class="grid">
            <div class="panel card">
                <h2 class="card__title">{{ $t("swaps-spares") }}</h2>
                <p class="card__hint">
                    <base-chip v-if="swapCount > 0" variant="swap" class="num">{{
                        $t("n-to-swap", { n: swapCount })
                    }}</base-chip>
                    <base-chip v-else>{{ $t("no-duplicates-yet") }}</base-chip>
                </p>
                <p class="card__desc">{{ $t("swaps-desc") }}</p>

                <format-options
                    v-model:grouping="grouping"
                    v-model:detail="detail"
                    v-model:compactness="compactness"
                    v-model:intro="includeIntro"
                />

                <div class="actions">
                    <base-button variant="primary" :disabled="swapCount === 0" @click="onCopy('swaps')">
                        <clipboard-check v-if="copied.swaps" :size="16" />
                        <copy v-else :size="16" />
                        {{ copied.swaps ? $t("copied") : $t("copy-to-clipboard") }}
                    </base-button>
                    <base-button :disabled="swapCount === 0" @click="onDownloadSwaps">
                        <download :size="16" /> {{ $t("download-txt") }}
                    </base-button>
                </div>
            </div>

            <div class="panel card card--preview">
                <h2 class="card__title">{{ $t("preview") }}</h2>
                <textarea
                    class="out"
                    readonly
                    spellcheck="false"
                    :value="swapsText"
                    :aria-label="$t('swaps-list-preview')"
                ></textarea>
            </div>
        </section>

        <backup-card />
    </div>
</template>

<style scoped>
.needs {
    padding-top: 24px;
    padding-bottom: 56px;
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.needs__head {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.needs__title {
    font-size: 1.6rem;
    color: var(--wc-text);
}
.needs__sub {
    margin: 0;
    color: var(--wc-muted);
    max-width: 60ch;
    line-height: 1.5;
}

.grid {
    display: grid;
    grid-template-columns: minmax(260px, 360px) 1fr;
    gap: 16px;
}
@media (max-width: 760px) {
    .grid {
        grid-template-columns: 1fr;
    }
}

.card {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.card__title {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.25rem;
    letter-spacing: -0.01em;
    line-height: 1.1;
    color: var(--wc-text);
}
.card__hint {
    margin: 0;
}
.card__desc {
    margin: 0;
    color: var(--wc-muted);
    font-size: 0.9rem;
    line-height: 1.5;
}

.actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: auto;
}
.actions .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.card--preview {
    min-height: 0;
}
.out {
    width: 100%;
    min-height: 320px;
    resize: vertical;
    flex: 1;
    background: var(--wc-black);
    color: var(--wc-text);
    border: 1px solid var(--wc-line-strong);
    border-radius: var(--radius-sm);
    padding: 14px 16px;
    font-family: ui-monospace, "Geist Mono", SFMono-Regular, Menlo, monospace;
    font-size: 0.86rem;
    line-height: 1.55;
    white-space: pre;
    overflow: auto;
    transition: border-color var(--ease);
}
.out:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
}
</style>
