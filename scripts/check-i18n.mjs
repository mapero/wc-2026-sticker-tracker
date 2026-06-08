// i18n key audit: fails if a $t("…") key used in code is missing from the
// source locale (en), or if another locale is out of parity with en.
// Run via `npm run check:i18n` and as the first step of `npm run build`.
//
// Only statically-quoted keys are checked - dynamic keys like t(`group-${x}`)
// can't be verified here and are skipped.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = "src";
const LANG_DIR = "src/lang";
const SOURCE_LOCALE = "en";

function walk(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) out.push(...walk(p));
        else if (/\.(ts|vue)$/.test(p)) out.push(p);
    }
    return out;
}

// Match $t("key") or a bare t("key"), but NOT foo.t( or createElement("…")
// (the char before a bare `t` must be a non-word, non-dot char).
const KEY_RE = /(?:\$t|[^\w.]t)\(\s*["']([a-z0-9-]+)["']/g;

const used = new Set();
for (const file of walk(SRC)) {
    const text = readFileSync(file, "utf8");
    let m;
    while ((m = KEY_RE.exec(text))) used.add(m[1]);
}

const loadKeys = (locale) =>
    new Set(Object.keys(JSON.parse(readFileSync(join(LANG_DIR, `${locale}.json`), "utf8"))));

const locales = readdirSync(LANG_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
const enKeys = loadKeys(SOURCE_LOCALE);

let failed = false;
const report = (msg, keys) => {
    failed = true;
    console.error(`✖ ${msg}`);
    for (const k of keys) console.error(`   - ${k}`);
};

const missingInEn = [...used].filter((k) => !enKeys.has(k)).sort();
if (missingInEn.length) report(`${missingInEn.length} key(s) used in code but missing from ${SOURCE_LOCALE}.json:`, missingInEn);

for (const loc of locales) {
    if (loc === SOURCE_LOCALE) continue;
    const keys = loadKeys(loc);
    const missing = [...enKeys].filter((k) => !keys.has(k)).sort();
    const extra = [...keys].filter((k) => !enKeys.has(k)).sort();
    if (missing.length) report(`${loc}.json is missing ${missing.length} key(s) present in ${SOURCE_LOCALE}.json:`, missing);
    if (extra.length) report(`${loc}.json has ${extra.length} key(s) not in ${SOURCE_LOCALE}.json:`, extra);
}

if (failed) {
    console.error("\ni18n key check failed.");
    process.exit(1);
}
console.log(`✓ i18n keys OK — ${used.size} keys used, ${locales.length} locales in parity.`);
