use crate::{auth, config, crash, java, launcher, modloaders, mods};
use serde_json::{json, Value};
use std::fs;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub fn window_minimize(app: AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.minimize();
    }
}

#[tauri::command]
pub fn window_maximize(app: AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_maximized().unwrap_or(false) {
            let _ = win.unmaximize();
        } else {
            let _ = win.maximize();
        }
    }
}

#[tauri::command]
pub fn window_close(app: AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.close();
    }
}

#[tauri::command]
pub fn open_external(url: String) {
    if url.starts_with("https://") || url.starts_with("http://") {
        let _ = open::that(&url);
    }
}

#[tauri::command]
pub async fn mc_get_versions() -> Value {
    modloaders::get_version_manifest(false).await
}

#[tauri::command]
pub async fn mc_get_loader_versions(loader: String, game_version: String) -> Vec<Value> {
    modloaders::get_loader_versions(&loader, &game_version).await
}

#[tauri::command]
pub fn mc_get_config() -> Value {
    config::load_config()
}

#[tauri::command]
pub fn mc_save_config(cfg: Value) -> bool {
    config::save_config(&cfg).is_ok()
}

#[tauri::command]
pub fn get_locale_data(app: AppHandle, code: String) -> Option<Value> {
    if code.is_empty()
        || !code
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return None;
    }
    let rel = format!("locales/{}.json", code);
    if let Ok(res_dir) = app.path().resource_dir() {
        let p = res_dir.join("src").join(&rel);
        if let Ok(raw) = fs::read_to_string(&p) {
            if let Ok(v) = serde_json::from_str::<Value>(&raw) {
                return Some(v);
            }
        }
        let p2 = res_dir.join(&rel);
        if let Ok(raw) = fs::read_to_string(&p2) {
            if let Ok(v) = serde_json::from_str::<Value>(&raw) {
                return Some(v);
            }
        }
    }
    // Dev fallback relative to project root
    let dev_p = std::path::PathBuf::from("..").join("src").join(&rel);
    if let Ok(raw) = fs::read_to_string(&dev_p) {
        if let Ok(v) = serde_json::from_str::<Value>(&raw) {
            return Some(v);
        }
    }
    None
}

#[tauri::command]
pub fn mc_get_installed_javas() -> Vec<java::JavaInfo> {
    java::find_installed_javas()
}

#[tauri::command]
pub async fn mc_select_java_file(app: AppHandle) -> Option<String> {
    #[cfg(windows)]
    let builder = app
        .dialog()
        .file()
        .set_title("Выберите исполняемый файл Java (javaw.exe)")
        .add_filter("Исполняемые файлы Java (*.exe)", &["exe"])
        .add_filter("Все файлы (*.*)", &["*"]);

    #[cfg(not(windows))]
    let builder = app
        .dialog()
        .file()
        .set_title("Выберите исполняемый файл Java (java)")
        .add_filter("Все файлы (*)", &["*"]);

    let picked = builder.blocking_pick_file();
    picked.map(|p| p.to_string())
}

#[tauri::command]
pub async fn ms_login_start(app: AppHandle) -> Value {
    auth::login_with_microsoft(&app).await
}

#[tauri::command]
pub async fn ms_login_browser_start(app: AppHandle) -> Value {
    auth::login_with_microsoft_browser(&app).await
}

#[tauri::command]
pub fn ms_login_cancel() -> Value {
    auth::cancel_microsoft_login();
    json!({ "success": true })
}

#[tauri::command]
pub async fn ely_login_start(username: String, password: String) -> Value {
    auth::login_with_ely_by(&username, &password).await
}

#[tauri::command]
pub async fn mc_launch(app: AppHandle, opts: Option<Value>) -> Value {
    let opts_val = opts.unwrap_or(json!({}));
    let hide_on_launch = opts_val
        .get("hideLauncherOnLaunch")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if hide_on_launch {
        if let Some(win) = app.get_webview_window("main") {
            let _ = win.hide();
        }
    }

    match launcher::launch_minecraft(app.clone(), opts_val).await {
        Ok(res) => res,
        Err(err) => {
            if hide_on_launch {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                }
            }
            json!({ "success": false, "error": err })
        }
    }
}

#[tauri::command]
pub fn mc_open_folder() -> bool {
    let dir = config::get_minecraft_dir(None);
    let _ = open::that(&dir);
    true
}

#[tauri::command]
pub async fn mc_select_minecraft_folder(app: AppHandle) -> Option<String> {
    let current = config::get_minecraft_dir(None);
    let picked = app
        .dialog()
        .file()
        .set_title("Выберите папку для данных Minecraft")
        .set_directory(current)
        .blocking_pick_folder();
    picked.map(|p| p.to_string())
}

#[tauri::command]
pub fn mc_get_default_folder() -> String {
    config::get_default_minecraft_dir().to_string_lossy().into_owned()
}

#[tauri::command]
pub fn mc_inspect_folder(folder_path: String) -> Value {
    config::inspect_minecraft_dir(&folder_path)
}

#[tauri::command]
pub fn mc_migrate_folder(old_path: String, new_path: String, action: String) -> Value {
    match config::migrate_minecraft_dir(&old_path, &new_path, &action) {
        Ok(v) => v,
        Err(e) => json!({ "success": false, "error": e }),
    }
}

#[tauri::command]
pub fn mc_open_mods_folder(instance_id: Option<String>) -> Value {
    let cfg = config::load_config();
    let inst_id = instance_id.or_else(|| {
        cfg.get("selectedInstanceId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    });
    let target = if let Some(id) = inst_id.filter(|s| !s.is_empty()) {
        match config::get_instance_mods_dir(&id) {
            Ok(d) => d,
            Err(e) => return json!({ "success": false, "error": e }),
        }
    } else {
        let d = config::get_minecraft_dir(None).join("mods");
        let _ = fs::create_dir_all(&d);
        d
    };
    match open::that(&target) {
        Ok(_) => json!(true),
        Err(e) => json!({ "success": false, "error": e.to_string() }),
    }
}

#[tauri::command]
pub fn mc_open_instance_folder(instance_id: Option<String>) -> Value {
    let cfg = config::load_config();
    let inst_id = instance_id.or_else(|| {
        cfg.get("selectedInstanceId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    });
    let target = if let Some(id) = inst_id.filter(|s| !s.is_empty()) {
        match config::get_instance_dir(&id) {
            Ok(d) => d,
            Err(e) => return json!({ "success": false, "error": e }),
        }
    } else {
        config::get_minecraft_dir(None)
    };
    match open::that(&target) {
        Ok(_) => json!(true),
        Err(e) => json!({ "success": false, "error": e.to_string() }),
    }
}

#[tauri::command]
pub async fn mc_download_single_mod(instance_id: String, mod_obj: Value) -> Value {
    match mods::download_mod_file(&instance_id, &mod_obj, None, None).await {
        Ok(v) => v,
        Err(e) => json!({ "success": false, "error": e }),
    }
}

#[tauri::command]
pub async fn mc_download_instance_mods(app: AppHandle, instance_id: String) -> Value {
    match mods::download_all_instance_mods(Some(&app), &instance_id).await {
        Ok(v) => v,
        Err(e) => json!({ "success": false, "error": e }),
    }
}

#[tauri::command]
pub fn mc_delete_mod_file(instance_id: String, mod_id: String, file_name: Option<String>) -> Value {
    match mods::delete_mod_file(&instance_id, &mod_id, file_name.as_deref()) {
        Ok(v) => v,
        Err(e) => json!({ "success": false, "error": e }),
    }
}

#[tauri::command]
pub fn mc_toggle_mod(instance_id: String, mod_id: String, enabled: bool) -> Value {
    match mods::toggle_mod_state(&instance_id, &mod_id, enabled) {
        Ok(v) => v,
        Err(e) => json!({ "success": false, "error": e }),
    }
}

#[tauri::command]
pub fn mc_delete_instance_folder(instance_id: String) -> Value {
    match config::delete_instance_folder(&instance_id) {
        Ok(v) => v,
        Err(e) => json!({ "success": false, "error": e }),
    }
}

#[tauri::command]
pub fn mc_get_instance_jars(instance_id: String) -> Value {
    match mods::get_instance_jars(&instance_id) {
        Ok(jars) => json!({ "success": true, "jars": jars }),
        Err(e) => json!({ "success": false, "error": e, "jars": [] }),
    }
}

#[tauri::command]
pub async fn mc_get_instance_disk_mods(instance_id: String) -> Value {
    let list = mods::get_instance_disk_mods(&instance_id).await;
    json!({ "success": true, "mods": list })
}

#[tauri::command]
pub async fn mc_search_mods(params: Value) -> Value {
    mods::search_mods(params).await
}

#[tauri::command]
pub async fn mc_upload_mclogs(log_text: String) -> Value {
    match crash::upload_to_mclogs(&log_text).await {
        Ok(v) => v,
        Err(e) => json!({ "success": false, "error": e }),
    }
}

#[tauri::command]
pub fn mc_analyze_crash(log_text: String) -> Value {
    let diag = crash::analyze_crash_log(&log_text);
    json!({ "success": true, "diagnosis": diag })
}

#[tauri::command]
pub async fn mc_select_mrpack_file(app: AppHandle) -> Option<String> {
    let picked = app
        .dialog()
        .file()
        .set_title("Выберите файл сборки Modrinth (*.mrpack)")
        .add_filter("Modrinth Modpack (*.mrpack)", &["mrpack"])
        .add_filter("Все файлы", &["*"])
        .blocking_pick_file();
    picked.map(|p| p.to_string())
}

#[tauri::command]
pub async fn mc_import_mrpack(app: AppHandle, mrpack_path: String) -> Value {
    match mods::import_modpack_mrpack(Some(&app), &mrpack_path).await {
        Ok(v) => v,
        Err(e) => json!({ "success": false, "error": e }),
    }
}

#[tauri::command]
pub async fn mc_select_export_instance_path(app: AppHandle, default_name: Option<String>) -> Option<String> {
    let raw = default_name.unwrap_or_else(|| "instance".to_string());
    let safe: String = raw
        .chars()
        .map(|c| if "<>:\"/\\|?*".contains(c) { '_' } else { c })
        .collect();
    let safe_trimmed = if safe.trim().is_empty() { "instance" } else { safe.trim() };
    let picked = app
        .dialog()
        .file()
        .set_title("Экспортировать сборку")
        .set_file_name(format!("{}.zip", safe_trimmed))
        .add_filter("Архив сборки (*.zip)", &["zip"])
        .add_filter("Material Launcher Pack (*.mlpack)", &["mlpack"])
        .blocking_save_file();
    picked.map(|p| p.to_string())
}

#[tauri::command]
pub async fn mc_export_instance(app: AppHandle, instance_id: String, dest_path: String) -> Value {
    let app_c = app.clone();
    let res = tokio::task::spawn_blocking(move || {
        mods::export_instance(Some(&app_c), &instance_id, &dest_path)
    })
    .await
    .map_err(|e| e.to_string())
    .and_then(|r| r);

    match res {
        Ok(v) => v,
        Err(e) => json!({ "success": false, "error": e }),
    }
}

#[tauri::command]
pub async fn mc_select_import_instance_file(app: AppHandle) -> Option<String> {
    let picked = app
        .dialog()
        .file()
        .set_title("Выберите архив сборки (*.zip, *.mlpack)")
        .add_filter("Архив сборки (*.zip, *.mlpack)", &["zip", "mlpack"])
        .add_filter("Все файлы", &["*"])
        .blocking_pick_file();
    picked.map(|p| p.to_string())
}

#[tauri::command]
pub async fn mc_import_instance(app: AppHandle, archive_path: String) -> Value {
    match mods::import_instance(Some(&app), &archive_path).await {
        Ok(v) => v,
        Err(e) => json!({ "success": false, "error": e }),
    }
}
