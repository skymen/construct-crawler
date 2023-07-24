<script setup>
import fs from "../libraries/tauriFsProvider";
import { ref, computed } from "vue";
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

fs.readBinaryFile(props.src).then((data) => {
  imageUrl.value = URL.createObjectURL(new Blob([data]));
});
</script>

<template>
  <img
    :src="imageUrl"
    :alt="alt"
    :width="width"
    :height="height"
    style="object-fit: contain; max-width: 90%; max-height: 90%"
  />
</template>
