import globals from "globals"
import eslintPluginVue from "eslint-plugin-vue"
import eslintPluginPrettier from "eslint-plugin-prettier"
import eslintPluginImport from "eslint-plugin-import"
import tseslint from "@typescript-eslint/eslint-plugin"
import tsParser from "@typescript-eslint/parser"
import vueParser from "vue-eslint-parser"
import prettierConfig from "eslint-config-prettier"

export default [
    {
        ignores: ["**/dist/**", "**/node_modules/**", "**/*.min.js", "**/coverage/**"],
    },
    ...eslintPluginVue.configs["flat/recommended"],
    {
        files: ["**/*.ts", "**/*.tsx", "**/*.vue"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "module",
            parser: vueParser,
            parserOptions: {
                parser: tsParser,
                ecmaVersion: 2023,
                sourceType: "module",
                extraFileExtensions: [".vue"],
            },
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2021,
            },
        },
        linterOptions: {
            reportUnusedDisableDirectives: true,
        },
        plugins: {
            vue: eslintPluginVue,
            "@typescript-eslint": tseslint,
            prettier: eslintPluginPrettier,
            import: eslintPluginImport,
        },
        rules: {
            ...tseslint.configs.recommended.rules,
            ...prettierConfig.rules,

            "no-debugger": "error",
            "prettier/prettier": [
                "warn",
                {
                    tabWidth: 4,
                    printWidth: 120,
                    endOfLine: "auto",
                    trailingComma: "es5",
                },
            ],
            "eol-last": "off",
            "max-lines": ["warn", { max: 500, skipComments: true, skipBlankLines: true }],

            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "no-empty-function": "off",
            "@typescript-eslint/no-empty-function": "off",
            "@typescript-eslint/no-unused-vars":
                process.env.NODE_ENV === "production" ? "off" : ["warn", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/no-non-null-assertion": process.env.NODE_ENV === "production" ? "off" : "warn",

            "vue/component-name-in-template-casing": ["error", "kebab-case", { registeredComponentsOnly: false }],
            "vue/v-on-event-hyphenation": ["error", "always", { ignore: ["update:value", "update:modelValue"] }],
            "vue/custom-event-name-casing": ["error", "kebab-case", { ignores: ["update:value", "update:modelValue"] }],
            "vue/multi-word-component-names": "off",

            "vue/require-default-prop": "off",
            "vue/no-template-shadow": "error",
            "vue/component-definition-name-casing": "error",

            "no-dupe-keys": "error",
            "no-unsafe-optional-chaining": "error",
            "vue/valid-v-slot": "error",
            "vue/require-valid-default-prop": "error",
            "vue/no-unused-components": "error",
            "vue/valid-v-on": "error",
            "vue/require-explicit-emits": "warn",
            "vue/valid-attribute-name": "error",
            "vue/valid-v-model": "error",

            "vue/require-v-for-key": "error",
            "vue/no-use-v-if-with-v-for": "error",

            "vue/no-undef-components": ["error", { ignorePatterns: ["v-*"] }],
            "no-undef": "error",

            "vue/prefer-import-from-vue": "error",

            "vue/prefer-separate-static-class": "warn",
            "vue/no-potential-component-option-typo": "warn",
            "vue/no-useless-mustaches": "warn",
            "vue/no-useless-v-bind": "warn",
            "vue/prefer-template": "warn",
            "vue/require-component-is": "error",
            "vue/no-lone-template": "error",
            "vue/one-component-per-file": "error",

            "import/no-duplicates": "error",
        },
    },
    {
        files: ["**/*.spec.ts", "**/*.test.ts", "**/__tests__/**/*.ts"],
        rules: {
            "max-lines": "off",
        },
    },
]
