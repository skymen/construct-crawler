import fs from "../../tauriFsProvider.js";

const urlMap = new Map();
const pathList = [];
const subscriptions = new Map();

const maxNumberOfUrls = 100;

export default async function urlFromFile(filePath) {
  if (pathList.length > maxNumberOfUrls) {
    const oldPath = pathList.shift();
    const oldUrl = urlMap.get(oldPath);
    URL.revokeObjectURL(oldUrl);
    urlMap.delete(oldPath);
  }

  if (urlMap.has(filePath)) {
    return urlMap.get(filePath);
  }

  pathList.push(filePath);
  let data = await fs.readBinaryFile(filePath);
  let url = URL.createObjectURL(new Blob([data]));
  urlMap.set(filePath, url);
  return url;
}

function callBackSubscriptions(path) {
  if (subscriptions.has(path)) {
    for (const callback of subscriptions.get(path)) {
      callback();
    }
    subscriptions.delete(path);
  }
}

function clearPaths(paths) {
  for (const path of paths) {
    const url = urlMap.get(path);
    URL.revokeObjectURL(url);
    urlMap.delete(path);
    pathList.splice(pathList.indexOf(path), 1);
    callBackSubscriptions(path);
  }
}

function clearAllPaths() {
  for (const url of urlMap.values()) {
    URL.revokeObjectURL(url);
  }
  urlMap.clear();
  for (const path of pathList) {
    callBackSubscriptions(path);
  }
  pathList.length = 0;
}

export function clearUrlMap(paths) {
  if (paths) {
    clearPaths(paths);
  } else {
    clearAllPaths();
  }
}

export function subscribeToPath(path, callback) {
  if (!subscriptions.has(path)) {
    subscriptions.set(path, []);
  }
  subscriptions.get(path).push(callback);
}
