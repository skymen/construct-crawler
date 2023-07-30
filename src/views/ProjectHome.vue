<script setup>
import { useAppStore } from "../store/appStore";
import { useRouter } from "vue-router";

const store = useAppStore();
const router = useRouter();

function openImages() {
  router.push({ path: "/project/object-types" });
}

function openFamilies() {
  router.push({ path: "/project/families" });
}
</script>

<template>
  <div
    class="flex h-full flex-column align-items-center justify-content-center w-full"
  >
    <Button class="btn" @click="openImages"><span>Object Types</span></Button>
    <Button class="btn" @click="openFamilies"><span>Families</span></Button>
  </div>
</template>

<style scoped>
.btn {
  width: 97%;
  margin: 5px;
  text-align: center;
  align-items: center;
  justify-content: center;
}
</style>
