<div align="center">

  <p>
    <a href="README.md">🇬🇧 English</a> &nbsp;|&nbsp; 
    <a href="README_RU.md"><strong>🇷🇺 Русский</strong></a>
  </p>

  <a href="https://imgur.com/a/hpicWJo">
    <img src="https://i.imgur.com/CGpougK.png" alt="Material Launcher" width="620">
  </a>

  <p><strong>Быстрый, чистый и приятный Minecraft лаунчер на Material Design 3 (Material You).</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Rust-2021-DE5833?style=flat-square&logo=rust&logoColor=white" alt="Rust">
    <img src="https://img.shields.io/badge/Tauri-v2-24C8DB?style=flat-square&logo=tauri&logoColor=white" alt="Tauri v2">
    <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-blue?style=flat-square" alt="Platform">
    <img src="https://img.shields.io/badge/License-MIT-orange?style=flat-square" alt="License">
  </p>

</div>

<br>

<div align="center">
  <img src="assets/rust_migration_banner_ru.png" alt="Material Launcher — Теперь на Rust" width="85%">
</div>

<br>

<div align="center">
  <a href="https://imgur.com/a/lW37YVm">
    <img src="https://i.imgur.com/gNiSOCZ.png" alt="Material Launcher Demo" width="85%">
  </a>
</div>

---

## 🎨 Зачем ещё один лаунчер?

Большинство существующих лаунчеров застряли где-то в 2014 году: либо перегружены баннерами и лишними кнопками, либо выглядят как софт времён Windows XP. 

**Material Launcher** сделан с упором на визуальный комфорт и простоту:
- **Ничего лишнего** — интерфейс по гайдлайнам **Google Material Design 3**: мягкие акцентные цвета, приятные скругления, адаптивная тёмная тема и плавная реакция на любые действия.
- **Всё под рукой** — запуск в один клик, удобный список сборок и быстрый доступ к модам без блуждания по бесконечным меню.

---

## ✨ Фичи

- 🎮 **Любые версии и загрузчики**: чистая ванилла, Fabric, Forge, NeoForge, Quilt. Ставятся и настраиваются на лету.
- 🔑 **Гибкая авторизация**:
  - Официальный **Microsoft** (OAuth 2.0)
  - **Ely.by** (с поддержкой скинов и плащей)
  - **Офлайн-режим** (для игры по локальной сети или без интернета)
- 🧩 **Браузер модов внутри лаунчера**: ищите и ставьте моды прямо с **Modrinth** и **CurseForge** — браузер открывать не придётся.
- 📦 **Пакеты под любую систему**:
  - **Windows**: портативный `.exe` (без установки), инсталлятор `.exe`, `.msi` и `.zip`.
  - **Linux**: `.AppImage`, `.deb`, `.rpm`, `.flatpak`, `.tar.gz` и `.zip`.
- 📰 **Лента новостей**: свежие статьи, обновления и анонсы снэпшотов прямо на главном экране.

---

## 📦 Форматы загрузки

Все сборки генерируются автоматически через CI/CD:

| Платформа | Доступные форматы | Описание |
| :--- | :--- | :--- |
| **Windows** | `Setup .exe` | Стандартный NSIS-установщик с ярлыками (~5.5 МБ) |
| | `Portable .exe` | Запустил и играешь, не оставляет мусора в системе (~18.7 МБ) |
| | `.msi` | Пакет Windows Installer (~7.9 МБ) |
| **Linux** | `.AppImage` | Универсальный бинарник для любого дистрибутива |
| | `.deb` | Пакет для Ubuntu, Debian, Linux Mint, Pop!_OS (~8.1 МБ) |
| | `.rpm` | Пакет для Fedora, openSUSE, RHEL (~8.1 МБ) |
| | `.tar.gz` | Архив с готовым бинарником (~7.9 МБ) |

---

## 🛠 Запуск и разработка

Требуется **Rust** (stable) и **Tauri CLI v2** (`cargo install tauri-cli --version "^2"`):

```bash
# Клонируем проект
git clone https://github.com/valdr1210/MaterialLauncherV2.git
cd MaterialLauncherV2

# Запуск в режиме разработки
cargo tauri dev
```

### Команды сборки:

```bash
# Сборка под Windows (Setup EXE, MSI, Portable EXE)
cargo tauri build --bundles nsis,msi

# Сборка под Linux (AppImage, DEB, RPM)
cargo tauri build --bundles deb,rpm,appimage
```

---

<div align="center">
  <a href="https://imgur.com/a/mnwiRM5">
    <img src="https://i.imgur.com/mbWxY5a.png" width="44" height="44" alt="ML Icon">
  </a><br>
  <sub>Material Launcher • Распространяется под лицензией MIT</sub>
</div>
