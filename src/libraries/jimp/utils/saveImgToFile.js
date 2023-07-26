import fs from "../../tauriFsProvider.js";

export async function saveImgToPath(image, path) {
  const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
  const data = new Uint8Array(buffer);
  await fs.writeBinaryFile(path, data);
}
