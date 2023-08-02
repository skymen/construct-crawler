<script setup>
import { useAppStore } from "../store/appStore";
const store = useAppStore();
</script>

<template>
  <div class="flex flex-column align-items-center justify-content-center">
    <ProgressSpinner style="width: 50px; height: 50px; margin: 20px" />
    <p
      style="
        margin-top: 4px;
        margin-bottom: 4px;
        white-space: pre-line;
        text-align: center;
      "
    >
      {{ store.$state.projectLoadingMessage }}
    </p>
    <ProgressBar
      :value="store.$state.projectLoadingProgress * 100"
      :showValue="false"
      style="width: 60vw; height: 3px; margin: 5px"
      :pt="{
        value: { style: { transition: 'none !important' } },
      }"
    ></ProgressBar>
  </div>
</template>
