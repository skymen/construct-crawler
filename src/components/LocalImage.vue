<script setup>
import urlFromFile, {
  subscribeToPath,
} from "../libraries/jimp/utils/urlFromFile";
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
const loading = ref(false);

const src = toRef(props, "src");

function updateImageUrl() {
  if (src.value === null) {
    imageUrl.value = null;
    loading.value = false;
    return;
  }
  loading.value = true;
  urlFromFile(src.value).then((url) => {
    imageUrl.value = url;
    loading.value = false;
    subscribeToPath(src.value, () => {
      updateImageUrl();
    });
  });
}

// watch src prop
watch(src, updateImageUrl, { immediate: true });
</script>

<template>
  <img
    v-if="imageUrl !== null && !loading"
    :src="imageUrl"
    :alt="alt"
    :width="width"
    :height="height"
    style="object-fit: contain; max-width: 90%; max-height: 90%"
  />
  <div
    v-else-if="loading"
    :style="`width: ${width}; height: ${height}; max-width: 90%; max-height: 90%`"
  >
    <ProgressSpinner />
  </div>
  <img
    v-else
    src="failedToLoadImage.png"
    :alt="alt"
    :width="width"
    :height="height"
    style="object-fit: contain; max-width: 90%; max-height: 90%"
  />
</template>
