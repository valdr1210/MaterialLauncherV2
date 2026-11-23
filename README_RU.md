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
    <img src="https://img.shields.io/badge/Node.js-v20+-68a063?style=flat-square&logo=node.js&logoColor=white" alt="Node.js">
    <img src="https://img.shields.io/badge/Electron-40+-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron">
    <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-blue?style=flat-square" alt="Platform">
    <img src="https://img.shields.io/badge/License-MIT-orange?style=flat-square" alt="License">
  </p>

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
| **Windows** | `Portable .exe` | Запустил и играешь, не оставляет мусора в системе |
| | `Setup .exe` | Стандартный установщик с ярлыками и мастером |
| | `.msi` | Пакет Windows Installer |
| | `.zip` | Портативный архив с распакованной программой |
| **Linux** | `.AppImage` | Универсальный бинарник для любого дистрибутива |
| | `.deb` | Пакет для Ubuntu, Debian, Linux Mint, Pop!_OS |
| | `.rpm` | Пакет для Fedora, openSUSE, RHEL |
| | `.flatpak` | Песочница с изоляцией прав и рантаймом Flathub |
| | `.tar.gz` / `.zip` | Архивы с готовым бинарником |

---

## 🛠 Запуск и разработка

Если хотите собрать лаунчер самостоятельно:

```bash
# Клонируем проект
git clone https://github.com/valdr1210/MaterialLauncherV2.git
cd MaterialLauncherV2

# Ставим зависимости
npm install

# Запуск в режиме разработки
npm start
```

### Команды сборки:

```bash
# Сборка под Windows (Portable EXE, Setup EXE, MSI, ZIP)
npm run build:win

# Сборка под Linux (AppImage, DEB, RPM, Flatpak, TAR.GZ, ZIP)
npm run build:linux
```

---

<div align="center">
  <a href="https://imgur.com/a/mnwiRM5">
    <img src="https://i.imgur.com/mbWxY5a.png" width="44" height="44" alt="ML Icon">
  </a><br>
  <sub>Material Launcher • Распространяется под лицензией MIT</sub>
</div>
