import * as _Jimp from "jimp/browser/lib/jimp.js";
const Jimp = typeof self !== "undefined" ? self.Jimp || _Jimp : _Jimp;
import urlFromFile from "./urlFromFile";

export default async function gaussian(imagePath, radius) {
  if (radius <= 0) return;
  const img = await Jimp.read(await urlFromFile(imagePath));
  await img.gaussian(radius);

  return img;
}
