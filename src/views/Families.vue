<script setup>
import { useAppStore } from "../store/appStore";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();

const store = useAppStore();

let filteredFamilies = ref([]);

function updateFilteredFamilies() {
  filteredFamilies.value = store.$state.project.projectData.families.filter(
    (ot) =>
      ot === "" ||
      ot.name.toLowerCase().includes(store.$state.familySearch.toLowerCase())
  );
}

function selectFamily(objectType) {
  router.push({
    path: "/project/families/" + objectType.name,
  });
}

updateFilteredFamilies();
</script>

<template>
  <div class="flex h-full">
    <div class="flex h-full flex-column" style="width: 210px">
      <InputText
        v-model="store.$state.familySearch"
        @update:modelValue="updateFilteredFamilies"
        placeholder="Search..."
      />
      <div
        class="flex"
        style="
          overflow-y: auto;
          height: 100%;
          background: #2a323d;
          border: 1px solid #3f4b5b;
          border-radius: 4px;
        "
      >
        <Menu
          :model="filteredFamilies"
          style="width: 100%; background: none; border: none"
        >
          <template #item="{ item }">
            <a
              class="p-menuitem-link"
              @click="
                () => {
                  selectFamily(item);
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
    </div>

    <router-view v-slot="{ Component }">
      <transition name="slide-y" mode="out-in">
        <component :is="Component" :key="$route.fullPath" />
      </transition>
    </router-view>
  </div>
</template>

<style scoped></style>
