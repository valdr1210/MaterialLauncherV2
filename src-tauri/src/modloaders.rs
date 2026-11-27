use crate::config::{get_minecraft_dir, launcher_data_dir, manifest_cache_path, now_ms, prism_dir};
use serde_json::{json, Value};
use std::cmp::Ordering;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

const USER_AGENT: &str = "MaterialLauncher/1.3.0 (admin@materiallauncher.app)";

static LOADER_CACHE: OnceLock<Mutex<HashMap<String, (u64, Vec<Value>)>>> = OnceLock::new();

fn loader_cache() -> &'static Mutex<HashMap<String, (u64, Vec<Value>)>> {
    LOADER_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn http_client(timeout_secs: u64) -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

pub fn natural_cmp_desc(a: &str, b: &str) -> Ordering {
    let split_parts = |s: &str| -> Vec<Result<u64, String>> {
        let mut res = Vec::new();
        let mut cur = String::new();
        let mut is_num: Option<bool> = None;
        for ch in s.chars() {
            let d = ch.is_ascii_digit();
            match is_num {
                Some(prev) if prev == d => cur.push(ch),
                Some(prev) => {
                    if prev {
                        res.push(cur.parse::<u64>().map_err(|_| cur.clone()));
                    } else {
                        res.push(Err(cur.clone()));
                    }
                    cur.clear();
                    cur.push(ch);
                    is_num = Some(d);
                }
                None => {
                    cur.push(ch);
                    is_num = Some(d);
                }
            }
        }
        if !cur.is_empty() {
            if is_num == Some(true) {
                res.push(cur.parse::<u64>().map_err(|_| cur.clone()));
            } else {
                res.push(Err(cur));
            }
        }
        res
    };

    let pa = split_parts(a);
    let pb = split_parts(b);
    for (xa, xb) in pa.iter().zip(pb.iter()) {
        let ord = match (xa, xb) {
            (Ok(na), Ok(nb)) => nb.cmp(na),
            (Err(sa), Err(sb)) => sb.cmp(sa),
            (Ok(_), Err(_)) => Ordering::Less,
            (Err(_), Ok(_)) => Ordering::Greater,
        };
        if ord != Ordering::Equal {
            return ord;
        }
    }
    pb.len().cmp(&pa.len())
}

pub async fn get_version_manifest(force_refresh: bool) -> Value {
    let cache_path = manifest_cache_path();
    if !force_refresh && cache_path.exists() {
        if let Ok(meta) = fs::metadata(&cache_path) {
            if let Ok(modified) = meta.modified() {
                if modified.elapsed().map(|d| d.as_secs() < 30 * 60).unwrap_or(false) {
                    if let Ok(raw) = fs::read_to_string(&cache_path) {
                        if let Ok(val) = serde_json::from_str::<Value>(&raw) {
                            return val;
                        }
                    }
                }
            }
        }
    }

    let client = http_client(12);
    if let Ok(resp) = client
        .get("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")
        .send()
        .await
    {
        if let Ok(val) = resp.json::<Value>().await {
            if val.get("versions").is_some() {
                if let Ok(s) = serde_json::to_string(&val) {
                    let _ = fs::write(&cache_path, s);
                }
                return val;
            }
        }
    }

    if let Ok(raw) = fs::read_to_string(&cache_path) {
        if let Ok(val) = serde_json::from_str::<Value>(&raw) {
            return val;
        }
    }

    json!({
        "latest": { "release": "26.1.2", "snapshot": "25w03a" },
        "versions": [
            { "id": "26.1.2", "type": "release", "releaseTime": "2024-12-10" },
            { "id": "1.21.4", "type": "release", "releaseTime": "2024-12-03" },
            { "id": "1.21.3", "type": "release", "releaseTime": "2024-10-23" },
            { "id": "1.20.4", "type": "release", "releaseTime": "2023-12-07" },
            { "id": "1.16.5", "type": "release", "releaseTime": "2021-01-15" }
        ]
    })
}

pub async fn get_loader_versions(loader: &str, game_version: &str) -> Vec<Value> {
    let clean_loader = loader.trim().to_lowercase();
    let clean_game = game_version.trim();
    if clean_loader.is_empty() || clean_loader == "vanilla" || clean_game.is_empty() {
        return Vec::new();
    }

    let cache_key = format!("{}:{}", clean_loader, clean_game);
    let now = now_ms();
    if let Ok(guard) = loader_cache().lock() {
        if let Some((ts, data)) = guard.get(&cache_key) {
            if now.saturating_sub(*ts) < 10 * 60 * 1000 {
                return data.clone();
            }
        }
    }

    let client = http_client(10);
    let mut results: Vec<Value> = Vec::new();

    match clean_loader.as_str() {
        "fabric" => {
            let url = format!("https://meta.fabricmc.net/v2/versions/loader/{}", urlencoding::encode(clean_game));
            if let Ok(resp) = client.get(&url).send().await {
                if let Ok(arr) = resp.json::<Vec<Value>>().await {
                    for item in arr.into_iter().take(60) {
                        if let Some(ver) = item.pointer("/loader/version").and_then(|v| v.as_str()) {
                            let stable = item.pointer("/loader/stable").and_then(|v| v.as_bool()).unwrap_or(false);
                            results.push(json!({ "version": ver, "stable": stable }));
                        }
                    }
                }
            }
        }
        "quilt" => {
            let url = format!("https://meta.quiltmc.org/v3/versions/loader/{}", urlencoding::encode(clean_game));
            if let Ok(resp) = client.get(&url).send().await {
                if let Ok(arr) = resp.json::<Vec<Value>>().await {
                    for item in arr.into_iter().take(60) {
                        if let Some(ver) = item.pointer("/loader/version").and_then(|v| v.as_str()) {
                            results.push(json!({ "version": ver, "stable": !ver.contains("beta") }));
                        }
                    }
                }
            }
        }
        "forge" => {
            let (meta_res, promo_res) = tokio::join!(
                client.get("https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json").send(),
                client.get("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json").send()
            );
            let meta_val = match meta_res {
                Ok(r) => r.json::<Value>().await.unwrap_or(Value::Null),
                Err(_) => Value::Null,
            };
            let promo_val = match promo_res {
                Ok(r) => r.json::<Value>().await.unwrap_or(Value::Null),
                Err(_) => Value::Null,
            };
            let promos = promo_val.get("promos");
            let rec_ver = promos
                .and_then(|p| p.get(format!("{}-recommended", clean_game)))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let latest_ver = promos
                .and_then(|p| p.get(format!("{}-latest", clean_game)))
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if let Some(raw_arr) = meta_val.get(clean_game).and_then(|v| v.as_array()) {
                let prefix = format!("{}-", clean_game);
                let mut vers: Vec<String> = raw_arr
                    .iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.strip_prefix(&prefix).unwrap_or(s).to_string())
                    .collect();
                vers.sort_by(|a, b| natural_cmp_desc(a, b));
                for ver in vers.into_iter().take(60) {
                    results.push(json!({
                        "version": ver,
                        "stable": ver == rec_ver || !ver.contains("beta"),
                        "recommended": ver == rec_ver,
                        "latest": ver == latest_ver
                    }));
                }
            }
        }
        "neoforge" => {
            let parts: Vec<&str> = clean_game.split('.').collect();
            if parts.len() >= 2 && parts[0] == "1" {
                let major = parts[1];
                let minor = parts.get(2).copied().unwrap_or("0");
                let prefix = format!("{}.{}.", major, minor);
                if let Ok(resp) = client
                    .get("https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge")
                    .send()
                    .await
                {
                    if let Ok(val) = resp.json::<Value>().await {
                        if let Some(arr) = val.get("versions").and_then(|v| v.as_array()) {
                            let mut vers: Vec<String> = arr
                                .iter()
                                .filter_map(|v| v.as_str())
                                .filter(|s| s.starts_with(&prefix))
                                .map(|s| s.to_string())
                                .collect();
                            vers.sort_by(|a, b| natural_cmp_desc(a, b));
                            for ver in vers.into_iter().take(60) {
                                results.push(json!({
                                    "version": ver,
                                    "stable": !ver.contains("beta") && !ver.contains("alpha")
                                }));
                            }
                        }
                    }
                }
            }
        }
        _ => {}
    }

    if !results.is_empty() {
        if let Ok(mut guard) = loader_cache().lock() {
            guard.insert(cache_key, (now, results.clone()));
        }
    }
    results
}

pub async fn ensure_fabric_profile(game_version: &str, preferred_ver: Option<&str>) -> Option<String> {
    let client = http_client(10);
    let mut loader_ver = preferred_ver
        .filter(|s| !s.is_empty() && *s != "latest")
        .map(|s| s.to_string())
        .unwrap_or_default();

    if loader_ver.is_empty() {
        let url = format!("https://meta.fabricmc.net/v2/versions/loader/{}", urlencoding::encode(game_version));
        let arr: Vec<Value> = client.get(&url).send().await.ok()?.json().await.ok()?;
        loader_ver = arr.first()?.pointer("/loader/version")?.as_str()?.to_string();
    }

    let profile_id = format!("fabric-loader-{}-{}", loader_ver, game_version);
    let v_dir = get_minecraft_dir(None).join("versions").join(&profile_id);
    let v_json = v_dir.join(format!("{}.json", profile_id));
    if v_json.exists() && fs::metadata(&v_json).map(|m| m.len() > 500).unwrap_or(false) {
        return Some(profile_id);
    }

    let p_url = format!(
        "https://meta.fabricmc.net/v2/versions/loader/{}/{}/profile/json",
        urlencoding::encode(game_version),
        urlencoding::encode(&loader_ver)
    );
    let profile_data: Value = client.get(&p_url).send().await.ok()?.json().await.ok()?;
    fs::create_dir_all(&v_dir).ok()?;
    fs::write(&v_json, serde_json::to_string_pretty(&profile_data).ok()?).ok()?;
    Some(profile_id)
}

pub async fn ensure_quilt_profile(game_version: &str, preferred_ver: Option<&str>) -> Option<String> {
    let client = http_client(10);
    let mut loader_ver = preferred_ver
        .filter(|s| !s.is_empty() && *s != "latest")
        .map(|s| s.to_string())
        .unwrap_or_default();

    if loader_ver.is_empty() {
        let url = format!("https://meta.quiltmc.org/v3/versions/loader/{}", urlencoding::encode(game_version));
        let arr: Vec<Value> = client.get(&url).send().await.ok()?.json().await.ok()?;
        loader_ver = arr.first()?.pointer("/loader/version")?.as_str()?.to_string();
    }

    let profile_id = format!("quilt-loader-{}-{}", loader_ver, game_version);
    let v_dir = get_minecraft_dir(None).join("versions").join(&profile_id);
    let v_json = v_dir.join(format!("{}.json", profile_id));
    if v_json.exists() && fs::metadata(&v_json).map(|m| m.len() > 500).unwrap_or(false) {
        return Some(profile_id);
    }

    let p_url = format!(
        "https://meta.quiltmc.org/v3/versions/loader/{}/{}/profile/json",
        urlencoding::encode(game_version),
        urlencoding::encode(&loader_ver)
    );
    let profile_data: Value = client.get(&p_url).send().await.ok()?.json().await.ok()?;
    fs::create_dir_all(&v_dir).ok()?;
    fs::write(&v_json, serde_json::to_string_pretty(&profile_data).ok()?).ok()?;
    Some(profile_id)
}

pub async fn ensure_forge_wrapper() -> Result<PathBuf, String> {
    let fw_ver = "1.6.0";
    let fw_dir = get_minecraft_dir(None)
        .join("libraries")
        .join("io")
        .join("github")
        .join("zekerzhayard")
        .join("ForgeWrapper")
        .join(fw_ver);
    let fw_path = fw_dir.join(format!("ForgeWrapper-{}.jar", fw_ver));
    if fw_path.exists() && fs::metadata(&fw_path).map(|m| m.len() > 10000).unwrap_or(false) {
        return Ok(fw_path);
    }
    fs::create_dir_all(&fw_dir).map_err(|e| e.to_string())?;
    let url = format!(
        "https://github.com/ZekerZhayard/ForgeWrapper/releases/download/{}/ForgeWrapper-{}.jar",
        fw_ver, fw_ver
    );
    let bytes = http_client(30)
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;
    fs::write(&fw_path, &bytes).map_err(|e| e.to_string())?;
    Ok(fw_path)
}

pub fn is_snapshot_version(v: &str) -> bool {
    let lower = v.to_lowercase();
    if lower.contains("snapshot") || lower.contains("-pre") || lower.contains("-rc") || lower.contains("beta") || lower.contains("alpha") {
        return true;
    }
    regex::Regex::new(r"^\d{2}w\d{2}[a-z]")
        .map(|r| r.is_match(&lower))
        .unwrap_or(false)
}

pub async fn ensure_forge_installer(game_version: &str, preferred_ver: Option<&str>) -> Result<PathBuf, String> {
    if is_snapshot_version(game_version) {
        return Err(format!(
            "Загрузчик Forge не поддерживает снапшоты ({}). Выберите официальный релиз Minecraft или используйте Fabric.",
            game_version
        ));
    }
    let _ = ensure_forge_wrapper().await;

    let forge_dir = launcher_data_dir().join("forge_installers");
    fs::create_dir_all(&forge_dir).map_err(|e| e.to_string())?;

    let prefix = format!("{}-", game_version);
    let check_base = |base: PathBuf| -> Option<PathBuf> {
        if !base.exists() {
            return None;
        }
        let mut candidates: Vec<String> = if let Some(pv) = preferred_ver.filter(|s| !s.is_empty() && *s != "latest") {
            vec![format!("{}-{}", game_version, pv)]
        } else {
            fs::read_dir(&base)
                .ok()?
                .flatten()
                .filter_map(|e| e.file_name().into_string().ok())
                .filter(|n| n.starts_with(&prefix))
                .collect()
        };
        candidates.sort_by(|a, b| natural_cmp_desc(a, b));
        for v in candidates {
            let p = base.join(&v).join(format!("forge-{}-installer.jar", v));
            if p.exists() && fs::metadata(&p).map(|m| m.len() > 1_000_000).unwrap_or(false) {
                return Some(p);
            }
        }
        None
    };

    if let Some(p) = check_base(prism_dir().join("libraries/net/minecraftforge/forge")) {
        return Ok(p);
    }
    if let Some(p) = check_base(get_minecraft_dir(None).join("libraries/net/minecraftforge/forge")) {
        return Ok(p);
    }

    // Check local cache
    if let Some(pv) = preferred_ver.filter(|s| !s.is_empty() && *s != "latest") {
        let p = forge_dir.join(format!("forge-{}-{}-installer.jar", game_version, pv));
        if p.exists() && fs::metadata(&p).map(|m| m.len() > 1_000_000).unwrap_or(false) {
            return Ok(p);
        }
    } else if let Ok(entries) = fs::read_dir(&forge_dir) {
        let mut files: Vec<String> = entries
            .flatten()
            .filter_map(|e| e.file_name().into_string().ok())
            .filter(|n| n.starts_with(&format!("forge-{}-", game_version)) && n.ends_with("-installer.jar"))
            .collect();
        files.sort_by(|a, b| natural_cmp_desc(a, b));
        if let Some(first) = files.first() {
            let p = forge_dir.join(first);
            if fs::metadata(&p).map(|m| m.len() > 1_000_000).unwrap_or(false) {
                return Ok(p);
            }
        }
    }

    let mut target_ver = preferred_ver
        .filter(|s| !s.is_empty() && *s != "latest")
        .map(|s| s.to_string())
        .unwrap_or_default();

    if target_ver.is_empty() {
        if let Ok(resp) = http_client(8)
            .get("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json")
            .send()
            .await
        {
            if let Ok(val) = resp.json::<Value>().await {
                if let Some(promos) = val.get("promos") {
                    if let Some(v) = promos
                        .get(format!("{}-recommended", game_version))
                        .or_else(|| promos.get(format!("{}-latest", game_version)))
                        .and_then(|x| x.as_str())
                    {
                        target_ver = v.to_string();
                    }
                }
            }
        }
    }

    if target_ver.is_empty() {
        target_ver = match game_version {
            "1.21.4" => "54.0.18",
            "1.21.3" => "53.0.28",
            "1.21.1" => "52.1.20",
            "1.21" => "51.0.33",
            "1.20.4" => "49.1.0",
            "1.20.2" => "48.1.0",
            "1.20.1" => "47.4.10",
            "1.20" => "46.0.14",
            "1.19.4" => "45.3.0",
            "1.19.2" => "43.4.0",
            "1.18.2" => "40.2.21",
            "1.16.5" => "36.2.39",
            "1.12.2" => "14.23.5.2860",
            "1.7.10" => "10.13.4.1614",
            _ => "47.4.10",
        }
        .to_string();
    }

    let full_version = format!("{}-{}", game_version, target_ver);
    let filename = format!("forge-{}-installer.jar", full_version);
    let dest_path = forge_dir.join(&filename);
    if dest_path.exists() && fs::metadata(&dest_path).map(|m| m.len() > 1_000_000).unwrap_or(false) {
        return Ok(dest_path);
    }

    let dl_url = format!(
        "https://maven.minecraftforge.net/net/minecraftforge/forge/{}/{}",
        full_version, filename
    );
    let bytes = http_client(60)
        .get(&dl_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;
    if bytes.is_empty() {
        return Err("Не удалось скачать установщик Forge".to_string());
    }
    fs::write(&dest_path, &bytes).map_err(|e| e.to_string())?;
    Ok(dest_path)
}

pub async fn ensure_authlib_injector() -> Option<PathBuf> {
    let target_path = get_minecraft_dir(None).join("authlib-injector.jar");
    if target_path.exists() && fs::metadata(&target_path).map(|m| m.len() > 10000).unwrap_or(false) {
        return Some(target_path);
    }
    let url = "https://authlib-injector.yushi.moe/artifact/56/authlib-injector-1.2.8.jar";
    let resp = http_client(25).get(url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let bytes = resp.bytes().await.ok()?;
    fs::write(&target_path, &bytes).ok()?;
    Some(target_path)
}
