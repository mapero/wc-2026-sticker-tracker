<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import { FileJson, Upload, Trash2, Copy } from "lucide-vue-next";
import { useCollectionStore } from "@/stores/collection";
import { downloadText } from "@/utils/download";
import BaseButton from "@/components/base/BaseButton.vue";

const { t } = useI18n();
const store = useCollectionStore();

const importText = ref<string>("");
const importMessage = ref<string>("");
const importOk = ref<boolean | null>(null);
const importFileInput = ref<HTMLInputElement | null>(null);
let importTimer: ReturnType<typeof setTimeout> | undefined;

function showImportResult(result: { ok: boolean; error?: string; imported?: number }): void {
    importOk.value = result.ok;
    if (result.ok) {
        importMessage.value = t("imported-n-stickers", { n: result.imported ?? 0 });
    } else {
        importMessage.value = result.error ?? t("import-failed");
    }
    clearTimeout(importTimer);
    importTimer = window.setTimeout(() => {
        importMessage.value = "";
        importOk.value = null;
    }, 4000);
}

onBeforeUnmount(() => {
    clearTimeout(importTimer);
});

function onExportBackup(): void {
    downloadText("wc2026-collection.json", store.exportJSON(), "application/json");
}

async function onImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
        const text = await file.text();
        showImportResult(store.importJSON(text));
    } catch {
        showImportResult({ ok: false, error: t("could-not-read-file") });
    } finally {
        input.value = "";
    }
}

function onImportPaste(): void {
    if (!importText.value.trim()) {
        showImportResult({ ok: false, error: t("nothing-to-import") });
        return;
    }
    const result = store.importJSON(importText.value);
    showImportResult(result);
    if (result.ok) importText.value = "";
}

function onReset(): void {
    if (window.confirm(t("reset-confirm"))) {
        store.reset();
    }
}

function onClearSwaps(): void {
    if (window.confirm(t("clear-swaps-confirm"))) {
        store.clearSwaps();
    }
}
</script>

<template>
    <section class="panel card card--backup">
        <h2 class="card__title">{{ $t("data-backup") }}</h2>
        <p class="card__desc">
            {{ $t("data-backup-desc") }}
        </p>

        <div class="backup__row">
            <base-button @click="onExportBackup"> <file-json :size="16" /> {{ $t("export-backup-json") }} </base-button>

            <button type="button" class="btn" @click="importFileInput?.click()">
                <upload :size="16" /> {{ $t("import-backup-file") }}
            </button>
            <input
                ref="importFileInput"
                class="sr-only"
                type="file"
                accept="application/json,.json"
                @change="onImportFile"
            />
        </div>

        <div class="backup__paste">
            <label class="paste__label" for="paste-import">{{ $t("or-paste-backup-json") }}</label>
            <textarea
                id="paste-import"
                v-model="importText"
                class="out out--paste"
                spellcheck="false"
                placeholder='{ "version": 1, "counts": { "BRA1": 1, ... } }'
            ></textarea>
            <base-button @click="onImportPaste"> <upload :size="16" /> {{ $t("import-pasted-json") }} </base-button>
        </div>

        <p
            v-if="importMessage"
            class="import-msg num"
            :class="importOk ? 'import-msg--ok' : 'import-msg--err'"
            role="status"
        >
            {{ importMessage }}
        </p>

        <hr class="rule" />

        <div class="danger-zone">
            <div>
                <strong class="danger-zone__title">{{ $t("clear-swaps") }}</strong>
                <p class="card__desc">{{ $t("clear-swaps-desc") }}</p>
            </div>
            <base-button :disabled="store.duplicateCount === 0" @click="onClearSwaps">
                <copy :size="16" /> {{ $t("clear-swaps") }}
            </base-button>
        </div>

        <div class="danger-zone">
            <div>
                <strong>{{ $t("reset-collection") }}</strong>
                <p class="card__desc">{{ $t("reset-collection-desc") }}</p>
            </div>
            <base-button variant="danger" @click="onReset">
                <trash2 :size="16" /> {{ $t("reset-collection") }}
            </base-button>
        </div>
    </section>
</template>

<style scoped>
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
.card__desc {
    margin: 0;
    color: var(--wc-muted);
    font-size: 0.9rem;
    line-height: 1.5;
}

.out--paste {
    width: 100%;
    min-height: 120px;
    resize: vertical;
    background: var(--wc-black);
    color: var(--wc-text);
    border: 1px solid var(--wc-line-strong);
    border-radius: var(--radius-sm);
    padding: 14px 16px;
    font-family: ui-monospace, "Geist Mono", SFMono-Regular, Menlo, monospace;
    font-size: 0.86rem;
    line-height: 1.55;
    white-space: pre-wrap;
    overflow: auto;
    transition: border-color var(--ease);
}
.out--paste:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
}

.card--backup {
    gap: 16px;
}
.backup__row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
}
.backup__row label.btn {
    cursor: pointer;
}
.backup__paste {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.paste__label {
    font-size: 0.85rem;
    color: var(--wc-muted);
    font-weight: 600;
}
.backup__paste .btn {
    align-self: flex-start;
}

.import-msg {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
}
.import-msg--ok {
    background: rgba(62, 207, 127, 0.14);
    color: var(--ok);
    border: 1px solid var(--ok);
}
.import-msg--err {
    background: rgba(224, 83, 61, 0.14);
    color: var(--danger);
    border: 1px solid var(--danger);
}

.rule {
    border: none;
    border-top: 1px solid var(--wc-line);
    margin: 2px 0;
}

.danger-zone {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
}
.danger-zone strong {
    font-family: var(--font-display);
    font-size: 1.05rem;
    color: var(--danger);
}
.danger-zone__title {
    color: var(--wc-text) !important;
}
</style>
