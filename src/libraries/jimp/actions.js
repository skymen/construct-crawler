import resize from "./utils/resize";
import blur from "./utils/fastBlur";
import gaussian from "./utils/gaussian";
import alphaThreshold from "./utils/alphaThreshold";
import replaceImage from "./utils/replaceImage";

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
  {
    name: "Fast Blur",
    function: blur,
    description:
      "Applies a quick blur to the image, similar to gaussian blur but much faster.",
    params: [
      {
        name: "Radius",
        type: "number",
        description: "The radius of the blur.",
      },
    ],
  },
  {
    name: "Gaussian Blur",
    function: gaussian,
    description:
      "Applies a gaussian blur to the image. WARNING: It's very slow.",
    params: [
      {
        name: "Radius",
        type: "number",
        description: "The radius of the blur.",
      },
    ],
  },
  {
    name: "Alpha Threshold",
    function: alphaThreshold,
    description: "Applies an alpha threshold to the image.",
    params: [
      {
        name: "Threshold",
        type: "number",
        description: "The threshold to apply.",
        value: 128,
      },
      {
        name: "Min",
        type: "number",
        description: "The minimum alpha value.",
      },
      {
        name: "Max",
        type: "number",
        description: "The maximum alpha value.",
        value: 255,
      },
    ],
  },
  {
    name: "Replace Image",
    function: replaceImage,
    description: "Replaces the image with another image.",
    params: [
      {
        name: "Image",
        type: "file",
        options: {
          multiple: false,
          accept: "image/*",
          invalidFileTypeMessage: "Only images are allowed.",
          fileLimit: 1,
          label: "Select an image",
          advanced: true,
        },
        description: "The image to replace with.",
      },
    ],
  },
];
