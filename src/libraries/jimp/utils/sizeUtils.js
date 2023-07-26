import * as _Jimp from "jimp/browser/lib/jimp.js";
const Jimp = typeof self !== "undefined" ? self.Jimp || _Jimp : _Jimp;
import urlFromFile from "./urlFromFile";

export function properSizeFormat(sizeParam) {
  const size = { width: sizeParam.width, height: sizeParam.height };
  if (sizeParam.autoWidth) size.width = "auto";
  if (sizeParam.autoHeight) size.height = "auto";
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
  if (sizeParam.width.endsWith("%")) {
    size.width = img.bitmap.width * (parseInt(sizeParam.width) / 100);
  } else if (sizeParam.width === "auto") {
    size.width = Jimp.AUTO;
  } else {
    size.width = parseInt(sizeParam.width);
  }

  if (sizeParam.height.endsWith("%")) {
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

export async function getImageSize(imagePath) {
  const img = await Jimp.read(await urlFromFile(imagePath));
  return img.bitmap;
}
