<script setup>
import { useAppStore } from "../store/appStore";
import { useRoute, useRouter } from "vue-router"; // Corrected import
import { ref, onMounted, computed, watch } from "vue";
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Checkbox from 'primevue/checkbox';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';
import InputText from 'primevue/inputtext';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import Tooltip from 'primevue/tooltip';

const store = useAppStore();
const route = useRoute();
const router = useRouter();

const layoutName = ref(route.params.layoutName);
const layoutFilePath = ref(route.query.filePath);

const isLoadingInstances = ref(false);
const allSelectedInView = ref(false);

const isSetReplicaDialogVisible = ref(false);
const selectedTargetTemplateName = ref(null); 

const instanceFilterText = ref('');
const filteredInstances = ref([]);

const projectTemplatesForDropdown = computed(() => {
    if (!store.project?.projectData?.projectTemplates) return [];
    return store.project.projectData.projectTemplates.map(t => ({
        label: `${t.name} (Type: ${t.object_type}, Layout: ${t.defined_in_layout_name})`,
        value: t.name, 
    })).sort((a,b) => a.label.localeCompare(b.label));
});

function applyInstanceFilter() {
    const allInstances = store.currentLayoutInstances;
    if (!instanceFilterText.value) {
        filteredInstances.value = [...allInstances];
    } else {
        const lowerFilter = instanceFilterText.value.toLowerCase();
        filteredInstances.value = allInstances.filter(inst =>
            inst.uid.toString().includes(lowerFilter) ||
            inst.object_type_name.toLowerCase().includes(lowerFilter) ||
            (inst.template_or_source_name && inst.template_or_source_name.toLowerCase().includes(lowerFilter))
        );
    }
    updateAllSelectedInViewState();
}

watch(() => store.currentLayoutInstances, () => {
    applyInstanceFilter();
    store.selectedInstancesForReplica.clear(); 
    allSelectedInView.value = false;
}, { deep: true });

watch(instanceFilterText, applyInstanceFilter);

onMounted(async () => {
  if (layoutFilePath.value) {
    isLoadingInstances.value = true;
    try {
        await store.fetchLayoutInstances(layoutFilePath.value);
    } catch (e) {
        console.error("Error onMounted fetching layout instances:", e);
    } finally {
        isLoadingInstances.value = false;
    }
  } else {
    console.error("Layout file path is missing from route query for LayoutDetail.");
  }
  if (store.projectOpened && store.project.path && store.project.projectData.projectTemplates.length === 0) {
    await store.fetchProjectTemplates();
  }
});

watch(() => route.query.filePath, async (newPath) => {
    if (newPath && newPath !== layoutFilePath.value) {
        layoutFilePath.value = newPath;
        layoutName.value = route.params.layoutName;
        isLoadingInstances.value = true;
        try { 
            await store.fetchLayoutInstances(newPath);
            instanceFilterText.value = ''; 
        } catch (e) {
            console.error("Error in watcher fetching layout instances:", e);
        } finally {
            isLoadingInstances.value = false;
        }
    }
}, { immediate: false });


function updateAllSelectedInViewState() {
    if (filteredInstances.value.length > 0 &&
        filteredInstances.value.every(inst => store.selectedInstancesForReplica.has(inst.uid))) {
        allSelectedInView.value = true;
    } else {
        allSelectedInView.value = false;
    }
}

watch(() => store.selectedInstancesForReplica, updateAllSelectedInViewState, {deep: true});


function toggleSelectAllInView(eventValue) {
    const isChecked = typeof eventValue === 'boolean' ? eventValue : eventValue.checked;
    store.selectAllInstancesForReplica(isChecked, filteredInstances.value);
}

function isInstanceSelected(instanceUid) {
    return store.selectedInstancesForReplica.has(instanceUid);
}

function toggleInstanceSelection(instanceUid) {
    store.toggleInstanceSelectionForReplica(instanceUid);
}

function openSetReplicaDialog() {
    if (store.selectedInstancesForReplica.size > 0) {
        selectedTargetTemplateName.value = null;
        if (store.project.projectData.projectTemplates.length === 0) {
            store.logError("No templates found. In C3, set an instance's 'Template' property to 'Yes' and give it a 'Template name'. Then re-open project.");
            return;
        }
        isSetReplicaDialogVisible.value = true;
    }
}

async function confirmSetReplicas() {
  if (layoutFilePath.value && selectedTargetTemplateName.value) { // Ensure selectedTargetTemplateName.value is used for the string
    await store.applySetReplicas(layoutFilePath.value, selectedTargetTemplateName.value);
    isSetReplicaDialogVisible.value = false;
    selectedTargetTemplateName.value = null;
  } else {
    store.logError("Layout file path or target template not selected.");
  }
}

const instanceStatus = (instance) => {
    if (instance.is_template) return `TEMPLATE: ${instance.template_or_source_name || 'Unnamed'}`;
    if (instance.is_replica) return `Replica of: ${instance.template_or_source_name || 'Unknown'}`;
    return 'Normal';
};

const noTemplatesDefined = computed(() => store.project.projectData.projectTemplates.length === 0);
const noInstancesSelected = computed(() => store.selectedInstancesForReplica.size === 0);

const replicaButtonTooltip = computed(() => {
    if (noTemplatesDefined.value) return 'No templates defined. In C3, set an instance\'s "Template" property to "Yes" and give it a "Template name", then re-open the project.';
    if (noInstancesSelected.value) return 'Select instances first.';
    return 'Set selected instances as replicas of a chosen template.';
});

</script>

<template>
  <div class="flex flex-column w-full h-full p-3">
    <Dialog header="Select Target Template" v-model:visible="isSetReplicaDialogVisible" modal :style="{width: '50vw'}">
        <div class="p-fluid">
            <div class="field">
                <label for="targetTemplate" class="mb-2">Choose a template to make selected instances replicas of:</label>
                <Dropdown id="targetTemplate" v-model="selectedTargetTemplateName" :options="projectTemplatesForDropdown"
                          optionLabel="label" optionValue="value" placeholder="Select a Template" filter style="width:100%;" />
                <small v-if="projectTemplatesForDropdown.length === 0 && !store.loading" class="p-error mt-1">
                    No templates defined in this project. In Construct 3, set an instance's 'Template' property to 'Yes' and give it a 'Template name'. Then re-open project here.
                </small>
            </div>
        </div>
        <template #footer>
            <Button label="Cancel" icon="pi pi-times" @click="isSetReplicaDialogVisible = false" class="p-button-text"/>
            <Button label="Confirm" icon="pi pi-check" @click="confirmSetReplicas" :disabled="!selectedTargetTemplateName || store.loading || noTemplatesDefined" autofocus />
        </template>
    </Dialog>

    <div v-if="!layoutFilePath && !isLoadingInstances" class="text-center p-5">
        Please select a layout from the list to view its instances.
    </div>
    <div v-else-if="isLoadingInstances" class="flex justify-content-center align-items-center h-full">
      <ProgressSpinner />
    </div>
    <div v-else-if="store.currentLayoutInstances.length === 0 && !store.loading" class="flex justify-content-center align-items-center h-full">
      No instances found in this layout or failed to load. Check console for errors.
    </div>
    <div v-else class="flex flex-column h-full">
      <div class="mb-3 flex justify-content-between align-items-center flex-wrap">
        <h2 class="mb-2 mr-3 white-space-nowrap p-text-secondary">Instances in {{ layoutName }}</h2>
        <InputText v-model="instanceFilterText" placeholder="Filter by UID, Type, Template..." class="mb-2" style="margin-left: auto; margin-right: 1rem; min-width: 200px; flex-grow: 1; max-width: 300px;"/>
        <Button
          label="Set as Replicas..."
          icon="pi pi-copy"
          @click="openSetReplicaDialog"
          :disabled="noInstancesSelected || noTemplatesDefined || store.loading"
          v-tooltip.bottom="replicaButtonTooltip"
          class="mb-2"
        />
      </div>
      <div class="flex-grow-1" style="overflow: hidden;">
        <DataTable :value="filteredInstances" responsiveLayout="scroll" scrollable scrollHeight="flex" class="p-datatable-sm" style="height: 100%;">
          <Column style="width: 3.5rem; flex-grow:0; flex-basis: auto;">
              <template #header>
                  <Checkbox @update:modelValue="toggleSelectAllInView" v-model="allSelectedInView" :binary="true" :disabled="filteredInstances.length === 0"/>
              </template>
              <template #body="slotProps">
                  <Checkbox :modelValue="isInstanceSelected(slotProps.data.uid)" @update:modelValue="toggleInstanceSelection(slotProps.data.uid)" :binary="true" />
              </template>
          </Column>
          <Column field="uid" header="UID" sortable style="min-width: 80px;"></Column>
          <Column field="object_type_name" header="Object Type" sortable style="min-width: 150px;"></Column>
          <Column header="Status" sortable :sortMethod="({data, field, order}) => data.sort((a,b) => instanceStatus(a).localeCompare(instanceStatus(b)) * order)" style="min-width: 200px;">
              <template #body="slotProps">
                  {{ instanceStatus(slotProps.data) }}
              </template>
          </Column>
          <Column field="x" header="X" sortable style="min-width: 80px;">
            <template #body="slotProps">{{ parseFloat(slotProps.data.x).toFixed(1) }}</template>
          </Column>
          <Column field="y" header="Y" sortable style="min-width: 80px;">
            <template #body="slotProps">{{ parseFloat(slotProps.data.y).toFixed(1) }}</template>
          </Column>
        </DataTable>
      </div>
    </div>
      <div v-if="store.projectLoadingMessage && !store.loading && (store.projectLoadingMessage.includes('Successfully') || store.projectLoadingMessage.includes('Error') || store.projectLoadingMessage.includes('Warning'))" class="p-2 border-round text-white fixed bottom-0 right-0 mb-4 mr-4 z-5"
        :class="{'bg-green-500': store.projectLoadingMessage.includes('Successfully'), 'bg-red-500': store.projectLoadingMessage.includes('Error') || store.projectLoadingMessage.includes('Warning')}">
        {{ store.projectLoadingMessage }}
    </div>
  </div>
</template>

<style scoped>
.p-datatable-sm {
  font-size: 0.875rem;
}
:deep(.p-datatable-scrollable-wrapper) {
    flex-grow: 1; /* Important for scrollHeight="flex" to work */
    height: 100%;
}
.p-datatable .p-datatable-tbody > tr > td,
.p-datatable .p-datatable-thead > tr > th {
    padding: 0.4rem 0.6rem;
}
.field label {
    display: block;
    margin-bottom: .5rem;
}
/* Allow tooltip on disabled buttons */
:deep(.p-button.p-disabled[role="button"]) {
    pointer-events: auto !important;
}
</style>