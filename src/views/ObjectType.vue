<script setup>
import { useAppStore } from "../store/appStore";
import { useRouter, useRoute } from "vue-router";
import LocalImage from "../components/LocalImage.vue";
import { ref, computed } from "vue";
import actions from "../libraries/jimp/actions";
import { getImageSizeRust } from "../libraries/jimp/utils/sizeUtils";
import { applyAction } from "../libraries/jimp/utils/applyAction";
import { clearUrlMap } from "../libraries/jimp/utils/urlFromFile";

import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import Tooltip from 'primevue/tooltip';

const router = useRouter();

const store = useAppStore();

// Get object type name from route
const route = useRoute();
const objectTypeName = route.params.objectType;

// Get object type from store
const objectType =
  store.$state.project.projectData.objectTypesByName.get(objectTypeName);

const imageUrl = ref(null);

if (objectType.properties && objectType.properties.image) {
  imageUrl.value = objectType.properties.image.src;
}

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
  selectedFrame.value = 0;
}

const selectedAction = ref(actions[0]);

const visible = ref(false);
const params = ref([]);
const applyTo = ref(0);

const applyToOptions = [
  {
    label: "Current frame",
    value: 0,
  },
  {
    label: "Whole animation",
    value: 1,
  },
  {
    label: "All animations",
    value: 2,
  },
];

const loadingAction = ref(false);

async function openActionDialog() {
  params.value = [
    ...(await Promise.all(
      selectedAction.value.params.map(async (param) => {
        let ret = {
          ...param,
        };

        if (param.type === "size") {
          let imgBitmap;
          if (objectType.properties && objectType.properties.image) {
            imgBitmap = await getImageSizeRust(imageUrl.value);
          } else if (
            objectType.properties &&
            objectType.properties.animations
          ) {
            imgBitmap = await getImageSizeRust(
              animations.value[selectedAnimation.value].frames[
                selectedFrame.value
              ].src
            );
          }

          if (imgBitmap) {
            ret.value = {
              width: imgBitmap.width,
              autoWidth: false,
              height: imgBitmap.height,
              autoHeight: false,
            };
          }
        } else if (param.type === "combo") {
          ret.value = 0;
          ret.options = param.options.map((option, i) => {
            return {
              label: option,
              value: i,
            };
          });
        } else if (param.type === "number") {
          ret.value = 0;
          if (param.value) {
            ret.value = param.value;
          }
        }

        return ret;
      })
    )),
  ];
  applyTo.value = 0;
  visible.value = true;
  loadComboSelections();
}

function saveComboSelections() {
  params.value.forEach((param, i) => {
    if (param.type === "combo") {
      let key = `${selectedAction.value.name}/${param.name}-${i}`;
      localStorage.setItem(key, param.value);
    }
  });

  localStorage.setItem(`${selectedAction.value.name}/applyTo`, applyTo.value);
}

function loadComboSelections() {
  params.value.forEach((param, i) => {
    if (param.type === "combo") {
      let key = `${selectedAction.value.name}/${param.name}-${i}`;
      let value = localStorage.getItem(key);
      if (value) {
        value = parseInt(value);
        if (value >= 0 && value < param.options.length) {
          param.value = value;
        }
      }
    }
  });

  let applyToValue = localStorage.getItem(
    `${selectedAction.value.name}/applyTo`
  );
  if (applyToValue) {
    applyToValue = parseInt(applyToValue);
    if (applyToValue >= 0 && applyToValue < applyToOptions.length) {
      applyTo.value = applyToValue;
    }
  }
}

async function executeAction() {
  loadingAction.value = true;
  saveComboSelections();
  const paths = await applyAction(
    selectedAction.value.function,
    JSON.parse(JSON.stringify(params.value)),
    applyTo.value,
    objectType,
    selectedAnimation.value,
    selectedFrame.value
  );
  clearUrlMap(paths);
  loadingAction.value = false;
  visible.value = false;
}

function onSelect(event, param) {
  param.value = event.files;
}

const isLoadingProjectWideAction = ref(false);
const isProjectWideSetReplicaDialogVisible = ref(false);
const selectedProjectWideTargetTemplateName = ref(null);

// Computed property for templates suitable for the current object type
// For now, lists all templates. User needs to pick a C3-compatible one.
// A more advanced filter would check if template's object_type is the same as objectType.name 
// or if objectType.name is in the family of the template's object_type.
const projectTemplatesForObjectTypeDropdown = computed(() => {
    if (!store.project?.projectData?.projectTemplates) return [];
    return store.project.projectData.projectTemplates
        .map(t => ({
            label: `${t.name} (Type: ${t.object_type}, Layout: ${t.defined_in_layout_name})`,
            value: t.name, // Store the template name as the value
        }))
        .sort((a,b) => a.label.localeCompare(b.label));
});

const noTemplatesDefinedInProject = computed(() => store.project?.projectData?.projectTemplates?.length === 0);

const projectWideReplicaButtonTooltip = computed(() => {
  if (noTemplatesDefinedInProject.value) return `No templates defined anywhere in the project. In C3, set an instance's "Template" property to "Yes" and give it a "Template name", then re-open the project.`;
  return `Set all instances of '${objectTypeName}' in the entire project as replicas of a chosen template.`;
});

function openProjectWideSetReplicaDialog() {
    if (store.project.projectData.projectTemplates.length === 0) {
        store.logError("No templates found in the project. In C3, set an instance's 'Template' property to 'Yes' and give it a 'Template name'. Then re-open project.");
        // Optionally, you could show an informational message in the UI too
        return;
    }
    selectedProjectWideTargetTemplateName.value = null; // Reset selection
    isProjectWideSetReplicaDialogVisible.value = true;
}

async function confirmProjectWideSetReplicas() {
    if (!objectTypeName || !selectedProjectWideTargetTemplateName.value) {
        store.logError("Object type name or target template name is missing for project-wide action.");
        return;
    }
    isLoadingProjectWideAction.value = true; // Use a specific loading flag if needed
    await store.setAllInstancesOfTypeAsReplicasProjectWide(objectTypeName, selectedProjectWideTargetTemplateName.value);
    isLoadingProjectWideAction.value = false;
    isProjectWideSetReplicaDialogVisible.value = false;
}
</script>

<template>
  <div class="flex w-full h-full flex-column">
    <div
      class="flex w-full align-items-center justify-content-center"
      style="
        height: 40px;
        background: #2a323d;
        border: 1px solid #3f4b5b;
        border-radius: 4px;
      "
      v-if="
        objectType.properties &&
        (objectType.properties.image || objectType.properties.animations)
      "
    >
      <Dialog
        v-model:visible="visible"
        modal
        :closable="false"
        :draggable="false"
        position="top"
        style="
          max-width: 70vw;
          width: 800px;
          background: #2a323d;
          border: 1px solid #3f4b5b;
          border-radius: 4px;
        "
      >
        <template #header>
          <div class="flex flex-column">
            <h3 style="margin: 0">{{ selectedAction.name }}</h3>
            <p
              style="
                margin-top: 5px;
                margin-bottom: 0px;
                font-size: small;
                font-style: italic;
              "
            >
              {{ selectedAction.description }}
            </p>
          </div>
        </template>
        <div
          v-for="(param, i) of params"
          :key="param.name"
          :style="`border: 1px solid #ddd;
        border-radius: 3px;
        padding: 10px;
        ${i !== 0 ? 'margin-top: 17px;' : 'margin-top: 3px;'}`"
        >
          <div
            style="
              transform: translateY(-22.5px);
              margin-bottom: -22.5px;
              background: #2a323d;
              padding: 0 5px;
              width: fit-content;
            "
          >
            {{ param.name }}
          </div>
          <p
            style="
              margin-top: 5px;
              margin-bottom: 10px;
              font-size: small;
              font-style: italic;
            "
          >
            {{ param.description }}
          </p>
          <div v-if="param.type === 'size'" class="flex flex-column">
            <div class="flex flex-row">
              <span class="flex align-items-center">
                <div
                  for="height"
                  style="margin-right: 5px; width: 50px !important"
                >
                  Width:
                </div>
                <InputText
                  id="width"
                  v-model="param.value.width"
                  :disabled="param.value.autoWidth"
                />
              </span>
              <div
                class=""
                style="
                  background: #ddd;
                  width: 1px;
                  margin-left: 6px;
                  margin-right: 5px;
                  opacity: 0.4;
                "
              ></div>
              <div class="flex align-items-center" style="">
                <Checkbox
                  v-model="param.value.autoWidth"
                  :disabled="param.value.autoHeight"
                  inputId="autoWidth"
                  :binary="true"
                />
                <label for="autoWidth" class="ml-2"> Auto </label>
              </div>
            </div>
            <div
              class="w-full"
              style="
                background: #ddd;
                height: 1px;
                margin-top: 6px;
                margin-bottom: 5px;
                opacity: 0.4;
              "
            ></div>
            <div class="flex flex-row">
              <span class="flex align-items-center">
                <div
                  for="height"
                  style="margin-right: 5px; width: 50px !important"
                >
                  Height:
                </div>
                <InputText
                  id="height"
                  v-model="param.value.height"
                  :disabled="param.value.autoHeight"
                />
              </span>

              <div
                class=""
                style="
                  background: #ddd;
                  width: 1px;
                  margin-left: 6px;
                  margin-right: 5px;
                  opacity: 0.4;
                "
              ></div>
              <div class="flex align-items-center">
                <Checkbox
                  v-model="param.value.autoHeight"
                  :disabled="param.value.autoWidth"
                  inputId="autoHeight"
                  :binary="true"
                />
                <label for="autoHeight" class="ml-2"> Auto </label>
              </div>
            </div>
          </div>
          <div v-else-if="param.type === 'combo'" class="flex flex-column">
            <Dropdown
              v-model="param.value"
              :options="param.options"
              optionLabel="label"
              optionValue="value"
            />
          </div>
          <div v-else-if="param.type === 'number'" class="flex flex-column">
            <InputNumber v-model="param.value" inputId="integeronly" />
          </div>
          <div v-else-if="param.type === 'file'" class="flex flex-column">
            <FileUpload
              :mode="param.options.advanced ? 'advanced' : 'basic'"
              :accept="param.options.accept"
              :multiple="param.options.multiple"
              :invalidFileTypeMessage="param.options.invalidFileTypeMessage"
              :fileLimit="param.options.fileLimit"
              :chooseLabel="param.options.label"
              @select="onSelect($event, param)"
              @remove="onSelect($event, param)"
              :showUploadButton="false"
              :showCancelButton="false"
            />
          </div>
        </div>

        <div
          v-if="objectType.properties && objectType.properties.animations"
          style="margin-top: 20px"
        >
          Apply to:
          <Dropdown
            v-model="applyTo"
            :options="applyToOptions"
            optionLabel="label"
            optionValue="value"
          />
        </div>

        <template #footer>
          <Button
            label="Cancel"
            icon="pi pi-times"
            @click="visible = false"
            text
          />
          <Button
            label="Execute"
            icon="pi pi-check"
            @click="executeAction"
            :loading="loadingAction"
            autofocus
          />
        </template>
      </Dialog>
      <Dialog header="Set All Instances of Type as Replicas (Project-wide)" v-model:visible="isProjectWideSetReplicaDialogVisible" modal :style="{width: '50vw'}">
        <p>
            This will change all instances of <strong>{{ objectTypeName }}</strong> across all layouts in the project
            (that are not already templates themselves) to become replicas of the selected template.
        </p>
        <div class="p-fluid mt-3">
            <div class="field">
                <label for="projectWideTargetTemplate" class="mb-2">Choose a template to make selected instances replicas of:</label>
                <Dropdown id="projectWideTargetTemplate" v-model="selectedProjectWideTargetTemplateName" :options="projectTemplatesForObjectTypeDropdown"
                          optionLabel="label" optionValue="value" placeholder="Select a Template" filter style="width:100%;" />
                <small v-if="noTemplatesDefinedInProject && !store.loading" class="p-error mt-1">
                    No templates defined in this project. In C3, set an instance's 'Template' property to 'Yes' and give it a 'Template name'. Then re-open project here.
                </small>
            </div>
        </div>
        <template #footer>
            <Button label="Cancel" icon="pi pi-times" @click="isProjectWideSetReplicaDialogVisible = false" class="p-button-text"/>
            <Button 
              label="Confirm & Apply to Project" 
              icon="pi pi-check" 
              @click="confirmProjectWideSetReplicas" 
              :disabled="!selectedProjectWideTargetTemplateName || store.loading || isLoadingProjectWideAction || noTemplatesDefinedInProject" 
              autofocus 
            />
        </template>
      </Dialog>
      <Dropdown
        v-model="selectedAction"
        editable
        :options="actions"
        optionLabel="name"
        placeholder="Select an action"
      />
      <Button
        label="Execute"
        class="p-button-success"
        style="margin-left: 10px"
        @click="openActionDialog"
      />
      <Button
          label="Set all to Replica"
          icon="pi pi-globe"
          class="p-button-warning"
          style="margin-left: 10px;"
          @click="openProjectWideSetReplicaDialog"
          :disabled="!objectType || isLoadingProjectWideAction || noTemplatesDefinedInProject"
          v-tooltip.bottom="projectWideReplicaButtonTooltip"
      />
    </div>
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
        <!-- <div
        class="flex w-full justify-content-center"
        style="
          background: #2a323d;
          border: 1px solid #3f4b5b;
          border-radius: 4px;
          flex: 2;
        "
      ></div> -->
      </div>
    </div>
    <div
      class="flex h-full flex-column align-items-center justify-content-center w-full"
      v-else
    >
      Nothing to see for {{ objectTypeName }}
    </div>
  </div>
</template>

<style>
.p-fileupload-file-badge {
  display: none !important;
}
</style>
