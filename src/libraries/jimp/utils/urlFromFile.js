import fs from "../../tauriFsProvider.js";

export default async function urlFromFile(filePath) {
  let data = await fs.readBinaryFile(filePath);
  return URL.createObjectURL(new Blob([data]));
}
