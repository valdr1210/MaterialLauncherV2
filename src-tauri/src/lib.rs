mod auth;
mod commands;
mod config;
mod crash;
mod crypto;
mod java;
mod launcher;
mod modloaders;
mod mods;

use serde_json::json;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if let Some(win) = app.get_webview_window("main") {
                let win_clone = win.clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::Resized(_) = event {
                        let is_max = win_clone.is_maximized().unwrap_or(false);
                        let _ = win_clone.emit("window-state-changed", json!({ "isMaximized": is_max }));
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::window_minimize,
            commands::window_maximize,
            commands::window_close,
            commands::open_external,
            commands::mc_get_versions,
            commands::mc_get_loader_versions,
            commands::mc_get_config,
            commands::mc_save_config,
            commands::get_locale_data,
            commands::mc_get_installed_javas,
            commands::mc_select_java_file,
            commands::ms_login_start,
            commands::ms_login_browser_start,
            commands::ms_login_cancel,
            commands::ely_login_start,
            commands::mc_launch,
            commands::mc_open_folder,
            commands::mc_select_minecraft_folder,
            commands::mc_get_default_folder,
            commands::mc_inspect_folder,
            commands::mc_migrate_folder,
            commands::mc_open_mods_folder,
            commands::mc_open_instance_folder,
            commands::mc_download_single_mod,
            commands::mc_download_instance_mods,
            commands::mc_delete_mod_file,
            commands::mc_toggle_mod,
            commands::mc_delete_instance_folder,
            commands::mc_get_instance_jars,
            commands::mc_get_instance_disk_mods,
            commands::mc_search_mods,
            commands::mc_upload_mclogs,
            commands::mc_analyze_crash,
            commands::mc_select_mrpack_file,
            commands::mc_import_mrpack,
            commands::mc_select_export_instance_path,
            commands::mc_export_instance,
            commands::mc_select_import_instance_file,
            commands::mc_import_instance,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Material Launcher");
}
