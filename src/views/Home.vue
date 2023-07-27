<script setup>
import { useAppStore } from "../store/appStore";
import { useRouter } from "vue-router";
//import logo from "@/assets/Construct Crawler.png";

const router = useRouter();
const store = useAppStore();

if (store.$state.projectOpened) {
  router.push({ path: "/project/home" });
}
</script>

<template>
  <div
    class="flex align-items-center justify-content-center h-full flex-column"
  >
    <h1 class="text-center title">Construct Crawler</h1>
    <img class="logo" src="/crawler.svg" />
    <div
      class="flex align-items-center justify-content-center"
      v-if="!store.$state.loading"
    >
      <Button class="homeButton" @click="store.openC3Project"
        >Open C3 Project</Button
      >
      <Button class="homeButton" @click="store.openC3File">Open C3 File</Button>
    </div>
    <div
      v-else
      class="flex flex-column align-items-center justify-content-center"
    >
      <ProgressSpinner style="width: 50px; height: 50px; margin: 20px" />
      <p>{{ store.$state.projectLoadingMessage }}</p>
      <ProgressBar
        :value="store.$state.projectLoadingProgress * 100"
        :showValue="false"
        style="width: 60vw; height: 3px; margin: 5px"
      ></ProgressBar>
    </div>
  </div>
</template>

<style scoped>
.homeButton {
  min-width: 200px;
  width: 50%;
  margin: 5px;
  text-align: center;
}

.logo {
  max-width: 40%;
  width: 500px;
  aspect-ratio: 1/1;
}

.title {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica,
    Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
}
</style>
