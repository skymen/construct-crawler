// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(non_snake_case)]

use std::fs::File;
use std::io::{Read, Cursor};
use std::fmt;
use std::path::Path;
use byteorder::{BigEndian, ReadBytesExt};
use zip::ZipArchive;
use zip::result::ZipError;
use std::io::{Error as IoError, ErrorKind};
use tokio;
use walkdir::WalkDir;
use std::io::Write;


#[tauri::command]
fn read_png_dimensions(file_path: String) -> tauri::Result<(u32, u32)> {

  let mut file = File::open(file_path)?;
  let mut buffer = vec![0; 24];
  file.read_exact(&mut buffer)?;

  let mut cursor = Cursor::new(buffer);
  cursor.set_position(16);  // Skip to the width/height bytes

  let width = cursor.read_u32::<BigEndian>()?;
  let height = cursor.read_u32::<BigEndian>()?;

  Ok((width, height))
}


#[derive(Debug)]
enum MyError {
    IoError(IoError),
    ZipError(ZipError),
    WalkDirError(walkdir::Error),
}

impl fmt::Display for MyError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            MyError::IoError(e) => write!(f, "{}", e),
            MyError::ZipError(e) => write!(f, "{}", e),
            MyError::WalkDirError(e) => write!(f, "{}", e),
        }
    }
}

impl std::error::Error for MyError {}
impl From<std::io::Error> for MyError {
    fn from(e: std::io::Error) -> Self {
        MyError::IoError(e)
    }
}
impl From<MyError> for tauri::Error {
    fn from(error: MyError) -> Self {
        match error {
            MyError::IoError(e) => tauri::Error::from(e),
            MyError::ZipError(e) => tauri::Error::from(IoError::new(ErrorKind::Other, e.to_string())),
            MyError::WalkDirError(e) => tauri::Error::from(IoError::new(ErrorKind::Other, e.to_string())),
        }
    }
}

// the payload type must implement `Serialize` and `Clone`.
#[derive(Clone, serde::Serialize)]
struct Payload {
  progress: f64,
  filename: String,
  done: bool,
}

#[tauri::command]
async fn extract_zip(window: tauri::Window, zip_path: String, dest_path: String) -> Result<(), tauri::Error> {
  let result = tokio::spawn(async move {
    let reader = File::open(zip_path).map_err(MyError::IoError)?;
    let mut archive = ZipArchive::new(reader).map_err(MyError::ZipError)?;

    let total_files = archive.len();

    let mut progress ;

    window.emit("progress", Payload { progress: 0.0, filename: "".into(), done: false }).unwrap();

    for i in 0..total_files {
      let mut file = archive.by_index(i).map_err(MyError::ZipError)?;
      let outpath = std::path::Path::new(&dest_path).join(file.name());
      if file.is_dir() {
        std::fs::create_dir_all(&outpath)?;
      } else {
        if let Some(p) = outpath.parent() {
          if !p.exists() {
            std::fs::create_dir_all(&p).map_err(MyError::IoError)?;
          }
        }
        let mut outfile = File::create(&outpath).map_err(MyError::IoError)?;
        std::io::copy(&mut file, &mut outfile).map_err(MyError::IoError)?;

        // Emit a 'progress' event
        progress = ((i + 1) as f64 / total_files as f64) as f64;
        window.emit("progress", Payload { progress, filename: file.name().into(), done: false }).unwrap();
      }
    }

    window.emit("progress", Payload { progress: 1.0, filename: "".into(), done: true }).unwrap();
    Ok::<_, MyError>(())
  }).await.map_err(|e| tauri::Error::from(e))?;

  match result {
      Ok(()) => Ok(()),
      Err(e) => Err(tauri::Error::from(std::io::Error::new(std::io::ErrorKind::Other, format!("Task panicked: {:?}", e)))),
  }
}

#[tauri::command]
async fn save_zip(window: tauri::Window, dir_path: String, zip_path: String) -> Result<(), tauri::Error> {
  let result = tokio::spawn(async move {
    let zip_file = File::create(&zip_path).map_err(MyError::IoError)?;

    // Count total number of files first
    let total_files = WalkDir::new(&dir_path).into_iter().filter_map(|e| e.ok()).count();

    let walkdir = WalkDir::new(&dir_path);
    let it = walkdir.into_iter();

    let mut zip = zip::ZipWriter::new(zip_file);
    let mut options = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755)
        .large_file(true);

    let mut buffer = Vec::new();
    let mut processed_files = 0;

    for entry in it {
      let entry = entry.map_err(MyError::WalkDirError)?;
      let path = entry.path();
      let name = path.strip_prefix(Path::new(&dir_path)).unwrap();

      if path.is_file() {
        let ext = path.extension()
            .and_then(std::ffi::OsStr::to_str)
            .unwrap_or("");

        let compression = if ext == "webm" {
            // Use 'Store' for .webm files (no compression)
            zip::CompressionMethod::Stored
        } else {
            // Use 'Deflated' for other files
            zip::CompressionMethod::Deflated
        };
        options = options.compression_method(compression);  // You can choose another compression method
        zip.start_file(name.to_string_lossy().as_ref(), options).map_err(MyError::ZipError)?;
        let mut f = File::open(path).map_err(MyError::IoError)?;

        f.read_to_end(&mut buffer).map_err(MyError::IoError)?;
        zip.write_all(&*buffer).map_err(MyError::IoError)?;
        buffer.clear();

        // Count the processed files and calculate the progress
        processed_files += 1;
        let progress = processed_files as f64 / total_files as f64;
        window.emit("progress", Payload { progress, filename: name.to_string_lossy().into(), done: false }).unwrap();
      }
    }
    zip.finish().map_err(MyError::ZipError)?;
    window.emit("progress", Payload { progress: 1.0, filename: "".into(), done: true }).unwrap();
    Ok::<_, MyError>(())
  }).await.map_err(|e| tauri::Error::from(e))?;

  match result {
      Ok(()) => Ok(()),
      Err(e) => Err(tauri::Error::from(std::io::Error::new(std::io::ErrorKind::Other, format!("Task panicked: {:?}", e)))),
  }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_png_dimensions, extract_zip, save_zip])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
