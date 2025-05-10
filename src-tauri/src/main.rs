// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(non_snake_case)]

use std::fs::{self, File};
use std::io::{Read, Cursor, Write};
use std::fmt;
use std::path::{Path, PathBuf};
use byteorder::{BigEndian, ReadBytesExt};
use zip::ZipArchive;
use zip::result::ZipError;
use std::io::{Error as IoError, ErrorKind};
use tokio;
use walkdir::WalkDir;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use quick_xml::events::Event;
use quick_xml::reader::Reader;
use std::collections::HashSet;

// --- Error Handling ---
#[derive(Debug)]
#[allow(dead_code)]
enum MyError {
    IoError(IoError),
    ZipError(ZipError),
    WalkDirError(walkdir::Error),
    XmlError(quick_xml::Error),
    SerdeJsonError(serde_json::Error),
    Custom(String),
}

impl fmt::Display for MyError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            MyError::IoError(e) => write!(f, "IO Error: {}", e),
            MyError::ZipError(e) => write!(f, "ZIP Error: {}", e),
            MyError::WalkDirError(e) => write!(f, "WalkDir Error: {}", e),
            MyError::XmlError(e) => write!(f, "XML Error: {}", e),
            MyError::SerdeJsonError(e) => write!(f, "JSON Error: {}", e),
            MyError::Custom(s) => write!(f, "Error: {}", s),
        }
    }
}

impl std::error::Error for MyError {}
impl From<std::io::Error> for MyError { fn from(e: std::io::Error) -> Self { MyError::IoError(e) } }
impl From<zip::result::ZipError> for MyError { fn from(e: zip::result::ZipError) -> Self { MyError::ZipError(e) } }
impl From<walkdir::Error> for MyError { fn from(e: walkdir::Error) -> Self { MyError::WalkDirError(e) } }
impl From<quick_xml::Error> for MyError { fn from(e: quick_xml::Error) -> Self { MyError::XmlError(e) } }
impl From<serde_json::Error> for MyError { fn from(e: serde_json::Error) -> Self { MyError::SerdeJsonError(e) } }

impl From<MyError> for tauri::Error {
    fn from(error: MyError) -> Self {
        match error {
            MyError::IoError(e) => tauri::Error::Io(e),
            MyError::ZipError(e) => tauri::Error::Io(IoError::new(ErrorKind::Other, e.to_string())),
            MyError::WalkDirError(e) => tauri::Error::Io(IoError::new(ErrorKind::Other, e.to_string())),
            MyError::XmlError(e) => tauri::Error::Io(IoError::new(ErrorKind::Other, e.to_string())),
            MyError::SerdeJsonError(e) => tauri::Error::Io(IoError::new(ErrorKind::Other, e.to_string())),
            MyError::Custom(s) => tauri::Error::Io(IoError::new(ErrorKind::Other, s)),
        }
    }
}
// --- End Error Handling ---

#[derive(Clone, serde::Serialize)]
struct Payload {
  progress: f64,
  filename: String,
  done: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LayoutEntry {
    name: String,
    path: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InstanceDisplayInfo {
    uid: u32,
    object_type_name: String,
    is_replica: bool,
    is_template: bool,
    template_or_source_name: Option<String>,
    x: f64,
    y: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
pub struct TemplateDefinition {
    name: String,
    object_type: String,
    defined_in_layout_name: String,
    defined_in_layout_path: String,
}

#[derive(Deserialize, Debug)]
pub struct SetReplicasPayload {
    project_path: String,
    layout_file_path: String,
    instance_uids: Vec<u32>,
    target_template_name: String,
}

#[derive(Deserialize, Debug)]
pub struct SetAllInstancesOfTypePayload {
    project_path: String,
    layout_file_paths: Vec<String>, // JS will send all layout paths
    object_type_name: String,
    target_template_name: String,
}


#[tauri::command]
fn read_png_dimensions(file_path: String) -> Result<(u32, u32), String> {
  let mut file = File::open(file_path).map_err(|e| e.to_string())?;
  let mut buffer = vec![0; 24];
  file.read_exact(&mut buffer).map_err(|e| e.to_string())?;
  let mut cursor = Cursor::new(buffer);
  cursor.set_position(16);
  let width = cursor.read_u32::<BigEndian>().map_err(|e| e.to_string())?;
  let height = cursor.read_u32::<BigEndian>().map_err(|e| e.to_string())?;
  Ok((width, height))
}

#[tauri::command]
async fn extract_zip(window: tauri::Window, zip_path: String, dest_path: String) -> Result<(), String> {
    let task = tokio::spawn(async move {
        let reader = File::open(&zip_path)?;
        let mut archive = ZipArchive::new(reader)?;
        let total_files = archive.len();
        window.emit("progress", Payload { progress: 0.0, filename: "".into(), done: false }).unwrap_or_else(|e| eprintln!("Emit error: {}", e));
        for i in 0..total_files {
            let mut file = archive.by_index(i)?;
            let outpath = Path::new(&dest_path).join(file.name());
            if file.is_dir() {
                fs::create_dir_all(&outpath)?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() { fs::create_dir_all(&p)?; }
                }
                let mut outfile = File::create(&outpath)?;
                std::io::copy(&mut file, &mut outfile)?;
                let progress = (i + 1) as f64 / total_files as f64;
                window.emit("progress", Payload { progress, filename: file.name().into(), done: false }).unwrap_or_else(|e| eprintln!("Emit error: {}", e));
            }
        }
        window.emit("progress", Payload { progress: 1.0, filename: "".into(), done: true }).unwrap_or_else(|e| eprintln!("Emit error: {}", e));
        Ok::<(), MyError>(())
    });
    task.await.map_err(|e| e.to_string())?.map_err(|e: MyError| e.to_string())
}

#[tauri::command]
async fn save_zip(window: tauri::Window, dir_path: String, zip_path: String) -> Result<(), String> {
    let task = tokio::spawn(async move {
        let zip_file = File::create(&zip_path)?;
        let total_files = WalkDir::new(&dir_path).into_iter().filter_map(Result::ok).count();
        let walkdir = WalkDir::new(&dir_path);
        let it = walkdir.into_iter();
        let mut zip = zip::ZipWriter::new(zip_file);
        let mut options = zip::write::FileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .unix_permissions(0o755).large_file(true);
        let mut buffer = Vec::new();
        let mut processed_files = 0;
        for entry_result in it {
            let entry = entry_result?;
            let path = entry.path();
            let name = path.strip_prefix(Path::new(&dir_path)).unwrap();
            if path.is_file() {
                let ext = path.extension().and_then(std::ffi::OsStr::to_str).unwrap_or("");
                options = options.compression_method(if ext == "webm" { zip::CompressionMethod::Stored } else { zip::CompressionMethod::Deflated });
                zip.start_file(name.to_string_lossy().into_owned(), options)?;
                let mut f = File::open(path)?;
                f.read_to_end(&mut buffer)?;
                zip.write_all(&buffer)?;
                buffer.clear();
                processed_files += 1;
                let progress = processed_files as f64 / total_files as f64;
                window.emit("progress", Payload { progress, filename: name.to_string_lossy().into(), done: false }).unwrap_or_else(|e| eprintln!("Emit error: {}", e));
            } else if name.as_os_str().len() != 0 {
                zip.add_directory(name.to_string_lossy().into_owned(), options)?;
            }
        }
        zip.finish()?;
        window.emit("progress", Payload { progress: 1.0, filename: "".into(), done: true }).unwrap_or_else(|e| eprintln!("Emit error: {}", e));
        Ok::<(), MyError>(())
    });
    task.await.map_err(|e| e.to_string())?.map_err(|e: MyError| e.to_string())
}

#[tauri::command]
fn get_layout_list_from_c3proj(project_c3proj_path: String) -> Result<Vec<LayoutEntry>, String> {
    let content = fs::read_to_string(&project_c3proj_path)
        .map_err(|e| format!("Failed to read project.c3proj: {}", e))?;
    let mut reader = Reader::from_str(&content);
    reader.trim_text(true);
    let mut buf = Vec::new();
    let mut layouts = Vec::new();
    let mut current_layout_name: Option<String> = None;
    let mut in_layout_tag = false; 
    let mut next_text_is_name = false;
    let mut next_text_is_file = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                match e.name().as_ref() {
                    b"layout" => {
                        in_layout_tag = true;
                        current_layout_name = None; 
                        next_text_is_name = false; 
                        next_text_is_file = false;
                    }
                    b"name" if in_layout_tag => next_text_is_name = true, 
                    b"file" if in_layout_tag && current_layout_name.is_some() => next_text_is_file = true,
                    _ => (),
                }
            }
            Ok(Event::Text(e)) => {
                let text_content = e.unescape().map_err(|err| format!("XML unescape error: {}", err))?.into_owned();
                if next_text_is_name {
                    current_layout_name = Some(text_content);
                    next_text_is_name = false;
                } else if next_text_is_file {
                  if let Some(ref name) = current_layout_name {
                        if text_content.ends_with(".json") { 
                            layouts.push(LayoutEntry {
                                name: name.clone(),
                                path: text_content,
                            });
                        }
                    }
                    next_text_is_file = false;
                }
            }
             Ok(Event::End(ref e)) => {
                match e.name().as_ref() {
                    b"layout" => {
                        in_layout_tag = false;
                        current_layout_name = None; 
                    }
                    _ => (),
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("XML Error at position {}: {:?}", reader.buffer_position(), e)),
            _ => (),
        }
        buf.clear();
    }
    Ok(layouts)
}

#[tauri::command]
fn get_project_defined_templates(project_path_str: String, layout_entries: Vec<LayoutEntry>) -> Result<Vec<TemplateDefinition>, String> {
    let project_path = PathBuf::from(project_path_str);
    let c3proj_path = project_path.join("project.c3proj");
    let mut found_templates = HashSet::new();

    if !c3proj_path.exists() {
        return Err("project.c3proj not found in project root.".to_string());
    }

    for layout_entry in layout_entries {
        let full_layout_path = project_path.join(&layout_entry.path); 
        if !full_layout_path.exists() {
            eprintln!("Warning: Layout file listed in c3proj not found: {:?} (referenced by {})", full_layout_path, layout_entry.path);
            continue;
        }
        let content = match fs::read_to_string(&full_layout_path) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Error reading layout file {:?}: {}", full_layout_path, e);
                continue;
            }
        };
        let layout_data: Value = match serde_json::from_str(&content) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("Error parsing layout JSON {:?}: {}", full_layout_path, e);
                continue;
            }
        };

        let current_layout_name_for_template_def = layout_entry.name.clone();

        if let Some(layers) = layout_data.get("layers").and_then(|l| l.as_array()) {
            for layer in layers {
                if let Some(instances_arr) = layer.get("instances").and_then(|i| i.as_array()) {
                    for instance_val in instances_arr {
                        if let Some(instance_obj) = instance_val.as_object() {
                            if let Some(template_val) = instance_obj.get("template") {
                                if let Some(template_obj_map) = template_val.as_object() {
                                    if template_obj_map.get("mode").and_then(|m| m.as_str()) == Some("template") {
                                        if let Some(template_name) = template_obj_map.get("templateName").and_then(|n| n.as_str()) {
                                            if !template_name.is_empty() {
                                                found_templates.insert(TemplateDefinition {
                                                    name: template_name.to_string(),
                                                    defined_in_layout_name: current_layout_name_for_template_def.clone(),
                                                    defined_in_layout_path: layout_entry.path.clone(),
                                                    object_type: instance_obj.get("type")
                                                                    .and_then(|t| t.as_str())
                                                                    .unwrap_or_default().to_string(),
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(found_templates.into_iter().collect())
}


#[tauri::command]
fn get_layout_instances_info(project_path: String, layout_file_path: String) -> Result<Vec<InstanceDisplayInfo>, String> {
    let full_layout_path = PathBuf::from(&project_path).join(&layout_file_path);
    if !full_layout_path.exists() {
        return Err(format!("Layout file not found: {:?}", full_layout_path));
    }
    let content = fs::read_to_string(&full_layout_path)
        .map_err(|e| format!("Failed to read layout file {:?}: {}", full_layout_path, e))?;
    let layout_data: Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse layout JSON {:?}: {}", full_layout_path, e))?;
    let mut instances_display_info = Vec::new();

    if let Some(layers) = layout_data.get("layers").and_then(|l| l.as_array()) {
        for layer in layers {
            if let Some(instances_arr) = layer.get("instances").and_then(|i| i.as_array()) {
                for instance_val in instances_arr {
                    if let Some(instance_obj) = instance_val.as_object() {
                        let uid = instance_obj.get("uid").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                        let object_type_name = instance_obj.get("type").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        
                        let world_coords = instance_obj.get("world").and_then(|w| w.as_object());
                        let x = world_coords.and_then(|w| w.get("x")).and_then(|v| v.as_f64()).unwrap_or(0.0);
                        let y = world_coords.and_then(|w| w.get("y")).and_then(|v| v.as_f64()).unwrap_or(0.0);
                        let mut is_replica = false;
                        let mut is_template = false;
                        let mut template_or_source_name: Option<String> = None;

                        if let Some(template_val) = instance_obj.get("template") {
                            if let Some(template_obj_map) = template_val.as_object() {
                                if let Some(mode_str) = template_obj_map.get("mode").and_then(|m| m.as_str()) {
                                    if mode_str == "replica" {
                                        is_replica = true;
                                        template_or_source_name = template_obj_map.get("sourceTemplateName").and_then(|n| n.as_str()).map(String::from);
                                    } else if mode_str == "template" {
                                        is_template = true;
                                        template_or_source_name = template_obj_map.get("templateName").and_then(|n| n.as_str()).map(String::from);
                                    }
                                }
                            }
                        }
                        instances_display_info.push(InstanceDisplayInfo {
                            uid,
                            object_type_name,
                            is_replica,
                            is_template,
                            template_or_source_name,
                            x,
                            y,
                        });
                    }
                }
            }
        }
    }
    Ok(instances_display_info)
}

#[tauri::command]
fn set_instances_as_replicas(payload: SetReplicasPayload) -> Result<(), String> {
    let full_layout_path = PathBuf::from(&payload.project_path).join(&payload.layout_file_path);
    if !full_layout_path.exists() {
        return Err(format!("Layout file not found: {:?}", full_layout_path));
    }
    let content = fs::read_to_string(&full_layout_path)
        .map_err(|e| format!("Failed to read layout file {:?}: {}", full_layout_path, e))?;
    let mut layout_data: Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse layout JSON {:?}: {}", full_layout_path, e))?;
    let mut modified_count = 0;

    if let Some(layers) = layout_data.get_mut("layers").and_then(|l| l.as_array_mut()) {
        for layer in layers {
            if let Some(instances_arr) = layer.get_mut("instances").and_then(|i| i.as_array_mut()) {
                for instance_val in instances_arr {
                    if let Some(instance_obj) = instance_val.as_object_mut() {
                        if let Some(uid_val) = instance_obj.get("uid").and_then(|v| v.as_u64()) {
                            let uid = uid_val as u32;
                            if payload.instance_uids.contains(&uid) {
                                let template_map_entry = instance_obj.entry("template".to_string())
                                    .or_insert_with(|| Value::Object(serde_json::Map::new()));
                                if let Some(template_obj) = template_map_entry.as_object_mut() {
                                    template_obj.insert("mode".to_string(), Value::String("replica".to_string()));
                                    template_obj.insert("sourceTemplateName".to_string(), Value::String(payload.target_template_name.clone()));
                                    template_obj.insert("templateName".to_string(), Value::String("".to_string()));
                                    template_obj.entry("replicaHierarchyInSyncWithTemplate".to_string()).or_insert(Value::Bool(true));
                                    template_obj.entry("templatePropagateHierarchyChanges".to_string()).or_insert(Value::Bool(true));
                                    template_obj.entry("replicaIgnoreTemplateHierarchyChanges".to_string()).or_insert(Value::Bool(false));
                                    template_obj.entry("components".to_string()).or_insert_with(|| Value::Array(vec![]));
                                    
                                    modified_count += 1;
                                } else {
                                    return Err("Internal error: Failed to ensure template object is a map".to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    } else {
        return Err(format!("Could not find 'layers' array in layout file: {:?}", full_layout_path));
    }
    if modified_count == 0 && !payload.instance_uids.is_empty() {
        eprintln!("Warning: No instances were modified for UIDs: {:?}. Target UIDs might not exist or layout structure differs.", payload.instance_uids);
    }
    let updated_content = serde_json::to_string_pretty(&layout_data)
        .map_err(|e| format!("Failed to serialize layout JSON: {}", e))?;
    fs::write(&full_layout_path, updated_content)
        .map_err(|e| format!("Failed to write updated layout file {:?}: {}", full_layout_path, e))?;
    Ok(())
}

#[tauri::command]
fn set_all_instances_of_type_as_replicas_project_wide(payload: SetAllInstancesOfTypePayload) -> Result<String, String> {
    let project_base_path = PathBuf::from(&payload.project_path);
    let mut modified_layouts_count = 0;
    let mut total_instances_modified = 0;

    for layout_relative_path_str in payload.layout_file_paths {
        let full_layout_path = project_base_path.join(&layout_relative_path_str);
        if !full_layout_path.exists() {
            eprintln!("Warning: Layout file not found during project-wide update: {:?}. Skipping.", full_layout_path);
            continue;
        }

        let content = match fs::read_to_string(&full_layout_path) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Error reading layout file {:?}: {}. Skipping.", full_layout_path, e);
                continue;
            }
        };
        let mut layout_data: Value = match serde_json::from_str(&content) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("Error parsing layout JSON {:?}: {}. Skipping.", full_layout_path, e);
                continue;
            }
        };

        let mut layout_modified_this_iteration = false;
        if let Some(layers) = layout_data.get_mut("layers").and_then(|l| l.as_array_mut()) {
            for layer in layers {
                if let Some(instances_arr) = layer.get_mut("instances").and_then(|i| i.as_array_mut()) {
                    for instance_val in instances_arr {
                        if let Some(instance_obj) = instance_val.as_object_mut() {
                            if let Some(instance_type_val) = instance_obj.get("type").and_then(|t| t.as_str()) {
                                if instance_type_val == payload.object_type_name {
                                    // Skip modifying instances that are themselves templates of any kind
                                    let is_already_template = instance_obj.get("template")
                                        .and_then(|t_val| t_val.as_object())
                                        .and_then(|t_obj| t_obj.get("mode"))
                                        .and_then(|m_val| m_val.as_str()) == Some("template");

                                    if is_already_template {
                                        continue; 
                                    }

                                    let template_map_entry = instance_obj.entry("template".to_string())
                                        .or_insert_with(|| Value::Object(serde_json::Map::new()));
                                    
                                    if let Some(template_obj) = template_map_entry.as_object_mut() {
                                        template_obj.insert("mode".to_string(), Value::String("replica".to_string()));
                                        template_obj.insert("sourceTemplateName".to_string(), Value::String(payload.target_template_name.clone()));
                                        template_obj.insert("templateName".to_string(), Value::String("".to_string())); // Clear specific template name for replicas
                                        // Keep existing or add defaults for other replica properties
                                        template_obj.entry("replicaHierarchyInSyncWithTemplate".to_string()).or_insert(Value::Bool(true));
                                        template_obj.entry("templatePropagateHierarchyChanges".to_string()).or_insert(Value::Bool(true));
                                        template_obj.entry("replicaIgnoreTemplateHierarchyChanges".to_string()).or_insert(Value::Bool(false));
                                        template_obj.entry("components".to_string()).or_insert_with(|| Value::Array(vec![]));
                                        
                                        total_instances_modified += 1;
                                        layout_modified_this_iteration = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if layout_modified_this_iteration {
            let updated_content = serde_json::to_string_pretty(&layout_data)
                .map_err(|e| format!("Failed to serialize layout JSON for {:?}: {}", full_layout_path, e))?;
            fs::write(&full_layout_path, updated_content)
                .map_err(|e| format!("Failed to write updated layout file {:?}: {}", full_layout_path, e))?;
            modified_layouts_count += 1;
        }
    }
    Ok(format!("Successfully modified {} instances of type '{}' across {} layouts to be replicas of '{}'.", total_instances_modified, payload.object_type_name, modified_layouts_count, payload.target_template_name))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_png_dimensions,
            extract_zip,
            save_zip,
            get_layout_list_from_c3proj,
            get_project_defined_templates,
            get_layout_instances_info,
            set_instances_as_replicas,
            set_all_instances_of_type_as_replicas_project_wide
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}