import resize from "./utils/resize";

export default [
  {
    name: "Resize",
    function: resize,
    description: "Resize the image to the specified width and height.",
    params: [
      {
        name: "Size",
        type: "size",
        description:
          "The width to resize the image to. Can be a number, or a percentage string.",
      },
      {
        name: "Mode",
        type: "combo",
        options: ["stretch", "cover", "contain", "alignTopLeft", "alignCenter"],
        description: "The resize mode.",
      },
      {
        name: "Smoothing",
        type: "combo",
        options: ["nearest", "bilinear", "bicubic", "hermite", "bezier"],
        description: "Algorithm to use for smoothing.",
      },
    ],
  },
];
