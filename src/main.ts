import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { i18n, setupLanguage } from "./plugins/i18n";
import "./styles/theme.css";

async function bootstrap() {
    await setupLanguage(i18n);

    const app = createApp(App);
    app.use(createPinia());
    app.use(router);
    app.use(i18n);
    app.mount("#app");
}

void bootstrap();
