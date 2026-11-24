const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  onWindowStateChange: (callback) => ipcRenderer.on('window-state-changed', (event, state) => callback(state)),
  isFlatpak: !!process.env.FLATPAK_ID,

  // Minecraft Launcher Core APIs
  getVersions: () => ipcRenderer.invoke('mc-get-versions'),
  getConfig: () => ipcRenderer.invoke('mc-get-config'),
  saveConfig: (cfg) => ipcRenderer.invoke('mc-save-config', cfg),
  getLocale: (code) => ipcRenderer.invoke('get-locale-data', code),
  getInstalledJavas: () => ipcRenderer.invoke('mc-get-installed-javas'),
  selectJavaDialog: () => ipcRenderer.invoke('mc-select-java-file'),
  loginMicrosoft: () => ipcRenderer.invoke('ms-login-start'),
  loginElyBy: (creds) => ipcRenderer.invoke('ely-login-start', creds),
  launchMinecraft: (opts) => ipcRenderer.invoke('mc-launch', opts),
  openMinecraftFolder: () => ipcRenderer.invoke('mc-open-folder'),
  selectMinecraftFolderDialog: () => ipcRenderer.invoke('mc-select-minecraft-folder'),
  getDefaultMinecraftFolder: () => ipcRenderer.invoke('mc-get-default-folder'),
  openModsFolder: (instanceId) => ipcRenderer.invoke('mc-open-mods-folder', instanceId),
  openInstanceFolder: (instanceId) => ipcRenderer.invoke('mc-open-instance-folder', instanceId),
  downloadSingleMod: (instanceId, mod) => ipcRenderer.invoke('mc-download-single-mod', { instanceId, mod }),
  downloadInstanceMods: (instanceId) => ipcRenderer.invoke('mc-download-instance-mods', instanceId),
  deleteModFile: (instanceId, modId, fileName) => ipcRenderer.invoke('mc-delete-mod-file', { instanceId, modId, fileName }),
  toggleMod: (instanceId, modId, enabled) => ipcRenderer.invoke('mc-toggle-mod', { instanceId, modId, enabled }),
  deleteInstanceFolder: (instanceId) => ipcRenderer.invoke('mc-delete-instance-folder', instanceId),
  getInstanceInstalledJarFiles: (instanceId) => ipcRenderer.invoke('mc-get-instance-jars', instanceId),
  searchMods: (params) => ipcRenderer.invoke('mc-search-mods', params),
  uploadMclogs: (logText) => ipcRenderer.invoke('mc-upload-mclogs', logText),
  analyzeCrash: (logText) => ipcRenderer.invoke('mc-analyze-crash', logText),
  selectMrpackDialog: () => ipcRenderer.invoke('mc-select-mrpack-file'),
  importMrpack: (mrpackPath) => ipcRenderer.invoke('mc-import-mrpack', mrpackPath),

  // Event Listeners
  onLaunchProgress: (callback) => ipcRenderer.on('mc-launch-progress', (event, data) => callback(data)),
  onLaunchStatus: (callback) => ipcRenderer.on('mc-launch-status', (event, data) => callback(data)),
  onLaunchLog: (callback) => ipcRenderer.on('mc-launch-log', (event, data) => callback(data)),
  onLaunchClose: (callback) => ipcRenderer.on('mc-launch-close', (event, code) => callback(code))
});
