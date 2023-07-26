import { saveImgToPath } from "./saveImgToFile";
import { properSizeFormat } from "./sizeUtils";
import fs from "../../tauriFsProvider.js";

export async function applyAction(
  action,
  params,
  applyTo,
  objectType,
  selectedAnim,
  selectedFrame
) {
  const pathsToClear = [];

  const preSaveImgToPath = async (img, path) => {
    pathsToClear.push(path);
    await saveImgToPath(img, path);
  };

  params = params.map((param) => {
    if (param.type === "size") {
      param.value = properSizeFormat(param.value);
    }
    return param.value;
  });

  const objectProperties = JSON.parse(objectType.originalJson);
  const objectPropertiesPath = objectType.src;

  const anims = [];
  if (objectType.properties && objectType.properties.animations) {
    const pushAnims = (animations, originAnimations) => {
      anims.push(
        ...animations.items.map((anim, i) => {
          return {
            ...anim,
            origin: originAnimations.items[i],
          };
        })
      );
      if (animations.subfolders) {
        animations.subfolders.forEach((subfolder, i) => {
          pushAnims(subfolder, originAnimations.subfolders[i]);
        });
      }
    };
    pushAnims(objectType.properties.animations, objectProperties.animations);
  }

  if (objectType.properties.image) {
    // Image
    let img = await action(objectType.properties.image, ...params);
    objectProperties.image.width = img.bitmap.width;
    objectProperties.image.height = img.bitmap.height;
    await preSaveImgToPath(img, objectType.properties.image.src);
  } else if (applyTo === 0) {
    // Current frame
    let img = await action(
      anims[selectedAnim].frames[selectedFrame].src,
      ...params
    );
    anims[selectedAnim].origin.frames[selectedFrame].width = img.bitmap.width;
    anims[selectedAnim].origin.frames[selectedFrame].height = img.bitmap.height;
    await preSaveImgToPath(img, anims[selectedAnim].frames[selectedFrame].src);
  } else if (applyTo === 1) {
    // Current animation
    const frames = anims[selectedAnim].frames;
    for (let i = 0; i < frames.length; i++) {
      let img = await action(frames[i].src, ...params);
      anims[selectedAnim].origin.frames[i].width = img.bitmap.width;
      anims[selectedAnim].origin.frames[i].height = img.bitmap.height;
      await preSaveImgToPath(img, frames[i].src);
    }
  } else {
    // All animations
    for (let i = 0; i < anims.length; i++) {
      const frames = anims[i].frames;
      for (let j = 0; j < frames.length; j++) {
        let img = await action(frames[j].src, ...params);
        anims[i].origin.frames[j].width = img.bitmap.width;
        anims[i].origin.frames[j].height = img.bitmap.height;
        await preSaveImgToPath(img, frames[j].src);
      }
    }
  }

  await fs.writeFile(
    objectPropertiesPath,
    JSON.stringify(objectProperties, null, 2)
  );

  return pathsToClear;
}
