import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
    {
        path: "/",
        name: "album",
        component: () => import("@/views/AlbumView.vue"),
        meta: { title: "album" },
    },
    {
        path: "/album/:section",
        name: "section",
        component: () => import("@/views/AlbumView.vue"),
        props: true,
        meta: { title: "album" },
    },
    {
        path: "/add",
        name: "add",
        component: () => import("@/views/QuickAddView.vue"),
        meta: { title: "quick-add" },
    },
    {
        path: "/checklist",
        name: "checklist",
        component: () => import("@/views/ChecklistView.vue"),
        meta: { title: "checklist" },
    },
    {
        path: "/trade",
        name: "trade",
        component: () => import("@/views/SwapView.vue"),
        meta: { title: "trade" },
    },
    {
        path: "/needs",
        name: "needs",
        component: () => import("@/views/NeedsView.vue"),
        meta: { title: "needs-swaps-backup" },
    },
];

const router = createRouter({
    history: createWebHashHistory(),
    routes,
    scrollBehavior() {
        return { top: 0 };
    },
});

export default router;
