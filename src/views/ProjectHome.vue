<script setup>
import { useAppStore } from "../store/appStore";
import { useRouter } from "vue-router";

const store = useAppStore();
const router = useRouter();

function openImages() {
  router.push({ path: "/project/object-types" });
}
</script>

<template>
  <div class="flex h-full flex-column">
    <Button @click="openImages">Object Types</Button>
  </div>
</template>

<style scoped></style>
