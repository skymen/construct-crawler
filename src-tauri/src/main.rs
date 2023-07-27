// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
fn read_png_dimensions(file_path: String) -> tauri::Result<(u32, u32)> {
  use std::fs::File;
  use std::io::{Read, Cursor};
  use byteorder::{BigEndian, ReadBytesExt};

  let mut file = File::open(file_path)?;
  let mut buffer = vec![0; 24];
  file.read_exact(&mut buffer)?;

  let mut cursor = Cursor::new(buffer);
  cursor.set_position(16);  // Skip to the width/height bytes

  let width = cursor.read_u32::<BigEndian>()?;
  let height = cursor.read_u32::<BigEndian>()?;

  Ok((width, height))
}

#[tauri::command]
async fn extract_zip(webview: tauri::WebviewMut, zip_path: String, extract_to: String) -> Result<(), String> {
  use std::path::Path;
use std::fs::File;
use zip::ZipArchive;
use tauri::Manager;
    let reader = File::open(&zip_path);
    let mut archive = match reader {
        Ok(file) => match ZipArchive::new(file) {
            Ok(zip) => zip,
            Err(_) => return Err("Failed to read the zip archive.".to_string()),
        },
        Err(_) => return Err("Failed to open the zip file.".to_string()),
    };
    
    let total_files = archive.len();
    
    for i in 0..total_files {
        let mut file = match archive.by_index(i) {
            Ok(file) => file,
            Err(_) => return Err(format!("Failed to access file at index {} in the zip archive.", i)),
        };

        let outpath = Path::new(&extract_to).join(file.sanitized_name());
        
        if (&*file.name()).ends_with('/') {
            std::fs::create_dir_all(&outpath);
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    std::fs::create_dir_all(&p);
                }
            }
            let mut outfile = File::create(&outpath).unwrap();
            std::io::copy(&mut file, &mut outfile).unwrap();
        }

        // calculate progress
        let progress = ((i as f32 / total_files as f32) * 100.0).round() as i32;
        
        // Send the progress back to the JS thread
        let _ = webview.emit("progress", Some(progress)).await;
    }

    Ok(())
}




fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_png_dimensions])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
