import * as _Jimp from "jimp/browser/lib/jimp.js";
const Jimp = typeof self !== "undefined" ? self.Jimp || _Jimp : _Jimp;
import urlFromFile from "./urlFromFile";
import { getSize, isSizeValid } from "./sizeUtils";

function stretch(img, size, smooth) {
  return img.resize(size.width, size.height, smooth);
}

function cover(img, size, smooth) {
  return img.cover(
    size.width,
    size.height,
    Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE,
    smooth
  );
}

function contain(img, size, smooth) {
  return img.contain(
    size.width,
    size.height,
    Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE,
    smooth
  );
}

function alignTopLeft(img, size, smooth) {
  return new Promise((resolve, reject) => {
    cropImage(img, size.width, size.height, false, (err, image) => {
      if (err) reject(err);
      else resolve(image);
    });
  });
}

function alignCenter(img, size, smooth) {
  return new Promise((resolve, reject) => {
    cropImage(img, size.width, size.height, true, (err, image) => {
      if (err) reject(err);
      else resolve(image);
    });
  });
}

function cropImage(image, cropWidth, cropHeight, centered, callback) {
  const imgWidth = image.bitmap.width;
  const imgHeight = image.bitmap.height;

  // Check if crop dimensions are greater than image dimensions
  if (cropWidth > imgWidth || cropHeight > imgHeight) {
    const newWidth = Math.max(cropWidth, imgWidth);
    const newHeight = Math.max(cropHeight, imgHeight);

    // Create new blank image with desired dimensions
    new Jimp(newWidth, newHeight, (err, newImage) => {
      if (err) throw err;

      // Center the original image on the new image
      newImage.composite(
        image,
        centered ? (newWidth - imgWidth) / 2 : 0,
        centered ? (newHeight - imgHeight) / 2 : 0
      );

      // Now proceed with the crop
      return performCrop(newImage, cropWidth, cropHeight, centered, callback);
    });
  } else {
    // If the image is larger than the crop dimensions, proceed with the crop
    return performCrop(image, cropWidth, cropHeight, centered, callback);
  }
}

const performCrop = (image, cropWidth, cropHeight, centered, callback) => {
  let x = 0;
  let y = 0;

  if (centered) {
    x = Math.max(0, (image.bitmap.width - cropWidth) / 2);
    y = Math.max(0, (image.bitmap.height - cropHeight) / 2);
  }

  image.crop(x, y, cropWidth, cropHeight, callback);
};

export default async function resize(imagePath, size, mode, smooth) {
  if (!isSizeValid(size)) {
    return;
  }
  const img = await Jimp.read(await urlFromFile(imagePath));
  const smoothMode = [
    Jimp.RESIZE_NEAREST_NEIGHBOR,
    Jimp.RESIZE_BILINEAR,
    Jimp.RESIZE_BICUBIC,
    Jimp.RESIZE_HERMITE,
    Jimp.RESIZE_BEZIER,
  ][smooth];

  size = getSize(size, img);

  await [stretch, cover, contain, alignTopLeft, alignCenter][mode](
    img,
    size,
    smoothMode
  );

  return img;
}
