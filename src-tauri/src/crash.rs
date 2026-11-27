use regex::Regex;
use serde_json::{json, Value};

pub fn analyze_crash_log(log_text: &str) -> Value {
    if Regex::new(r"(?i)OutOfMemoryError|java\.lang\.OutOfMemoryError")
        .map(|r| r.is_match(log_text))
        .unwrap_or(false)
    {
        return json!({
            "type": "OutOfMemory",
            "title": "Недостаточно оперативной памяти (OutOfMemoryError)",
            "description": "Игре не хватило выделенной памяти. Перейдите в Настройки -> Java и увеличьте максимальный объем RAM (например, до 6144 MB или 8192 MB).",
            "severity": "error"
        });
    }

    if Regex::new(r"(?i)UnsupportedClassVersionError|compiled by a more recent version of the Java")
        .map(|r| r.is_match(log_text))
        .unwrap_or(false)
    {
        return json!({
            "type": "JavaMismatch",
            "title": "Несовместимая версия Java (UnsupportedClassVersionError)",
            "description": "Версия Java не соответствует требованиям Minecraft или мода. Для 1.18+ требуется Java 17, для 1.20.5+ — Java 21, для 25w/26.x — Java 25. Включите автопереключение Java в Настройках.",
            "severity": "error"
        });
    }

    if Regex::new(r"(?i)DuplicateModsException|Found duplicate mods")
        .map(|r| r.is_match(log_text))
        .unwrap_or(false)
    {
        return json!({
            "type": "DuplicateMods",
            "title": "Обнаружены дубликаты модов (DuplicateModsException)",
            "description": "В папке mods находятся конфликтующие или дублирующиеся версии модов. Удалите старую версию мода в списке установленных.",
            "severity": "error"
        });
    }

    if let Ok(re) = Regex::new(r"(?i)MixinApplyError|Mixin apply failed|org\.spongepowered\.asm\.mixin|in config\s+\[|Mixin\s+\[") {
        if re.is_match(log_text) {
            let hint = Regex::new(r"(?i)in mixin (\S+)|failed to apply (\S+)|apply failed:?\s+(\S+)|Mixin\s+\[([^\]]+)\]|in config\s+\[([^\]]+)\]")
                .ok()
                .and_then(|rx| rx.captures(log_text))
                .and_then(|caps| (1..=5).find_map(|i| caps.get(i).map(|m| format!(" ({})", m.as_str()))))
                .unwrap_or_default();
            return json!({
                "type": "MixinError",
                "title": "Ошибка инициализации модов (Mixin Error)",
                "description": format!("Один из установленных модов{} несовместим с текущей версией игры или конфликтует с другим модом. Попробуйте временно отключить его тумблером в списке модов.", hint),
                "severity": "error"
            });
        }
    }

    if Regex::new(r"(?i)Exit code: 1|Process crashed with exit code 1")
        .map(|r| r.is_match(log_text))
        .unwrap_or(false)
    {
        return json!({
            "type": "GenericCrash",
            "title": "Сбой инициализации клиента (Exit Code 1)",
            "description": "Minecraft завершился с ошибкой. Часто это происходит из-за отсутствия обязательной зависимости (например, Fabric API) или несовместимого мода.",
            "severity": "warning"
        });
    }

    json!({
        "type": "Unknown",
        "title": "Игра аварийно закрылась",
        "description": "Minecraft завершил работу с ненулевым кодом выхода. Ознакомьтесь с подробным логом или загрузите его на mclo.gs.",
        "severity": "info"
    })
}

pub fn sanitize_log(text: &str) -> String {
    let mut sanitized = text.to_string();
    if let Ok(re) = Regex::new(r#"(?i)(access_token|refresh_token|Token|Bearer|client_token)["':\s]+[a-zA-Z0-9_\-\.]{20,}"#) {
        sanitized = re.replace_all(&sanitized, "$1: [REDACTED_TOKEN]").to_string();
    }
    if let Ok(re) = Regex::new(r"(?i)([a-zA-Z]:[\\/]Users[\\/])[^\\/]+") {
        sanitized = re.replace_all(&sanitized, "${1}<User>").to_string();
    }
    if let Ok(re) = Regex::new(r"(/(?:home|Users)/)[^/]+") {
        sanitized = re.replace_all(&sanitized, "${1}<User>").to_string();
    }
    if let Ok(re) = Regex::new(r"\b(?:\d{1,3}\.){3}\d{1,3}\b") {
        sanitized = re.replace_all(&sanitized, "[IP_REDACTED]").to_string();
    }
    sanitized
}

pub async fn upload_to_mclogs(raw_log_text: &str) -> Result<Value, String> {
    let mut sanitized = sanitize_log(raw_log_text);
    let lines: Vec<&str> = sanitized.lines().collect();
    if lines.len() > 20000 {
        let head = lines[..1000].join("\n");
        let tail = lines[lines.len() - 15000..].join("\n");
        let skipped = lines.len() - 16000;
        sanitized = format!(
            "{}\n\n... [{} строк пропущено для предотвращения лимита mclo.gs] ...\n\n{}",
            head, skipped, tail
        );
    }

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.mclo.gs/1/log")
        .form(&[("content", sanitized)])
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data: Value = resp.json().await.map_err(|e| e.to_string())?;
    if data.get("success").and_then(|v| v.as_bool()) == Some(true) {
        if let Some(url) = data.get("url").and_then(|v| v.as_str()) {
            return Ok(json!({
                "success": true,
                "url": url,
                "raw": data.get("raw")
            }));
        }
    }
    let err = data
        .get("error")
        .and_then(|v| v.as_str())
        .unwrap_or("Не удалось отправить лог на mclo.gs");
    Err(err.to_string())
}
