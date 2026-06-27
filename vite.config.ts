import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

// Served from https://ryandeering.github.io/wc-2026-sticker-tracker/ (a GitHub
// project page), so production assets default to that sub-path base. Dev stays
// at "/". Override with VITE_BASE (e.g. "/" for a root-served Docker deploy).
export default defineConfig(({ command }) => ({
    base: process.env.VITE_BASE ?? (command === "build" ? "/wc-2026-sticker-tracker/" : "/"),
    plugins: [vue()],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    server: {
        port: 5173,
        open: true,
        // Forward sync API calls to the local self-hosted backend (server/).
        proxy: {
            "/api": {
                target: process.env.VITE_SYNC_URL || "http://localhost:8787",
                changeOrigin: true,
            },
        },
    },
}));
