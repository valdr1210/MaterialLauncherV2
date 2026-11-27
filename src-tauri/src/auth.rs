use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tokio::sync::oneshot;

const CLIENT_ID: &str = "00000000402b5328";
const REDIRECT_URI: &str = "https://login.live.com/oauth20_desktop.srf";
const SCOPE: &str = "service::user.auth.xboxlive.com::MBI_SSL";
const AUTH_USER_AGENT: &str = "MaterialLauncher/1.3.0";

static ACTIVE_CANCEL_TOKEN: OnceLock<Mutex<Option<Arc<AtomicBool>>>> = OnceLock::new();

fn cancel_token_slot() -> &'static Mutex<Option<Arc<AtomicBool>>> {
    ACTIVE_CANCEL_TOKEN.get_or_init(|| Mutex::new(None))
}

pub fn cancel_microsoft_login() {
    if let Ok(guard) = cancel_token_slot().lock() {
        if let Some(ref flag) = *guard {
            flag.store(true, Ordering::SeqCst);
        }
    }
}

fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(AUTH_USER_AGENT)
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

fn format_xbox_error(step: &str, status: Option<u16>, data: Option<&Value>, fallback: &str) -> String {
    if let Some(d) = data {
        if let Some(xerr) = d.get("XErr").and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))) {
            match xerr {
                2148916233 => return "Для этой учётной записи Microsoft ещё не создан профиль Xbox Live. Войдите на xbox.com и создайте тег игрока.".to_string(),
                2148916235 => return "Служба Xbox Live недоступна в вашей стране или регионе.".to_string(),
                2148916236 | 2148916237 => return "Требуется подтверждение возраста совершеннолетнего (для Южной Кореи).".to_string(),
                2148916238 => return "Это детская учётная запись. Родитель должен добавить её в семейную группу Microsoft и разрешить доступ.".to_string(),
                _ => {}
            }
        }
        let err_code = d.get("error").and_then(|v| v.as_str()).unwrap_or("");
        let err_desc = d.get("error_description")
            .or_else(|| d.get("errorMessage"))
            .and_then(|v| v.as_str())
            .unwrap_or(fallback);
        if err_code == "invalid_grant" || err_desc.to_lowercase().contains("code has expired") {
            return format!("[{}] Код авторизации Microsoft истёк или уже использован. Попробуйте войти заново.", step);
        }
        if let Some(st) = status {
            if st >= 500 {
                return format!("[{}] Сервер авторизации Microsoft/Minecraft временно вернул ошибку {}. Попробуйте ещё раз через минуту.", step, st);
            }
        }
        return format!("[{}] {}", step, err_desc);
    }
    if let Some(st) = status {
        if st >= 500 {
            return format!("[{}] Сервер авторизации Microsoft/Minecraft временно вернул ошибку {}. Попробуйте ещё раз через минуту.", step, st);
        }
    }
    format!("[{}] {}", step, fallback)
}

async fn authenticate_xbox_to_minecraft(ms_access_token: &str) -> Result<String, String> {
    let client = http_client();
    let rps_with_prefix = if ms_access_token.starts_with("d=") {
        ms_access_token.to_string()
    } else {
        format!("d={}", ms_access_token)
    };
    let rps_raw = ms_access_token.strip_prefix("d=").unwrap_or(ms_access_token).to_string();

    // 1. Xbox Live Authenticate
    let mut xbl_data: Option<Value> = None;
    let mut last_err = String::new();
    for rps in [rps_with_prefix, rps_raw] {
        let resp = client
            .post("https://user.auth.xboxlive.com/user/authenticate")
            .header("Accept", "application/json")
            .json(&json!({
                "Properties": {
                    "AuthMethod": "RPS",
                    "SiteName": "user.auth.xboxlive.com",
                    "RpsTicket": rps
                },
                "RelyingParty": "http://auth.xboxlive.com",
                "TokenType": "JWT"
            }))
            .send()
            .await;
        match resp {
            Ok(r) => {
                let st = r.status().as_u16();
                let val: Value = r.json().await.unwrap_or(Value::Null);
                if st >= 200 && st < 300 {
                    xbl_data = Some(val);
                    break;
                } else {
                    last_err = format_xbox_error("Xbox Live", Some(st), Some(&val), "Xbox Live auth failed");
                }
            }
            Err(e) => {
                last_err = format_xbox_error("Xbox Live", None, None, &e.to_string());
            }
        }
    }
    let xbl = xbl_data.ok_or(last_err)?;
    let xbl_token = xbl.get("Token").and_then(|v| v.as_str()).ok_or("Xbox Live не вернул токен")?;
    let user_hash = xbl
        .pointer("/DisplayClaims/xui/0/uhs")
        .and_then(|v| v.as_str())
        .ok_or("Xbox Live не вернул UHS")?;

    // 2. XSTS Authenticate
    let xsts_resp = client
        .post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .header("Accept", "application/json")
        .json(&json!({
            "Properties": {
                "SandboxId": "RETAIL",
                "UserTokens": [xbl_token]
            },
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType": "JWT"
        }))
        .send()
        .await
        .map_err(|e| format_xbox_error("XSTS", None, None, &e.to_string()))?;

    let xsts_st = xsts_resp.status().as_u16();
    let xsts_val: Value = xsts_resp.json().await.unwrap_or(Value::Null);
    if !(200..300).contains(&xsts_st) {
        return Err(format_xbox_error("XSTS", Some(xsts_st), Some(&xsts_val), "XSTS auth failed"));
    }
    let xsts_token = xsts_val.get("Token").and_then(|v| v.as_str()).ok_or("[XSTS] Missing Token")?;

    // 3. Minecraft Services Login
    let mc_resp = client
        .post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .header("Accept", "application/json")
        .json(&json!({
            "identityToken": format!("XBL3.0 x={};{}", user_hash, xsts_token)
        }))
        .send()
        .await
        .map_err(|e| format_xbox_error("Minecraft Login", None, None, &e.to_string()))?;

    let mc_st = mc_resp.status().as_u16();
    let mc_val: Value = mc_resp.json().await.unwrap_or(Value::Null);
    if !(200..300).contains(&mc_st) {
        return Err(format_xbox_error("Minecraft Login", Some(mc_st), Some(&mc_val), "Minecraft login failed"));
    }
    mc_val
        .get("access_token")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "[Minecraft Login] Missing access_token".to_string())
}

async fn fetch_minecraft_profile(mc_access_token: &str, ms_refresh_token: &str) -> Result<Value, String> {
    let client = http_client();

    let mut has_license = false;
    if let Ok(ent_resp) = client
        .get("https://api.minecraftservices.com/entitlements/mcstore")
        .bearer_auth(mc_access_token)
        .send()
        .await
    {
        if let Ok(ent_val) = ent_resp.json::<Value>().await {
            if let Some(items) = ent_val.get("items").and_then(|v| v.as_array()) {
                has_license = items.iter().any(|it| {
                    matches!(
                        it.get("name").and_then(|n| n.as_str()),
                        Some("product_minecraft") | Some("game_minecraft")
                    )
                });
            }
        }
    }

    let prof_resp = client
        .get("https://api.minecraftservices.com/minecraft/profile")
        .bearer_auth(mc_access_token)
        .send()
        .await
        .map_err(|e| format_xbox_error("Minecraft Profile", None, None, &e.to_string()))?;

    let st = prof_resp.status().as_u16();
    if st == 404 {
        return Err("На этой учётной записи Microsoft не найдена лицензия Minecraft Java Edition. Приобретите игру или создайте профиль на minecraft.net.".to_string());
    }
    let profile: Value = prof_resp.json().await.unwrap_or(Value::Null);
    if !(200..300).contains(&st) {
        return Err(format_xbox_error("Minecraft Profile", Some(st), Some(&profile), "Failed to fetch profile"));
    }

    let name = profile.get("name").and_then(|v| v.as_str()).unwrap_or("Player");
    let id = profile.get("id").and_then(|v| v.as_str()).unwrap_or("");
    let skin_url = profile
        .pointer("/skins/0/url")
        .and_then(|v| v.as_str())
        .map(|s| Value::String(s.to_string()))
        .unwrap_or(Value::Null);

    Ok(json!({
        "type": "mojang",
        "name": name,
        "uuid": id,
        "access_token": mc_access_token,
        "refresh_token": ms_refresh_token,
        "skinUrl": skin_url,
        "hasLicense": has_license,
        "authProvider": "Mojang / Microsoft"
    }))
}

async fn exchange_code_for_minecraft(code: &str) -> Result<Value, String> {
    let client = http_client();
    let resp = client
        .post("https://login.live.com/oauth20_token.srf")
        .form(&[
            ("client_id", CLIENT_ID),
            ("code", code),
            ("grant_type", "authorization_code"),
            ("redirect_uri", REDIRECT_URI),
        ])
        .send()
        .await
        .map_err(|e| format_xbox_error("Live Token", None, None, &e.to_string()))?;

    let st = resp.status().as_u16();
    let val: Value = resp.json().await.unwrap_or(Value::Null);
    if !(200..300).contains(&st) {
        return Err(format_xbox_error("Live Token", Some(st), Some(&val), "Failed to exchange code"));
    }

    let ms_access = val.get("access_token").and_then(|v| v.as_str()).ok_or("[Live Token] Missing access_token")?;
    let ms_refresh = val.get("refresh_token").and_then(|v| v.as_str()).unwrap_or("");
    let mc_access = authenticate_xbox_to_minecraft(ms_access).await?;
    fetch_minecraft_profile(&mc_access, ms_refresh).await
}

fn parse_query_str(s: &str, key: &str) -> Option<String> {
    for pair in s.split('&') {
        let mut parts = pair.splitn(2, '=');
        if let (Some(k), Some(v)) = (parts.next(), parts.next()) {
            if k == key {
                return urlencoding::decode(v).ok().map(|c| c.into_owned());
            }
        }
    }
    None
}

pub async fn login_with_microsoft(app: &AppHandle) -> Value {
    let auth_url = format!(
        "https://login.live.com/oauth20_authorize.srf?client_id={}&response_type=token&scope={}&redirect_uri={}&prompt=select_account",
        CLIENT_ID,
        urlencoding::encode(SCOPE),
        urlencoding::encode(REDIRECT_URI)
    );

    if let Some(existing) = app.get_webview_window("ms-auth") {
        let _ = existing.close();
    }

    let parsed_url: tauri::Url = match auth_url.parse() {
        Ok(u) => u,
        Err(e) => return json!({ "success": false, "error": e.to_string() }),
    };

    let (tx, rx) = oneshot::channel::<Result<(Option<String>, Option<String>), String>>();
    let tx_slot = Arc::new(Mutex::new(Some(tx)));
    let tx_nav = Arc::clone(&tx_slot);
    let tx_evt = Arc::clone(&tx_slot);

    let win_res = WebviewWindowBuilder::new(app, "ms-auth", WebviewUrl::External(parsed_url))
        .title("Войти через Microsoft / Mojang")
        .inner_size(520.0, 670.0)
        .resizable(true)
        .on_navigation(move |url| {
            let url_str = url.as_str();
            if url_str.starts_with(REDIRECT_URI) {
                let hash = url.fragment().unwrap_or("");
                let query = url.query().unwrap_or("");
                let access_token = parse_query_str(hash, "access_token")
                    .or_else(|| parse_query_str(query, "access_token"));
                let code = parse_query_str(query, "code");
                let err = parse_query_str(hash, "error_description")
                    .or_else(|| parse_query_str(hash, "error"))
                    .or_else(|| parse_query_str(query, "error_description"))
                    .or_else(|| parse_query_str(query, "error"));

                if access_token.is_some() || code.is_some() || err.is_some() {
                    if let Ok(mut guard) = tx_nav.lock() {
                        if let Some(sender) = guard.take() {
                            let res = if let Some(e) = err {
                                Err(e)
                            } else {
                                Ok((access_token, code))
                            };
                            let _ = sender.send(res);
                        }
                    }
                    return false;
                }
            }
            true
        })
        .build();

    let auth_win = match win_res {
        Ok(w) => w,
        Err(e) => return json!({ "success": false, "error": format!("Не удалось открыть окно входа: {}", e) }),
    };

    auth_win.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            if let Ok(mut guard) = tx_evt.lock() {
                if let Some(sender) = guard.take() {
                    let _ = sender.send(Err("Окно входа было закрыто".to_string()));
                }
            }
        }
    });

    let nav_result = rx.await;
    if let Some(w) = app.get_webview_window("ms-auth") {
        let _ = w.close();
    }

    match nav_result {
        Ok(Ok((Some(access_token), _))) => match authenticate_xbox_to_minecraft(&access_token).await {
            Ok(mc_tok) => match fetch_minecraft_profile(&mc_tok, "").await {
                Ok(acc) => json!({ "success": true, "account": acc }),
                Err(e) => json!({ "success": false, "error": e }),
            },
            Err(e) => json!({ "success": false, "error": e }),
        },
        Ok(Ok((_, Some(code)))) => match exchange_code_for_minecraft(&code).await {
            Ok(acc) => json!({ "success": true, "account": acc }),
            Err(e) => json!({ "success": false, "error": e }),
        },
        Ok(Ok((None, None))) => json!({ "success": false, "error": "Не получен токен авторизации" }),
        Ok(Err(e)) => json!({ "success": false, "error": e }),
        Err(_) => json!({ "success": false, "error": "Окно входа было закрыто" }),
    }
}

pub async fn login_with_microsoft_browser(app: &AppHandle) -> Value {
    cancel_microsoft_login();
    let cancel_flag = Arc::new(AtomicBool::new(false));
    if let Ok(mut guard) = cancel_token_slot().lock() {
        *guard = Some(Arc::clone(&cancel_flag));
    }

    let client = http_client();
    let dev_resp = match client
        .post("https://login.live.com/oauth20_connect.srf")
        .form(&[
            ("client_id", CLIENT_ID),
            ("scope", SCOPE),
            ("response_type", "device_code"),
        ])
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return json!({ "success": false, "error": format_xbox_error("Device Code", None, None, &e.to_string()) }),
    };

    let dev_st = dev_resp.status().as_u16();
    let dev_val: Value = dev_resp.json().await.unwrap_or(Value::Null);
    if !(200..300).contains(&dev_st) {
        return json!({ "success": false, "error": format_xbox_error("Device Code", Some(dev_st), Some(&dev_val), "Device code error") });
    }

    let user_code = dev_val.get("user_code").and_then(|v| v.as_str()).unwrap_or("");
    let device_code = dev_val.get("device_code").and_then(|v| v.as_str()).unwrap_or("");
    let verification_uri = dev_val.get("verification_uri").and_then(|v| v.as_str()).unwrap_or("");

    if user_code.is_empty() || device_code.is_empty() || verification_uri.is_empty() {
        return json!({ "success": false, "error": "Не удалось получить код авторизации Microsoft" });
    }

    let sep = if verification_uri.contains('?') { '&' } else { '?' };
    let browser_url = format!("{}{}otc={}", verification_uri, sep, urlencoding::encode(user_code));
    let _ = open::that(&browser_url);

    let _ = app.emit(
        "ms-login-code",
        json!({
            "userCode": user_code,
            "verificationUri": verification_uri,
            "browserUrl": browser_url
        }),
    );

    let mut poll_secs = dev_val.get("interval").and_then(|v| v.as_u64()).unwrap_or(5).max(3);
    let expires_in = dev_val.get("expires_in").and_then(|v| v.as_u64()).unwrap_or(900).max(60);
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(expires_in);

    while std::time::Instant::now() < deadline {
        if cancel_flag.load(Ordering::SeqCst) {
            return json!({ "success": false, "error": "Вход отменён пользователем" });
        }
        tokio::time::sleep(std::time::Duration::from_secs(poll_secs)).await;
        if cancel_flag.load(Ordering::SeqCst) {
            return json!({ "success": false, "error": "Вход отменён пользователем" });
        }

        let token_resp = match client
            .post("https://login.live.com/oauth20_token.srf")
            .form(&[
                ("client_id", CLIENT_ID),
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                ("device_code", device_code),
            ])
            .send()
            .await
        {
            Ok(r) => r,
            Err(_) => continue,
        };

        let st = token_resp.status().as_u16();
        let val: Value = token_resp.json().await.unwrap_or(Value::Null);
        if (200..300).contains(&st) {
            if let Some(ms_access) = val.get("access_token").and_then(|v| v.as_str()) {
                let ms_refresh = val.get("refresh_token").and_then(|v| v.as_str()).unwrap_or("");
                return match authenticate_xbox_to_minecraft(ms_access).await {
                    Ok(mc_tok) => match fetch_minecraft_profile(&mc_tok, ms_refresh).await {
                        Ok(acc) => json!({ "success": true, "account": acc }),
                        Err(e) => json!({ "success": false, "error": e }),
                    },
                    Err(e) => json!({ "success": false, "error": e }),
                };
            }
        } else {
            let err_code = val.get("error").and_then(|v| v.as_str()).unwrap_or("");
            match err_code {
                "authorization_pending" => continue,
                "slow_down" => {
                    poll_secs += 5;
                    continue;
                }
                "expired_token" => {
                    return json!({ "success": false, "error": "Время ожидания входа в браузере истекло. Попробуйте снова." });
                }
                "access_denied" => {
                    return json!({ "success": false, "error": "Доступ отклонён пользователем в браузере." });
                }
                _ if st >= 500 => continue,
                _ => return json!({ "success": false, "error": format_xbox_error("Device Token", Some(st), Some(&val), "Auth error") }),
            }
        }
    }

    json!({ "success": false, "error": "Время ожидания входа в браузере истекло. Попробуйте снова." })
}

pub async fn refresh_microsoft_token(account: &mut Value) -> Result<(), String> {
    let refresh_tok = account
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if refresh_tok.is_empty() {
        return Err("No refresh token available".to_string());
    }

    let client = http_client();
    let resp = client
        .post("https://login.live.com/oauth20_token.srf")
        .form(&[
            ("client_id", CLIENT_ID),
            ("grant_type", "refresh_token"),
            ("refresh_token", &refresh_tok),
            ("redirect_uri", REDIRECT_URI),
            ("scope", SCOPE),
        ])
        .send()
        .await
        .map_err(|e| format_xbox_error("Live Token Refresh", None, None, &e.to_string()))?;

    let st = resp.status().as_u16();
    let val: Value = resp.json().await.unwrap_or(Value::Null);
    if !(200..300).contains(&st) {
        return Err(format_xbox_error("Live Token Refresh", Some(st), Some(&val), "Refresh failed"));
    }

    let ms_access = val.get("access_token").and_then(|v| v.as_str()).ok_or("Missing access_token")?;
    let new_refresh = val.get("refresh_token").and_then(|v| v.as_str()).unwrap_or(&refresh_tok);
    let mc_access = authenticate_xbox_to_minecraft(ms_access).await?;

    account["access_token"] = Value::String(mc_access);
    account["refresh_token"] = Value::String(new_refresh.to_string());
    account["lastRefreshed"] = json!(crate::config::now_ms());
    Ok(())
}

pub async fn login_with_ely_by(username: &str, password: &str) -> Value {
    let user = username.trim();
    let pass = password.trim();
    if user.is_empty() || pass.is_empty() {
        return json!({ "success": false, "error": "Введите логин/email и пароль" });
    }

    let client = http_client();
    let resp = match client
        .post("https://authserver.ely.by/auth/authenticate")
        .header("Accept", "application/json")
        .json(&json!({
            "username": user,
            "password": pass,
            "requestUser": true
        }))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return json!({ "success": false, "error": e.to_string() }),
    };

    let st = resp.status().as_u16();
    let data: Value = resp.json().await.unwrap_or(Value::Null);
    if !(200..300).contains(&st) {
        let msg = data
            .get("errorMessage")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                if st == 403 {
                    "Неверный логин или пароль на Ely.by".to_string()
                } else {
                    "Ошибка входа через Ely.by".to_string()
                }
            });
        return json!({ "success": false, "error": msg });
    }

    let profile = data
        .get("selectedProfile")
        .or_else(|| data.pointer("/availableProfiles/0"));
    let name = profile
        .and_then(|p| p.get("name"))
        .and_then(|v| v.as_str())
        .or_else(|| data.pointer("/user/username").and_then(|v| v.as_str()))
        .unwrap_or(user);
    let id = profile
        .and_then(|p| p.get("id"))
        .and_then(|v| v.as_str())
        .or_else(|| data.pointer("/user/id").and_then(|v| v.as_str()))
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("ely_{}", crate::config::now_ms()));

    let access_token = data.get("accessToken").and_then(|v| v.as_str()).unwrap_or("");
    let client_token = data.get("clientToken").and_then(|v| v.as_str()).unwrap_or("");

    json!({
        "success": true,
        "account": {
            "type": "elyby",
            "name": name,
            "uuid": id,
            "access_token": access_token,
            "client_token": client_token,
            "skinUrl": format!("https://skinsystem.ely.by/skins/{}.png", urlencoding::encode(name)),
            "authProvider": "Ely.by"
        }
    })
}
