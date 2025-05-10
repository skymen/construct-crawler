<script setup>
import { useAppStore } from "../store/appStore";
import { computed, ref, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import InputText from 'primevue/inputtext';
import Menu from 'primevue/menu';

const router = useRouter();
const store = useAppStore();

const filteredLayouts = ref([]);

function updateFilteredLayouts() {
  const layoutsSource = store.project?.projectData?.layouts || [];
  if (layoutsSource.length > 0) {
    filteredLayouts.value = layoutsSource.filter(
      (layout) =>
        layout.name.toLowerCase().includes(store.layoutSearch.toLowerCase())
    );
  } else {
    filteredLayouts.value = [];
  }
}

function selectLayout(layout) {
  // Ensure filePath (which is 'path' in Rust struct) is passed for uniqueness
  router.push({
    name: "LayoutDetail",
    params: { layoutName: layout.name }, // layout.name is for display
    query: { filePath: layout.path } // layout.path is the relative file path
  });
}

watch(() => store.layoutSearch, updateFilteredLayouts);
watch(() => store.project?.projectData?.layouts, () => {
    updateFilteredLayouts();
    // If project templates are not loaded yet and layouts are, good time to fetch templates
    if (store.project?.projectData?.layouts?.length > 0 && store.project?.projectData?.projectTemplates?.length === 0 && store.projectOpened) {
        store.fetchProjectTemplates();
    }
}, { deep: true, immediate: true });


onMounted(() => {
  updateFilteredLayouts();
   // Fetch templates if project is open but templates aren't loaded (e.g. direct navigation)
  if (store.projectOpened && store.project.path && store.project.projectData.projectTemplates.length === 0) {
    store.fetchProjectTemplates();
  }
});
</script>

<template>
  <div class="flex h-full p-2">
    <div class="flex h-full flex-column" style="width: 230px; margin-right: 10px;">
      <InputText
        v-model="store.layoutSearch"
        placeholder="Search Layouts..."
        style="margin-bottom: 5px;"
        class="w-full"
      />
      <div
        class="flex-grow-1"
        style="
          overflow-y: auto;
          background: #2a323d;
          border: 1px solid #3f4b5b;
          border-radius: 4px;
        "
      >
        <Menu
          :model="filteredLayouts"
          style="width: 100%; background: none; border: none"
          class="w-full"
        >
          <template #item="{ item }">
            <a
              class="p-menuitem-link"
              @click="selectLayout(item)"
              :class="{ 'p-menuitem-link-active': $route.query.filePath === item.path }"
              role="menuitem"
            >
              <span class="p-menuitem-text">
                {{ item.name }}
              </span>
            </a>
          </template>
          <template #end v-if="filteredLayouts.length === 0 && store.projectOpened">
             <div class="p-menuitem-text p-3 text-center">No layouts found.</div>
          </template>
        </Menu>
      </div>
    </div>

    <div class="flex-grow-1 h-full" style="min-width: 0;">
        <router-view v-slot="{ Component }">
          <transition name="slide-y" mode="out-in">
            <component :is="Component" :key="$route.fullPath" />
          </transition>
        </router-view>
    </div>
  </div>
</template>

<style scoped>
.p-menuitem-link-active {
  background-color: #3f4b5b !important;
}
.p-menu .p-menuitem-link {
    padding: 0.75rem 1rem;
}
</style>