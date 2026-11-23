const { app, BrowserWindow, ipcMain, shell, dialog, nativeImage, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const launcherCore = require('./launcherCore');
const authManager = require('./authManager');

// DPAPI / Keychain Token Encryption Helpers (AppSec Audit Compliance)
function encryptToken(plainText) {
  if (!plainText || typeof plainText !== 'string') return plainText || '';
  if (plainText.startsWith('enc:')) return plainText;
  try {
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(plainText);
      return 'enc:' + encrypted.toString('base64');
    }
  } catch (e) {
    console.warn('safeStorage encryption failed:', e.message);
  }
  return plainText;
}

function decryptToken(encryptedText) {
  if (!encryptedText || typeof encryptedText !== 'string') return encryptedText || '';
  if (!encryptedText.startsWith('enc:')) return encryptedText;
  try {
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(encryptedText.slice(4), 'base64');
      return safeStorage.decryptString(buffer);
    }
  } catch (e) {
    // Corrupted ciphertext or session key changed: fail silently without spamming console
  }
  return '';
}

launcherCore.setCryptoHelpers({ encryptToken, decryptToken });
launcherCore.setShell(shell);

// Set application identity early for Windows taskbar and Alt+Tab
app.setName('Material Launcher');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.materiallauncher.app');
}

// Single instance lock to prevent cache collisions and socket errors
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

let mainWindow = null;

// Resolve application icon
const iconIcoPath = path.join(__dirname, 'src', 'assets', 'icon.ico');
const iconPngPath = path.join(__dirname, 'src', 'assets', 'icon.png');
const defaultIconPath = process.platform === 'win32' && fs.existsSync(iconIcoPath) ? iconIcoPath : iconPngPath;
let appNativeIcon = null;
try {
  if (fs.existsSync(defaultIconPath)) {
    appNativeIcon = nativeImage.createFromPath(defaultIconPath);
  }
} catch (e) {
  console.warn('Could not load native image icon:', e);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1060,
    height: 680,
    minWidth: 940,
    minHeight: 580,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    icon: (appNativeIcon && !appNativeIcon.isEmpty()) ? appNativeIcon : defaultIconPath
  });

  if (appNativeIcon && !appNativeIcon.isEmpty()) {
    win.setIcon(appNativeIcon);
  }

  mainWindow = win;
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  // AppSec: Prevent arbitrary window opening and external navigation
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const currentUrl = win.webContents.getURL();
    if (url !== currentUrl) {
      event.preventDefault();
      if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
        shell.openExternal(url);
      }
    }
  });

  // Window control IPC
  ipcMain.on('window-minimize', () => win.minimize());
  ipcMain.on('window-maximize', () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });
  ipcMain.on('window-close', () => win.close());

  // External link handler
  ipcMain.on('open-external', (event, url) => {
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url);
    }
  });

  // Minecraft Core IPC Handlers
  ipcMain.handle('mc-get-versions', async () => {
    return await launcherCore.getVersionManifest();
  });

  ipcMain.handle('mc-get-config', () => {
    return launcherCore.loadConfig();
  });

  ipcMain.handle('mc-save-config', (event, cfg) => {
    launcherCore.saveConfig(cfg);
    return true;
  });

  ipcMain.handle('get-locale-data', (event, code) => {
    try {
      const localePath = path.join(__dirname, 'src', 'locales', `${code}.json`);
      if (fs.existsSync(localePath)) {
        return JSON.parse(fs.readFileSync(localePath, 'utf8'));
      }
    } catch (e) {
      console.error('Failed to load locale:', e);
    }
    return null;
  });

  ipcMain.handle('mc-get-installed-javas', () => {
    return launcherCore.findInstalledJavas();
  });

  ipcMain.handle('mc-select-java-file', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: 'Выберите исполняемый файл Java (javaw.exe)',
      filters: [
        { name: 'Исполняемые файлы Java', extensions: ['exe'] },
        { name: 'Все файлы', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    if (!res.canceled && res.filePaths.length > 0) {
      return res.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('ms-login-start', async () => {
    return await authManager.loginWithMicrosoft(win);
  });

  ipcMain.handle('ely-login-start', async (event, creds) => {
    if (process.env.FLATPAK_ID) {
      return { success: false, error: 'Ely.by authentication is disabled in Flathub builds for compliance.' };
    }
    return await authManager.loginWithElyBy(creds?.username, creds?.password);
  });

  ipcMain.handle('mc-launch', async (event, launchOpts) => {
    try {
      if (launchOpts.hideLauncherOnLaunch) {
        win.hide();
      }

      return await launcherCore.launchMinecraft(launchOpts, {
        onProgress: (prog) => {
          if (!win.isDestroyed()) win.webContents.send('mc-launch-progress', prog);
        },
        onStatus: (stat) => {
          if (!win.isDestroyed()) win.webContents.send('mc-launch-status', stat);
        },
        onLog: (log) => {
          if (!win.isDestroyed()) win.webContents.send('mc-launch-log', log);
        },
        onClose: (code) => {
          if (launchOpts.closeLauncherOnExit) {
            app.quit();
          } else {
            if (!win.isDestroyed()) {
              win.show();
              win.webContents.send('mc-launch-close', code);
            }
          }
        }
      });
    } catch (err) {
      console.error('Launch failed:', err);
      if (launchOpts.hideLauncherOnLaunch && !win.isDestroyed()) {
        win.show();
      }
      return { success: false, error: err.message || 'Ошибка запуска' };
    }
  });

  ipcMain.handle('mc-open-folder', () => {
    shell.openPath(launcherCore.MINECRAFT_DIR);
    return true;
  });

  ipcMain.handle('mc-open-mods-folder', (event, instanceId) => {
    const cfg = launcherCore.loadConfig();
    const instId = instanceId || cfg.selectedInstanceId;
    let targetPath;
    if (instId) {
      targetPath = launcherCore.getInstanceModsDir(instId);
    } else {
      targetPath = path.join(launcherCore.MINECRAFT_DIR, 'mods');
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }
    }
    shell.openPath(targetPath);
    return true;
  });

  ipcMain.handle('mc-open-instance-folder', (event, instanceId) => {
    const cfg = launcherCore.loadConfig();
    const instId = instanceId || cfg.selectedInstanceId;
    let targetPath;
    if (instId) {
      targetPath = launcherCore.getInstanceDir(instId);
    } else {
      targetPath = launcherCore.MINECRAFT_DIR;
    }
    shell.openPath(targetPath);
    return true;
  });

  ipcMain.handle('mc-download-single-mod', async (event, data) => {
    try {
      const { instanceId, mod } = data || {};
      const res = await launcherCore.downloadModFile(instanceId, mod);
      return { success: true, ...res };
    } catch (e) {
      console.warn('Single mod download failed:', e.message);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('mc-download-instance-mods', async (event, instanceId) => {
    try {
      const res = await launcherCore.downloadAllInstanceMods(instanceId);
      return { success: true, ...res };
    } catch (e) {
      console.warn('Instance mods download failed:', e.message);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('mc-delete-mod-file', async (event, data) => {
    try {
      const { instanceId, modId, fileName } = data || {};
      const res = await launcherCore.deleteModFile(instanceId, modId, fileName);
      return { success: true, ...res };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('mc-delete-instance-folder', async (event, instanceId) => {
    try {
      const res = await launcherCore.deleteInstanceFolder(instanceId);
      return { success: true, ...res };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('mc-toggle-mod', async (event, data) => {
    try {
      const { instanceId, modId, enabled } = data || {};
      const res = await launcherCore.toggleModState(instanceId, modId, enabled);
      return { success: true, ...res };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('mc-upload-mclogs', async (event, logText) => {
    try {
      const res = await launcherCore.uploadToMclogs(logText);
      return { success: true, ...res };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('mc-analyze-crash', (event, logText) => {
    try {
      const res = launcherCore.analyzeCrashLog(logText);
      return { success: true, diagnosis: res };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('mc-select-mrpack-file', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: 'Выберите файл сборки Modrinth (*.mrpack)',
      filters: [
        { name: 'Modrinth Modpack (*.mrpack)', extensions: ['mrpack'] },
        { name: 'Все файлы', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    if (!res.canceled && res.filePaths.length > 0) {
      return res.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('mc-import-mrpack', async (event, mrpackPath) => {
    try {
      const res = await launcherCore.importModpackMrpack(mrpackPath, (status) => {
        if (!win.isDestroyed()) win.webContents.send('mc-launch-status', status);
      });
      return { success: true, ...res };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('mc-get-instance-jars', (event, instanceId) => {
    try {
      const jars = launcherCore.getInstanceJars(instanceId);
      return { success: true, jars };
    } catch (e) {
      return { success: false, jars: [] };
    }
  });

  ipcMain.handle('mc-search-mods', async (event, params = {}) => {
    try {
      const query = params.query || '';
      const loader = params.loader || '';
      const gameVersion = params.gameVersion || '';
      const limit = params.limit || 24;
      const facets = [];
      if (loader && loader !== 'all' && loader !== 'vanilla') {
        facets.push([`categories:${loader}`]);
      }
      if (gameVersion) {
        facets.push([`versions:${gameVersion}`]);
      }
      const facetsParam = facets.length > 0 ? `&facets=${encodeURIComponent(JSON.stringify(facets))}` : '';
      const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=${limit}${facetsParam}`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'MaterialLauncher/1.0.0 (admin@materiallauncher.app)' },
        timeout: 8000
      });
      return { success: true, hits: res.data?.hits || [] };
    } catch (e) {
      return { success: false, error: e.message, hits: [] };
    }
  });

  // Watch for src changes and reload automatically (development mode only)
  if (!app.isPackaged) {
    const srcDir = path.join(__dirname, 'src');
    if (fs.existsSync(srcDir)) {
      try {
        fs.watch(srcDir, { recursive: true }, (event, filename) => {
          if (filename) {
            setTimeout(() => {
              try {
                if (!win.isDestroyed()) {
                  win.webContents.reloadIgnoringCache();
                }
              } catch (e) {}
            }, 120);
          }
        });
      } catch (err) {
        console.warn('fs.watch not supported or failed:', err);
      }
    }
  }

  // Reload shortcuts (F5 and Ctrl+R)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      win.webContents.reloadIgnoringCache();
    }
  });

  win.on('maximize', () => win.webContents.send('window-state-changed', { isMaximized: true }));
  win.on('unmaximize', () => win.webContents.send('window-state-changed', { isMaximized: false }));
  win.on('restore', () => win.webContents.send('window-state-changed', { isMaximized: win.isMaximized() }));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
}
