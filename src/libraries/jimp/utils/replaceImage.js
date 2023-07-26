import * as _Jimp from "jimp/browser/lib/jimp.js";
const Jimp = typeof self !== "undefined" ? self.Jimp || _Jimp : _Jimp;
import urlFromFile from "./urlFromFile";

export default async function replaceImage(imagePath, newImage) {
  const newImageUrl = newImage[0].objectURL;
  const image = await Jimp.read(newImageUrl);
  return image;
}
