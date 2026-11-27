// Tauri v2 bridge implementing window.electronAPI for Material Launcher frontend
(function () {
  if (window.electronAPI) return;
  const tauri = window.__TAURI__;
  if (!tauri || !tauri.core || !tauri.event) {
    console.warn('[TauriBridge] window.__TAURI__ is not available');
    return;
  }

  const invoke = tauri.core.invoke;
  const listen = tauri.event.listen;

  window.electronAPI = {
    minimize: () => invoke('window_minimize'),
    maximize: () => invoke('window_maximize'),
    close: () => invoke('window_close'),
    openExternal: (url) => invoke('open_external', { url }),
    onWindowStateChange: (cb) => listen('window-state-changed', (e) => cb(e.payload)),
    isFlatpak: false,

    getVersions: () => invoke('mc_get_versions'),
    getLoaderVersions: (loader, gameVersion) =>
      invoke('mc_get_loader_versions', { loader: loader || '', gameVersion: gameVersion || '' }),
    getConfig: () => invoke('mc_get_config'),
    saveConfig: (cfg) => invoke('mc_save_config', { cfg }),
    getLocale: async (code) => {
      const res = await invoke('get_locale_data', { code }).catch(() => null);
      if (res) return res;
      try {
        const r = await fetch(`./locales/${encodeURIComponent(code)}.json`);
        if (r.ok) return await r.json();
      } catch (e) {}
      return null;
    },
    getInstalledJavas: () => invoke('mc_get_installed_javas'),
    selectJavaDialog: () => invoke('mc_select_java_file'),
    loginMicrosoft: () => invoke('ms_login_start'),
    loginMicrosoftBrowser: () => invoke('ms_login_browser_start'),
    cancelMicrosoftLogin: () => invoke('ms_login_cancel'),
    onMsLoginCode: (cb) => listen('ms-login-code', (e) => cb(e.payload)),
    loginElyBy: (creds) =>
      invoke('ely_login_start', {
        username: creds?.username || '',
        password: creds?.password || ''
      }),
    launchMinecraft: (opts) => invoke('mc_launch', { opts: opts || {} }),
    openMinecraftFolder: () => invoke('mc_open_folder'),
    selectMinecraftFolderDialog: () => invoke('mc_select_minecraft_folder'),
    getDefaultMinecraftFolder: () => invoke('mc_get_default_folder'),
    inspectMinecraftFolder: (folderPath) => invoke('mc_inspect_folder', { folderPath: folderPath || '' }),
    migrateMinecraftFolder: (params) =>
      invoke('mc_migrate_folder', {
        oldPath: params?.oldPath || '',
        newPath: params?.newPath || '',
        action: params?.action || 'keep'
      }),
    openModsFolder: (instanceId) => invoke('mc_open_mods_folder', { instanceId: instanceId || null }),
    openInstanceFolder: (instanceId) => invoke('mc_open_instance_folder', { instanceId: instanceId || null }),
    downloadSingleMod: (instanceId, mod) =>
      invoke('mc_download_single_mod', { instanceId, modObj: mod }),
    downloadInstanceMods: (instanceId) => invoke('mc_download_instance_mods', { instanceId }),
    deleteModFile: (instanceId, modId, fileName) =>
      invoke('mc_delete_mod_file', { instanceId, modId, fileName: fileName || null }),
    toggleMod: (instanceId, modId, enabled) =>
      invoke('mc_toggle_mod', { instanceId, modId, enabled: !!enabled }),
    deleteInstanceFolder: (instanceId) => invoke('mc_delete_instance_folder', { instanceId }),
    getInstanceInstalledJarFiles: (instanceId) => invoke('mc_get_instance_jars', { instanceId }),
    getInstanceDiskMods: (instanceId) => invoke('mc_get_instance_disk_mods', { instanceId }),
    searchMods: (params) => invoke('mc_search_mods', { params: params || {} }),
    uploadMclogs: (logText) => invoke('mc_upload_mclogs', { logText: logText || '' }),
    analyzeCrash: (logText) => invoke('mc_analyze_crash', { logText: logText || '' }),
    selectMrpackDialog: () => invoke('mc_select_mrpack_file'),
    importMrpack: (mrpackPath) => invoke('mc_import_mrpack', { mrpackPath }),
    selectExportInstanceDialog: (defaultName) =>
      invoke('mc_select_export_instance_path', { defaultName: defaultName || 'instance' }),
    exportInstance: (instanceId, destPath) =>
      invoke('mc_export_instance', { instanceId, destPath }),
    selectImportInstanceDialog: () => invoke('mc_select_import_instance_file'),
    importInstance: (archivePath) => invoke('mc_import_instance', { archivePath }),

    onLaunchProgress: (cb) => listen('mc-launch-progress', (e) => cb(e.payload)),
    onLaunchStatus: (cb) => listen('mc-launch-status', (e) => cb(e.payload)),
    onLaunchLog: (cb) => listen('mc-launch-log', (e) => cb(e.payload)),
    onLaunchClose: (cb) => listen('mc-launch-close', (e) => cb(e.payload))
  };
})();
