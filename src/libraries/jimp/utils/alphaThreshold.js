import * as _Jimp from "jimp/browser/lib/jimp.js";
const Jimp = typeof self !== "undefined" ? self.Jimp || _Jimp : _Jimp;
import urlFromFile from "./urlFromFile";

export default async function alphaThreshold(imagePath, threshold, min, max) {
  threshold = Math.min(Math.max(threshold, 0), 255);
  min = Math.min(Math.max(min, 0), 255);
  max = Math.min(Math.max(max, 0), 255);

  const image = await Jimp.read(await urlFromFile(imagePath));
  for (let x = 0; x < image.bitmap.width; x++) {
    for (let y = 0; y < image.bitmap.height; y++) {
      let color = Jimp.intToRGBA(image.getPixelColor(x, y));
      color.a = color.a >= threshold ? max : min;
      image.setPixelColor(
        Jimp.rgbaToInt(color.r, color.g, color.b, color.a),
        x,
        y
      );
    }
  }

  return image;
}
