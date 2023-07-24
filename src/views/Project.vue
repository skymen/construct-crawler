<script setup>
import { useAppStore } from "../store/appStore";
import { useRoute, useRouter } from "vue-router";
import { watch } from "vue";
//import logo from "@/assets/Construct Crawler.png";

const router = useRouter();
const store = useAppStore();
if (!store.$state.projectOpened) {
  router.push({ path: "/" });
}
</script>

<template>
  <div class="flex h-full flex-column">
    <Toolbar style="border-radius: 0; height: 3.9rem">
      <template #start>
        {{ store.$state.project.name }}
      </template>

      <template #end>
        <!-- <Button
          :loading="store.saving"
          icon="pi pi-file-import"
          text
          rounded
          size="small"
          :label="store.pendingChanges ? '*' : ''"
          @click="store.saveStoreToFile"
        /> -->
      </template>
    </Toolbar>
    <router-view v-slot="{ Component }">
      <transition name="slide-y" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<style scoped></style>
