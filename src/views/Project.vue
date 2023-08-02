<script setup>
import { useAppStore } from "../store/appStore";
import { useRouter } from "vue-router";
import ProjectProgress from "../components/ProjectProgress.vue";
import { computed } from "vue";
//import logo from "@/assets/Construct Crawler.png";

const router = useRouter();
const store = useAppStore();
if (!store.$state.projectOpened) {
  router.push({ path: "/" });
}

function routeToProjectHome() {
  router.push({ path: "/project/home" });
}

const isOnHome = computed(() => {
  return router.currentRoute.value.path === "/project/home";
});
</script>

<template>
  <div class="flex h-full flex-column">
    <Toolbar style="border-radius: 0; height: 3.9rem; padding: 0rem 1rem">
      <template #start>
        <Button text rounded @click="routeToProjectHome" :disabled="isOnHome">
          {{ store.$state.project.name }}
        </Button>
      </template>

      <template #end>
        <Button :loading="store.loading" text rounded @click="store.saveToFile">
          Save to C3P
        </Button>
      </template>
    </Toolbar>
    <Dialog
      v-model:visible="store.$state.loading"
      modal
      :draggable="false"
      :closable="false"
      position="top"
      style="
        max-width: 70vw;
        width: 800px;
        background: #2a323d;
        border: 1px solid #3f4b5b;
        border-radius: 4px;
      "
    >
      <template #header>
        <div class="flex flex-column">
          <h3 style="margin: 0">Saving</h3>
        </div>
      </template>
      <ProjectProgress />
    </Dialog>
    <div style="height: calc(100vh - 3.9rem) !important">
      <router-view v-slot="{ Component }">
        <transition name="slide-y" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
  </div>
</template>

<style scoped></style>
