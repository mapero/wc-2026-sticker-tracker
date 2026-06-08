import { Composer, createI18n, I18n, I18nOptions } from "vue-i18n";
import { WritableComputedRef } from "vue";

export interface CI18n extends I18n {
    t: Composer["t"];
    tc: (key: string, choice?: number, values?: Record<string, unknown>) => string;
}

const loadedLanguages: string[] = [];

export const availableLanguages = ["en", "es", "fr"];

export const languageNames: Record<string, string> = {
    en: "English",
    es: "Español",
    fr: "Français",
};

const DEFAULT_LOCALE = "en";

const LANG_KEY = "wc-lang";

function readStoredLang(): string | null {
    try {
        return localStorage.getItem(LANG_KEY);
    } catch {
        return null;
    }
}
function storeLang(lang: string): void {
    try {
        localStorage.setItem(LANG_KEY, lang);
    } catch {}
}

function getFallbackConfig() {
    return {
        es: ["es", "en"],
        fr: ["fr", "en"],
        default: ["en"],
    };
}

const setI18nLanguage = (i18nInstance: I18n, lang: string): string => {
    (i18nInstance.global.locale as WritableComputedRef<string>).value = lang;
    document.querySelector("html")?.setAttribute("lang", lang);
    storeLang(lang);
    return lang;
};

const loadLanguageAsync = async (i18nInstance: I18n, lang: string): Promise<string> => {
    const fallbackConfig = getFallbackConfig() as Record<string, string[]>;
    const fallbackChain = fallbackConfig[lang] ?? fallbackConfig.default;

    const toLoad = loadedLanguages.includes(lang) ? [...fallbackChain] : [lang, ...fallbackChain];

    for (const code of toLoad) {
        if (loadedLanguages.includes(code)) continue;
        try {
            const messages = await import(`../lang/${code}.json`);
            i18nInstance.global.setLocaleMessage(code, messages.default);
            loadedLanguages.push(code);
        } catch (e) {
            console.warn(`Failed to load language file for ${code}:`, e);
        }
    }

    return setI18nLanguage(i18nInstance, lang);
};

export const loadNewLanguageMessagesAsync = async (lang: string): Promise<void> => {
    if (loadedLanguages.includes(lang)) return;
    try {
        const messages = await import(`../lang/${lang}.json`);
        i18n.global.setLocaleMessage(lang, messages.default);
        loadedLanguages.push(lang);
    } catch (e) {
        console.warn(`Failed to load language file for ${lang}:`, e);
        throw e;
    }
};

const determineLanguage = (): string => {
    const storedLang = readStoredLang();
    const browserLang = (navigator.language || navigator.languages?.[0] || "").split("-")[0];

    let lang = storedLang || browserLang || DEFAULT_LOCALE;
    lang = availableLanguages.includes(lang) ? lang : DEFAULT_LOCALE;
    return lang;
};

const createI18nInstance = (): I18n => {
    const options: I18nOptions = {
        legacy: false,
        locale: DEFAULT_LOCALE,
        fallbackLocale: getFallbackConfig(),
        messages: {},
        silentFallbackWarn: true,
        globalInjection: true,
    };
    return createI18n(options);
};

export const i18n = createI18nInstance() as CI18n;

export const setupLanguage = async (i18nInstance: I18n = i18n): Promise<string> => {
    const lang = determineLanguage();
    return loadLanguageAsync(i18nInstance, lang);
};

export const setLanguage = async (lang: string): Promise<string> => {
    if (!availableLanguages.includes(lang)) lang = DEFAULT_LOCALE;
    return loadLanguageAsync(i18n, lang);
};

i18n.t = i18n.global.t.bind(i18n.global);
i18n.tc = (key: string, choice?: number, values?: Record<string, unknown>) => {
    const count = choice ?? 1;
    return i18n.t(key, { count, ...(values ?? {}) });
};
