use crate::auth::refresh_microsoft_token;
use crate::config::{get_instance_dir, get_instance_mods_dir, get_minecraft_dir, load_config, prism_dir, save_config};
use crate::java::{apply_windows_gpu_preference, get_java_major_version, resolve_java_for_version};
use crate::modloaders::{
    ensure_authlib_injector, ensure_fabric_profile, ensure_forge_installer, ensure_forge_wrapper,
    ensure_quilt_profile, get_version_manifest,
};
use crate::mods::{download_all_instance_mods, stream_download_to_file};
use md5::{Digest as Md5Digest, Md5};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use zip::ZipArchive;

fn current_os_name() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "windows"
    }
    #[cfg(target_os = "macos")]
    {
        "osx"
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        "linux"
    }
}

fn classpath_sep() -> &'static str {
    #[cfg(windows)]
    {
        ";"
    }
    #[cfg(not(windows))]
    {
        ":"
    }
}

fn offline_uuid(name: &str) -> String {
    let mut hasher = Md5::new();
    hasher.update(format!("OfflinePlayer:{}", name).as_bytes());
    let mut bytes: [u8; 16] = hasher.finalize().into();
    bytes[6] = (bytes[6] & 0x0f) | 0x30;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[0], bytes[1], bytes[2], bytes[3],
        bytes[4], bytes[5],
        bytes[6], bytes[7],
        bytes[8], bytes[9],
        bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]
    )
}

fn check_rules(rules: Option<&Value>, has_custom_res: bool) -> bool {
    let Some(arr) = rules.and_then(|v| v.as_array()) else {
        return true;
    };
    if arr.is_empty() {
        return true;
    }
    let os_name = current_os_name();
    let mut allowed = false;
    for rule in arr {
        let action = rule.get("action").and_then(|v| v.as_str()).unwrap_or("allow");
        let mut matches = true;
        if let Some(os_obj) = rule.get("os") {
            if let Some(name) = os_obj.get("name").and_then(|v| v.as_str()) {
                if name != os_name {
                    matches = false;
                }
            }
        }
        if let Some(features) = rule.get("features").and_then(|v| v.as_object()) {
            for (k, v) in features {
                let want = v.as_bool().unwrap_or(false);
                let actual = match k.as_str() {
                    "has_custom_resolution" => has_custom_res,
                    _ => false,
                };
                if actual != want {
                    matches = false;
                }
            }
        }
        if matches {
            allowed = action == "allow";
        }
    }
    allowed
}

fn maven_coords_to_path(coords: &str) -> Option<String> {
    let parts: Vec<&str> = coords.split(':').collect();
    if parts.len() < 3 {
        return None;
    }
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let ver_and_ext: Vec<&str> = parts[2].split('@').collect();
    let version = ver_and_ext[0];
    let ext = if parts.len() >= 4 {
        let p3: Vec<&str> = parts[3].split('@').collect();
        let e = p3.get(1).copied().unwrap_or("jar");
        format!("-{}.{}", p3[0], e)
    } else {
        let e = ver_and_ext.get(1).copied().unwrap_or("jar");
        format!(".{}", e)
    };
    Some(format!("{}/{}/{}/{}-{}{}", group, artifact, version, artifact, version, ext))
}

async fn ensure_version_json(mc_dir: &Path, version_id: &str) -> Result<Value, String> {
    let v_dir = mc_dir.join("versions").join(version_id);
    let v_json_path = v_dir.join(format!("{}.json", version_id));
    if v_json_path.exists() {
        if let Ok(raw) = fs::read_to_string(&v_json_path) {
            if let Ok(val) = serde_json::from_str::<Value>(&raw) {
                return Ok(val);
            }
        }
    }

    let manifest = get_version_manifest(false).await;
    let url = manifest
        .get("versions")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.iter().find(|item| item.get("id").and_then(|x| x.as_str()) == Some(version_id)))
        .and_then(|item| item.get("url"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("Версия {} не найдена в манифесте Mojang", version_id))?
        .to_string();

    fs::create_dir_all(&v_dir).map_err(|e| e.to_string())?;
    let resp = reqwest::Client::new()
        .get(&url)
        .timeout(std::time::Duration::from_secs(20))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let text = resp.text().await.map_err(|e| e.to_string())?;
    let val: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let _ = fs::write(&v_json_path, &text);
    Ok(val)
}

fn merge_version_json(base: Value, child: Value) -> Value {
    let mut merged = base;
    if let Some(mc) = child.get("mainClass").and_then(|v| v.as_str()) {
        merged["mainClass"] = json!(mc);
    }
    if let Some(ma) = child.get("minecraftArguments").and_then(|v| v.as_str()) {
        merged["minecraftArguments"] = json!(ma);
    }
    if let Some(child_libs) = child.get("libraries").and_then(|v| v.as_array()) {
        let mut libs = merged
            .get("libraries")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        let mut combined = child_libs.clone();
        combined.append(&mut libs);
        merged["libraries"] = Value::Array(combined);
    }
    if let Some(child_args) = child.get("arguments") {
        if merged.get("arguments").is_none() {
            merged["arguments"] = json!({ "game": [], "jvm": [] });
        }
        for key in ["game", "jvm"] {
            if let Some(carr) = child_args.get(key).and_then(|v| v.as_array()) {
                let mut existing = merged
                    .pointer(&format!("/arguments/{}", key))
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();
                existing.extend(carr.clone());
                merged["arguments"][key] = Value::Array(existing);
            }
        }
    }
    merged
}

fn emit_log(app: &AppHandle, msg: &str) {
    let _ = app.emit("mc-launch-log", msg);
}

fn emit_status(app: &AppHandle, payload: Value) {
    let _ = app.emit("mc-launch-status", payload);
}

fn emit_progress(app: &AppHandle, kind: &str, current: usize, total: usize) {
    let pct = if total > 0 { ((current * 100) / total).min(100) } else { 100 };
    let _ = app.emit(
        "mc-launch-progress",
        json!({ "type": kind, "current": current, "total": total, "percent": pct }),
    );
    emit_status(
        app,
        json!({ "status": "downloading", "percent": pct, "type": kind, "current": current, "total": total }),
    );
}

pub async fn launch_minecraft(app: AppHandle, opts: Value) -> Result<Value, String> {
    let mut cfg = load_config();
    let version_id = opts
        .get("version")
        .and_then(|v| v.as_str())
        .or_else(|| cfg.get("selectedVersion").and_then(|v| v.as_str()))
        .unwrap_or("26.1.2")
        .to_string();
    let version_type = opts
        .get("versionType")
        .and_then(|v| v.as_str())
        .or_else(|| cfg.get("selectedVersionType").and_then(|v| v.as_str()))
        .unwrap_or("release")
        .to_string();

    let active_instance_id = opts
        .get("instanceId")
        .and_then(|v| v.as_str())
        .or_else(|| cfg.get("selectedInstanceId").and_then(|v| v.as_str()))
        .map(|s| s.to_string());

    let target_inst = active_instance_id.as_ref().and_then(|id| {
        cfg.get("instances")
            .and_then(|v| v.as_array())
            .and_then(|arr| arr.iter().find(|i| i.get("id").and_then(|x| x.as_str()) == Some(id)))
            .cloned()
    });

    let loader_type = target_inst
        .as_ref()
        .and_then(|i| i.get("loader"))
        .and_then(|v| v.as_str())
        .unwrap_or_else(|| {
            if version_type != "release" && version_type != "snapshot" {
                &version_type
            } else {
                "vanilla"
            }
        })
        .to_lowercase();

    let is_auto_java = opts
        .get("autoJavaSwitch")
        .and_then(|v| v.as_bool())
        .or_else(|| cfg.get("autoJavaSwitch").and_then(|v| v.as_bool()))
        .unwrap_or(true);
    let manual_java = opts
        .get("manualJavaPath")
        .and_then(|v| v.as_str())
        .or_else(|| cfg.get("manualJavaPath").and_then(|v| v.as_str()))
        .unwrap_or("");
    let selected_java = resolve_java_for_version(&version_id, is_auto_java, manual_java);
    apply_windows_gpu_preference(&selected_java);

    let min_ram = opts
        .get("minRam")
        .or_else(|| cfg.get("minRam"))
        .and_then(|v| v.as_u64())
        .unwrap_or(512)
        .max(256);
    let max_ram = opts
        .get("maxRam")
        .or_else(|| opts.get("ram"))
        .or_else(|| cfg.get("maxRam"))
        .and_then(|v| v.as_u64())
        .unwrap_or(4096)
        .max(min_ram);
    let perm_gen = opts
        .get("permGen")
        .or_else(|| cfg.get("permGen"))
        .and_then(|v| v.as_u64())
        .unwrap_or(128);

    let width = opts
        .get("windowWidth")
        .or_else(|| cfg.get("windowWidth"))
        .and_then(|v| v.as_u64())
        .unwrap_or(854);
    let height = opts
        .get("windowHeight")
        .or_else(|| cfg.get("windowHeight"))
        .and_then(|v| v.as_u64())
        .unwrap_or(480);
    let fullscreen = opts
        .get("fullscreen")
        .and_then(|v| v.as_bool())
        .or_else(|| cfg.get("fullscreen").and_then(|v| v.as_bool()))
        .unwrap_or(false);

    // Resolve account & refresh Microsoft token if needed
    let mut active_acc = opts
        .get("account")
        .cloned()
        .or_else(|| {
            cfg.get("accounts")
                .and_then(|v| v.as_array())
                .and_then(|arr| {
                    arr.iter()
                        .find(|a| a.get("active").and_then(|x| x.as_bool()) == Some(true))
                        .or_else(|| arr.first())
                        .cloned()
                })
        })
        .unwrap_or_else(|| json!({ "name": "Player", "type": "offline" }));

    let acc_type = active_acc.get("type").and_then(|v| v.as_str()).unwrap_or("offline").to_string();
    if acc_type == "mojang" && !active_acc.get("refresh_token").and_then(|v| v.as_str()).unwrap_or("").is_empty() {
        match refresh_microsoft_token(&mut active_acc).await {
            Ok(_) => {
                if let Some(accs) = cfg.get_mut("accounts").and_then(|v| v.as_array_mut()) {
                    let acc_name = active_acc.get("name").and_then(|v| v.as_str()).unwrap_or("");
                    if let Some(found) = accs.iter_mut().find(|a| a.get("name").and_then(|v| v.as_str()) == Some(acc_name)) {
                        *found = active_acc.clone();
                        let _ = save_config(&cfg);
                    }
                }
                emit_log(&app, "[MaterialLauncher]: Токен Microsoft успешно обновлен в фоне.");
            }
            Err(e) => {
                emit_log(&app, &format!("[MaterialLauncher]: Фоновое обновление токена пропущено: {}", e));
            }
        }
    }

    let player_name = active_acc.get("name").and_then(|v| v.as_str()).unwrap_or("Player").to_string();
    let player_uuid = active_acc
        .get("uuid")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty() && !s.starts_with("offline_"))
        .map(|s| s.to_string())
        .unwrap_or_else(|| offline_uuid(&player_name));
    let access_token = active_acc
        .get("access_token")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .unwrap_or("offline-token")
        .to_string();
    let user_type = if acc_type == "mojang" { "msa" } else { "mojang" };

    // Instance isolation & mod downloading
    let mc_dir = get_minecraft_dir(Some(&cfg));
    let game_dir = if let Some(ref inst) = target_inst {
        let inst_id = inst.get("id").and_then(|v| v.as_str()).unwrap_or("");
        let d = get_instance_dir(inst_id)?;
        let md = get_instance_mods_dir(inst_id)?;
        emit_log(&app, &format!("[MaterialLauncher]: Изолированная папка версии: {}", d.display()));
        emit_log(&app, &format!("[MaterialLauncher]: Изолированная папка модов: {}", md.display()));
        if inst.get("mods").and_then(|v| v.as_array()).map(|a| !a.is_empty()).unwrap_or(false) {
            emit_status(&app, json!({ "status": "downloading", "message": "Проверка и скачивание модов..." }));
            let _ = download_all_instance_mods(Some(&app), inst_id).await;
        }
        d
    } else {
        mc_dir.clone()
    };

    // Mod loader setup
    let raw_loader_ver = opts
        .get("loaderVersion")
        .and_then(|v| v.as_str())
        .or_else(|| target_inst.as_ref().and_then(|i| i.get("loaderVersion")).and_then(|v| v.as_str()))
        .unwrap_or("latest");
    let preferred_loader = if raw_loader_ver != "latest" && !raw_loader_ver.is_empty() {
        Some(raw_loader_ver)
    } else {
        None
    };

    let mut custom_profile: Option<String> = None;
    let mut forge_installer: Option<PathBuf> = None;

    if loader_type == "fabric" {
        emit_status(&app, json!({ "status": "preparing", "message": "Подготовка загрузчика Fabric..." }));
        custom_profile = ensure_fabric_profile(&version_id, preferred_loader).await;
        if let Some(ref p) = custom_profile {
            emit_log(&app, &format!("[MaterialLauncher]: Установлен профиль Fabric: {}", p));
        }
    } else if loader_type == "quilt" {
        emit_status(&app, json!({ "status": "preparing", "message": "Подготовка загрузчика Quilt..." }));
        custom_profile = ensure_quilt_profile(&version_id, preferred_loader).await;
        if let Some(ref p) = custom_profile {
            emit_log(&app, &format!("[MaterialLauncher]: Установлен профиль Quilt: {}", p));
        }
    } else if loader_type == "forge" {
        emit_status(&app, json!({ "status": "preparing", "message": "Подготовка загрузчика Forge..." }));
        match ensure_forge_installer(&version_id, preferred_loader).await {
            Ok(p) => {
                emit_log(&app, &format!("[MaterialLauncher]: Найден установщик Forge: {}", p.display()));
                forge_installer = Some(p);
            }
            Err(e) => {
                emit_log(&app, &format!("[MaterialLauncher]: Ошибка подготовки Forge: {}", e));
            }
        }
    }

    emit_log(&app, &format!("[MaterialLauncher]: Запуск Minecraft {} ({})", version_id, version_type));
    emit_log(&app, &format!("[MaterialLauncher]: Java: {}", selected_java));
    emit_log(&app, &format!("[MaterialLauncher]: Игрок: {} ({})", player_name, acc_type));
    emit_log(&app, &format!("[MaterialLauncher]: Память: {}M - {}M, Разрешение: {}x{}", min_ram, max_ram, width, height));
    emit_status(&app, json!({ "status": "preparing", "message": format!("Подготовка к запуску {}...", version_id) }));

    // 1. Load base version.json and merge loader profile if present
    let base_vjson = ensure_version_json(&mc_dir, &version_id).await?;
    let mut vjson = base_vjson.clone();

    if let Some(ref prof_id) = custom_profile {
        let prof_path = mc_dir.join("versions").join(prof_id).join(format!("{}.json", prof_id));
        if let Ok(raw) = fs::read_to_string(&prof_path) {
            if let Ok(prof_json) = serde_json::from_str::<Value>(&raw) {
                vjson = merge_version_json(vjson, prof_json);
            }
        }
    }

    let mut use_forge_wrapper = false;
    let mut forge_wrapper_jar: Option<PathBuf> = None;
    let mut extra_libs: Vec<Value> = Vec::new();

    if let Some(ref inst_jar) = forge_installer {
        if let Ok(f) = File::open(inst_jar) {
            if let Ok(mut zip) = ZipArchive::new(f) {
                if let Ok(mut vj) = zip.by_name("version.json") {
                    let mut s = String::new();
                    if vj.read_to_string(&mut s).is_ok() {
                        if let Ok(fj) = serde_json::from_str::<Value>(&s) {
                            vjson = merge_version_json(vjson, fj);
                            use_forge_wrapper = true;
                        }
                    }
                }
                if let Ok(mut ip) = zip.by_name("install_profile.json") {
                    let mut s = String::new();
                    if ip.read_to_string(&mut s).is_ok() {
                        if let Ok(ip_json) = serde_json::from_str::<Value>(&s) {
                            if let Some(libs) = ip_json.get("libraries").and_then(|v| v.as_array()) {
                                extra_libs.extend(libs.clone());
                            }
                            if !use_forge_wrapper {
                                if let Some(vi) = ip_json.get("versionInfo") {
                                    vjson = merge_version_json(vjson, vi.clone());
                                }
                            }
                        }
                    }
                }
            }
        }
        if use_forge_wrapper {
            if let Ok(fw) = ensure_forge_wrapper().await {
                forge_wrapper_jar = Some(fw);
            } else {
                use_forge_wrapper = false;
            }
        }
    }

    // 2. Ensure client.jar
    let client_jar = mc_dir.join("versions").join(&version_id).join(format!("{}.jar", version_id));
    if let Some(client_dl) = base_vjson.pointer("/downloads/client") {
        let url = client_dl.get("url").and_then(|v| v.as_str()).unwrap_or("");
        let sha1 = client_dl.get("sha1").and_then(|v| v.as_str());
        let size = client_dl.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
        let need_dl = !client_jar.exists()
            || (size > 0 && fs::metadata(&client_jar).map(|m| m.len() != size).unwrap_or(true));
        if need_dl && !url.is_empty() {
            emit_status(&app, json!({ "status": "downloading", "message": "Скачивание клиента Minecraft..." }));
            stream_download_to_file(url, &client_jar, sha1).await?;
        }
    }
    if !client_jar.exists() {
        let prism_jar = prism_dir().join("versions").join(&version_id).join(format!("{}.jar", version_id));
        if prism_jar.exists() {
            if let Some(p) = client_jar.parent() {
                let _ = fs::create_dir_all(p);
            }
            let _ = fs::copy(&prism_jar, &client_jar);
        }
    }
    if !client_jar.exists() {
        return Err(format!(
            "Не удалось найти или скачать файл клиента Minecraft: {}. Проверьте подключение к интернету.",
            client_jar.display()
        ));
    }

    // 3. Collect libraries and natives to download
    let natives_dir = mc_dir.join("bin").join("natives").join(&version_id);
    fs::create_dir_all(&natives_dir).map_err(|e| e.to_string())?;

    let vjson_libs = vjson
        .get("libraries")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    struct LibTask {
        url: String,
        dest: PathBuf,
        sha1: Option<String>,
        size: u64,
        is_native: bool,
    }

    let mut lib_tasks: Vec<LibTask> = Vec::new();
    let mut classpath_entries: Vec<PathBuf> = Vec::new();
    let mut seen_cp = HashSet::new();
    let libs_root = mc_dir.join("libraries");

    for (lib, add_to_cp) in vjson_libs
        .iter()
        .map(|l| (l, true))
        .chain(extra_libs.iter().map(|l| (l, false)))
    {
        if !check_rules(lib.get("rules"), true) {
            continue;
        }

        let mut added_artifact = false;
        if let Some(art) = lib.pointer("/downloads/artifact") {
            let path_rel = art.get("path").and_then(|v| v.as_str()).unwrap_or("");
            let url = art.get("url").and_then(|v| v.as_str()).unwrap_or("");
            let sha1 = art.get("sha1").and_then(|v| v.as_str()).map(|s| s.to_string());
            let size = art.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
            if !path_rel.is_empty() {
                let dest = libs_root.join(path_rel);
                if add_to_cp && seen_cp.insert(dest.clone()) {
                    classpath_entries.push(dest.clone());
                }
                let need = !dest.exists() || (size > 0 && fs::metadata(&dest).map(|m| m.len() != size).unwrap_or(true));
                if need && !url.is_empty() {
                    lib_tasks.push(LibTask { url: url.to_string(), dest, sha1, size, is_native: false });
                }
                added_artifact = true;
            }
        }

        if !added_artifact && lib.get("natives").is_none() {
            if let Some(coords) = lib.get("name").and_then(|v| v.as_str()) {
                if let Some(rel) = maven_coords_to_path(coords) {
                    let base_url = lib
                        .get("url")
                        .and_then(|v| v.as_str())
                        .unwrap_or("https://libraries.minecraft.net/");
                    let url = format!("{}{}", if base_url.ends_with('/') { base_url.to_string() } else { format!("{}/", base_url) }, rel);
                    let dest = libs_root.join(&rel);
                    if add_to_cp && seen_cp.insert(dest.clone()) {
                        classpath_entries.push(dest.clone());
                    }
                    if !dest.exists() {
                        lib_tasks.push(LibTask { url, dest, sha1: None, size: 0, is_native: false });
                    }
                }
            }
        }

        if let Some(natives_map) = lib.get("natives").and_then(|v| v.as_object()) {
            if let Some(cls_tmpl) = natives_map.get(current_os_name()).and_then(|v| v.as_str()) {
                let cls_key = cls_tmpl.replace("${arch}", "64");
                if let Some(cls_obj) = lib.pointer(&format!("/downloads/classifiers/{}", cls_key)) {
                    let path_rel = cls_obj.get("path").and_then(|v| v.as_str()).unwrap_or("");
                    let url = cls_obj.get("url").and_then(|v| v.as_str()).unwrap_or("");
                    let sha1 = cls_obj.get("sha1").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let size = cls_obj.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
                    if !path_rel.is_empty() && !url.is_empty() {
                        let dest = libs_root.join(path_rel);
                        lib_tasks.push(LibTask { url: url.to_string(), dest, sha1, size, is_native: true });
                    }
                }
            }
        }
    }

    let total_libs = lib_tasks.len();
    if total_libs > 0 {
        let done_cnt = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let sem = Arc::new(tokio::sync::Semaphore::new(10));
        let mut handles = Vec::new();
        for task in lib_tasks {
            let permit = sem.clone().acquire_owned().await.map_err(|e| e.to_string())?;
            let done_c = Arc::clone(&done_cnt);
            let app_c = app.clone();
            let nat_dir = natives_dir.clone();
            handles.push(tokio::spawn(async move {
                let _permit = permit;
                let need = !task.dest.exists()
                    || (task.size > 0 && fs::metadata(&task.dest).map(|m| m.len() != task.size).unwrap_or(true));
                if need {
                    let _ = stream_download_to_file(&task.url, &task.dest, task.sha1.as_deref()).await;
                }
                if task.is_native && task.dest.exists() {
                    if let Ok(f) = File::open(&task.dest) {
                        if let Ok(mut zip) = ZipArchive::new(f) {
                            for i in 0..zip.len() {
                                if let Ok(mut entry) = zip.by_index(i) {
                                    let ename = entry.name().to_string();
                                    if entry.is_dir() || ename.starts_with("META-INF/") {
                                        continue;
                                    }
                                    if let Some(fname) = Path::new(&ename).file_name() {
                                        let out_p = nat_dir.join(fname);
                                        if let Ok(mut out_f) = File::create(&out_p) {
                                            let _ = std::io::copy(&mut entry, &mut out_f);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                let d = done_c.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
                if d % 5 == 0 || d == total_libs {
                    emit_progress(&app_c, "libraries", d, total_libs);
                }
            }));
        }
        for h in handles {
            let _ = h.await;
        }
    }

    // 4. Assets download (reuse Prism assets if present)
    let prism_assets = prism_dir().join("assets");
    let assets_root = if prism_assets.exists() {
        prism_assets
    } else {
        mc_dir.join("assets")
    };
    let asset_index_id = base_vjson
        .pointer("/assetIndex/id")
        .and_then(|v| v.as_str())
        .unwrap_or("legacy")
        .to_string();
    let asset_index_url = base_vjson
        .pointer("/assetIndex/url")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let asset_index_sha1 = base_vjson.pointer("/assetIndex/sha1").and_then(|v| v.as_str());

    let index_path = assets_root.join("indexes").join(format!("{}.json", asset_index_id));
    if !index_path.exists() && !asset_index_url.is_empty() {
        let _ = stream_download_to_file(asset_index_url, &index_path, asset_index_sha1).await;
    }

    if let Ok(raw_idx) = fs::read_to_string(&index_path) {
        if let Ok(idx_json) = serde_json::from_str::<Value>(&raw_idx) {
            if let Some(objects) = idx_json.get("objects").and_then(|v| v.as_object()) {
                let mut missing_assets = Vec::new();
                for (_, obj) in objects {
                    let hash = obj.get("hash").and_then(|v| v.as_str()).unwrap_or("");
                    let size = obj.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
                    if hash.len() < 2 {
                        continue;
                    }
                    let obj_path = assets_root.join("objects").join(&hash[..2]).join(hash);
                    let need = !obj_path.exists()
                        || (size > 0 && fs::metadata(&obj_path).map(|m| m.len() != size).unwrap_or(true));
                    if need {
                        missing_assets.push((hash.to_string(), obj_path));
                    }
                }
                let total_assets = missing_assets.len();
                if total_assets > 0 {
                    let done_cnt = Arc::new(std::sync::atomic::AtomicUsize::new(0));
                    let sem = Arc::new(tokio::sync::Semaphore::new(16));
                    let mut handles = Vec::new();
                    for (hash, dest) in missing_assets {
                        let permit = sem.clone().acquire_owned().await.map_err(|e| e.to_string())?;
                        let done_c = Arc::clone(&done_cnt);
                        let app_c = app.clone();
                        handles.push(tokio::spawn(async move {
                            let _permit = permit;
                            let url = format!("https://resources.download.minecraft.net/{}/{}", &hash[..2], hash);
                            let _ = stream_download_to_file(&url, &dest, Some(&hash)).await;
                            let d = done_c.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
                            if d % 25 == 0 || d == total_assets {
                                emit_progress(&app_c, "assets", d, total_assets);
                            }
                        }));
                    }
                    for h in handles {
                        let _ = h.await;
                    }
                }
            }
        }
    }

    // 5. Build JVM & Game Arguments
    if let Some(ref fw) = forge_wrapper_jar {
        if seen_cp.insert(fw.clone()) {
            classpath_entries.push(fw.clone());
        }
    }
    if seen_cp.insert(client_jar.clone()) {
        classpath_entries.push(client_jar.clone());
    }
    let cp_str = classpath_entries
        .iter()
        .filter(|p| p.exists())
        .map(|p| p.to_string_lossy().into_owned())
        .collect::<Vec<String>>()
        .join(classpath_sep());

    let replace_vars = |s: &str| -> String {
        s.replace("${auth_player_name}", &player_name)
            .replace("${version_name}", &version_id)
            .replace("${game_directory}", &game_dir.to_string_lossy())
            .replace("${assets_root}", &assets_root.to_string_lossy())
            .replace("${assets_index_name}", &asset_index_id)
            .replace("${auth_uuid}", &player_uuid)
            .replace("${auth_access_token}", &access_token)
            .replace("${user_type}", user_type)
            .replace("${version_type}", &version_type)
            .replace("${natives_directory}", &natives_dir.to_string_lossy())
            .replace("${library_directory}", &libs_root.to_string_lossy())
            .replace("${classpath_separator}", classpath_sep())
            .replace("${launcher_name}", "MaterialLauncher")
            .replace("${launcher_version}", "1.2.0")
            .replace("${classpath}", &cp_str)
            .replace("${resolution_width}", &width.to_string())
            .replace("${resolution_height}", &height.to_string())
            .replace("${user_properties}", "{}")
    };

    let mut jvm_args: Vec<String> = Vec::new();
    jvm_args.push(format!("-Xms{}M", min_ram));
    jvm_args.push(format!("-Xmx{}M", max_ram));

    if acc_type == "elyby" {
        if let Some(inj) = ensure_authlib_injector().await {
            if inj.exists() {
                jvm_args.push(format!("-javaagent:{}=ely.by", inj.display()));
            }
        }
    }

    let java_major = get_java_major_version(&selected_java);
    if perm_gen > 0 && java_major > 0 && java_major <= 7 {
        jvm_args.push(format!("-XX:PermSize={}M", perm_gen));
    }

    let extra_jvm = opts
        .get("jvmArgs")
        .and_then(|v| v.as_str())
        .or_else(|| cfg.get("jvmArgs").and_then(|v| v.as_str()))
        .unwrap_or("")
        .trim();
    for a in extra_jvm.split_whitespace() {
        jvm_args.push(a.to_string());
    }

    let gc_preset = opts
        .get("gcPreset")
        .and_then(|v| v.as_str())
        .or_else(|| cfg.get("gcPreset").and_then(|v| v.as_str()))
        .unwrap_or("auto")
        .to_lowercase();
    if java_major >= 21 && (gc_preset == "zgc" || (gc_preset == "auto" && max_ram >= 6144)) {
        jvm_args.push("-XX:+UseZGC".to_string());
        jvm_args.push("-XX:+ZGenerational".to_string());
        emit_log(&app, "[MaterialLauncher]: Активирован ультранизколатентный Generational ZGC");
    } else if !jvm_args.iter().any(|a| a.contains("UseG1GC") || a.contains("UseZGC") || a.contains("UseParallelGC")) {
        for flag in [
            "-XX:+UseG1GC",
            "-XX:+ParallelRefProcEnabled",
            "-XX:MaxGCPauseMillis=200",
            "-XX:+UnlockExperimentalVMOptions",
            "-XX:+DisableExplicitGC",
            "-XX:+AlwaysPreTouch",
            "-XX:G1NewSizePercent=30",
            "-XX:G1MaxNewSizePercent=40",
            "-XX:G1ReservePercent=20",
            "-XX:G1HeapWastePercent=5",
            "-XX:G1MixedGCCountTarget=4",
            "-XX:InitiatingHeapOccupancyPercent=15",
            "-XX:G1MixedGCLiveThresholdPercent=90",
            "-XX:G1RSetUpdatingPauseTimePercent=5",
            "-XX:SurvivorRatio=32",
        ] {
            jvm_args.push(flag.to_string());
        }
        emit_log(&app, "[MaterialLauncher]: Активированы оптимизированные GC-флаги Aikar G1GC");
    }

    if use_forge_wrapper {
        if let Some(ref inst_jar) = forge_installer {
            jvm_args.push(format!("-Dforgewrapper.librariesDir={}", libs_root.display()));
            jvm_args.push(format!("-Dforgewrapper.installer={}", inst_jar.display()));
            jvm_args.push(format!("-Dforgewrapper.minecraft={}", client_jar.display()));
        }
    }

    let mut has_cp_arg = false;
    if let Some(v_jvm) = vjson.pointer("/arguments/jvm").and_then(|v| v.as_array()) {
        for item in v_jvm {
            if let Some(s) = item.as_str() {
                if s == "-cp" {
                    has_cp_arg = true;
                }
                jvm_args.push(replace_vars(s));
            } else if check_rules(item.get("rules"), true) {
                if let Some(val) = item.get("value") {
                    if let Some(s) = val.as_str() {
                        if s == "-cp" {
                            has_cp_arg = true;
                        }
                        jvm_args.push(replace_vars(s));
                    } else if let Some(arr) = val.as_array() {
                        for x in arr {
                            if let Some(xs) = x.as_str() {
                                if xs == "-cp" {
                                    has_cp_arg = true;
                                }
                                jvm_args.push(replace_vars(xs));
                            }
                        }
                    }
                }
            }
        }
    }
    if !has_cp_arg {
        jvm_args.push(format!("-Djava.library.path={}", natives_dir.display()));
        jvm_args.push("-cp".to_string());
        jvm_args.push(cp_str.clone());
    }

    let main_class = if use_forge_wrapper {
        "io.github.zekerzhayard.forgewrapper.installer.Main".to_string()
    } else {
        vjson
            .get("mainClass")
            .and_then(|v| v.as_str())
            .unwrap_or("net.minecraft.client.main.Main")
            .to_string()
    };

    let mut game_args: Vec<String> = Vec::new();
    if let Some(v_game) = vjson.pointer("/arguments/game").and_then(|v| v.as_array()) {
        for item in v_game {
            if let Some(s) = item.as_str() {
                game_args.push(replace_vars(s));
            } else if check_rules(item.get("rules"), true) {
                if let Some(val) = item.get("value") {
                    if let Some(s) = val.as_str() {
                        game_args.push(replace_vars(s));
                    } else if let Some(arr) = val.as_array() {
                        for x in arr {
                            if let Some(xs) = x.as_str() {
                                game_args.push(replace_vars(xs));
                            }
                        }
                    }
                }
            }
        }
    } else if let Some(legacy_args) = vjson.get("minecraftArguments").and_then(|v| v.as_str()) {
        for tok in legacy_args.split_whitespace() {
            game_args.push(replace_vars(tok));
        }
        game_args.push("--width".to_string());
        game_args.push(width.to_string());
        game_args.push("--height".to_string());
        game_args.push(height.to_string());
    }

    if fullscreen && !game_args.iter().any(|a| a == "--fullscreen") {
        game_args.push("--fullscreen".to_string());
    }

    // 6. Spawn Java process
    let mut cmd = Command::new(&selected_java);
    cmd.current_dir(&game_dir)
        .args(&jvm_args)
        .arg(&main_class)
        .args(&game_args)
        .env("__NV_PRIME_RENDER_OFFLOAD", "1")
        .env("__GLX_VENDOR_LIBRARY_NAME", "nvidia")
        .env("DRI_PRIME", "1")
        .env("SHIM_MCCOMPAT", "0")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    {
        cmd.creation_flags(0x08000000);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Не удалось запустить Java ({}): {}", selected_java, e))?;

    emit_status(&app, json!({ "status": "running", "message": "Minecraft запущен" }));

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let app_out = app.clone();
    let app_err = app.clone();

    if let Some(out) = stdout {
        tokio::spawn(async move {
            let mut lines = BufReader::new(out).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if line.contains(".class") && (line.trim_start().starts_with("Slim ") || line.trim_start().starts_with("Data ")) {
                    continue;
                }
                emit_log(&app_out, &line);
            }
        });
    }
    if let Some(err) = stderr {
        tokio::spawn(async move {
            let mut lines = BufReader::new(err).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                emit_log(&app_err, &line);
            }
        });
    }

    let close_on_exit = opts
        .get("closeLauncherOnExit")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    tokio::spawn(async move {
        let code = match child.wait().await {
            Ok(status) => status.code().unwrap_or(0),
            Err(_) => 1,
        };
        emit_log(&app, &format!("Minecraft завершил работу с кодом: {}", code));
        let _ = app.emit("mc-launch-close", code);
        emit_status(&app, json!({ "status": "closed", "message": format!("Minecraft закрыт ({})", code), "exitCode": code }));
        if close_on_exit {
            app.exit(0);
        } else if let Some(win) = app.get_webview_window("main") {
            let _ = win.show();
        }
    });

    Ok(json!({ "success": true }))
}
