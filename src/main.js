import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import PrimeVue from "primevue/config";
import { router } from "./plugins/router.js";
import "primevue/resources/themes/bootstrap4-dark-blue/theme.css";
import "primeflex/primeflex.css";

import Button from "primevue/button";
import Sidebar from "primevue/sidebar";
import Image from "primevue/image";
import Dialog from "primevue/dialog";
import Toolbar from "primevue/toolbar";
import InputText from "primevue/inputtext";
import Menu from "primevue/menu";
import ProgressSpinner from "primevue/progressspinner";

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);
app.use(router);
app.use(PrimeVue);

app.component("Button", Button);
app.component("Sidebar", Sidebar);
app.component("Image", Image);
app.component("Dialog", Dialog);
app.component("Toolbar", Toolbar);
app.component("InputText", InputText);
app.component("Menu", Menu);
app.component("ProgressSpinner", ProgressSpinner);

app.mount("#app");
