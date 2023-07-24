import { defineStore } from "pinia";
import JSZip from "jszip";
import { open } from "@tauri-apps/api/dialog";
import fs from "../libraries/tauriFsProvider.js";
import { BaseDirectory } from "@tauri-apps/api/fs";
import * as path from "@tauri-apps/api/path";
import { router } from "../plugins/router.js";

function nanoId() {
  return Math.random().toString(36).substring(2, 15);
}

function zeroPad(num, places) {
  return String(num).padStart(places, "0");
}

export const useAppStore = defineStore("app", {
  state: () => ({
    projectOpened: false,
    loading: false,
    project: {
      path: "",
      name: "",
      projectData: {
        c3proj: {},
        objectTypes: [],
        objectTypesByName: {},
      },
    },
    log: "",
    objectTypeSearch: "",
  }),
  getters: {},
  actions: {
    async openC3Project() {
      this.loading = true;
      // open folder dialog
      // check if the folder contains a c3proj file
      // if it does, call openPath()
      try {
        const dir = await open({
          directory: true,
          multiple: false,
        });

        if (dir) {
          const c3ProjFile = await path.join(dir, "project.c3proj");
          const exists = await fs.exists(c3ProjFile);
          if (exists) {
            this.openPath(dir);
          } else {
            this.logError("No c3proj file found in the selected folder.");
          }
        }
      } catch (error) {
        this.loading = false;
        this.projectOpened = false;
      }
    },
    async openC3File() {
      this.loading = true;
      // open file dialog
      // c3p file is just a zip file.
      // Create a temp folder, extract the zip file to it, and then call the other action.
      try {
        const dir = await open({
          directory: false,
          multiple: false,
          filters: [
            {
              name: "Construct 3 Project",
              extensions: ["c3p"],
            },
          ],
        });

        if (dir) {
          if (dir.endsWith(".c3p")) {
            const zipContent = await fs.readBinaryFile(dir);
            const zipFile = await JSZip.loadAsync(zipContent);
            const folderPath = await path.join(
              await path.appCacheDir(),
              `construct-crawler-c3p`
            );
            if (await fs.exists(folderPath)) {
              await fs.removeDir(folderPath, { recursive: true });
            }
            await fs.createDir(folderPath);

            const seen = new Set();

            const extractZip = async (zipFile, folderPath) => {
              const promises = [];
              const handler = async (relativePath, zipEntry) => {
                const filePath = await path.join(folderPath, relativePath);
                const fileContent = await zipEntry.async("uint8array");

                const folderName = await path.dirname(filePath);
                const folderExists = await fs.exists(folderName);
                if (seen.has(filePath)) return;
                seen.add(folderName);
                try {
                  if (!folderExists) {
                    await fs.createDir(folderName, { recursive: true });
                  }

                  if (await fs.exists(filePath)) {
                    return;
                  }

                  await fs.writeBinaryFile(filePath, fileContent);
                } catch (error) {
                  this.logError(error);
                }
              };
              zipFile.forEach((relativePath, zipEntry) => {
                promises.push(handler(relativePath, zipEntry));
              });

              await Promise.all(promises);
            };

            await extractZip(zipFile, folderPath);
            this.openPath(folderPath);
          } else {
            this.logError("No c3p file selected.");
          }
        }
      } catch (error) {
        this.loading = false;
        this.projectOpened = false;
      }
    },
    logLine(line) {
      this.log += line + "\n";
    },
    async maybeDumpLog() {
      if (this.log.length > 0) {
        fs.writeFile(
          await path.join(
            await path.appCacheDir(),
            `construct-crawler-log.txt`
          ),
          this.log
        );
      }
    },
    async openPath(projectDir) {
      // open the path, and then call the other action.
      this.log = "";
      const fsPath = path;
      const c3proj = JSON.parse(
        await fs.readFile(await fsPath.join(projectDir, "project.c3proj"))
      );

      const objectTypesByName = new Map();
      const allObjectTypes = [];

      const getObjectTypeInfo = async (name, path) => {
        const src = await fsPath.join(
          projectDir,
          "objectTypes",
          path,
          `${name}.json`
        );
        const info = { name, src };
        this.logLine(`[INFO]: Getting info for ${name} in ${path}`);

        // check [name].json in "objectTypes" folder in the project directory. The file can be in a subfolder based on path
        // if it exists, add the properties to info

        if (await fs.exists(src)) {
          const json = JSON.parse(await fs.readFile(src));

          info.properties = json;

          if (info.properties.animations) {
            // get all image paths in here
            const processAnimFolder = (folder) => {
              folder.items.forEach((animation) => {
                animation.frames.forEach(async (frame, i) => {
                  const imageName = [
                    name.toLowerCase(),
                    animation.name.toLowerCase(),
                    zeroPad(i, 3),
                  ].join("-");
                  const imagePath = await fsPath.join(
                    projectDir,
                    "images",
                    `${imageName}.png`
                  );

                  if (await fs.exists(imagePath)) {
                    frame.src = imagePath;
                  } else {
                    // log error
                    this.logLine(
                      `[ERROR]: Image ${imageName} not found in ${imagePath}`
                    );
                  }
                });
              });
              if (folder.subfolders) {
                folder.subfolders.forEach((subfolder) => {
                  processAnimFolder(subfolder);
                });
              }
            };
            processAnimFolder(info.properties.animations);
          }

          if (info.properties.image) {
            // get image path here
            const imageName = name.toLowerCase();
            const imagePath = await fsPath.join(
              projectDir,
              "images",
              `${imageName}.png`
            );

            if (await fs.exists(imagePath)) {
              info.properties.image.src = imagePath;
            } else {
              // log error
              this.logLine(
                `[ERROR]: Image ${imageName} not found in ${imagePath}`
              );
            }
          }
        } else {
          // log error
          this.logLine(
            `[ERROR]: No object type file found for ${name} in ${path}`
          );
        }

        return info;
      };

      const addObjectTypesToList = async (folder, path) => {
        this.logLine(`[INFO]: Adding object types in ${path}`);
        for (const item of folder.items) {
          const info = await getObjectTypeInfo(item, path);
          objectTypesByName.set(item, info);
          allObjectTypes.push(info);
        }

        if (folder.subfolders) {
          for (const subfolder of folder.subfolders) {
            await addObjectTypesToList(
              subfolder,
              `${path}${path === "" ? "" : "/"}${subfolder.name}`
            );
          }
        }
      };

      await addObjectTypesToList(c3proj.objectTypes, "");

      this.logLine(`[INFO]: Project ${c3proj.name} opened.`);
      await this.maybeDumpLog(fs, path);

      this.project = {
        path: projectDir,
        name: c3proj.name,
        projectData: {
          c3proj,
          objectTypes: allObjectTypes,
          objectTypesByName,
        },
      };

      this.projectOpened = true;
      this.loading = false;
      await router.push({ path: "/project/home" });
    },

    logError(error) {
      console.error(error);
    },
  },
});
