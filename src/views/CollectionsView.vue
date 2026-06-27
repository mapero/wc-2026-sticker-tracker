<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Plus, Check, Pencil, Copy, Trash2, RefreshCw, ClipboardCheck, Link2, Unlink } from "lucide-vue-next";
import { useCollectionStore } from "@/stores/collection";
import BaseButton from "@/components/base/BaseButton.vue";
import BaseChip from "@/components/base/BaseChip.vue";

const { t } = useI18n();
const store = useCollectionStore();

// ---- collections --------------------------------------------------------
const newName = ref("");

function addCollection(): void {
    if (!newName.value.trim()) return;
    store.createCollection(newName.value);
    newName.value = "";
}
function rename(id: string, current: string): void {
    const name = window.prompt(t("rename-collection-prompt"), current);
    if (name && name.trim()) store.renameCollection(id, name);
}
function remove(id: string, name: string): void {
    if (window.confirm(t("delete-collection-confirm", { name }))) store.deleteCollection(id);
}

// ---- sync ---------------------------------------------------------------
const pairCode = ref("");
const codeCopied = ref(false);
const busy = computed(() => store.syncStatus === "syncing");

async function onEnable(): Promise<void> {
    await store.enableSync();
}
async function onPair(): Promise<void> {
    if (!pairCode.value.trim()) return;
    const res = await store.pairWithCode(pairCode.value);
    if (res.ok) pairCode.value = "";
}
function onDisable(): void {
    if (window.confirm(t("stop-syncing-confirm"))) store.disableSync();
}
async function copyCode(): Promise<void> {
    if (!store.syncCode) return;
    try {
        await navigator.clipboard.writeText(store.syncCode);
        codeCopied.value = true;
        window.setTimeout(() => (codeCopied.value = false), 1800);
    } catch {
        /* clipboard unavailable */
    }
}

const errorMessage = computed(() => {
    const e = store.syncError;
    if (!e || store.syncStatus !== "error") return "";
    if (e === "unknown-code") return t("sync-error-unknown-code");
    if (e === "network") return t("sync-error-network");
    return t("sync-error-generic");
});
const lastSyncedText = computed(() =>
    store.lastSyncedAt ? new Date(store.lastSyncedAt).toLocaleTimeString() : t("never")
);
</script>

<template>
    <div class="collections container">
        <header class="collections__head">
            <h1 class="collections__title">{{ $t("collections") }}</h1>
            <p class="collections__sub">{{ $t("collections-intro") }}</p>
        </header>

        <!-- Collections overview -->
        <section class="grid">
            <article
                v-for="{ collection, stats } in store.allCollectionStats"
                :key="collection.id"
                class="panel card col"
                :class="{ 'col--active': collection.id === store.activeId }"
            >
                <div class="col__top">
                    <h2 class="col__name">{{ collection.name }}</h2>
                    <base-chip v-if="collection.id === store.activeId" variant="done">
                        <check :size="13" /> {{ $t("active") }}
                    </base-chip>
                </div>

                <div class="col__statline num">
                    <span class="col__owned">{{ stats.owned }}</span
                    ><span class="col__slash">/</span>{{ stats.total }}
                    <span class="col__pct">· {{ $t("n-percent-complete", { n: stats.percent }) }}</span>
                </div>

                <div
                    class="bar"
                    role="progressbar"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    :aria-valuenow="stats.percent"
                >
                    <div class="bar__fill" :style="{ width: `${stats.percent}%` }" />
                </div>

                <div class="col__chips">
                    <base-chip v-if="stats.complete" variant="done">{{ $t("complete") }}</base-chip>
                    <base-chip v-else variant="need">{{ $t("n-missing", { n: stats.missing }) }}</base-chip>
                    <base-chip v-if="stats.duplicates > 0" variant="swap">{{
                        $t("n-duplicates", { n: stats.duplicates })
                    }}</base-chip>
                </div>

                <div class="col__actions">
                    <base-button
                        v-if="collection.id !== store.activeId"
                        variant="primary"
                        size="sm"
                        @click="store.setActiveCollection(collection.id)"
                    >
                        {{ $t("make-active") }}
                    </base-button>
                    <base-button size="sm" @click="rename(collection.id, collection.name)">
                        <pencil :size="14" /> {{ $t("rename") }}
                    </base-button>
                    <base-button size="sm" @click="store.duplicateCollection(collection.id)">
                        <copy :size="14" /> {{ $t("duplicate") }}
                    </base-button>
                    <base-button
                        variant="danger"
                        size="sm"
                        :disabled="store.collections.length <= 1"
                        @click="remove(collection.id, collection.name)"
                    >
                        <trash2 :size="14" /> {{ $t("delete") }}
                    </base-button>
                </div>
            </article>

            <!-- New collection -->
            <article class="panel card col col--new">
                <h2 class="col__name">{{ $t("new-collection") }}</h2>
                <form class="col__newform" @submit.prevent="addCollection">
                    <input
                        v-model="newName"
                        class="input"
                        type="text"
                        :placeholder="$t('collection-name')"
                        :aria-label="$t('collection-name')"
                        maxlength="120"
                    />
                    <base-button variant="primary" type="submit" :disabled="!newName.trim()">
                        <plus :size="16" /> {{ $t("create") }}
                    </base-button>
                </form>
            </article>
        </section>

        <!-- Sync -->
        <section class="panel card sync">
            <div class="sync__head">
                <h2 class="card__title">{{ $t("sync") }}</h2>
                <base-chip :variant="store.syncEnabled ? 'done' : 'default'">
                    {{ store.syncEnabled ? $t("sync-active") : $t("sync-off") }}
                </base-chip>
            </div>
            <p class="card__desc">{{ $t("sync-intro") }}</p>

            <p v-if="errorMessage" class="sync__error" role="alert">{{ errorMessage }}</p>

            <!-- Enabled state -->
            <template v-if="store.syncEnabled">
                <div class="sync__codebox">
                    <span class="sync__codelabel">{{ $t("your-sync-code") }}</span>
                    <code class="sync__code">{{ store.syncCode }}</code>
                    <base-button size="sm" @click="copyCode">
                        <clipboard-check v-if="codeCopied" :size="14" />
                        <copy v-else :size="14" />
                        {{ codeCopied ? $t("copied") : $t("copy-code") }}
                    </base-button>
                </div>
                <p class="card__desc sync__hint">{{ $t("sync-code-hint") }}</p>
                <div class="sync__status num">
                    {{ busy ? $t("syncing") : $t("last-synced", { time: lastSyncedText }) }}
                </div>
                <div class="sync__actions">
                    <base-button variant="primary" :disabled="busy" @click="store.syncNow()">
                        <refresh-cw :size="16" /> {{ $t("sync-now") }}
                    </base-button>
                    <base-button variant="danger" :disabled="busy" @click="onDisable">
                        <unlink :size="16" /> {{ $t("stop-syncing") }}
                    </base-button>
                </div>
            </template>

            <!-- Disabled state -->
            <template v-else>
                <div class="sync__options">
                    <div class="sync__opt">
                        <h3 class="sync__opttitle">{{ $t("enable-sync") }}</h3>
                        <p class="card__desc">{{ $t("enable-sync-desc") }}</p>
                        <base-button variant="primary" :disabled="busy" @click="onEnable">
                            <link2 :size="16" /> {{ $t("enable-sync") }}
                        </base-button>
                    </div>

                    <div class="sync__opt">
                        <h3 class="sync__opttitle">{{ $t("pair-with-code") }}</h3>
                        <p class="card__desc">{{ $t("pair-with-code-desc") }}</p>
                        <form class="sync__pair" @submit.prevent="onPair">
                            <input
                                v-model="pairCode"
                                class="input num"
                                type="text"
                                :placeholder="$t('enter-sync-code')"
                                :aria-label="$t('enter-sync-code')"
                                autocapitalize="characters"
                                spellcheck="false"
                            />
                            <base-button type="submit" :disabled="busy || !pairCode.trim()">
                                {{ $t("pair") }}
                            </base-button>
                        </form>
                    </div>
                </div>
            </template>
        </section>
    </div>
</template>

<style scoped>
.collections {
    padding-top: 24px;
    padding-bottom: 56px;
    display: flex;
    flex-direction: column;
    gap: 24px;
}
.collections__head {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.collections__title {
    font-size: 1.6rem;
    color: var(--wc-text);
}
.collections__sub {
    margin: 0;
    color: var(--wc-muted);
    max-width: 60ch;
    line-height: 1.5;
}

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
}

.col {
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.col--active {
    border-color: var(--success);
    box-shadow: 0 0 0 1px var(--success) inset;
}
.col__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}
.col__name {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.15rem;
    letter-spacing: -0.01em;
    color: var(--wc-text);
    word-break: break-word;
}
.col__statline {
    font-family: var(--font-display);
    font-size: 1.25rem;
    color: var(--wc-text);
}
.col__owned {
    color: var(--success);
}
.col__slash {
    color: var(--wc-muted);
    margin: 0 2px;
}
.col__pct {
    font-size: 0.85rem;
    color: var(--wc-muted);
}
.bar {
    height: 8px;
    border-radius: 999px;
    background: var(--wc-panel-2);
    overflow: hidden;
    border: 1px solid var(--wc-line);
}
.bar__fill {
    height: 100%;
    border-radius: 999px;
    background: var(--accent);
    transition: width 0.4s ease;
}
.col__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.col__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: auto;
    padding-top: 4px;
}
.col__actions .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.col--new {
    border-style: dashed;
    justify-content: center;
}
.col__newform {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.input {
    width: 100%;
    padding: 9px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--wc-line-strong);
    background: var(--wc-panel-2);
    color: var(--wc-text);
    font: inherit;
    font-size: 0.9rem;
}
.input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
}

.sync {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.sync__head {
    display: flex;
    align-items: center;
    gap: 12px;
}
.card__title {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.25rem;
    letter-spacing: -0.01em;
    color: var(--wc-text);
}
.card__desc {
    margin: 0;
    color: var(--wc-muted);
    font-size: 0.9rem;
    line-height: 1.5;
}
.sync__error {
    margin: 0;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--danger, #e5484d) 14%, transparent);
    border: 1px solid var(--danger, #e5484d);
    color: var(--wc-text);
    font-size: 0.88rem;
}
.sync__codebox {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: var(--radius-sm);
    background: var(--wc-black, var(--wc-panel-2));
    border: 1px solid var(--wc-line-strong);
}
.sync__codelabel {
    font-size: 0.78rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--wc-muted);
}
.sync__code {
    font-family: ui-monospace, "Geist Mono", SFMono-Regular, Menlo, monospace;
    font-size: 1.15rem;
    letter-spacing: 0.08em;
    color: var(--accent);
    font-weight: 700;
}
.sync__hint {
    margin-top: -4px;
}
.sync__status {
    font-size: 0.85rem;
    color: var(--wc-muted);
}
.sync__actions,
.sync__pair {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}
.sync__options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}
.sync__opt {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border: 1px solid var(--wc-line);
    border-radius: var(--radius-sm);
}
.sync__opttitle {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1rem;
    color: var(--wc-text);
}
.sync__pair .input {
    flex: 1;
    min-width: 160px;
}
.sync .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

@media (max-width: 640px) {
    .sync__options {
        grid-template-columns: 1fr;
    }
}
</style>
