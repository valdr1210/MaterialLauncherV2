use crate::config::prism_dir;
use regex::Regex;
use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(windows)]
fn silent_cmd(prog: &str) -> Command {
    use std::os::windows::process::CommandExt;
    let mut cmd = Command::new(prog);
    cmd.creation_flags(0x08000000);
    cmd
}

#[cfg(not(windows))]
fn silent_cmd(prog: &str) -> Command {
    Command::new(prog)
}

#[derive(Debug, Clone, Serialize)]
pub struct JavaInfo {
    pub version: String,
    pub major: u32,
    pub arch: String,
    pub path: String,
    pub name: String,
}

fn parse_major_from_output(output: &str) -> Option<(u32, String)> {
    let re = Regex::new(r#"version\s+"(\d+)(?:\.(\d+))?[^"]*""#).ok()?;
    let caps = re.captures(output)?;
    let num: u32 = caps.get(1)?.as_str().parse().ok()?;
    let major = if num == 1 {
        caps.get(2)
            .and_then(|m| m.as_str().parse::<u32>().ok())
            .unwrap_or(8)
    } else {
        num
    };
    let ver_str = caps
        .get(0)
        .map(|m| m.as_str().replace("version \"", "").replace('"', ""))
        .unwrap_or_else(|| major.to_string());
    Some((major, ver_str))
}

pub fn get_java_major_version(java_path: &str) -> u32 {
    let clean_path = java_path.trim().trim_matches('"');
    if clean_path.is_empty() {
        return 0;
    }

    #[cfg(windows)]
    let java_exe = if clean_path.to_lowercase().ends_with("javaw.exe") {
        format!("{}java.exe", &clean_path[..clean_path.len() - 9])
    } else {
        clean_path.to_string()
    };
    #[cfg(not(windows))]
    let java_exe = clean_path.to_string();

    if let Ok(out) = silent_cmd(&java_exe).arg("-version").output() {
        let combined = format!(
            "{}{}",
            String::from_utf8_lossy(&out.stdout),
            String::from_utf8_lossy(&out.stderr)
        );
        if let Some((major, _)) = parse_major_from_output(&combined) {
            return major;
        }
    }

    let lower = clean_path.to_lowercase();
    if lower.contains("25.") || lower.contains("jdk-25") || lower.contains("java-runtime-epsilon") {
        25
    } else if lower.contains("21.") || lower.contains("jdk-21") || lower.contains("java-runtime-delta") {
        21
    } else if lower.contains("17.") || lower.contains("jdk-17") || lower.contains("java-runtime-gamma") {
        17
    } else if lower.contains("1.8") || lower.contains("jre1.8") || lower.contains("jdk1.8") {
        8
    } else if lower.contains("jre7") || lower.contains("jdk1.7") || lower.contains("jre6") || lower.contains("jdk1.6") {
        7
    } else {
        0
    }
}

pub fn find_installed_javas() -> Vec<JavaInfo> {
    let mut list = Vec::new();
    let mut seen_paths = HashSet::new();

    let mut add_candidate = |javaw_path: &Path, source_name: &str, custom_ver: Option<&str>, custom_major: Option<u32>| {
        let clean = javaw_path.to_string_lossy().trim().trim_matches('"').to_string();
        if clean.is_empty() {
            return;
        }
        let lower = clean.to_lowercase();
        if seen_paths.contains(&lower) || !Path::new(&clean).exists() {
            return;
        }
        seen_paths.insert(lower.clone());

        let mut major = custom_major;
        let mut version_str = custom_ver.unwrap_or("Java").to_string();

        if major.is_none() {
            if lower.contains("25.") || lower.contains("jdk-25") || lower.contains("java-runtime-epsilon") {
                major = Some(25);
                version_str = "25.0.1".to_string();
            } else if lower.contains("21.") || lower.contains("jdk-21") || lower.contains("java-runtime-delta") {
                major = Some(21);
                version_str = "21.0.7".to_string();
            } else if lower.contains("17.") || lower.contains("jdk-17") || lower.contains("java-runtime-gamma") {
                major = Some(17);
                version_str = "17.0.15".to_string();
            } else if lower.contains("1.8") || lower.contains("jre1.8") || lower.contains("jdk1.8") {
                major = Some(8);
                version_str = "1.8.0".to_string();
            }
        }

        if major.is_none() {
            let detected = get_java_major_version(&clean);
            if detected > 0 {
                major = Some(detected);
                version_str = format!("{}", detected);
            }
        }

        let final_major = major.unwrap_or(17);
        list.push(JavaInfo {
            version: version_str,
            major: final_major,
            arch: "amd64".to_string(),
            path: clean,
            name: format!("{} {}", if source_name.is_empty() { "Java" } else { source_name }, final_major),
        });
    };

    #[cfg(windows)]
    let bin_name = "javaw.exe";
    #[cfg(not(windows))]
    let bin_name = "java";

    // 1. PrismLauncher Runtimes
    let prism_java = prism_dir().join("java");
    if prism_java.exists() {
        let runtimes = [
            ("java-runtime-epsilon", "25.0.1", 25, "Prism Microsoft JDK 25"),
            ("java-runtime-delta", "21.0.7", 21, "Prism Microsoft JDK 21"),
            ("java-runtime-gamma", "17.0.15", 17, "Prism Microsoft JDK 17"),
            ("java-runtime-alpha", "1.8.0", 8, "Prism Microsoft JDK 8"),
        ];
        for (id, ver, maj, desc) in runtimes {
            let p = prism_java.join(id).join("bin").join(bin_name);
            add_candidate(&p, desc, Some(ver), Some(maj));
        }
    }

    // 2. Windows Registry Deep Scan
    #[cfg(windows)]
    {
        let reg_keys = [
            r"HKLM\SOFTWARE\JavaSoft\Java Runtime Environment",
            r"HKLM\SOFTWARE\JavaSoft\Java Development Kit",
            r"HKLM\SOFTWARE\JavaSoft\JDK",
            r"HKLM\SOFTWARE\Eclipse Adoptium\JDK",
            r"HKLM\SOFTWARE\Eclipse Adoptium\JRE",
            r"HKLM\SOFTWARE\AdoptOpenJDK\JDK",
            r"HKLM\SOFTWARE\Zulu",
            r"HKLM\SOFTWARE\BellSoft\Liberica",
        ];
        let re = Regex::new(r"(?i)JavaHome\s+REG_SZ\s+(.+)").ok();
        for rk in reg_keys {
            if let Ok(out) = silent_cmd("reg").args(["query", rk, "/s", "/v", "JavaHome"]).output() {
                let text = String::from_utf8_lossy(&out.stdout);
                if let Some(ref rx) = re {
                    for caps in rx.captures_iter(&text) {
                        if let Some(m) = caps.get(1) {
                            let home = m.as_str().trim();
                            let jw = PathBuf::from(home).join("bin").join("javaw.exe");
                            add_candidate(&jw, "Windows Registry JDK", None, None);
                        }
                    }
                }
            }
        }
    }

    // 3. Standard directories
    let mut search_roots: Vec<PathBuf> = Vec::new();
    #[cfg(windows)]
    {
        search_roots.push(PathBuf::from(r"C:\Program Files\Java"));
        search_roots.push(PathBuf::from(r"C:\Program Files\Eclipse Adoptium"));
        search_roots.push(PathBuf::from(r"C:\Program Files\Zulu"));
        search_roots.push(PathBuf::from(r"C:\Program Files\BellSoft"));
        search_roots.push(PathBuf::from(r"C:\Program Files (x86)\Java"));
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            search_roots.push(PathBuf::from(local).join("Programs").join("Eclipse Adoptium"));
        }
    }
    #[cfg(target_os = "macos")]
    {
        search_roots.push(PathBuf::from("/Library/Java/JavaVirtualMachines"));
        if let Some(home) = dirs::home_dir() {
            search_roots.push(home.join("Library/Java/JavaVirtualMachines"));
        }
    }
    #[cfg(target_os = "linux")]
    {
        search_roots.push(PathBuf::from("/usr/lib/jvm"));
        search_roots.push(PathBuf::from("/usr/java"));
        search_roots.push(PathBuf::from("/opt/java"));
    }
    if let Some(home) = dirs::home_dir() {
        search_roots.push(home.join(".jdks"));
    }

    for root in search_roots {
        if let Ok(entries) = fs::read_dir(&root) {
            for entry in entries.flatten() {
                let sub_name = entry.file_name().to_string_lossy().to_string();
                #[cfg(target_os = "macos")]
                let jw = {
                    let default_p = entry.path().join("bin").join(bin_name);
                    if default_p.exists() {
                        default_p
                    } else {
                        entry.path().join("Contents/Home/bin").join(bin_name)
                    }
                };
                #[cfg(not(target_os = "macos"))]
                let jw = entry.path().join("bin").join(bin_name);

                add_candidate(&jw, &sub_name, None, None);
            }
        }
    }

    // 4. JAVA_HOME
    if let Ok(jh) = std::env::var("JAVA_HOME") {
        let jw = PathBuf::from(jh).join("bin").join(bin_name);
        add_candidate(&jw, "JAVA_HOME", None, None);
    }

    // 5. PATH
    #[cfg(windows)]
    {
        if let Ok(out) = silent_cmd("where.exe").arg("javaw.exe").output() {
            for line in String::from_utf8_lossy(&out.stdout).lines() {
                let l = line.trim();
                if l.ends_with(".exe") {
                    add_candidate(Path::new(l), "System Default", None, None);
                }
            }
        }
    }
    #[cfg(not(windows))]
    {
        if let Ok(out) = Command::new("which").arg("java").output() {
            let l = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !l.is_empty() {
                add_candidate(Path::new(&l), "System Default", None, None);
            }
        }
    }

    list
}

pub fn resolve_java_for_version(target_version: &str, is_auto: bool, manual_path: &str) -> String {
    let clean_manual = manual_path.trim().trim_matches('"');
    if !is_auto && !clean_manual.is_empty() && Path::new(clean_manual).exists() {
        return clean_manual.to_string();
    }

    let mut javas = find_installed_javas();
    if javas.is_empty() {
        #[cfg(windows)]
        return "javaw".to_string();
        #[cfg(not(windows))]
        return "java".to_string();
    }

    let ver = target_version.trim();
    let needed_major = if ver.starts_with("26.") || ver.starts_with("25.") {
        25
    } else if ver.starts_with("1.21") || ver == "1.20.5" || ver == "1.20.6" || ver.starts_with("24w") || ver.starts_with("25w") {
        21
    } else if ver.starts_with("1.17") || ver.starts_with("1.18") || ver.starts_with("1.19") || ver.starts_with("1.20") {
        17
    } else {
        8
    };

    if let Some(exact) = javas.iter().find(|j| j.major == needed_major) {
        return exact.path.clone();
    }

    if needed_major == 8 {
        javas.sort_by_key(|j| j.major);
        return javas[0].path.clone();
    }

    let mut higher: Vec<&JavaInfo> = javas.iter().filter(|j| j.major >= needed_major).collect();
    if !higher.is_empty() {
        higher.sort_by_key(|j| j.major);
        return higher[0].path.clone();
    }

    javas.sort_by(|a, b| b.major.cmp(&a.major));
    javas[0].path.clone()
}

pub fn apply_windows_gpu_preference(javaw_path: &str) {
    #[cfg(windows)]
    {
        if javaw_path.trim().is_empty() {
            return;
        }
        let clean = javaw_path.replace('/', "\\");
        let _ = silent_cmd("reg")
            .args([
                "add",
                r"HKCU\Software\Microsoft\DirectX\UserGpuPreferences",
                "/v",
                &clean,
                "/t",
                "REG_SZ",
                "/d",
                "GpuPreference=2;",
                "/f",
            ])
            .output();
    }
    #[cfg(not(windows))]
    {
        let _ = javaw_path;
    }
}
