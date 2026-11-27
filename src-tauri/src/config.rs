use crate::crypto::{decrypt_token, encrypt_token};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn get_default_data_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            if !appdata.trim().is_empty() {
                return PathBuf::from(appdata);
            }
        }
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("AppData")
            .join("Roaming")
    }
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Library")
            .join("Application Support")
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        if let Ok(xdg) = std::env::var("XDG_DATA_HOME") {
            if !xdg.trim().is_empty() {
                return PathBuf::from(xdg);
            }
        }
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".local")
            .join("share")
    }
}

pub fn get_default_minecraft_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        get_default_data_dir().join(".minecraft")
    }
    #[cfg(target_os = "macos")]
    {
        get_default_data_dir().join("minecraft")
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".minecraft")
    }
}

pub fn launcher_data_dir() -> PathBuf {
    let dir = get_default_data_dir().join(".materiallauncher");
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn prism_dir() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        get_default_data_dir().join("PrismLauncher")
    }
    #[cfg(target_os = "linux")]
    {
        get_default_data_dir().join("PrismLauncher")
    }
    #[cfg(target_os = "windows")]
    {
        get_default_data_dir().join("PrismLauncher")
    }
}

pub fn config_file_path() -> PathBuf {
    launcher_data_dir().join("config.json")
}

pub fn manifest_cache_path() -> PathBuf {
    launcher_data_dir().join("version_manifest_v2.json")
}

pub fn get_minecraft_dir(cfg: Option<&Value>) -> PathBuf {
    let mut target = String::new();
    if let Some(c) = cfg {
        if let Some(p) = c.get("minecraftPath").and_then(|v| v.as_str()) {
            if !p.trim().is_empty() {
                target = p.trim().to_string();
            }
        }
    } else if let Ok(raw) = fs::read_to_string(config_file_path()) {
        if let Ok(parsed) = serde_json::from_str::<Value>(&raw) {
            if let Some(p) = parsed.get("minecraftPath").and_then(|v| v.as_str()) {
                if !p.trim().is_empty() {
                    target = p.trim().to_string();
                }
            }
        }
    }

    let resolved = if target.is_empty() {
        get_default_minecraft_dir()
    } else {
        PathBuf::from(target)
    };
    let _ = fs::create_dir_all(&resolved);
    resolved
}

pub fn inspect_minecraft_dir(dir: &str) -> Value {
    if dir.trim().is_empty() {
        return json!({ "exists": false, "hasFiles": false, "count": 0 });
    }
    let resolved = PathBuf::from(dir);
    if !resolved.exists() {
        return json!({
            "exists": false,
            "hasFiles": false,
            "count": 0,
            "resolved": resolved.to_string_lossy()
        });
    }
    match fs::read_dir(&resolved) {
        Ok(entries) => {
            let count = entries.count();
            json!({
                "exists": true,
                "hasFiles": count > 0,
                "count": count,
                "resolved": resolved.to_string_lossy()
            })
        }
        Err(_) => json!({
            "exists": false,
            "hasFiles": false,
            "count": 0,
            "resolved": resolved.to_string_lossy()
        }),
    }
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let ty = entry.file_type().map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else if ty.is_file() {
            fs::copy(&src_path, &dst_path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

pub fn migrate_minecraft_dir(old_dir: &str, new_dir: &str, action: &str) -> Result<Value, String> {
    if old_dir.trim().is_empty() || new_dir.trim().is_empty() {
        return Err("Пути директорий не указаны".to_string());
    }
    let resolved_old = fs::canonicalize(old_dir).unwrap_or_else(|_| PathBuf::from(old_dir));
    let resolved_new = PathBuf::from(new_dir);

    #[cfg(windows)]
    let is_same = resolved_old.to_string_lossy().to_lowercase()
        == resolved_new.to_string_lossy().to_lowercase();
    #[cfg(not(windows))]
    let is_same = resolved_old == resolved_new;

    if is_same {
        return Ok(json!({ "success": true, "action": "none", "message": "Директории совпадают" }));
    }

    match action {
        "keep" => {
            fs::create_dir_all(&resolved_new).map_err(|e| e.to_string())?;
            Ok(json!({ "success": true, "action": "keep" }))
        }
        "delete" => {
            if resolved_old.exists() {
                let _ = fs::remove_dir_all(&resolved_old);
            }
            fs::create_dir_all(&resolved_new).map_err(|e| e.to_string())?;
            Ok(json!({ "success": true, "action": "delete" }))
        }
        "move" => {
            fs::create_dir_all(&resolved_new).map_err(|e| e.to_string())?;
            if resolved_old.exists() {
                let norm_old = resolved_old.to_string_lossy().to_lowercase();
                let norm_new = resolved_new.to_string_lossy().to_lowercase();
                if norm_new == norm_old
                    || norm_new.starts_with(&format!("{}/", norm_old))
                    || norm_new.starts_with(&format!("{}\\", norm_old))
                {
                    return Err("Новая папка не может находиться внутри старой папки".to_string());
                }
                copy_dir_recursive(&resolved_old, &resolved_new)?;
                let _ = fs::remove_dir_all(&resolved_old);
            }
            Ok(json!({ "success": true, "action": "move" }))
        }
        _ => Err(format!("Неизвестное действие: {}", action)),
    }
}

pub fn validate_instance_id(instance_id: &str) -> Result<String, String> {
    if instance_id.is_empty() {
        return Err("Некорректный идентификатор сборки".to_string());
    }
    let clean = Path::new(instance_id)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if clean.is_empty() || clean == "." || clean == ".." || clean != instance_id {
        return Err("Недопустимый идентификатор сборки (содержит недопустимые символы или путь)".to_string());
    }
    Ok(clean)
}

pub fn get_instance_dir(instance_id: &str) -> Result<PathBuf, String> {
    let clean_id = validate_instance_id(instance_id)?;
    let instances_root = get_minecraft_dir(None).join("instances");
    let dir = instances_root.join(&clean_id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

pub fn get_instance_mods_dir(instance_id: &str) -> Result<PathBuf, String> {
    let dir = get_instance_dir(instance_id)?.join("mods");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

pub fn delete_instance_folder(instance_id: &str) -> Result<Value, String> {
    let clean_id = validate_instance_id(instance_id)?;
    let inst_dir = get_minecraft_dir(None).join("instances").join(clean_id);
    if inst_dir.exists() {
        fs::remove_dir_all(&inst_dir).map_err(|e| e.to_string())?;
    }
    Ok(json!({ "success": true }))
}

pub fn load_config() -> Value {
    let cfg_path = config_file_path();
    let mut cfg: Option<Value> = fs::read_to_string(&cfg_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok());

    if cfg.is_none() {
        let bak_path = PathBuf::from(format!("{}.bak", cfg_path.to_string_lossy()));
        cfg = fs::read_to_string(&bak_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok());
    }

    let mut cfg = cfg.unwrap_or_else(|| {
        json!({
            "accounts": [{
                "type": "offline",
                "name": "Player",
                "uuid": "offline_Player",
                "active": true
            }],
            "selectedVersion": "26.1.2",
            "selectedVersionType": "release",
            "fullscreen": false,
            "windowWidth": 854,
            "windowHeight": 480,
            "hideLauncherOnLaunch": false,
            "closeLauncherOnExit": false,
            "showConsoleOnLaunch": false,
            "showConsoleOnError": true,
            "autoCloseConsole": false,
            "autoJavaSwitch": true,
            "manualJavaPath": "",
            "skipJavaCheck": false,
            "minRam": 512,
            "maxRam": 4096,
            "permGen": 128,
            "jvmArgs": "",
            "theme": "dark",
            "accentColor": "lavender",
            "customAccentHex": "#EADDFF"
        })
    });

    if let Some(accounts) = cfg.get_mut("accounts").and_then(|a| a.as_array_mut()) {
        for acc in accounts.iter_mut() {
            let acc_type = acc.get("type").and_then(|t| t.as_str()).unwrap_or("").to_string();
            if let Some(tok) = acc.get("access_token").and_then(|t| t.as_str()).map(|s| s.to_string()) {
                if tok.starts_with("enc:") {
                    let dec = decrypt_token(&tok);
                    let val = if dec.is_empty() && acc_type == "offline" {
                        "offline-token".to_string()
                    } else {
                        dec
                    };
                    acc["access_token"] = Value::String(val);
                }
            }
            if let Some(rtok) = acc.get("refresh_token").and_then(|t| t.as_str()).map(|s| s.to_string()) {
                if rtok.starts_with("enc:") {
                    acc["refresh_token"] = Value::String(decrypt_token(&rtok));
                }
            }
        }
        if !accounts.is_empty() && !accounts.iter().any(|a| a.get("active").and_then(|v| v.as_bool()) == Some(true)) {
            accounts[0]["active"] = Value::Bool(true);
        }
    }

    let needs_default_inst = cfg
        .get("instances")
        .and_then(|v| v.as_array())
        .map(|a| a.is_empty())
        .unwrap_or(true);
    if needs_default_inst {
        cfg["instances"] = json!([{
            "id": "inst-fabric-1-21-1",
            "name": "Fabric 1.21.1",
            "gameVersion": "1.21.1",
            "loader": "fabric",
            "loaderVersion": "latest",
            "modProvider": "modrinth",
            "icon": "fabric",
            "created": now_ms(),
            "mods": []
        }]);
    }
    if cfg.get("selectedInstanceId").is_none() {
        let first_id = cfg["instances"][0]["id"].clone();
        cfg["selectedInstanceId"] = first_id;
    }
    if cfg.get("accentColor").is_none() {
        cfg["accentColor"] = json!("lavender");
    }
    if cfg.get("theme").is_none() {
        cfg["theme"] = json!("dark");
    }

    if !cfg_path.exists() {
        let _ = save_config(&cfg);
    }

    cfg
}

pub fn save_config(cfg: &Value) -> Result<(), String> {
    let mut clone = cfg.clone();
    if let Some(accounts) = clone.get_mut("accounts").and_then(|a| a.as_array_mut()) {
        for acc in accounts.iter_mut() {
            if let Some(tok) = acc.get("access_token").and_then(|t| t.as_str()).map(|s| s.to_string()) {
                if !tok.is_empty() {
                    acc["access_token"] = Value::String(encrypt_token(&tok));
                }
            }
            if let Some(rtok) = acc.get("refresh_token").and_then(|t| t.as_str()).map(|s| s.to_string()) {
                if !rtok.is_empty() {
                    acc["refresh_token"] = Value::String(encrypt_token(&rtok));
                }
            }
        }
    }

    let cfg_path = config_file_path();
    if let Some(parent) = cfg_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json_str = serde_json::to_string_pretty(&clone).map_err(|e| e.to_string())?;
    let tmp_path = PathBuf::from(format!("{}.tmp.{}", cfg_path.to_string_lossy(), now_ms()));
    fs::write(&tmp_path, json_str).map_err(|e| e.to_string())?;
    if cfg_path.exists() {
        let bak_path = PathBuf::from(format!("{}.bak", cfg_path.to_string_lossy()));
        let _ = fs::copy(&cfg_path, &bak_path);
    }
    fs::rename(&tmp_path, &cfg_path).map_err(|e| e.to_string())?;
    Ok(())
}
