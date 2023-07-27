import * as _Jimp from "jimp/browser/lib/jimp.js";
const Jimp = typeof self !== "undefined" ? self.Jimp || _Jimp : _Jimp;
import urlFromFile from "./urlFromFile";
import fs from "../../tauriFsProvider.js";
import { invoke } from "@tauri-apps/api/tauri";

export function properSizeFormat(sizeParam) {
  const size = { width: sizeParam.width, height: sizeParam.height };
  if (sizeParam.autoWidth) size.width = "auto";
  if (sizeParam.autoHeight) size.height = "auto";

  if (typeof size.width === "number") size.width.toString();
  if (typeof size.height === "number") size.height.toString();
  return size;
}

export function isSizeValid(size) {
  if (size.width === "auto" && size.height === "auto") {
    return false;
  }
  return true;
}

export function getSize(sizeParam, img) {
  const size = {};
  if (typeof sizeParam.width === "number") {
    size.width = sizeParam.width;
  } else if (sizeParam.width.endsWith("%")) {
    size.width = img.bitmap.width * (parseInt(sizeParam.width) / 100);
  } else if (sizeParam.width === "auto") {
    size.width = Jimp.AUTO;
  } else {
    size.width = parseInt(sizeParam.width);
  }

  if (typeof sizeParam.height === "number") {
    size.height = sizeParam.height;
  } else if (sizeParam.height.endsWith("%")) {
    size.height = img.bitmap.height * (parseInt(sizeParam.height) / 100);
  } else if (sizeParam.height === "auto") {
    size.height = Jimp.AUTO;
  } else {
    size.height = parseInt(sizeParam.height);
  }

  if (size.width === Jimp.AUTO) {
    size.width = img.bitmap.width * (size.height / img.bitmap.height);
  }

  if (size.height === Jimp.AUTO) {
    size.height = img.bitmap.height * (size.width / img.bitmap.width);
  }

  return size;
}

export async function getImageBitmap(imagePath) {
  const img = await Jimp.read(await urlFromFile(imagePath));
  return img.bitmap;
}

export async function getImageSize(imagePath) {
  try {
    const bytes = await fs.readBinaryFile(imagePath);
    // The width and height are stored in bytes 16-20 and 20-24 of the PNG file
    const width = new DataView(bytes.buffer).getUint32(16);
    const height = new DataView(bytes.buffer).getUint32(20);

    return { width, height };
  } catch (error) {
    console.error("Error reading file stats:", error);
  }
}

export async function getImageSizeRust(imagePath) {
  try {
    const res = await invoke("read_png_dimensions", {
      filePath: imagePath,
    });
    return { width: res[0], height: res[1] };
  } catch (error) {
    console.error("Error reading file stats:", error);
  }
}
