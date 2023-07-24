<script setup>
import { useAppStore } from "../store/appStore";
import { useRouter, useRoute } from "vue-router";
import LocalImage from "../components/LocalImage.vue";
import { ref, computed } from "vue";

const router = useRouter();

const store = useAppStore();

// Get object type name from route
const route = useRoute();
const objectTypeName = route.params.objectType;

// Get object type from store
const objectType =
  store.$state.project.projectData.objectTypesByName.get(objectTypeName);

const imageUrl = ref(null);

const animations = computed(() => {
  if (objectType.properties && objectType.properties.animations) {
    let anims = [];

    const pushAnims = (animations) => {
      anims.push(...animations.items);
      if (animations.subfolders) {
        animations.subfolders.forEach((subfolder) => {
          pushAnims(subfolder);
        });
      }
    };

    pushAnims(objectType.properties.animations);

    return anims;
  } else {
    return [];
  }
});

const selectedAnimation = ref(0);
const selectedFrame = ref(0);

if (!objectType) {
  router.push({ path: "/project/home" });
}

function selectAnimation(animation) {
  selectedAnimation.value = animations.value.findIndex(
    (a) => a.name === animation.name
  );
}
</script>

<template>
  <div
    class="flex h-full flex-column align-items-center justify-content-center w-full"
    v-if="objectType.properties && objectType.properties.image"
  >
    <LocalImage :src="imageUrl" :width="500" :height="500" />
  </div>
  <div
    class="flex h-full align-items-center justify-content-center w-full"
    v-else-if="objectType.properties && objectType.properties.animations"
  >
    <div class="flex flex-column h-full" style="flex: 8">
      <div
        class="flex w-full align-items-center justify-content-center"
        style="flex: 1"
      >
        <LocalImage
          v-if="animations && animations[selectedAnimation]"
          :src="animations[selectedAnimation].frames[selectedFrame].src"
          :width="500"
          :height="500"
          :key="selectedAnimation + '-' + selectedFrame"
        />
      </div>
      <div
        class="flex flex-row w-full"
        style="
          height: 150px;
          background: #2a323d;
          border: 1px solid #3f4b5b;
          border-radius: 4px;
        "
      >
        <div
          class="flex"
          style="overflow-x: auto"
          v-if="animations && animations[selectedAnimation]"
        >
          <div
            v-for="(frame, i) of animations[selectedAnimation].frames"
            :key="frame.sid"
            class="flex flex-column align-items-center justify-content-center"
            @click="selectedFrame = i"
            :style="selectedFrame === i ? 'background: #3f4b5b' : ''"
          >
            <LocalImage :src="frame.src" :width="100" :height="100" />
            {{ i }}
          </div>
        </div>
      </div>
    </div>
    <div
      class="flex flex-column h-full align-items-center justify-content-center"
      style="width: 210px"
    >
      <div
        class="flex w-full justify-content-center"
        style="
          background: #2a323d;
          border: 1px solid #3f4b5b;
          border-radius: 4px;
          flex: 3;
        "
      >
        <Menu
          :model="animations"
          style="width: 100%; background: none; border: none"
        >
          <template #start> Animations </template>
          <template #item="{ item }">
            <a
              class="p-menuitem-link"
              :style="
                animations[selectedAnimation].name === item.name
                  ? 'background: #3f4b5b'
                  : ''
              "
              @click="
                () => {
                  selectAnimation(item);
                }
              "
            >
              <span class="p-menuitem-text">
                {{ item.name }}
              </span>
            </a>
          </template>
        </Menu>
      </div>
      <div
        class="flex w-full justify-content-center"
        style="
          background: #2a323d;
          border: 1px solid #3f4b5b;
          border-radius: 4px;
          flex: 2;
        "
      ></div>
    </div>
  </div>
  <div
    class="flex h-full flex-column align-items-center justify-content-center w-full"
    v-else
  >
    Nothing to see for {{ objectTypeName }}
  </div>
</template>

<style scoped></style>
