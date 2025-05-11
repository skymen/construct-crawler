import { defineStore } from "pinia";
import { open, save } from "@tauri-apps/api/dialog";
import fs from "../libraries/tauriFsProvider.js";
import * as path from "@tauri-apps/api/path";
import { router } from "../plugins/router.js";
import { appWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/tauri";

function zeroPad(num, places) {
  return String(num).padStart(places, "0");
}

export const useAppStore = defineStore("app", {
  state: () => ({
    projectOpened: false,
    loading: false,
    projectLoadingMessage: "",
    projectLoadingProgress: 0,
    project: {
      path: "",
      name: "",
      projectData: {
        c3proj: {}, // Will hold the parsed project.c3proj content
        objectTypes: [],
        objectTypesByName: new Map(),
        families: [],
        familiesByName: new Map(),
        layouts: [], // [{ name: string, path: string (relative to project root) }]
        projectTemplates: [], // [{ name: string, object_type: string, defined_in_layout_name: string, defined_in_layout_path: string }]
      },
    },
    log: "",
    objectTypeSearch: "",
    familySearch: "",
    layoutSearch: "",
    currentLayoutInstances: [],
    selectedInstancesForReplica: new Set(),
  }),
  getters: {},
  actions: {
    async clearProject() {
      this.projectOpened = false;
      this.loading = false;
      this.objectTypeSearch = "";
      this.familySearch = "";
      this.layoutSearch = "";
      this.log = "";
      this.project = {
        path: "",
        name: "",
        projectData: {
          c3proj: {},
          objectTypes: [],
          objectTypesByName: new Map(),
          families: [],
          familiesByName: new Map(),
          layouts: [],
          projectTemplates: [],
        },
      };
      this.currentLayoutInstances = [];
      this.selectedInstancesForReplica.clear();
      await router.push({ path: "/" });
    },
    async saveToFile() {
      const targetPath = await save({
        defaultPath: `${this.project.name || 'project'}.c3p`,
        filters: [{ name: "Construct 3 Project", extensions: ["c3p"] }],
      });

      if (targetPath) {
        this.loading = true;
        this.projectLoadingProgress = 0;
        this.projectLoadingMessage = "Saving project to C3P...";
        
        const unlisten = await appWindow.listen("progress", (event) => {
          this.projectLoadingProgress = event.payload.progress;
          this.projectLoadingMessage = "Saving project...\n" + event.payload.filename;
          if (event.payload.done) unlisten();
        });

        try {
          await invoke("save_zip", {
            zipPath: targetPath,
            dirPath: this.project.path, // Use the currently open project folder path
          });
          this.projectLoadingMessage = 'Project saved successfully!';
        } catch (e) {
          this.logError(e);
          this.projectLoadingMessage = `Error saving: ${e}`;
        } finally {
          this.loading = false;
          setTimeout(() => { if(this.projectLoadingMessage.includes('successfully') || this.projectLoadingMessage.includes('Error')) this.projectLoadingMessage = ''; }, 5000);
        }
      }
    },
    async openC3Project() {
      try {
        const dir = await open({ directory: true, multiple: false });
        if (dir) {
          const c3ProjFile = await path.join(dir, "project.c3proj");
          if (await fs.exists(c3ProjFile)) {
            await this.openPath(dir);
          } else {
            this.logError("No project.c3proj file found in the selected folder.");
          }
        }
      } catch (error) { this.logError(error); }
    },
    async openC3File() {
      try {
        const filePath = await open({
          directory: false,
          multiple: false,
          filters: [{ name: "Construct 3 Project", extensions: ["c3p"] }],
        });
        if (filePath && filePath.endsWith(".c3p")) {
          this.loading = true;
          this.projectLoadingMessage = "Opening project file...";
          this.projectLoadingProgress = 0;
          const folderPath = await path.join(await path.appCacheDir(), `construct-crawler-c3p`);
          if (await fs.exists(folderPath)) {
            await fs.removeDir(folderPath, { recursive: true });
          }
          await fs.createDir(folderPath);
          this.projectLoadingMessage = "Extracting project...";
          const unlisten = await appWindow.listen("progress", (event) => {
            this.projectLoadingProgress = event.payload.progress;
            this.projectLoadingMessage = "Extracting project...\n" + event.payload.filename;
            if (event.payload.done) unlisten();
          });
          await invoke("extract_zip", { zipPath: filePath, destPath: folderPath });
          await this.openPath(folderPath);
        } else if (filePath) {
          this.logError("No .c3p file selected.");
        }
      } catch (error) {
        this.logError(error);
        this.loading = false; // Ensure loading is reset on error
      }
    },
    logLine(line) {
      this.log += line + "\n";
      console.log(line);
    },
    async maybeDumpLog() {
      if (this.log.length > 0) {
        try {
            await fs.writeFile(await path.join(await path.appCacheDir(), `construct-crawler-log.txt`), this.log);
        } catch (e) { console.error("Failed to dump log:", e); }
      }
    },
    async openPath(projectDir) {
      this.log = "";
      this.projectLoadingMessage = "Loading project...";
      this.projectLoadingProgress = 0;
      this.loading = true;

      try {
        const fsPath = path;
        const c3projPath = await fsPath.join(projectDir, "project.c3proj");
        if (!await fs.exists(c3projPath)) {
            throw new Error("project.c3proj not found at specified path.");
        }
        const c3projContent = await fs.readFile(c3projPath);
        const c3projDataForJs = JSON.parse(c3projContent);

        this.projectLoadingMessage = "Loading layouts list...";
        let layouts = [];
        const c3projIsJsonFormat = typeof c3projDataForJs.layouts === 'object' && c3projDataForJs.layouts !== null;

        if (c3projIsJsonFormat) {
          this.projectLoadingMessage = "Processing layouts from project.json...";
          const parsedLayoutsFromJson = [];
          const processLayoutsFolder = (folder, currentPathParts) => {
            (folder.items || []).forEach(itemName => {
              const layoutFilePathParts = ["layouts", ...currentPathParts, `${itemName}.json`];
              const relativeLayoutPath = layoutFilePathParts.join('/');
              // Check if this layout already exists by path to avoid duplicates if structure is odd
              if (!parsedLayoutsFromJson.some(l => l.path === relativeLayoutPath)) {
                 parsedLayoutsFromJson.push({ name: itemName, path: relativeLayoutPath });
              }
            });

            (folder.subfolders || []).forEach(subfolder => {
              // Ensure subfolder.name is valid before adding to path
              if (subfolder.name && typeof subfolder.name === 'string' && subfolder.name.trim() !== '') {
                processLayoutsFolder(subfolder, [...currentPathParts, subfolder.name]);
              } else {
                processLayoutsFolder(subfolder, currentPathParts); // Process items in unnamed folder
              }
            });
          };

          if (c3projDataForJs.layouts) {
            processLayoutsFolder(c3projDataForJs.layouts, []);
          }
          this.logLine(`[INFO] Loaded ${parsedLayoutsFromJson.length} layouts directly from JSON project file.`);
          layouts = parsedLayoutsFromJson;
        } else {
          this.projectLoadingMessage = "Loading layouts list (XML fallback)...";
          this.logLine("[INFO] project.c3proj does not appear to use JSON for layouts structure. Attempting XML parse via Rust.");
          try {
            layouts = await invoke("get_layout_list_from_c3proj", { projectC3projPath: c3projPath });
            this.logLine(`[INFO] Rust XML parser returned ${layouts.length} layouts.`);
          } catch (e) {
            this.logError(`Error loading layouts via Rust XML parser: ${e}`);
            layouts = []; // Ensure layouts is an empty array on error
          }
        }

        const objectTypesByName = new Map();
        const allObjectTypes = [];
        const getObjectTypeInfo = async (name, objectTypePath) => {
          const src = await fsPath.join(projectDir, "objectTypes", objectTypePath, `${name}.json`);
          const info = { name, src, path: objectTypePath };
          if (await fs.exists(src)) {
            const untouchedJson = await fs.readFile(src);
            const json = JSON.parse(untouchedJson);
            info.properties = json;
            info.originalJson = untouchedJson;
            if (info.properties.animations) {
              const processAnimFolder = (animations) => {
                (animations.items || []).forEach((animation) => {
                  (animation.frames || []).forEach(async (frame, i) => {
                    const imageName = [name.toLowerCase(), animation.name.toLowerCase(), zeroPad(i, 3)].join("-");
                    const imagePath = await fsPath.join(projectDir, "images", `${imageName}.png`);
                    if (await fs.exists(imagePath)) frame.src = imagePath;
                    else this.logLine(`[WARNING]: Image ${imageName}.png not found for ${name}/${animation.name}`);
                  });
                });
                if (animations.subfolders) animations.subfolders.forEach(processAnimFolder);
              };
              processAnimFolder(info.properties.animations);
            }
            if (info.properties.image) {
              const imagePath = await fsPath.join(projectDir, "images", `${name.toLowerCase()}.png`);
              if (await fs.exists(imagePath)) info.properties.image.src = imagePath;
              else this.logLine(`[WARNING]: Image ${name.toLowerCase()}.png not found for ${name}`);
            }
          } else this.logLine(`[ERROR]: No object type file found for ${name} at ${src}`);
          return info;
        };
        let totalObjectTypes = 0;
        const countObjectTypes = (folder) => { totalObjectTypes += (folder.items || []).length; (folder.subfolders || []).forEach(countObjectTypes); };
        countObjectTypes(c3projDataForJs.objectTypes);
        let currentObjectType = 0;
        const addObjectTypesToList = async (folder, currentPath) => {
          for (const item of (folder.items || [])) {
            currentObjectType++;
            this.projectLoadingMessage = `Loading object type: ${currentPath ? currentPath + '/' : ''}${item}`;
            this.projectLoadingProgress = currentObjectType / (totalObjectTypes || 1);
            const info = await getObjectTypeInfo(item, currentPath);
            objectTypesByName.set(item, info);
            allObjectTypes.push(info);
          }
          for (const subfolder of (folder.subfolders || [])) {
            await addObjectTypesToList(subfolder, `${currentPath}${currentPath === "" ? "" : "/"}${subfolder.name}`);
          }
        };
        await addObjectTypesToList(c3projDataForJs.objectTypes, "");

        const familiesByName = new Map();
        const allFamilies = [];
        const getFamilyInfo = async (name, familyPath) => {
            const src = await fsPath.join(projectDir, "families", familyPath, `${name}.json`);
            const info = { name, src, path: familyPath };
            if (await fs.exists(src)) {
                const untouchedJson = await fs.readFile(src);
                info.properties = JSON.parse(untouchedJson);
                info.originalJson = untouchedJson;
            } else this.logLine(`[ERROR]: No family file found for ${name} at ${src}`);
            return info;
        };
        let totalFamilies = 0;
        const countFamilies = (folder) => { totalFamilies += (folder.items || []).length; (folder.subfolders || []).forEach(countFamilies);};
        countFamilies(c3projDataForJs.families);
        let currentFamily = 0;
        const addFamilyToList = async (folder, currentPath) => {
            for (const item of (folder.items || [])) {
                currentFamily++;
                this.projectLoadingMessage = `Loading family: ${currentPath ? currentPath + '/' : ''}${item}`;
                this.projectLoadingProgress = currentFamily / (totalFamilies || 1); // Simplified progress for now
                const info = await getFamilyInfo(item, currentPath);
                familiesByName.set(item, info);
                allFamilies.push(info);
            }
            for (const subfolder of (folder.subfolders || [])) {
                await addFamilyToList(subfolder, `${currentPath}${currentPath === "" ? "" : "/"}${subfolder.name}`);
            }
        };
        await addFamilyToList(c3projDataForJs.families, "");

        this.project = {
          path: projectDir,
          name: c3projDataForJs.name,
          projectData: {
            c3proj: c3projDataForJs,
            objectTypes: allObjectTypes,
            objectTypesByName,
            families: allFamilies,
            familiesByName,
            layouts: layouts,
            projectTemplates: [],
          },
        };

        this.projectLoadingMessage = "Loading project templates...";
        this.projectLoadingProgress = 0;
        await this.fetchProjectTemplates();

        this.logLine(`[INFO]: Project ${this.project.name} opened.`);
        this.projectOpened = true;
        await router.push({ path: "/project/home" });
      } catch (error) {
        this.logError(`Error opening project path ${projectDir}: ${error}`);
        await this.clearProject(); // Reset state on critical error
      } finally {
        this.loading = false;
        this.projectLoadingMessage = "";
        this.projectLoadingProgress = 0;
        await this.maybeDumpLog();
      }
    },
    async fetchProjectTemplates() {
        if (!this.project || !this.project.path) return;
        this.projectLoadingMessage = "Fetching defined templates...";
        try {
            const templates = await invoke('get_project_defined_templates', {
                projectPathStr: this.project.path,
                layoutEntries: this.project.projectData.layouts
            });
            this.project.projectData.projectTemplates = templates;
        } catch (error) {
            this.logError(`Error fetching project templates: ${error}`);
            this.project.projectData.projectTemplates = [];
        } finally {
            this.projectLoadingMessage = "";
        }
    },
    async fetchLayoutInstances(layoutFilePath) {
      if (!this.project || !this.project.path) return;
      this.currentLayoutInstances = [];
      this.selectedInstancesForReplica.clear();
      try {
        const instances = await invoke('get_layout_instances_info', {
          projectPath: this.project.path,
          layoutFilePath: layoutFilePath,
        });
        this.currentLayoutInstances = instances;
      } catch (error) {
        this.logError(`Error fetching layout instances for ${layoutFilePath}: ${error}`);
      } finally {
      }
    },
    async applySetReplicas(layoutFilePath, targetTemplateName) {
      if (!this.project || !this.project.path || this.selectedInstancesForReplica.size === 0 || !targetTemplateName) {
        this.logError("Missing data for setting replicas. Ensure instances and a target template are selected.");
        return;
      }
      this.loading = true;
      this.projectLoadingMessage = `Setting instances in ${layoutFilePath} as replicas of ${targetTemplateName}...`;
      try {
        await invoke('set_instances_as_replicas', {
          payload: {
            project_path: this.project.path,
            layout_file_path: layoutFilePath,
            instance_uids: Array.from(this.selectedInstancesForReplica),
            target_template_name: targetTemplateName,
          },
        });
        await this.fetchLayoutInstances(layoutFilePath); // Refresh instances
        this.projectLoadingMessage = 'Successfully set replicas!';
        this.selectedInstancesForReplica.clear(); // Clear selection after successful operation
      } catch (error) {
        this.logError(`Error setting instances as replicas: ${error}`);
        this.projectLoadingMessage = `Error: ${error}`;
      } finally {
        this.loading = false;
        setTimeout(() => { if (this.projectLoadingMessage.includes('Successfully') || this.projectLoadingMessage.includes('Error')) this.projectLoadingMessage = ''; }, 5000);
      }
    },
    async setAllInstancesOfTypeAsReplicasProjectWide(objectTypeName, targetTemplateName) {
      if (!this.project || !this.project.path || !objectTypeName || !targetTemplateName) {
        this.logError("Missing data for project-wide replica setting. Ensure object type and target template are selected.");
        return;
      }
      if (!this.project.projectData.layouts || this.project.projectData.layouts.length === 0) {
        this.logError("No layouts found in the project to process.");
        return;
      }
    
      this.loading = true; 
      this.projectLoadingMessage = `Processing all layouts for '${objectTypeName}' to become replicas of '${targetTemplateName}'...`;
      this.projectLoadingProgress = 0; 
    
      try {
        const layoutFilePaths = this.project.projectData.layouts.map(l => l.path);
        const resultMessage = await invoke('set_all_instances_of_type_as_replicas_project_wide', {
          payload: {
            project_path: this.project.path,
            layout_file_paths: layoutFilePaths,
            object_type_name: objectTypeName,
            target_template_name: targetTemplateName,
          },
        });
        this.projectLoadingMessage = resultMessage; 
        this.logLine(`[INFO] ${resultMessage}`);
        
        this.currentLayoutInstances = []; // Invalidate, will refetch if LayoutDetail is active
        this.selectedInstancesForReplica.clear();
        
        // Refresh current layout view if it's open
        const currentRoute = router.currentRoute.value;
        if (currentRoute.name === 'LayoutDetail' && currentRoute.query.filePath) {
            await this.fetchLayoutInstances(currentRoute.query.filePath);
        }
        // Also good to refresh project templates, as an object type might newly become a template source effectively
        await this.fetchProjectTemplates();
    
    
      } catch (error) {
        this.logError(`Error setting project-wide replicas: ${error}`);
        this.projectLoadingMessage = `Error setting project-wide replicas: ${error.toString().substring(0, 200)}...`;
      } finally {
        this.loading = false;
        setTimeout(() => { 
            if (this.projectLoadingMessage.includes('Successfully modified') || this.projectLoadingMessage.startsWith('Error')) {
                this.projectLoadingMessage = ''; 
            }
        }, 7000);
        this.projectLoadingProgress = 0;
      }
    },
    toggleInstanceSelectionForReplica(instanceUid) {
        if (this.selectedInstancesForReplica.has(instanceUid)) {
            this.selectedInstancesForReplica.delete(instanceUid);
        } else {
            this.selectedInstancesForReplica.add(instanceUid);
        }
    },
    selectAllInstancesForReplica(selectAll, instancesToConsider) {
        // This action now considers only the passed 'instancesToConsider' (e.g., filtered list)
        if (selectAll) {
            instancesToConsider.forEach(inst => this.selectedInstancesForReplica.add(inst.uid));
        } else {
            instancesToConsider.forEach(inst => this.selectedInstancesForReplica.delete(inst.uid));
        }
    },
    logError(error) {
      const errorMessage = typeof error === 'string' ? error : (error.message || 'An unknown error occurred');
      console.error(error);
      this.logLine(`[ERROR]: ${errorMessage}`);
      this.projectLoadingMessage = `Error: ${errorMessage.substring(0, 200)}...`;
    },
  },
});