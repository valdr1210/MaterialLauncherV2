use crate::config::{get_instance_dir, get_instance_mods_dir, load_config, now_ms, save_config};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use futures_util::StreamExt;
use regex::Regex;
use serde_json::{json, Value};
use sha1::{Digest, Sha1};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, Emitter};
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

const USER_AGENT: &str = "MaterialLauncher/1.3.0 (admin@materiallauncher.app)";

static DISK_MOD_CACHE: OnceLock<Mutex<HashMap<String, Value>>> = OnceLock::new();

fn disk_mod_cache() -> &'static Mutex<HashMap<String, Value>> {
    DISK_MOD_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn http_client(timeout_secs: u64) -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

pub async fn stream_download_to_file(
    url: &str,
    dest_path: &Path,
    expected_sha1: Option<&str>,
) -> Result<u64, String> {
    if let Some(parent) = dest_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp_path = PathBuf::from(format!("{}.tmp.{}", dest_path.to_string_lossy(), now_ms()));

    let resp = http_client(90)
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {} при скачивании {}", resp.status(), url));
    }

    let mut file = File::create(&tmp_path).map_err(|e| e.to_string())?;
    let mut hasher = expected_sha1.map(|_| Sha1::new());
    let mut total_bytes: u64 = 0;

    let mut stream = resp.bytes_stream();
    while let Some(chunk_res) = stream.next().await {
        let chunk = match chunk_res {
            Ok(c) => c,
            Err(e) => {
                let _ = fs::remove_file(&tmp_path);
                return Err(e.to_string());
            }
        };
        if let Some(ref mut h) = hasher {
            h.update(&chunk);
        }
        if let Err(e) = file.write_all(&chunk) {
            let _ = fs::remove_file(&tmp_path);
            return Err(e.to_string());
        }
        total_bytes += chunk.len() as u64;
    }
    drop(file);

    if total_bytes == 0 {
        let _ = fs::remove_file(&tmp_path);
        return Err("Файл загрузился пустым (0 байт)".to_string());
    }

    if let (Some(exp), Some(h)) = (expected_sha1, hasher) {
        let actual = hex::encode(h.finalize());
        if !actual.eq_ignore_ascii_case(exp) {
            let _ = fs::remove_file(&tmp_path);
            let fname = dest_path.file_name().and_then(|n| n.to_str()).unwrap_or("file");
            return Err(format!("Ошибка контрольной суммы SHA-1 для {}", fname));
        }
    }

    if dest_path.exists() {
        let _ = fs::remove_file(dest_path);
    }
    fs::rename(&tmp_path, dest_path).map_err(|e| e.to_string())?;
    Ok(total_bytes)
}

const CURSEFORGE_API_KEY: &str = "$2a$10$C6qgNzG0E9IuDmwb1MrZIOUSOO5lx7aj5hc8kiv.Ofu12Rcr/r2iy";

fn curseforge_loader_type(loader: &str) -> Option<u32> {
    match loader.to_lowercase().as_str() {
        "forge" => Some(1),
        "fabric" => Some(4),
        "quilt" => Some(5),
        "neoforge" => Some(6),
        _ => None,
    }
}

pub async fn resolve_curseforge_file(cf_mod_id: u64, game_version: &str, loader: &str) -> Option<Value> {
    let client = http_client(12);
    let mut urls = Vec::new();
    if let Some(lt) = curseforge_loader_type(loader) {
        if !game_version.is_empty() {
            urls.push(format!(
                "https://api.curseforge.com/v1/mods/{}/files?gameVersion={}&modLoaderType={}&pageSize=10",
                cf_mod_id,
                urlencoding::encode(game_version),
                lt
            ));
        }
    }
    if !game_version.is_empty() {
        urls.push(format!(
            "https://api.curseforge.com/v1/mods/{}/files?gameVersion={}&pageSize=10",
            cf_mod_id,
            urlencoding::encode(game_version)
        ));
    }

    for url in urls {
        if let Ok(resp) = client
            .get(&url)
            .header("x-api-key", CURSEFORGE_API_KEY)
            .header("Accept", "application/json")
            .send()
            .await
        {
            if resp.status().is_success() {
                if let Ok(data) = resp.json::<Value>().await {
                    if let Some(arr) = data.get("data").and_then(|v| v.as_array()) {
                        if let Some(first) = arr.first() {
                            return Some(first.clone());
                        }
                    }
                }
            }
        }
    }
    None
}

pub async fn search_mods(params: Value) -> Value {
    let provider = params.get("provider").and_then(|v| v.as_str()).unwrap_or("modrinth");
    let query = params.get("query").and_then(|v| v.as_str()).unwrap_or("");
    let loader = params.get("loader").and_then(|v| v.as_str()).unwrap_or("");
    let game_version = params.get("gameVersion").and_then(|v| v.as_str()).unwrap_or("");
    let category = params.get("category").and_then(|v| v.as_str()).unwrap_or("");
    let limit = params.get("limit").and_then(|v| v.as_u64()).unwrap_or(40).min(100);
    let offset = params.get("offset").and_then(|v| v.as_u64()).unwrap_or(0);

    if provider == "curseforge" {
        let mut url = format!(
            "https://api.curseforge.com/v1/mods/search?gameId=432&classId=6&searchFilter={}&pageSize={}&index={}&sortField=2&sortOrder=desc",
            urlencoding::encode(query),
            limit.min(50),
            offset
        );
        if !game_version.is_empty() {
            url.push_str(&format!("&gameVersion={}", urlencoding::encode(game_version)));
        }
        if let Some(lt) = curseforge_loader_type(loader) {
            url.push_str(&format!("&modLoaderType={}", lt));
        }

        return match http_client(10)
            .get(&url)
            .header("x-api-key", CURSEFORGE_API_KEY)
            .header("Accept", "application/json")
            .send()
            .await
        {
            Ok(resp) => {
                let status = resp.status();
                if status == reqwest::StatusCode::FORBIDDEN {
                    return json!({
                        "success": false,
                        "provider": "curseforge",
                        "error": "curseforge_search_forbidden",
                        "hits": [],
                        "total_hits": 0,
                        "offset": offset
                    });
                }
                match resp.json::<Value>().await {
                    Ok(data) => {
                        let raw_hits = data.get("data").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                        let mapped: Vec<Value> = raw_hits
                            .into_iter()
                            .map(|m| {
                                let cf_id = m.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
                                let author = m
                                    .get("authors")
                                    .and_then(|a| a.as_array())
                                    .and_then(|a| a.first())
                                    .and_then(|a| a.get("name"))
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("Author");
                                let icon_url = m
                                    .pointer("/logo/thumbnailUrl")
                                    .or_else(|| m.pointer("/logo/url"))
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("");
                                let mut cats: Vec<String> = m
                                    .get("categories")
                                    .and_then(|c| c.as_array())
                                    .map(|arr| {
                                        arr.iter()
                                            .filter_map(|c| c.get("slug").and_then(|s| s.as_str()).map(|s| s.to_string()))
                                            .collect()
                                    })
                                    .unwrap_or_default();
                                if !loader.is_empty() && loader != "all" && loader != "vanilla" {
                                    cats.push(loader.to_lowercase());
                                }
                                json!({
                                    "project_id": format!("cf-{}", cf_id),
                                    "cfId": cf_id,
                                    "slug": m.get("slug").and_then(|v| v.as_str()).unwrap_or(""),
                                    "title": m.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                                    "author": author,
                                    "description": m.get("summary").and_then(|v| v.as_str()).unwrap_or(""),
                                    "icon_url": icon_url,
                                    "downloads": m.get("downloadCount").and_then(|v| v.as_u64()).unwrap_or(0),
                                    "categories": cats,
                                    "provider": "curseforge"
                                })
                            })
                            .collect();
                        let total = data
                            .pointer("/pagination/totalCount")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(mapped.len() as u64);
                        json!({
                            "success": true,
                            "provider": "curseforge",
                            "hits": mapped,
                            "total_hits": total,
                            "offset": offset
                        })
                    }
                    Err(e) => json!({ "success": false, "provider": "curseforge", "error": e.to_string(), "hits": [], "total_hits": 0, "offset": 0 }),
                }
            }
            Err(e) => json!({ "success": false, "provider": "curseforge", "error": e.to_string(), "hits": [], "total_hits": 0, "offset": 0 }),
        };
    }

    let mut facets: Vec<Vec<String>> = vec![vec!["project_type:mod".to_string()]];
    if !loader.is_empty() && loader != "all" && loader != "vanilla" {
        facets.push(vec![format!("categories:{}", loader)]);
    }
    if !category.is_empty() && category != "all" {
        facets.push(vec![format!("categories:{}", category)]);
    }
    if !game_version.is_empty() {
        facets.push(vec![format!("versions:{}", game_version)]);
    }

    let facets_json = serde_json::to_string(&facets).unwrap_or_else(|_| "[]".to_string());
    let url = format!(
        "https://api.modrinth.com/v2/search?query={}&limit={}&offset={}&facets={}",
        urlencoding::encode(query),
        limit,
        offset,
        urlencoding::encode(&facets_json)
    );

    match http_client(10).get(&url).send().await {
        Ok(resp) => match resp.json::<Value>().await {
            Ok(data) => json!({
                "success": true,
                "provider": "modrinth",
                "hits": data.get("hits").cloned().unwrap_or(json!([])),
                "total_hits": data.get("total_hits").and_then(|v| v.as_u64()).unwrap_or(0),
                "offset": offset
            }),
            Err(e) => json!({ "success": false, "provider": "modrinth", "error": e.to_string(), "hits": [], "total_hits": 0, "offset": 0 }),
        },
        Err(e) => json!({ "success": false, "provider": "modrinth", "error": e.to_string(), "hits": [], "total_hits": 0, "offset": 0 }),
    }
}

pub async fn resolve_modrinth_version(project_id: &str, game_version: &str, loader: &str) -> Option<Value> {
    let clean_loader = if loader.is_empty() { "fabric" } else { loader }.to_lowercase();
    let clean_gv = if game_version.is_empty() { "1.20.1" } else { game_version };
    let client = http_client(10);

    let loaders_param = urlencoding::encode(&serde_json::to_string(&vec![&clean_loader]).unwrap_or_default()).into_owned();
    let gv_param = urlencoding::encode(&serde_json::to_string(&vec![clean_gv]).unwrap_or_default()).into_owned();

    // 1. Exact
    let url1 = format!(
        "https://api.modrinth.com/v2/project/{}/version?loaders={}&game_versions={}",
        urlencoding::encode(project_id),
        loaders_param,
        gv_param
    );
    if let Ok(resp) = client.get(&url1).send().await {
        if let Ok(arr) = resp.json::<Vec<Value>>().await {
            if let Some(first) = arr.into_iter().next() {
                return Some(first);
            }
        }
    }

    // 2. Loader only, major version match
    let url2 = format!(
        "https://api.modrinth.com/v2/project/{}/version?loaders={}",
        urlencoding::encode(project_id),
        loaders_param
    );
    if let Ok(resp) = client.get(&url2).send().await {
        if let Ok(arr) = resp.json::<Vec<Value>>().await {
            if !arr.is_empty() {
                let major: String = clean_gv.split('.').take(2).collect::<Vec<&str>>().join(".");
                if let Some(matched) = arr.iter().find(|v| {
                    v.get("game_versions")
                        .and_then(|gvs| gvs.as_array())
                        .map(|a| a.iter().any(|x| x.as_str().map(|s| s.starts_with(&major)).unwrap_or(false)))
                        .unwrap_or(false)
                }) {
                    return Some(matched.clone());
                }
                return arr.into_iter().next();
            }
        }
    }

    // 3. Fallback all
    let url3 = format!("https://api.modrinth.com/v2/project/{}/version", urlencoding::encode(project_id));
    if let Ok(resp) = client.get(&url3).send().await {
        if let Ok(arr) = resp.json::<Vec<Value>>().await {
            if let Some(matched) = arr.iter().find(|v| {
                v.get("loaders")
                    .and_then(|ls| ls.as_array())
                    .map(|a| a.iter().any(|x| x.as_str() == Some(clean_loader.as_str())))
                    .unwrap_or(false)
            }) {
                return Some(matched.clone());
            }
            return arr.into_iter().next();
        }
    }

    None
}

fn update_mod_in_config(instance_id: &str, mod_id: &str, fields: &[(&str, Value)]) {
    let mut cfg = load_config();
    if let Some(instances) = cfg.get_mut("instances").and_then(|v| v.as_array_mut()) {
        if let Some(inst) = instances.iter_mut().find(|i| i.get("id").and_then(|v| v.as_str()) == Some(instance_id)) {
            if let Some(mods) = inst.get_mut("mods").and_then(|v| v.as_array_mut()) {
                if let Some(m) = mods.iter_mut().find(|x| {
                    x.get("id").and_then(|v| v.as_str()) == Some(mod_id)
                        || x.get("slug").and_then(|v| v.as_str()) == Some(mod_id)
                }) {
                    for (k, v) in fields {
                        m[*k] = v.clone();
                    }
                    let _ = save_config(&cfg);
                }
            }
        }
    }
}

pub async fn download_mod_file(
    instance_id: &str,
    mod_obj: &Value,
    target_gv: Option<&str>,
    target_loader: Option<&str>,
) -> Result<Value, String> {
    let mods_dir = get_instance_mods_dir(instance_id)?;
    let cfg = load_config();
    let inst = cfg
        .get("instances")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.iter().find(|i| i.get("id").and_then(|v| v.as_str()) == Some(instance_id)));

    let gv = target_gv
        .or_else(|| inst.and_then(|i| i.get("gameVersion")).and_then(|v| v.as_str()))
        .unwrap_or("1.20.1")
        .to_string();
    let loader = target_loader
        .or_else(|| inst.and_then(|i| i.get("loader")).and_then(|v| v.as_str()))
        .unwrap_or("fabric")
        .to_string();

    if let Some(fname) = mod_obj.get("fileName").and_then(|v| v.as_str()) {
        if let Some(safe_name) = Path::new(fname).file_name().and_then(|n| n.to_str()) {
            let existing = mods_dir.join(safe_name);
            if existing.exists() {
                if let Ok(meta) = fs::metadata(&existing) {
                    if meta.len() > 0 {
                        return Ok(json!({
                            "success": true,
                            "fileName": safe_name,
                            "fileSize": meta.len(),
                            "cached": true
                        }));
                    }
                }
            }
        }
    }

    let mod_id = mod_obj.get("id").and_then(|v| v.as_str()).unwrap_or("");
    let project_id = mod_obj
        .get("slug")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .unwrap_or(mod_id);
    let title = mod_obj.get("title").and_then(|v| v.as_str()).unwrap_or(project_id);

    let provider = mod_obj
        .get("provider")
        .and_then(|v| v.as_str())
        .or_else(|| inst.and_then(|i| i.get("modProvider")).and_then(|v| v.as_str()))
        .unwrap_or("modrinth");

    let cf_id_opt = mod_obj
        .get("cfId")
        .and_then(|v| v.as_u64())
        .or_else(|| mod_id.strip_prefix("cf-").and_then(|s| s.parse::<u64>().ok()));

    if provider == "curseforge" {
        if let Some(cf_id) = cf_id_opt {
            if let Some(cf_file) = resolve_curseforge_file(cf_id, &gv, &loader).await {
                let raw_filename = cf_file.get("fileName").and_then(|v| v.as_str()).unwrap_or("mod.jar");
                let safe_filename = Path::new(raw_filename)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("mod.jar")
                    .to_string();
                let dest_path = mods_dir.join(&safe_filename);
                let file_id = cf_file.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
                let fallback_url = if file_id > 0 {
                    format!(
                        "https://edge.forgecdn.net/files/{}/{}/{}",
                        file_id / 1000,
                        file_id % 1000,
                        urlencoding::encode(&safe_filename)
                    )
                } else {
                    String::new()
                };
                let file_url = cf_file
                    .get("downloadUrl")
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_string())
                    .unwrap_or(fallback_url);
                if !file_url.is_empty() {
                    let file_size = cf_file.get("fileLength").and_then(|v| v.as_u64()).unwrap_or(0);
                    let sha1 = cf_file
                        .get("hashes")
                        .and_then(|h| h.as_array())
                        .and_then(|arr| arr.iter().find(|x| x.get("algo").and_then(|a| a.as_u64()) == Some(1)))
                        .and_then(|x| x.get("value").and_then(|v| v.as_str()));

                    if dest_path.exists() && fs::metadata(&dest_path).map(|m| m.len() == file_size && file_size > 0).unwrap_or(false) {
                        update_mod_in_config(
                            instance_id,
                            mod_id,
                            &[
                                ("fileName", json!(safe_filename)),
                                ("fileSize", json!(file_size)),
                                ("fileUrl", json!(file_url)),
                            ],
                        );
                        return Ok(json!({
                            "success": true,
                            "fileName": safe_filename,
                            "fileSize": file_size,
                            "cached": true
                        }));
                    }

                    let downloaded_size = stream_download_to_file(&file_url, &dest_path, sha1).await?;
                    let final_size = if file_size > 0 { file_size } else { downloaded_size };
                    update_mod_in_config(
                        instance_id,
                        mod_id,
                        &[
                            ("fileName", json!(safe_filename)),
                            ("fileSize", json!(final_size)),
                            ("fileUrl", json!(file_url)),
                            ("downloadedAt", json!(now_ms())),
                        ],
                    );

                    return Ok(json!({
                        "success": true,
                        "fileName": safe_filename,
                        "fileSize": final_size
                    }));
                }
            }
        }
    }

    let version_data = resolve_modrinth_version(project_id, &gv, &loader)
        .await
        .ok_or_else(|| format!("Не удалось найти файл для мода \"{}\" ({} {})", title, loader, gv))?;

    let files = version_data
        .get("files")
        .and_then(|v| v.as_array())
        .filter(|a| !a.is_empty())
        .ok_or_else(|| format!("Отсутствуют файлы для мода \"{}\"", title))?;

    let file_info = files
        .iter()
        .find(|f| f.get("primary").and_then(|v| v.as_bool()) == Some(true))
        .unwrap_or(&files[0]);

    let raw_filename = file_info.get("filename").and_then(|v| v.as_str()).unwrap_or("mod.jar");
    let safe_filename = Path::new(raw_filename)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("mod.jar")
        .to_string();
    let dest_path = mods_dir.join(&safe_filename);
    let file_url = file_info.get("url").and_then(|v| v.as_str()).unwrap_or("");
    let file_size = file_info.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
    let sha1 = file_info.pointer("/hashes/sha1").and_then(|v| v.as_str());

    if dest_path.exists() && fs::metadata(&dest_path).map(|m| m.len() == file_size && file_size > 0).unwrap_or(false) {
        update_mod_in_config(
            instance_id,
            mod_id,
            &[
                ("fileName", json!(safe_filename)),
                ("fileSize", json!(file_size)),
                ("fileUrl", json!(file_url)),
            ],
        );
        return Ok(json!({
            "success": true,
            "fileName": safe_filename,
            "fileSize": file_size,
            "cached": true
        }));
    }

    let downloaded_size = stream_download_to_file(file_url, &dest_path, sha1).await?;
    let final_size = if file_size > 0 { file_size } else { downloaded_size };
    update_mod_in_config(
        instance_id,
        mod_id,
        &[
            ("fileName", json!(safe_filename)),
            ("fileSize", json!(final_size)),
            ("fileUrl", json!(file_url)),
            ("downloadedAt", json!(now_ms())),
        ],
    );

    if let Some(deps) = version_data.get("dependencies").and_then(|v| v.as_array()) {
        if !deps.is_empty() {
            let mut visited = HashSet::new();
            resolve_mod_dependencies(instance_id, deps, &gv, &loader, &mut visited).await;
        }
    }

    Ok(json!({
        "success": true,
        "fileName": safe_filename,
        "fileSize": final_size
    }))
}

fn resolve_mod_dependencies<'a>(
    instance_id: &'a str,
    dependencies: &'a [Value],
    game_version: &'a str,
    loader: &'a str,
    visited: &'a mut HashSet<String>,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + 'a>> {
    Box::pin(async move {
        let client = http_client(10);
        for dep in dependencies {
            if dep.get("dependency_type").and_then(|v| v.as_str()) != Some("required") {
                continue;
            }
            let Some(proj_id) = dep.get("project_id").and_then(|v| v.as_str()) else {
                continue;
            };
            if !visited.insert(proj_id.to_string()) {
                continue;
            }

            let mut cfg = load_config();
            let already = cfg
                .get("instances")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.iter().find(|i| i.get("id").and_then(|v| v.as_str()) == Some(instance_id)))
                .and_then(|i| i.get("mods"))
                .and_then(|m| m.as_array())
                .map(|mods| {
                    mods.iter().any(|m| {
                        m.get("id").and_then(|v| v.as_str()) == Some(proj_id)
                            || m.get("slug").and_then(|v| v.as_str()) == Some(proj_id)
                    })
                })
                .unwrap_or(false);
            if already {
                continue;
            }

            let proj_url = format!("https://api.modrinth.com/v2/project/{}", urlencoding::encode(proj_id));
            let Ok(resp) = client.get(&proj_url).send().await else { continue };
            let Ok(pdata) = resp.json::<Value>().await else { continue };

            let mut dep_mod = json!({
                "id": pdata.get("id").cloned().unwrap_or(json!(proj_id)),
                "slug": pdata.get("slug").cloned().unwrap_or(json!(proj_id)),
                "title": pdata.get("title").cloned().unwrap_or(json!(proj_id)),
                "description": pdata.get("description").cloned().unwrap_or(json!("Обязательная зависимость")),
                "author": pdata.get("author").cloned().unwrap_or(json!("")),
                "icon_url": pdata.get("icon_url").cloned().unwrap_or(json!("")),
                "isDependency": true
            });

            if let Some(instances) = cfg.get_mut("instances").and_then(|v| v.as_array_mut()) {
                if let Some(inst) = instances.iter_mut().find(|i| i.get("id").and_then(|v| v.as_str()) == Some(instance_id)) {
                    if let Some(mods) = inst.get_mut("mods").and_then(|v| v.as_array_mut()) {
                        mods.push(dep_mod.clone());
                        let _ = save_config(&cfg);
                    }
                }
            }

            if let Some(vdata) = resolve_modrinth_version(proj_id, game_version, loader).await {
                if let Some(files) = vdata.get("files").and_then(|v| v.as_array()) {
                    if !files.is_empty() {
                        let finfo = files
                            .iter()
                            .find(|f| f.get("primary").and_then(|v| v.as_bool()) == Some(true))
                            .unwrap_or(&files[0]);
                        let fname = finfo.get("filename").and_then(|v| v.as_str()).unwrap_or("dep.jar");
                        let furl = finfo.get("url").and_then(|v| v.as_str()).unwrap_or("");
                        let fsize = finfo.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
                        let sha1 = finfo.pointer("/hashes/sha1").and_then(|v| v.as_str());
                        if let Ok(mods_dir) = get_instance_mods_dir(instance_id) {
                            let dest = mods_dir.join(Path::new(fname).file_name().unwrap_or_default());
                            if stream_download_to_file(furl, &dest, sha1).await.is_ok() {
                                dep_mod["fileName"] = json!(fname);
                                dep_mod["fileSize"] = json!(fsize);
                                dep_mod["fileUrl"] = json!(furl);
                                update_mod_in_config(
                                    instance_id,
                                    proj_id,
                                    &[
                                        ("fileName", json!(fname)),
                                        ("fileSize", json!(fsize)),
                                        ("fileUrl", json!(furl)),
                                    ],
                                );
                                if let Some(sub_deps) = vdata.get("dependencies").and_then(|v| v.as_array()) {
                                    resolve_mod_dependencies(instance_id, sub_deps, game_version, loader, visited).await;
                                }
                            }
                        }
                    }
                }
            }
        }
    })
}

pub async fn download_all_instance_mods(app: Option<&AppHandle>, instance_id: &str) -> Result<Value, String> {
    let cfg = load_config();
    let inst = cfg
        .get("instances")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.iter().find(|i| i.get("id").and_then(|v| v.as_str()) == Some(instance_id)));

    let Some(inst) = inst else {
        return Ok(json!({ "success": true, "count": 0 }));
    };
    let mods = inst.get("mods").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    if mods.is_empty() {
        return Ok(json!({ "success": true, "count": 0 }));
    }

    let gv = inst.get("gameVersion").and_then(|v| v.as_str()).unwrap_or("1.20.1").to_string();
    let loader = inst.get("loader").and_then(|v| v.as_str()).unwrap_or("fabric").to_string();
    let mut count = 0u64;

    for m in mods {
        if m.get("disabled").and_then(|v| v.as_bool()) == Some(true) {
            continue;
        }
        let title = m
            .get("title")
            .or_else(|| m.get("id"))
            .and_then(|v| v.as_str())
            .unwrap_or("Mod");
        if let Some(a) = app {
            let _ = a.emit("mc-launch-status", json!({ "status": "downloading", "message": format!("Скачивание мода: {}...", title) }));
        }
        if download_mod_file(instance_id, &m, Some(&gv), Some(&loader)).await.is_ok() {
            count += 1;
        }
    }

    Ok(json!({ "success": true, "count": count }))
}

pub fn toggle_mod_state(instance_id: &str, mod_id: &str, enabled: bool) -> Result<Value, String> {
    let mods_dir = get_instance_mods_dir(instance_id)?;
    let mut cfg = load_config();
    let instances = cfg
        .get_mut("instances")
        .and_then(|v| v.as_array_mut())
        .ok_or("Инстансы не найдены")?;
    let inst = instances
        .iter_mut()
        .find(|i| i.get("id").and_then(|v| v.as_str()) == Some(instance_id))
        .ok_or("Инстанс не найден")?;
    let mods = inst
        .get_mut("mods")
        .and_then(|v| v.as_array_mut())
        .ok_or("Моды не найдены")?;
    let m = mods
        .iter_mut()
        .find(|x| {
            x.get("id").and_then(|v| v.as_str()) == Some(mod_id)
                || x.get("slug").and_then(|v| v.as_str()) == Some(mod_id)
        })
        .ok_or("Мод не найден")?;

    let files: Vec<String> = fs::read_dir(&mods_dir)
        .map(|rd| rd.flatten().filter_map(|e| e.file_name().into_string().ok()).collect())
        .unwrap_or_default();

    let clean_id: String = m
        .get("id")
        .or_else(|| m.get("slug"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_lowercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect();

    let mut current_file: Option<String> = None;
    if let Some(fname) = m.get("fileName").and_then(|v| v.as_str()) {
        let disabled_name = format!("{}.disabled", fname);
        let stripped = fname.strip_suffix(".disabled").unwrap_or(fname).to_string();
        if files.iter().any(|f| f == fname) {
            current_file = Some(fname.to_string());
        } else if files.iter().any(|f| f == &disabled_name) {
            current_file = Some(disabled_name);
        } else if files.iter().any(|f| f == &stripped) {
            current_file = Some(stripped);
        }
    }

    if current_file.is_none() && clean_id.len() >= 2 {
        current_file = files.into_iter().find(|f| {
            let cf: String = f.to_lowercase().chars().filter(|c| c.is_ascii_alphanumeric()).collect();
            cf.contains(&clean_id) && (f.ends_with(".jar") || f.ends_with(".jar.disabled"))
        });
    }

    if let Some(cur) = current_file {
        let old_path = mods_dir.join(&cur);
        let new_name = if enabled {
            let mut s = cur.strip_suffix(".disabled").unwrap_or(&cur).to_string();
            if !s.ends_with(".jar") {
                s.push_str(".jar");
            }
            s
        } else if cur.ends_with(".disabled") {
            cur.clone()
        } else {
            format!("{}.disabled", cur)
        };
        let new_path = mods_dir.join(&new_name);
        if old_path != new_path && old_path.exists() {
            fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?;
        }
        m["fileName"] = json!(new_name);
    }

    m["disabled"] = json!(!enabled);
    let disabled_val = !enabled;
    let fname_val = m.get("fileName").cloned().unwrap_or(Value::Null);
    save_config(&cfg)?;
    Ok(json!({ "success": true, "disabled": disabled_val, "fileName": fname_val }))
}

pub fn delete_mod_file(instance_id: &str, mod_id: &str, file_name: Option<&str>) -> Result<Value, String> {
    let mods_dir = get_instance_mods_dir(instance_id)?;
    if let Some(fname) = file_name {
        if let Some(clean) = Path::new(fname).file_name().and_then(|n| n.to_str()) {
            let p1 = mods_dir.join(clean);
            let p2 = mods_dir.join(format!("{}.disabled", clean));
            let p3 = mods_dir.join(clean.strip_suffix(".disabled").unwrap_or(clean));
            for p in [p1, p2, p3] {
                if p.exists() {
                    let _ = fs::remove_file(p);
                }
            }
        }
    }

    let clean_id: String = mod_id
        .to_lowercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect();
    if clean_id.len() >= 2 {
        if let Ok(entries) = fs::read_dir(&mods_dir) {
            for entry in entries.flatten() {
                if let Ok(name) = entry.file_name().into_string() {
                    let clean_f: String = name.to_lowercase().chars().filter(|c| c.is_ascii_alphanumeric()).collect();
                    if clean_f.contains(&clean_id) && (name.ends_with(".jar") || name.ends_with(".jar.disabled")) {
                        let _ = fs::remove_file(entry.path());
                    }
                }
            }
        }
    }
    Ok(json!({ "success": true }))
}

pub fn get_instance_jars(instance_id: &str) -> Result<Vec<String>, String> {
    let mods_dir = get_instance_mods_dir(instance_id)?;
    let mut jars = Vec::new();
    if let Ok(entries) = fs::read_dir(mods_dir) {
        for entry in entries.flatten() {
            if let Ok(name) = entry.file_name().into_string() {
                if name.ends_with(".jar") {
                    jars.push(name);
                }
            }
        }
    }
    Ok(jars)
}

fn parse_mod_jar_metadata(file_path: &Path) -> Value {
    let mut title = String::new();
    let mut description = String::new();
    let mut author = String::new();
    let mut icon_data_url = String::new();

    let Ok(buf) = fs::read(file_path) else {
        return json!({ "title": "", "description": "", "author": "", "iconDataUrl": "", "sha1": "" });
    };

    let mut hasher = Sha1::new();
    hasher.update(&buf);
    let sha1_hex = hex::encode(hasher.finalize());

    if let Ok(guard) = disk_mod_cache().lock() {
        if let Some(cached) = guard.get(&sha1_hex) {
            let mut c = cached.clone();
            c["sha1"] = json!(sha1_hex);
            return c;
        }
    }

    let reader = std::io::Cursor::new(&buf);
    if let Ok(mut archive) = ZipArchive::new(reader) {
        let mut icon_path = String::new();

        let json_entry_name = if archive.by_name("fabric.mod.json").is_ok() {
            Some("fabric.mod.json")
        } else if archive.by_name("quilt.mod.json").is_ok() {
            Some("quilt.mod.json")
        } else {
            None
        };

        if let Some(ename) = json_entry_name {
            if let Ok(mut f) = archive.by_name(ename) {
                let mut text = String::new();
                if f.read_to_string(&mut text).is_ok() {
                    if let Ok(raw) = serde_json::from_str::<Value>(&text) {
                        let obj = raw.pointer("/quilt_loader/metadata").unwrap_or(&raw);
                        title = obj.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        description = obj.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        if let Some(authors) = obj.get("authors").and_then(|v| v.as_array()) {
                            if let Some(first) = authors.first() {
                                author = first
                                    .as_str()
                                    .or_else(|| first.get("name").and_then(|v| v.as_str()))
                                    .unwrap_or("")
                                    .to_string();
                            }
                        } else if let Some(contribs) = obj.get("contributors").and_then(|v| v.as_object()) {
                            if let Some(first_key) = contribs.keys().next() {
                                author = first_key.clone();
                            }
                        }
                        if let Some(ic) = obj.get("icon") {
                            if let Some(s) = ic.as_str() {
                                icon_path = s.to_string();
                            } else if let Some(map) = ic.as_object() {
                                if let Some((_, v)) = map.iter().max_by_key(|(k, _)| k.parse::<u32>().unwrap_or(0)) {
                                    icon_path = v.as_str().unwrap_or("").to_string();
                                }
                            }
                        }
                    }
                }
            }
        } else {
            let toml_name = if archive.by_name("META-INF/neoforge.mods.toml").is_ok() {
                Some("META-INF/neoforge.mods.toml")
            } else if archive.by_name("META-INF/mods.toml").is_ok() {
                Some("META-INF/mods.toml")
            } else {
                None
            };
            if let Some(tname) = toml_name {
                if let Ok(mut f) = archive.by_name(tname) {
                    let mut toml = String::new();
                    if f.read_to_string(&mut toml).is_ok() {
                        if let Some(c) = Regex::new(r#"displayName\s*=\s*["']([^"']+)["']"#).ok().and_then(|r| r.captures(&toml)) {
                            title = c[1].trim().to_string();
                        }
                        if let Some(c) = Regex::new(r#"authors\s*=\s*["']([^"']+)["']"#).ok().and_then(|r| r.captures(&toml)) {
                            author = c[1].trim().to_string();
                        }
                        if let Some(c) = Regex::new(r#"logoFile\s*=\s*["']([^"']+)["']"#).ok().and_then(|r| r.captures(&toml)) {
                            icon_path = c[1].trim().to_string();
                        }
                        if let Some(c) = Regex::new(r#"description\s*=\s*(?:'''([\s\S]*?)'''|"""([\s\S]*?)"""|["']([^"'\r\n]+)["'])"#)
                            .ok()
                            .and_then(|r| r.captures(&toml))
                        {
                            let raw_desc = c.get(1).or_else(|| c.get(2)).or_else(|| c.get(3)).map(|m| m.as_str()).unwrap_or("");
                            description = raw_desc.split_whitespace().collect::<Vec<&str>>().join(" ");
                        }
                    }
                }
            }
        }

        if !icon_path.is_empty() {
            let clean_icon = icon_path.trim_start_matches('/');
            if let Ok(mut icon_file) = archive.by_name(clean_icon) {
                if icon_file.is_file() && icon_file.size() > 0 && icon_file.size() < 512 * 1024 {
                    let mut ibuf = Vec::new();
                    if icon_file.read_to_end(&mut ibuf).is_ok() {
                        let ext = Path::new(clean_icon)
                            .extension()
                            .and_then(|e| e.to_str())
                            .unwrap_or("png")
                            .to_lowercase();
                        let mime = match ext.as_str() {
                            "jpg" | "jpeg" => "jpeg",
                            "webp" => "webp",
                            "gif" => "gif",
                            _ => "png",
                        };
                        icon_data_url = format!("data:image/{};base64,{}", mime, BASE64.encode(ibuf));
                    }
                }
            }
        }
    }

    json!({
        "title": title,
        "description": description,
        "author": author,
        "iconDataUrl": icon_data_url,
        "sha1": sha1_hex
    })
}

pub async fn get_instance_disk_mods(instance_id: &str) -> Vec<Value> {
    let Ok(mods_dir) = get_instance_mods_dir(instance_id) else {
        return Vec::new();
    };
    if !mods_dir.exists() {
        return Vec::new();
    }
    let Ok(entries) = fs::read_dir(&mods_dir) else {
        return Vec::new();
    };

    let mut result = Vec::new();
    let mut uncached_hashes = Vec::new();

    for entry in entries.flatten() {
        let Ok(ft) = entry.file_type() else { continue };
        if !ft.is_file() {
            continue;
        }
        let Ok(name) = entry.file_name().into_string() else { continue };
        if !name.ends_with(".jar") && !name.ends_with(".jar.disabled") {
            continue;
        }
        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
        let meta = parse_mod_jar_metadata(&entry.path());
        let sha1 = meta.get("sha1").and_then(|v| v.as_str()).unwrap_or("").to_string();

        let is_cached = !sha1.is_empty()
            && disk_mod_cache()
                .lock()
                .map(|g| g.contains_key(&sha1))
                .unwrap_or(false);
        if !sha1.is_empty() && !is_cached {
            uncached_hashes.push(sha1.clone());
        }

        let icon_url = meta
            .get("icon_url")
            .or_else(|| meta.get("iconDataUrl"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        result.push(json!({
            "fileName": name,
            "size": size,
            "disabled": name.ends_with(".jar.disabled"),
            "sha1": sha1,
            "title": meta.get("title").cloned().unwrap_or(json!("")),
            "description": meta.get("description").cloned().unwrap_or(json!("")),
            "author": meta.get("author").cloned().unwrap_or(json!("")),
            "icon_url": icon_url
        }));
    }

    if !uncached_hashes.is_empty() {
        let client = http_client(5);
        if let Ok(ver_res) = client
            .post("https://api.modrinth.com/v2/version_files")
            .json(&json!({ "hashes": uncached_hashes, "algorithm": "sha1" }))
            .send()
            .await
        {
            if let Ok(ver_map) = ver_res.json::<Value>().await {
                if let Some(obj) = ver_map.as_object() {
                    let mut hash_to_proj = HashMap::new();
                    let mut proj_ids = HashSet::new();
                    for (sha, vinfo) in obj {
                        if let Some(pid) = vinfo.get("project_id").and_then(|v| v.as_str()) {
                            hash_to_proj.insert(sha.clone(), pid.to_string());
                            proj_ids.insert(pid.to_string());
                        }
                    }

                    let mut proj_map = HashMap::new();
                    if !proj_ids.is_empty() {
                        let ids_vec: Vec<String> = proj_ids.into_iter().collect();
                        let ids_param = urlencoding::encode(&serde_json::to_string(&ids_vec).unwrap_or_default()).into_owned();
                        if let Ok(proj_res) = client
                            .get(format!("https://api.modrinth.com/v2/projects?ids={}", ids_param))
                            .send()
                            .await
                        {
                            if let Ok(arr) = proj_res.json::<Vec<Value>>().await {
                                for p in arr {
                                    if let Some(id) = p.get("id").and_then(|v| v.as_str()) {
                                        proj_map.insert(id.to_string(), p);
                                    }
                                }
                            }
                        }
                    }

                    if let Ok(mut guard) = disk_mod_cache().lock() {
                        for item in result.iter_mut() {
                            let sha = item.get("sha1").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            if sha.is_empty() {
                                continue;
                            }
                            if let Some(pid) = hash_to_proj.get(&sha) {
                                if let Some(proj) = proj_map.get(pid) {
                                    if let Some(ic) = proj.get("icon_url").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
                                        item["icon_url"] = json!(ic);
                                    }
                                    if let Some(t) = proj.get("title").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
                                        item["title"] = json!(t);
                                    }
                                    if let Some(d) = proj.get("description").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
                                        item["description"] = json!(d);
                                    }
                                }
                            }
                            guard.insert(
                                sha,
                                json!({
                                    "title": item["title"],
                                    "description": item["description"],
                                    "author": item["author"],
                                    "icon_url": item["icon_url"],
                                    "iconDataUrl": item["icon_url"]
                                }),
                            );
                        }
                    }
                }
            }
        }
    }

    result
}

fn safe_join_zip_path(base_dir: &Path, rel: &str) -> Result<PathBuf, String> {
    let mut out = base_dir.to_path_buf();
    for comp in Path::new(rel).components() {
        match comp {
            Component::Normal(p) => out.push(p),
            Component::CurDir => {}
            _ => return Err(format!("Обнаружена угроза Zip Slip (Path Traversal): {}", rel)),
        }
    }
    Ok(out)
}

pub async fn import_modpack_mrpack(app: Option<&AppHandle>, mrpack_path: &str) -> Result<Value, String> {
    if mrpack_path.is_empty() || !Path::new(mrpack_path).exists() {
        return Err("Файл .mrpack не найден".to_string());
    }
    if let Some(a) = app {
        let _ = a.emit("mc-launch-status", json!({ "status": "preparing", "message": "Анализ модпака (.mrpack)..." }));
    }

    let file = File::open(mrpack_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    let index: Value = {
        let mut idx_entry = archive
            .by_name("modrinth.index.json")
            .map_err(|_| "Некорректный .mrpack: отсутствует modrinth.index.json".to_string())?;
        let mut s = String::new();
        idx_entry.read_to_string(&mut s).map_err(|e| e.to_string())?;
        serde_json::from_str(&s).map_err(|e| e.to_string())?
    };

    let pack_name = index
        .get("name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            Path::new(mrpack_path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Modpack")
                .to_string()
        });
    let game_version = index
        .pointer("/dependencies/minecraft")
        .and_then(|v| v.as_str())
        .unwrap_or("1.20.1")
        .to_string();

    let loader = if index.pointer("/dependencies/forge").is_some() {
        "forge"
    } else if index.pointer("/dependencies/neoforge").is_some() {
        "neoforge"
    } else if index.pointer("/dependencies/quilt").is_some() {
        "quilt"
    } else {
        "fabric"
    };

    let instance_id = format!("inst-pack-{}", now_ms());
    let instance_dir = get_instance_dir(&instance_id)?;

    if let Some(a) = app {
        let _ = a.emit("mc-launch-status", json!({ "status": "preparing", "message": "Распаковка конфигурации..." }));
    }

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        if entry.is_dir() {
            continue;
        }
        let clean_name = entry.name().replace('\\', "/");
        let target_rel = if let Some(r) = clean_name.strip_prefix("overrides/") {
            Some(r)
        } else if let Some(r) = clean_name.strip_prefix("client-overrides/") {
            Some(r)
        } else {
            None
        };
        if let Some(rel) = target_rel {
            if rel.is_empty() {
                continue;
            }
            let dest = safe_join_zip_path(&instance_dir, rel)?;
            if let Some(p) = dest.parent() {
                fs::create_dir_all(p).map_err(|e| e.to_string())?;
            }
            let mut out = File::create(&dest).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
        }
    }

    let client_files: Vec<Value> = index
        .get("files")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter(|f| f.pointer("/env/client").and_then(|v| v.as_str()) != Some("unsupported"))
                .cloned()
                .collect()
        })
        .unwrap_or_default();

    let total = client_files.len();
    let completed = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let instance_mods = Arc::new(tokio::sync::Mutex::new(Vec::<Value>::new()));
    let sem = Arc::new(tokio::sync::Semaphore::new(6));

    let mut handles = Vec::new();
    for f in client_files {
        let permit = sem.clone().acquire_owned().await.map_err(|e| e.to_string())?;
        let inst_dir = instance_dir.clone();
        let completed_c = Arc::clone(&completed);
        let mods_c = Arc::clone(&instance_mods);
        let app_c = app.cloned();
        handles.push(tokio::spawn(async move {
            let _permit = permit;
            let rel = f.get("path").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let dest = safe_join_zip_path(&inst_dir, &rel)?;
            let fname = dest.file_name().and_then(|n| n.to_str()).unwrap_or("mod.jar").to_string();
            if let Some(url) = f.pointer("/downloads/0").and_then(|v| v.as_str()) {
                let sha1 = f.pointer("/hashes/sha1").and_then(|v| v.as_str());
                stream_download_to_file(url, &dest, sha1).await?;
            }
            let done = completed_c.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
            if let Some(ref a) = app_c {
                let pct = if total > 0 { (done * 100 / total) as u64 } else { 100 };
                let _ = a.emit(
                    "mc-launch-status",
                    json!({
                        "status": "downloading",
                        "message": format!("Скачивание ({}/{}): {}", done, total, fname),
                        "percent": pct,
                        "current": done,
                        "total": total
                    }),
                );
            }
            if rel.starts_with("mods/") || rel.starts_with("mods\\") {
                let clean_name = fname
                    .strip_suffix(".jar.disabled")
                    .or_else(|| fname.strip_suffix(".jar"))
                    .unwrap_or(&fname)
                    .to_string();
                let fsize = f.get("fileSize").and_then(|v| v.as_u64()).unwrap_or(0);
                mods_c.lock().await.push(json!({
                    "id": clean_name,
                    "title": clean_name,
                    "fileName": fname,
                    "fileSize": fsize,
                    "disabled": false
                }));
            }
            Ok::<(), String>(())
        }));
    }

    let mut failed_files = Vec::new();
    for h in handles {
        match h.await {
            Ok(Ok(())) => {}
            Ok(Err(e)) => failed_files.push(e),
            Err(e) => failed_files.push(e.to_string()),
        }
    }

    if !failed_files.is_empty() && total > 0 && failed_files.len() == total {
        return Err(format!("Не удалось скачать файлы модпака: {}", failed_files.join(", ")));
    }

    let mods_list = instance_mods.lock().await.clone();
    let mut cfg = load_config();
    if cfg.get("instances").and_then(|v| v.as_array()).is_none() {
        cfg["instances"] = json!([]);
    }
    let new_inst = json!({
        "id": instance_id,
        "name": pack_name,
        "gameVersion": game_version,
        "loader": loader,
        "loaderVersion": "latest",
        "modProvider": "modrinth",
        "icon": if loader == "forge" { "forge" } else { "fabric" },
        "created": now_ms(),
        "mods": mods_list
    });
    if let Some(arr) = cfg.get_mut("instances").and_then(|v| v.as_array_mut()) {
        arr.insert(0, new_inst);
    }
    cfg["selectedInstanceId"] = json!(instance_id);
    save_config(&cfg)?;

    if let Some(a) = app {
        let msg = if failed_files.is_empty() {
            format!("Модпак \"{}\" успешно установлен!", pack_name)
        } else {
            format!("Модпак \"{}\" установлен (пропущено {} недоступных файлов)", pack_name, failed_files.len())
        };
        let _ = a.emit("mc-launch-status", json!({ "status": "done", "message": msg }));
    }
    Ok(json!({ "success": true, "instanceId": instance_id, "instanceName": pack_name, "warnings": failed_files }))
}

pub fn export_instance(app: Option<&AppHandle>, instance_id: &str, dest_path: &str) -> Result<Value, String> {
    if instance_id.is_empty() {
        return Err("Не указан ID сборки".to_string());
    }
    if dest_path.is_empty() {
        return Err("Не указан путь для сохранения".to_string());
    }

    let cfg = load_config();
    let inst = cfg
        .get("instances")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.iter().find(|i| i.get("id").and_then(|v| v.as_str()) == Some(instance_id)))
        .ok_or("Сборка не найдена")?;

    let inst_name = inst.get("name").and_then(|v| v.as_str()).unwrap_or("Imported Instance");
    if let Some(a) = app {
        let _ = a.emit("mc-launch-status", json!({ "status": "preparing", "message": format!("Экспорт сборки \"{}\"...", inst_name) }));
    }

    if let Some(parent) = Path::new(dest_path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let out_file = File::create(dest_path).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(out_file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let manifest = json!({
        "format": "material-launcher-instance",
        "formatVersion": 1,
        "name": inst_name,
        "gameVersion": inst.get("gameVersion").and_then(|v| v.as_str()).unwrap_or("1.20.1"),
        "loader": inst.get("loader").and_then(|v| v.as_str()).unwrap_or("vanilla"),
        "loaderVersion": inst.get("loaderVersion").and_then(|v| v.as_str()).unwrap_or("latest"),
        "modProvider": inst.get("modProvider").and_then(|v| v.as_str()).unwrap_or("modrinth"),
        "icon": inst.get("icon").and_then(|v| v.as_str()).unwrap_or("fabric"),
        "mods": inst.get("mods").cloned().unwrap_or(json!([])),
        "exportedAt": now_ms()
    });
    zip.start_file("manifest.json", options).map_err(|e| e.to_string())?;
    zip.write_all(serde_json::to_string_pretty(&manifest).unwrap_or_default().as_bytes())
        .map_err(|e| e.to_string())?;

    let instance_dir = get_instance_dir(instance_id)?;
    let skip_dirs = ["logs", "crash-reports", ".cache"];
    let mut file_count = 0u64;

    for entry in walkdir::WalkDir::new(&instance_dir).into_iter().filter_entry(|e| {
        if e.depth() == 1 && e.file_type().is_dir() {
            if let Some(name) = e.file_name().to_str() {
                return !skip_dirs.contains(&name);
            }
        }
        true
    }) {
        let Ok(entry) = entry else { continue };
        if !entry.file_type().is_file() {
            continue;
        }
        let Ok(rel) = entry.path().strip_prefix(&instance_dir) else { continue };
        let rel_posix = rel.to_string_lossy().replace('\\', "/");
        zip.start_file(format!("files/{}", rel_posix), options)
            .map_err(|e| e.to_string())?;
        let mut f = File::open(entry.path()).map_err(|e| e.to_string())?;
        std::io::copy(&mut f, &mut zip).map_err(|e| e.to_string())?;
        file_count += 1;
    }

    zip.finish().map_err(|e| e.to_string())?;
    if let Some(a) = app {
        let _ = a.emit(
            "mc-launch-status",
            json!({ "status": "done", "message": format!("Сборка \"{}\" экспортирована ({} файлов)", inst_name, file_count) }),
        );
    }
    Ok(json!({ "success": true, "instanceName": inst_name, "fileCount": file_count, "destPath": dest_path }))
}

pub async fn import_instance(app: Option<&AppHandle>, archive_path: &str) -> Result<Value, String> {
    if archive_path.is_empty() || !Path::new(archive_path).exists() {
        return Err("Файл сборки не найден".to_string());
    }
    if let Some(a) = app {
        let _ = a.emit("mc-launch-status", json!({ "status": "preparing", "message": "Анализ архива сборки..." }));
    }

    let file = File::open(archive_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    let manifest_opt: Option<Value> = if let Ok(mut mf) = archive.by_name("manifest.json") {
        let mut s = String::new();
        mf.read_to_string(&mut s).map_err(|e| e.to_string())?;
        Some(serde_json::from_str(&s).map_err(|e| e.to_string())?)
    } else {
        None
    };

    let Some(manifest) = manifest_opt else {
        if archive.by_name("modrinth.index.json").is_ok() {
            drop(archive);
            return import_modpack_mrpack(app, archive_path).await;
        }
        return Err("Некорректный архив сборки: отсутствует manifest.json".to_string());
    };

    if manifest.get("format").and_then(|v| v.as_str()) != Some("material-launcher-instance") {
        return Err("Неподдерживаемый формат архива сборки".to_string());
    }

    let instance_id = format!("inst-imp-{}", now_ms());
    let instance_dir = get_instance_dir(&instance_id)?;
    if let Some(a) = app {
        let _ = a.emit("mc-launch-status", json!({ "status": "preparing", "message": "Распаковка файлов сборки..." }));
    }

    let mut extracted = 0u64;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        if entry.is_dir() {
            continue;
        }
        let clean_name = entry.name().replace('\\', "/");
        let Some(rel) = clean_name.strip_prefix("files/") else { continue };
        if rel.is_empty() {
            continue;
        }
        let dest = safe_join_zip_path(&instance_dir, rel)?;
        if let Some(p) = dest.parent() {
            fs::create_dir_all(p).map_err(|e| e.to_string())?;
        }
        let mut out = File::create(&dest).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
        extracted += 1;
    }

    let pack_name = manifest
        .get("name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            Path::new(archive_path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Imported")
                .to_string()
        });
    let loader = manifest.get("loader").and_then(|v| v.as_str()).unwrap_or("vanilla");

    let mut cfg = load_config();
    if cfg.get("instances").and_then(|v| v.as_array()).is_none() {
        cfg["instances"] = json!([]);
    }
    let new_inst = json!({
        "id": instance_id,
        "name": pack_name,
        "gameVersion": manifest.get("gameVersion").and_then(|v| v.as_str()).unwrap_or("1.20.1"),
        "loader": loader,
        "loaderVersion": manifest.get("loaderVersion").and_then(|v| v.as_str()).unwrap_or("latest"),
        "modProvider": manifest.get("modProvider").and_then(|v| v.as_str()).unwrap_or("modrinth"),
        "icon": manifest.get("icon").and_then(|v| v.as_str()).unwrap_or(if loader == "forge" { "forge" } else { "fabric" }),
        "created": now_ms(),
        "mods": manifest.get("mods").cloned().unwrap_or(json!([]))
    });
    if let Some(arr) = cfg.get_mut("instances").and_then(|v| v.as_array_mut()) {
        arr.insert(0, new_inst);
    }
    cfg["selectedInstanceId"] = json!(instance_id);
    save_config(&cfg)?;

    if let Some(a) = app {
        let _ = a.emit("mc-launch-status", json!({ "status": "done", "message": format!("Сборка \"{}\" успешно импортирована!", pack_name) }));
    }
    Ok(json!({ "success": true, "instanceId": instance_id, "instanceName": pack_name, "extractedFiles": extracted }))
}
