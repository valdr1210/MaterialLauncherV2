<div align="center">

  <p>
    <a href="README.md">🇷🇺 Русский</a> &nbsp;|&nbsp; 
    <a href="README_EN.md"><strong>🇬🇧 English</strong></a>
  </p>

  <a href="https://imgur.com/a/hpicWJo">
    <img src="https://i.imgur.com/CGpougK.png" alt="Material Launcher" width="620">
  </a>

  <p><strong>A clean, fast, and modern Minecraft launcher built on Material Design 3 (Material You).</strong></p>

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

## 🎨 Why another launcher?

Most existing Minecraft launchers are either stuck in 2014, cluttered with ads, or look like Windows XP utilities.

**Material Launcher** is built for people who appreciate clean design:
- **No visual clutter** — interface following **Google Material Design 3** guidelines: soft accent colors, rounded corners, an adaptive dark theme, and fluid animations.
- **Everything within reach** — single-click launch, easy instance management, and direct mod installs without getting lost in nested menus.

---

## ✨ Features

- 🎮 **Any version & loader**: Pure Vanilla, Fabric, Forge, NeoForge, and Quilt ready to install on the fly.
- 🔑 **Flexible authentication**:
  - Official **Microsoft** accounts
  - **Ely.by** (with skins & capes support)
  - **Offline mode** (for LAN play or playing without internet)
- 🧩 **Built-in mod browser**: Search and install mods directly from **Modrinth** and **CurseForge** without leaving the app.
- 📦 **Cross-platform packaging**:
  - **Windows**: Portable `.exe` (zero-install), Setup `.exe`, `.msi`, and `.zip`.
  - **Linux**: `.AppImage`, `.deb`, `.rpm`, `.flatpak`, `.tar.gz`, and `.zip`.
- 📰 **News feed**: Latest news, snapshot announcements, and game updates straight on your home screen.

---

## 📦 Downloads

All builds are compiled natively through CI/CD:

| Platform | Formats | Details |
| :--- | :--- | :--- |
| **Windows** | `Portable .exe` | Standalone executable, leaves no junk behind |
| | `Setup .exe` | Traditional NSIS installer with shortcuts |
| | `.msi` | Windows Installer package |
| | `.zip` | Portable archive |
| **Linux** | `.AppImage` | Universal bundle for any distro |
| | `.deb` | Ubuntu, Debian, Linux Mint, Pop!_OS |
| | `.rpm` | Fedora, openSUSE, RHEL |
| | `.flatpak` | Sandboxed Flathub package |
| | `.tar.gz` / `.zip` | Generic portable archives |

---

## 🛠 Building & Running from Source

If you want to tweak the code or build it yourself:

```bash
# Clone the repository
git clone https://github.com/valdr1210/MaterialLauncherV2.git
cd MaterialLauncherV2

# Install dependencies
npm install

# Start in development mode
npm start
```

### Build Commands:

```bash
# Build for Windows (Portable EXE, Setup EXE, MSI, ZIP)
npm run build:win

# Build for Linux (AppImage, DEB, RPM, Flatpak, TAR.GZ, ZIP)
npm run build:linux
```

---

<div align="center">
  <a href="https://imgur.com/a/mnwiRM5">
    <img src="https://i.imgur.com/mbWxY5a.png" width="44" height="44" alt="ML Icon">
  </a><br>
  <sub>Material Launcher • Released under the MIT License</sub>
</div>
