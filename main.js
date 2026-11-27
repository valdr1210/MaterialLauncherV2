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
      if (typeof code !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(code)) {
        return null;
      }
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

  ipcMain.handle('ms-login-browser-start', async () => {
    return await authManager.loginWithMicrosoftBrowser({
      onCode: (data) => {
        if (!win.isDestroyed()) win.webContents.send('ms-login-code', data);
      }
    });
  });

  ipcMain.handle('ms-login-cancel', () => {
    authManager.cancelMicrosoftLogin();
    return { success: true };
  });

  ipcMain.handle('ely-login-start', async (event, creds) => {
    if (process.env.FLATPAK_ID) {
      return { success: false, error: 'Ely.by authentication is disabled in Flathub builds for compliance.' };
    }
    return await authManager.loginWithElyBy(creds?.username, creds?.password);
  });

  ipcMain.handle('mc-launch', async (event, launchOpts) => {
    const opts = launchOpts || {};
    try {
      if (opts.hideLauncherOnLaunch) {
        win.hide();
      }

      return await launcherCore.launchMinecraft(opts, {
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
          if (opts.closeLauncherOnExit) {
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
      if (opts.hideLauncherOnLaunch && !win.isDestroyed()) {
        win.show();
      }
      return { success: false, error: err.message || 'Ошибка запуска' };
    }
  });

  ipcMain.handle('mc-open-folder', () => {
    shell.openPath(launcherCore.getMinecraftDir());
    return true;
  });

  ipcMain.handle('mc-select-minecraft-folder', async () => {
    const currentPath = launcherCore.getMinecraftDir();
    const res = await dialog.showOpenDialog(win, {
      title: 'Выберите папку для данных Minecraft',
      defaultPath: currentPath,
      properties: ['openDirectory', 'createDirectory']
    });
    if (!res.canceled && res.filePaths.length > 0) {
      return res.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('mc-get-default-folder', () => {
    return launcherCore.getDefaultMinecraftDir();
  });

  ipcMain.handle('mc-inspect-folder', (event, folderPath) => {
    return launcherCore.inspectMinecraftDir(folderPath);
  });

  ipcMain.handle('mc-migrate-folder', async (event, { oldPath, newPath, action } = {}) => {
    try {
      return await launcherCore.migrateMinecraftDir(oldPath, newPath, action);
    } catch (e) {
      return { success: false, error: e.message || 'Ошибка миграции папки' };
    }
  });

  ipcMain.handle('mc-get-loader-versions', async (event, { loader, gameVersion } = {}) => {
    return await launcherCore.getLoaderVersions(loader, gameVersion);
  });

  ipcMain.handle('mc-open-mods-folder', async (event, instanceId) => {
    try {
      const cfg = launcherCore.loadConfig();
      const instId = instanceId || cfg.selectedInstanceId;
      let targetPath;
      if (instId) {
        targetPath = launcherCore.getInstanceModsDir(instId);
      } else {
        targetPath = path.join(launcherCore.getMinecraftDir(), 'mods');
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(targetPath, { recursive: true });
        }
      }
      const err = await shell.openPath(targetPath);
      if (err) return { success: false, error: err };
      return true;
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('mc-open-instance-folder', async (event, instanceId) => {
    try {
      const cfg = launcherCore.loadConfig();
      const instId = instanceId || cfg.selectedInstanceId;
      let targetPath;
      if (instId) {
        targetPath = launcherCore.getInstanceDir(instId);
      } else {
        targetPath = launcherCore.getMinecraftDir();
      }
      const err = await shell.openPath(targetPath);
      if (err) return { success: false, error: err };
      return true;
    } catch (e) {
      return { success: false, error: e.message };
    }
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
      const res = await launcherCore.downloadAllInstanceMods(instanceId, (stat) => {
        if (!win.isDestroyed()) win.webContents.send('mc-launch-status', stat);
      });
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

  ipcMain.handle('mc-select-export-instance-path', async (event, defaultName) => {
    const safeName = String(defaultName || 'instance').replace(/[<>:"/\\|?*]+/g, '_').trim() || 'instance';
    const res = await dialog.showSaveDialog(win, {
      title: 'Экспортировать сборку',
      defaultPath: `${safeName}.zip`,
      filters: [
        { name: 'Архив сборки (*.zip)', extensions: ['zip'] },
        { name: 'Material Launcher Pack (*.mlpack)', extensions: ['mlpack'] }
      ]
    });
    if (!res.canceled && res.filePath) {
      return res.filePath;
    }
    return null;
  });

  ipcMain.handle('mc-export-instance', async (event, { instanceId, destPath } = {}) => {
    try {
      const res = await launcherCore.exportInstance(instanceId, destPath, (status) => {
        if (!win.isDestroyed()) win.webContents.send('mc-launch-status', status);
      });
      return { success: true, ...res };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('mc-select-import-instance-file', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: 'Выберите архив сборки (*.zip, *.mlpack)',
      filters: [
        { name: 'Архив сборки (*.zip, *.mlpack)', extensions: ['zip', 'mlpack'] },
        { name: 'Все файлы', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    if (!res.canceled && res.filePaths.length > 0) {
      return res.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('mc-import-instance', async (event, archivePath) => {
    try {
      const res = await launcherCore.importInstance(archivePath, (status) => {
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
      return { success: false, error: e.message, jars: [] };
    }
  });

  ipcMain.handle('mc-get-instance-disk-mods', async (event, instanceId) => {
    try {
      const mods = await launcherCore.getInstanceDiskMods(instanceId);
      return { success: true, mods };
    } catch (e) {
      return { success: false, error: e.message, mods: [] };
    }
  });

  ipcMain.handle('mc-search-mods', async (event, params = {}) => {
    try {
      const query = params.query || '';
      const loader = params.loader || '';
      const gameVersion = params.gameVersion || '';
      const category = params.category || '';
      const limit = Math.min(Number(params.limit) || 40, 100);
      const offset = Math.max(Number(params.offset) || 0, 0);
      const facets = [['project_type:mod']];
      if (loader && loader !== 'all' && loader !== 'vanilla') {
        facets.push([`categories:${loader}`]);
      }
      if (category && category !== 'all') {
        facets.push([`categories:${category}`]);
      }
      if (gameVersion) {
        facets.push([`versions:${gameVersion}`]);
      }
      const facetsParam = facets.length > 0 ? `&facets=${encodeURIComponent(JSON.stringify(facets))}` : '';
      const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}${facetsParam}`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'MaterialLauncher/1.3.0 (admin@materiallauncher.app)' },
        timeout: 8000
      });
      return {
        success: true,
        hits: res.data?.hits || [],
        total_hits: res.data?.total_hits || 0,
        offset
      };
    } catch (e) {
      return { success: false, error: e.message, hits: [], total_hits: 0, offset: 0 };
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
