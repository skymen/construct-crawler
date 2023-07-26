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



fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_png_dimensions])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
