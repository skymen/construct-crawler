import { createRouter, createWebHistory } from "vue-router";

const routes = [
  {
    path: "/",
    name: "Home",
    component: () => import("../views/Home.vue"),
  },
  {
    path: "/project",
    name: "Project",
    component: () => import("../views/Project.vue"),
    // sub routes
    children: [
      {
        path: "/project/home",
        name: "ProjectHome",
        component: () => import("../views/ProjectHome.vue"),
      },
      {
        path: "/project/object-types",
        name: "ObjectTypes",
        component: () => import("../views/ObjectTypes.vue"),

        children: [
          {
            path: "/project/object-types/:objectType",
            name: "ObjectType",
            component: () => import("../views/ObjectType.vue"),
          },
        ],
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export { routes, router };
