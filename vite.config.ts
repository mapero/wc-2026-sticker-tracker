import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

// Served from https://ryandeering.github.io/wc-2026-sticker-tracker/ (a GitHub
// project page), so production assets need that sub-path base. Dev stays at "/".
export default defineConfig(({ command }) => ({
    base: command === "build" ? "/wc-2026-sticker-tracker/" : "/",
    plugins: [vue()],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    server: {
        port: 5173,
        open: true,
    },
}));
