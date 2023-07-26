<script setup>
import urlFromFile from "../libraries/jimp/utils/urlFromFile";
import { ref, watch, toRef } from "vue";
const props = defineProps({
  src: String,
  alt: String,
  width: {
    type: Number,
    default: 100,
  },
  height: {
    type: Number,
    default: 100,
  },
});

const imageUrl = ref(null);

const src = toRef(props, "src");

// watch src prop
watch(
  src,
  (newSrc) => {
    if (newSrc === null) {
      imageUrl.value = null;
      return;
    }
    urlFromFile(newSrc).then((url) => {
      imageUrl.value = url;
    });
  },
  { immediate: true }
);
</script>

<template>
  <img
    v-if="imageUrl !== null"
    :src="imageUrl"
    :alt="alt"
    :width="width"
    :height="height"
    style="object-fit: contain; max-width: 90%; max-height: 90%"
  />
  <div
    v-else
    :style="`width: ${width}; height: ${height}; max-width: 90%; max-height: 90%`"
  >
    <ProgressSpinner />
  </div>
</template>
