import {
  copyFile,
  createDir,
  exists,
  readDir,
  readTextFile,
  removeDir,
  removeFile,
  writeTextFile,
  readBinaryFile,
  writeBinaryFile,
} from "@tauri-apps/api/fs";

async function isDirectory(path) {
  const result = await readDir(path);
  // If readDir doesn't throw an error, it is a directory
  return Array.isArray(result);
}

async function createFile(file) {
  // In Tauri, creating a file is as simple as writing to it
  // This will create an empty file
  await writeTextFile(file, "");
}

// Here's how you would implement the rest of the methods
export default {
  exists,
  readDir,
  removeFile,
  removeDir,
  isDirectory,
  createDir,
  createFile,
  writeFile: writeTextFile,
  copyFile,
  readFile: readTextFile,
  readBinaryFile,
  writeBinaryFile,
};
