import { createRouter, createWebHashHistory } from "vue-router";
import Home from "../views/Home.vue";
import Project from "../views/Project.vue";
import ProjectHome from "../views/ProjectHome.vue";
import ObjectTypes from "../views/ObjectTypes.vue";
import ObjectType from "../views/ObjectType.vue";
import Families from "../views/Families.vue";
import Family from "../views/Family.vue";

// Import new views
import Layouts from "../views/Layouts.vue";
import LayoutDetail from "../views/LayoutDetail.vue";

const routes = [
  { path: "/", name: "Home", component: Home },
  {
    path: "/project",
    name: "Project",
    component: Project,
    children: [
      { path: "home", name: "ProjectHome", component: ProjectHome },
      {
        path: "object-types",
        name: "ObjectTypes",
        component: ObjectTypes,
        children: [
          { path: ":objectType", name: "ObjectType", component: ObjectType },
        ],
      },
      {
        path: "families",
        name: "Families",
        component: Families,
        children: [
          { path: ":family", name: "Family", component: Family },
        ],
      },
      {
        path: "layouts",
        name: "Layouts", // Give a name to the parent route for layouts
        component: Layouts,
        children: [
          {
            path: ":layoutName", // Using layoutName as param, ensure it's unique or use filePath
            name: "LayoutDetail",
            component: LayoutDetail,
            props: true // Pass route params (layoutName) and query (filePath) as props
          }
        ]
      },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(), // Recommended for Tauri
  routes,
});

export { routes, router };