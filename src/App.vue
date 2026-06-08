<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, RouterView } from "vue-router";
import { useI18n } from "vue-i18n";
import { useCollectionStore } from "@/stores/collection";
import { ALBUM_META } from "@/data/album";
import { downloadText } from "@/utils/download";
import { availableLanguages, languageNames, setLanguage } from "@/plugins/i18n";

const { t, locale } = useI18n();
const store = useCollectionStore();
const pct = computed(() => store.percentComplete);

function onLanguageChange(event: Event) {
    void setLanguage((event.target as HTMLSelectElement).value);
}

function exportCollection() {
    downloadText("wc2026-collection.json", store.exportJSON(), "application/json");
}
</script>

<template>
    <div class="app">
        <header class="topbar">
            <div class="container topbar__inner">
                <router-link to="/" class="brand" :aria-label="t('title-home', { title: ALBUM_META.title })">
                    <span class="brand__text">
                        <span class="brand__title">{{ ALBUM_META.title }}</span>
                        <span class="brand__sub">{{ $t("unofficial-sticker-tracker") }}</span>
                    </span>
                </router-link>

                <nav class="nav">
                    <router-link to="/" class="nav__link">
                        <svg class="nav__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                            <rect x="3" y="5" width="8" height="14" rx="1.2" />
                            <rect x="13" y="5" width="8" height="14" rx="1.2" />
                        </svg>
                        {{ $t("album") }}
                    </router-link>
                    <router-link to="/add" class="nav__link">
                        <svg class="nav__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                            <rect x="4" y="4" width="16" height="16" rx="3" />
                            <path d="M12 9.3v5.4M9.3 12h5.4" />
                        </svg>
                        {{ $t("add") }}
                    </router-link>
                    <router-link to="/checklist" class="nav__link">
                        <svg class="nav__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                            <rect x="4" y="4" width="16" height="16" rx="3" />
                            <path d="M8 12.4l2.6 2.6L16 9.2" />
                        </svg>
                        {{ $t("checklist") }}
                    </router-link>
                    <router-link to="/trade" class="nav__link">
                        <svg class="nav__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                            <path d="M8 4v15M8 4 5 7M8 4l3 3" />
                            <path d="M16 20V5M16 20l-3-3M16 20l3-3" />
                        </svg>
                        {{ $t("trade") }}
                    </router-link>
                    <router-link to="/needs" class="nav__link">
                        <svg class="nav__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                            <path d="M5 9h12l-3.2-3.4" />
                            <path d="M19 15H7l3.2 3.4" />
                        </svg>
                        {{ $t("needs-swaps-backup") }}
                    </router-link>
                </nav>

                <div class="progress">
                    <div class="progress__stat num">
                        <strong>{{ store.ownedCount }}</strong
                        ><span class="progress__slash">/</span>{{ store.totalCount }}
                    </div>
                    <div
                        class="progress__bar"
                        role="progressbar"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        :aria-valuenow="pct"
                        :aria-label="t('collection-pct-complete', { pct })"
                    >
                        <div class="progress__fill" :style="{ width: `${pct}%` }" />
                    </div>
                </div>

                <label class="lang">
                    <span class="sr-only">{{ $t("language") }}</span>
                    <svg class="lang__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                        <path
                            d="M3 12h18M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9S9.5 5.4 12 3Z"
                        />
                    </svg>
                    <select
                        class="lang__select"
                        :value="locale"
                        :aria-label="$t('language')"
                        @change="onLanguageChange"
                    >
                        <option v-for="code in availableLanguages" :key="code" :value="code">
                            {{ languageNames[code] }}
                        </option>
                    </select>
                </label>

                <button
                    class="btn btn--sm topbar__export"
                    type="button"
                    :title="$t('export-your-collection-json')"
                    @click="exportCollection"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                        <path d="M12 3v11m0 0 4-4m-4 4-4-4" />
                        <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
                    </svg>
                    {{ $t("export") }}
                </button>
            </div>
        </header>

        <main class="container main">
            <router-view />
        </main>

        <footer class="foot container">
            <span>
                2026 -
                <a class="foot__link" href="https://github.com/ryandeering" target="_blank" rel="noopener noreferrer"
                    >Ryan Deering</a
                >
                -
                <span class="foot__muted">{{
                    $t("not-officially-affiliated-with-fifa-or-panini-no-money-is-made-from-this")
                }}</span>
            </span>
        </footer>
    </div>
</template>

<style scoped>
.app {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
}

.topbar {
    position: sticky;
    top: 0;
    z-index: 50;
    background: var(--wc-ink);
    border-bottom: 1px solid var(--wc-line-strong);
    box-shadow: var(--shadow-sm);
}
.topbar__inner {
    display: flex;
    align-items: center;
    gap: 16px;
    height: 64px;
}

.brand {
    display: flex;
    align-items: center;
}
.brand__text {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
}
.brand__title {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.05rem;
    letter-spacing: -0.01em;
}
.brand__sub {
    font-size: 0.66rem;
    color: var(--wc-muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.nav {
    display: flex;
    gap: 2px;
    margin-left: 4px;
}
.nav__link {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 11px;
    border-radius: var(--radius-sm);
    font-weight: 600;
    font-size: 0.88rem;
    white-space: nowrap;
    color: var(--wc-muted);
    transition:
        background var(--ease),
        color var(--ease),
        transform var(--ease);
}
.nav__ico {
    flex: none;
    width: 16px;
    height: 16px;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    color: var(--wc-muted);
    transition: color var(--ease);
}
.nav__link:hover {
    background: var(--n-850);
    color: var(--wc-text);
}
.nav__link:hover .nav__ico {
    color: var(--wc-text);
}
.nav__link:active {
    transform: translateY(1px);
}
.nav__link.router-link-active {
    background: var(--n-800);
    color: #fff;
}
.nav__link.router-link-active .nav__ico {
    color: var(--accent);
}
.nav__link.router-link-active::after {
    content: "";
    position: absolute;
    left: 13px;
    right: 13px;
    bottom: 3px;
    height: 2px;
    border-radius: 2px;
    background: var(--accent);
}

.progress {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 10px;
}
.progress__stat {
    font-family: var(--font-display);
    font-size: 1rem;
    white-space: nowrap;
}
.progress__stat strong {
    color: var(--success);
}
.progress__slash {
    color: var(--wc-muted);
    margin: 0 1px;
}
.progress__bar {
    width: 140px;
    height: 8px;
    border-radius: 999px;
    background: var(--wc-panel-2);
    overflow: hidden;
    border: 1px solid var(--wc-line);
}
.progress__fill {
    height: 100%;
    border-radius: var(--radius-pill);
    background: var(--accent);
    transition: width 0.4s ease;
}
.progress__pct {
    font-size: 0.82rem;
    color: var(--wc-muted);
    min-width: 38px;
    text-align: right;
}

.lang {
    flex: none;
    position: relative;
    display: inline-flex;
    align-items: center;
}
.lang__ico {
    position: absolute;
    left: 8px;
    width: 15px;
    height: 15px;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    color: var(--wc-muted);
    pointer-events: none;
}
.lang__select {
    appearance: none;
    -webkit-appearance: none;
    padding: 7px 10px 7px 28px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--wc-line-strong);
    background: var(--wc-panel-2);
    color: var(--wc-text);
    font: inherit;
    font-size: 0.84rem;
    font-weight: 600;
    cursor: pointer;
    transition:
        border-color var(--ease),
        color var(--ease);
}
.lang__select:hover {
    color: #fff;
    border-color: var(--accent);
}
.lang__select:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
}

.topbar__export {
    flex: none;
}
.topbar__export svg {
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
}

.main {
    flex: 1;
    width: 100%;
    padding-top: 24px;
    padding-bottom: 48px;
}

.foot {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding-top: 18px;
    padding-bottom: 28px;
    border-top: 1px solid var(--wc-line);
    font-size: 0.78rem;
    color: var(--wc-muted);
    flex-wrap: wrap;
}
.foot__muted {
    opacity: 0.85;
}
.foot__link {
    color: var(--wc-text);
    text-decoration: underline;
    text-underline-offset: 2px;
}
.foot__link:hover {
    color: var(--accent);
}

@media (max-width: 860px) {
    .topbar__inner {
        flex-wrap: wrap;
        height: auto;
        padding-top: 10px;
        padding-bottom: 10px;
        gap: 12px;
    }
    .nav {
        order: 3;
        width: 100%;
        margin-left: 0;
        flex-wrap: wrap;
    }
    .progress {
        order: 2;
        width: 100%;
        margin-left: 0;
    }
    .topbar__export {
        order: 1;
        margin-left: auto;
    }
}
</style>
