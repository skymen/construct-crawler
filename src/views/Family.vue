<script setup>
import { useAppStore } from "../store/appStore";
import { useRouter, useRoute } from "vue-router";
import { ref, computed } from "vue";
import actions from "../libraries/jimp/actions";
import {
  moveBehaviorFromFamilyToMembers,
  moveBehaviorFromMembersToFamily,
} from "../libraries/behavior/utils";

const router = useRouter();

const store = useAppStore();

// Get object type name from route
const route = useRoute();
const familyName = route.params.family;

// Get object type from store
const family = store.$state.project.projectData.familiesByName.get(familyName);

if (!family) {
  router.push({ path: "/project/home" });
}

const members = family.properties.members.map((member) => {
  return store.$state.project.projectData.objectTypesByName.get(member);
});

let familyBehaviors = ref([]);
let membersBehaviors = ref([]);

function updateBehaviors() {
  familyBehaviors.value = family.properties.behaviorTypes;
  const membersBehaviorsByName = {};
  // Get behaviors for each member and histogram them
  members.forEach((member) => {
    member.properties.behaviorTypes.forEach((behavior) => {
      if (!membersBehaviorsByName[behavior.name]) {
        membersBehaviorsByName[behavior.name] = {
          name: behavior.name,
          behaviorId: behavior.behaviorId,
          members: [],
        };
      }
      membersBehaviorsByName[behavior.name].members.push(member);
    });
  });

  membersBehaviors.value = Object.values(membersBehaviorsByName);
}

function moveBehaviorToMembers(behavior) {
  moveBehaviorFromFamilyToMembers(family, members, behavior.name).then(() => {
    updateBehaviors();
  });
}

function moveBehaviorToFamily(behavior) {
  moveBehaviorFromMembersToFamily(family, members, behavior.name).then(() => {
    updateBehaviors();
  });
}

updateBehaviors();
</script>

<template>
  <div class="flex w-full h-full flex-row family">
    <div
      class="flex h-full flex-column align-items-center justify-content-center familyColumn"
    >
      <h1>Family members</h1>
      <div
        class="h-full flex align-items-center justify-content-center familyColumnContent"
      >
        <div style="display: block !important; width: 100%">
          <div
            class="flex flex-row flex-wrap align-items-center justify-content-center"
          >
            <div v-for="member of members" class="familyMember">
              {{ member.name }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <div
      class="flex h-full flex-column align-items-center justify-content-center familyColumn"
    >
      <h1>Family behaviors</h1>
      <div
        class="flex h-full flex-column w-full align-items-center justify-content-center familyColumnContent"
      >
        <div style="display: block !important; width: 100%">
          <div
            v-for="behavior of familyBehaviors"
            class="flex flex-row align-items-center justify-content-center familyBehavior"
          >
            <div
              class="flex flex-column align-items-start justify-content-center"
            >
              <span style="margin-right: 8px">{{ behavior.name }}</span>
              <span style="font-size: 0.9em; color: grey">
                ({{ behavior.behaviorId }})
              </span>
            </div>
            <div style="flex: 1"></div>
            <Button @click="moveBehaviorToMembers(behavior)">
              Move to members
            </Button>
          </div>
        </div>
      </div>
    </div>
    <div
      class="flex h-full flex-column align-items-center justify-content-center familyColumn"
    >
      <h1>Members non family behaviors</h1>
      <div
        class="flex h-full w-full flex-column align-items-center justify-content-center familyColumnContent"
      >
        <div style="display: block !important; width: 100%">
          <div
            v-for="behavior of membersBehaviors"
            class="flex flex-column align-items-center justify-content-center familyBehavior"
          >
            <div
              class="flex flex-row w-full align-items-center justify-content-center"
            >
              <div
                class="flex flex-column align-items-start justify-content-center"
              >
                <span style="margin-right: 8px">{{ behavior.name }}</span>
                <span style="font-size: 0.9em; color: grey">
                  ({{ behavior.behaviorId }})
                </span>
                <div
                  class="w-full flex flex-column align items-start justify-items-start"
                  style="text-align: left"
                >
                  <span
                    style="margin-top: 8px; font-size: 0.9em; color: lightgray"
                  >
                    Instances:
                  </span>
                  <div class="flex flex-row flex-wrap">
                    <div
                      v-for="member in behavior.members"
                      class="familyMemberChip"
                    >
                      {{ member.name }}
                    </div>
                  </div>
                </div>
              </div>
              <div style="flex: 1"></div>
              <Button @click="moveBehaviorToFamily(behavior)">
                Move to family
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.family {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica,
    Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
}

.familyColumn {
  border-right: 1px solid #3f4b5b;
  flex: 1;
}

.familyColumn:last-child {
  border-right: none;
}

.familyColumnContent {
  padding: 20px;
  overflow-y: auto;
}

.familyMember {
  background: #2a323d;
  border: 1px solid #3f4b5b;
  border-radius: 4px;
  padding: 4px;
  margin: 4px;
  text-align: center;
}

.familyMemberChip {
  font-size: 0.8em;
  color: lightgray;
  background: #3f4b5b;
  border-radius: 50px;
  padding: 4px;
  padding-left: 12px;
  padding-right: 12px;
  margin: 4px;
  margin-left: -1px;
  text-align: center;
  width: fit-content;
}

.familyBehavior {
  background: #2a323d;
  border: 1px solid #3f4b5b;
  border-radius: 4px;
  padding: 4px;
  margin: 4px;
  text-align: center;
  width: 97%;
}
</style>
