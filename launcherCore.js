const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const axios = require('axios');
const { execSync } = require('child_process');
const AdmZip = require('adm-zip');
const { Client, Authenticator } = require('minecraft-launcher-core');

function getDefaultDataDir() {
  if (process.platform === 'win32') {
    return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  } else if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support');
  } else {
    return process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  }
}

function getDefaultMinecraftDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), '.minecraft');
  } else if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'minecraft');
  } else {
    return path.join(os.homedir(), '.minecraft');
  }
}

const APPDATA_DIR = getDefaultDataDir();
const LAUNCHER_DATA_DIR = path.join(APPDATA_DIR, '.materiallauncher');
const DEFAULT_MINECRAFT_DIR = getDefaultMinecraftDir();
const PRISM_DIR = process.platform === 'darwin'
  ? path.join(os.homedir(), 'Library', 'Application Support', 'PrismLauncher')
  : (process.platform === 'linux' ? path.join(os.homedir(), '.local', 'share', 'PrismLauncher') : path.join(APPDATA_DIR, 'PrismLauncher'));
const PRISM_ACCOUNTS_FILE = path.join(PRISM_DIR, 'accounts.json');
const PRISM_ASSETS_DIR = path.join(PRISM_DIR, 'assets');
const CONFIG_FILE = path.join(LAUNCHER_DATA_DIR, 'config.json');
const MANIFEST_CACHE = path.join(LAUNCHER_DATA_DIR, 'version_manifest_v2.json');

function getMinecraftDir(cfg) {
  let target = '';
  if (cfg && typeof cfg.minecraftPath === 'string' && cfg.minecraftPath.trim()) {
    target = cfg.minecraftPath.trim();
  } else {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        if (raw && typeof raw.minecraftPath === 'string' && raw.minecraftPath.trim()) {
          target = raw.minecraftPath.trim();
        }
      }
    } catch (e) {}
  }
  const resolved = target ? path.resolve(target) : DEFAULT_MINECRAFT_DIR;
  try {
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
  } catch (e) {}
  return resolved;
}

// Ensure directories exist
if (!fs.existsSync(LAUNCHER_DATA_DIR)) {
  fs.mkdirSync(LAUNCHER_DATA_DIR, { recursive: true });
}
try {
  const currentMcDir = getMinecraftDir();
  if (!fs.existsSync(currentMcDir)) {
    fs.mkdirSync(currentMcDir, { recursive: true });
  }
} catch (e) {}

// Token encryption & Shell bridges
let cryptoHelpers = {
  encryptToken: (t) => t,
  decryptToken: (t) => t
};

function setCryptoHelpers(helpers) {
  if (helpers) {
    cryptoHelpers = { ...cryptoHelpers, ...helpers };
  }
}

let shellModule = null;
function setShell(sh) {
  shellModule = sh;
}

// Java Discovery (Deep Registry & Multi-Path Scanning)
function findInstalledJavas() {
  const list = [];
  const seenPaths = new Set();

  function addJavaCandidate(javawPath, sourceName, customVer = null, customMajor = null) {
    if (!javawPath) return;
    const cleanPath = String(javawPath).trim().replace(/^"|"$/g, '');
    const lower = cleanPath.toLowerCase();
    if (seenPaths.has(lower)) return;
    if (!fs.existsSync(cleanPath)) return;

    seenPaths.add(lower);

    let major = customMajor;
    let versionStr = customVer || 'Java';

    if (!major) {
      if (lower.includes('25.') || lower.includes('jdk-25') || lower.includes('java-runtime-epsilon')) {
        major = 25; versionStr = '25.0.1';
      } else if (lower.includes('21.') || lower.includes('jdk-21') || lower.includes('java-runtime-delta')) {
        major = 21; versionStr = '21.0.7';
      } else if (lower.includes('17.') || lower.includes('jdk-17') || lower.includes('java-runtime-gamma')) {
        major = 17; versionStr = '17.0.15';
      } else if (lower.includes('1.8') || lower.includes('jre1.8') || lower.includes('jdk1.8')) {
        major = 8; versionStr = '1.8.0';
      }
    }

    if (!major) {
      try {
        const javaExe = process.platform === 'win32' ? cleanPath.replace(/javaw\.exe$/i, 'java.exe') : cleanPath;
        const verOutput = execSync(`"${javaExe}" -version 2>&1`, { encoding: 'utf8', timeout: 3000 });
        const m = verOutput.match(/version\s+"(\d+)(?:\.(\d+))?/i);
        if (m) {
          const num = parseInt(m[1], 10);
          major = (num === 1 && m[2]) ? parseInt(m[2], 10) : num;
          versionStr = m[0].replace('version "', '').replace('"', '');
        }
      } catch (e) {}
    }

    if (!major) major = 17;

    list.push({
      version: versionStr,
      major: major,
      arch: 'amd64',
      path: cleanPath,
      name: `${sourceName || 'Java'} ${major}`
    });
  }

  // 1. PrismLauncher Runtimes
  const prismJava = path.join(PRISM_DIR, 'java');
  if (fs.existsSync(prismJava)) {
    const runtimes = [
      { id: 'java-runtime-epsilon', ver: '25.0.1', major: 25, desc: 'Prism Microsoft JDK 25' },
      { id: 'java-runtime-delta', ver: '21.0.7', major: 21, desc: 'Prism Microsoft JDK 21' },
      { id: 'java-runtime-gamma', ver: '17.0.15', major: 17, desc: 'Prism Microsoft JDK 17' },
      { id: 'java-runtime-alpha', ver: '1.8.0', major: 8, desc: 'Prism Microsoft JDK 8' }
    ];
    for (const rt of runtimes) {
      const binName = process.platform === 'win32' ? 'javaw.exe' : 'java';
      const p = path.join(prismJava, rt.id, 'bin', binName);
      addJavaCandidate(p, rt.desc, rt.ver, rt.major);
    }
  }

  // 2. Windows Registry Deep Scan
  if (process.platform === 'win32') {
    const regKeys = [
      'HKLM\\SOFTWARE\\JavaSoft\\Java Runtime Environment',
      'HKLM\\SOFTWARE\\JavaSoft\\Java Development Kit',
      'HKLM\\SOFTWARE\\JavaSoft\\JDK',
      'HKLM\\SOFTWARE\\Eclipse Adoptium\\JDK',
      'HKLM\\SOFTWARE\\Eclipse Adoptium\\JRE',
      'HKLM\\SOFTWARE\\AdoptOpenJDK\\JDK',
      'HKLM\\SOFTWARE\\Zulu',
      'HKLM\\SOFTWARE\\BellSoft\\Liberica'
    ];
    for (const rk of regKeys) {
      try {
        const out = execSync(`reg query "${rk}" /s /v JavaHome 2>nul`, { encoding: 'utf8', timeout: 3000 });
        const matches = out.match(/JavaHome\s+REG_SZ\s+(.+)/gi);
        if (matches) {
          for (const m of matches) {
            const home = m.replace(/JavaHome\s+REG_SZ\s+/i, '').trim();
            const jw = path.join(home, 'bin', 'javaw.exe');
            addJavaCandidate(jw, 'Windows Registry JDK');
          }
        }
      } catch (e) {}
    }
  }

  // 3. Standard Program Files & System Directories
  const searchRoots = [
    'C:\\Program Files\\Java',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Zulu',
    'C:\\Program Files\\BellSoft',
    'C:\\Program Files (x86)\\Java',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Eclipse Adoptium'),
    path.join(os.homedir(), '.jdks')
  ];

  if (process.platform === 'darwin') {
    searchRoots.push('/Library/Java/JavaVirtualMachines');
    searchRoots.push(path.join(os.homedir(), 'Library', 'Java', 'JavaVirtualMachines'));
  } else if (process.platform === 'linux') {
    searchRoots.push('/usr/lib/jvm');
    searchRoots.push('/usr/java');
    searchRoots.push('/opt/java');
  }

  const binName = process.platform === 'win32' ? 'javaw.exe' : 'java';
  for (const root of searchRoots) {
    if (fs.existsSync(root)) {
      try {
        const subdirs = fs.readdirSync(root);
        for (const sub of subdirs) {
          let jw = path.join(root, sub, 'bin', binName);
          if (!fs.existsSync(jw) && process.platform === 'darwin') {
            jw = path.join(root, sub, 'Contents', 'Home', 'bin', binName);
          }
          addJavaCandidate(jw, sub);
        }
      } catch (e) {}
    }
  }

  // 4. JAVA_HOME Environment Variable
  if (process.env.JAVA_HOME) {
    const jw = path.join(process.env.JAVA_HOME, 'bin', binName);
    addJavaCandidate(jw, 'JAVA_HOME');
  }

  // 5. System PATH lookup
  try {
    if (process.platform === 'win32') {
      const whereOutput = execSync('where.exe javaw.exe 2>nul || where.exe java.exe 2>nul', { encoding: 'utf8' }).trim();
      for (const line of whereOutput.split(/\r?\n/)) {
        if (line && line.endsWith('.exe')) {
          addJavaCandidate(line, 'System Default');
        }
      }
    } else {
      const whichOutput = execSync('which java 2>/dev/null', { encoding: 'utf8' }).trim();
      if (whichOutput) {
        addJavaCandidate(whichOutput, 'System Default');
      }
    }
  } catch (e) {}

  return list;
}

// Smart Java Resolver depending on target Minecraft version and loader
function resolveJavaForVersion(targetVersion, isAuto = true, manualPath = '', loaderType = 'vanilla') {
  if (!isAuto && manualPath && fs.existsSync(manualPath)) {
    return manualPath;
  }

  const javas = findInstalledJavas();
  if (javas.length === 0) return process.platform === 'win32' ? 'javaw' : 'java';

  const ver = String(targetVersion || '').trim();
  const loader = String(loaderType || '').toLowerCase();
  let neededMajor = 17;

  if (ver.startsWith('26.') || ver.startsWith('25.')) {
    neededMajor = 25;
  } else if (ver.startsWith('1.21') || ver === '1.20.5' || ver === '1.20.6') {
    neededMajor = 21;
  } else if (ver.startsWith('1.17') || ver.startsWith('1.18') || ver.startsWith('1.19') || ver.startsWith('1.20')) {
    neededMajor = 17;
  } else {
    // For 1.16.5 and older: Forge (1.7.10, 1.12.2, up to 1.16.5) strictly requires Java 8.
    // Modern Java (17+) crashes Forge with classloader / reflection errors.
    neededMajor = 8;
  }

  // 1. Try exact major match
  const exact = javas.find(j => j.major === neededMajor);
  if (exact) return exact.path;

  // 2. If neededMajor is 8 and exact 8 is not found:
  // For legacy versions, lowest available Java is always safer than Java 21/25
  if (neededMajor === 8) {
    const lowest = [...javas].sort((a, b) => a.major - b.major);
    return lowest[0].path;
  }

  // 3. Try closest compatible major (>= neededMajor)
  const higher = javas.filter(j => j.major >= neededMajor).sort((a, b) => a.major - b.major);
  if (higher.length > 0) return higher[0].path;

  // 4. Fallback to highest available
  javas.sort((a, b) => b.major - a.major);
  return javas[0].path;
}

// Helper to ensure authlib-injector is present for Ely.by accounts
async function ensureAuthlibInjector() {
  const targetPath = path.join(getMinecraftDir(), 'authlib-injector.jar');
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 10000) {
    return targetPath;
  }
  try {
    const url = 'https://authlib-injector.yushi.moe/artifact/56/authlib-injector-1.2.8.jar';
    const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 25000 });
    fs.writeFileSync(targetPath, Buffer.from(resp.data));
    return targetPath;
  } catch (e) {
    console.warn('Failed to download authlib-injector:', e.message);
    return null;
  }
}

// Config manager
function loadConfig() {
  let cfg = null;
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      // Decrypt any encrypted tokens in memory
      if (Array.isArray(cfg?.accounts)) {
        for (const acc of cfg.accounts) {
          if (acc.access_token && acc.access_token.startsWith('enc:')) {
            const dec = cryptoHelpers.decryptToken(acc.access_token);
            acc.access_token = dec || (acc.type === 'offline' ? 'offline-token' : '');
          }
          if (acc.refresh_token && acc.refresh_token.startsWith('enc:')) {
            const dec = cryptoHelpers.decryptToken(acc.refresh_token);
            acc.refresh_token = dec || '';
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to read config, attempting backup restore:', e);
    const bakFile = `${CONFIG_FILE}.bak`;
    if (fs.existsSync(bakFile)) {
      try {
        cfg = JSON.parse(fs.readFileSync(bakFile, 'utf8'));
      } catch (bakErr) {}
    }
  }

  if (!cfg) {
    cfg = {
      accounts: [
        {
          type: 'offline',
          name: 'Player',
          uuid: 'offline_Player',
          active: true
        }
      ],
      selectedVersion: '26.1.2',
      selectedVersionType: 'release',
      // Game Window Settings (Screenshot 1)
      fullscreen: false,
      windowWidth: 854,
      windowHeight: 480,
      hideLauncherOnLaunch: false,
      closeLauncherOnExit: false,
      // Console Settings (Screenshot 1)
      showConsoleOnLaunch: false,
      showConsoleOnError: true,
      autoCloseConsole: false,
      // Java Settings (Screenshot 2 & 3)
      autoJavaSwitch: true,
      manualJavaPath: '',
      skipJavaCheck: false,
      minRam: 512,
      maxRam: 4096,
      permGen: 128,
      jvmArgs: '',
      theme: 'dark',
      accentColor: 'lavender',
      customAccentHex: '#EADDFF'
    };
  }

  // Auto-import accounts from PrismLauncher if not already imported
  try {
    if (fs.existsSync(PRISM_ACCOUNTS_FILE)) {
      const prismData = JSON.parse(fs.readFileSync(PRISM_ACCOUNTS_FILE, 'utf8'));
      if (Array.isArray(prismData.accounts)) {
        for (const pAcc of prismData.accounts) {
          const name = pAcc.profile?.name;
          const isMs = pAcc.type === 'MSA' || pAcc.type === 'Microsoft' || pAcc.msa;
          if (name && !cfg.accounts.some(a => a.name.toLowerCase() === name.toLowerCase())) {
            cfg.accounts.push({
              type: isMs ? 'mojang' : 'offline',
              name: name,
              uuid: pAcc.profile?.id || 'offline_' + name,
              access_token: pAcc.ygg?.token || pAcc.msa?.token || '',
              skinUrl: pAcc.profile?.skin?.url || '',
              active: pAcc.active || false
            });
          }
        }
      }
    }
  } catch (e) {
    console.warn('Could not read PrismLauncher accounts:', e.message);
  }

  // Ensure at least one account is active
  if (cfg.accounts && cfg.accounts.length > 0 && !cfg.accounts.some(a => a.active)) {
    cfg.accounts[0].active = true;
  }

  // Ensure instances list is initialized
  if (!Array.isArray(cfg.instances) || cfg.instances.length === 0) {
    cfg.instances = [
      {
        id: 'inst-fabric-1-21-1',
        name: 'Fabric 1.21.1',
        gameVersion: '1.21.1',
        loader: 'fabric',
        loaderVersion: 'latest',
        modProvider: 'modrinth',
        icon: 'fabric',
        created: Date.now(),
        mods: []
      }
    ];
  }
  if (cfg.selectedInstanceId === undefined) {
    cfg.selectedInstanceId = cfg.instances[0]?.id || null;
  }
  if (!cfg.accentColor) {
    cfg.accentColor = 'lavender';
  }
  if (!cfg.theme) {
    cfg.theme = 'dark';
  }

  // Persist if not exists
  if (!fs.existsSync(CONFIG_FILE)) {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
    } catch (e) {}
  }

  return cfg;
}

function saveConfig(cfg) {
  try {
    const clone = JSON.parse(JSON.stringify(cfg));
    if (Array.isArray(clone?.accounts)) {
      for (const acc of clone.accounts) {
        if (acc.access_token) {
          acc.access_token = cryptoHelpers.encryptToken(acc.access_token);
        }
        if (acc.refresh_token) {
          acc.refresh_token = cryptoHelpers.encryptToken(acc.refresh_token);
        }
      }
    }
    const jsonStr = JSON.stringify(clone, null, 2);
    const tmpFile = `${CONFIG_FILE}.tmp.${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    fs.writeFileSync(tmpFile, jsonStr, 'utf8');
    if (fs.existsSync(CONFIG_FILE)) {
      try { fs.copyFileSync(CONFIG_FILE, `${CONFIG_FILE}.bak`); } catch (err) {}
    }
    fs.renameSync(tmpFile, CONFIG_FILE);
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

// Version manifest fetcher
async function getVersionManifest(forceRefresh = false) {
  try {
    if (!forceRefresh && fs.existsSync(MANIFEST_CACHE)) {
      const stats = fs.statSync(MANIFEST_CACHE);
      if (Date.now() - stats.mtimeMs < 30 * 60 * 1000) {
        return JSON.parse(fs.readFileSync(MANIFEST_CACHE, 'utf8'));
      }
    }

    const response = await axios.get('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', {
      timeout: 12000
    });
    if (response.data && response.data.versions) {
      fs.writeFileSync(MANIFEST_CACHE, JSON.stringify(response.data), 'utf8');
      return response.data;
    }
  } catch (e) {
    console.warn('Network error fetching manifest, falling back to cache:', e.message);
    if (fs.existsSync(MANIFEST_CACHE)) {
      return JSON.parse(fs.readFileSync(MANIFEST_CACHE, 'utf8'));
    }
  }

  return {
    latest: { release: '26.1.2', snapshot: '25w03a' },
    versions: [
      { id: '26.1.2', type: 'release', releaseTime: '2024-12-10' },
      { id: '1.21.4', type: 'release', releaseTime: '2024-12-03' },
      { id: '1.21.3', type: 'release', releaseTime: '2024-10-23' },
      { id: '1.20.4', type: 'release', releaseTime: '2023-12-07' },
      { id: '1.16.5', type: 'release', releaseTime: '2021-01-15' }
    ]
  };
}

// Instance management and directories
function validateInstanceId(instanceId) {
  if (!instanceId || typeof instanceId !== 'string') {
    throw new Error('Некорректный идентификатор сборки');
  }
  const clean = path.basename(instanceId).trim();
  if (!clean || clean === '.' || clean === '..' || clean !== instanceId) {
    throw new Error('Недопустимый идентификатор сборки (содержит недопустимые символы или путь)');
  }
  return clean;
}

function getInstanceDir(instanceId) {
  const cleanId = validateInstanceId(instanceId);
  const instancesRoot = path.resolve(getMinecraftDir(), 'instances');
  const dir = path.resolve(instancesRoot, cleanId);
  if (!dir.startsWith(instancesRoot + path.sep)) {
    throw new Error('Обнаружена попытка Path Traversal в пути инстанса');
  }
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getInstanceModsDir(instanceId) {
  const dir = path.join(getInstanceDir(instanceId), 'mods');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Find download URL and filename from Modrinth for a mod
async function resolveModrinthVersion(projectId, gameVersion, loader) {
  const cleanLoader = (loader || 'fabric').toLowerCase();
  const cleanGv = gameVersion || '1.20.1';

  // 1. Try exact loader + gameVersion
  try {
    const vUrl = `https://api.modrinth.com/v2/project/${encodeURIComponent(projectId)}/version?loaders=${encodeURIComponent(JSON.stringify([cleanLoader]))}&game_versions=${encodeURIComponent(JSON.stringify([cleanGv]))}`;
    const res = await axios.get(vUrl, {
      headers: { 'User-Agent': 'MaterialLauncher/1.0.0 (admin@materiallauncher.app)' },
      timeout: 10000
    });
    if (Array.isArray(res.data) && res.data.length > 0) {
      return res.data[0];
    }
  } catch (e) {}

  // 2. Try with loader only, match major gameVersion (e.g. 1.20)
  try {
    const vUrl = `https://api.modrinth.com/v2/project/${encodeURIComponent(projectId)}/version?loaders=${encodeURIComponent(JSON.stringify([cleanLoader]))}`;
    const res = await axios.get(vUrl, {
      headers: { 'User-Agent': 'MaterialLauncher/1.0.0 (admin@materiallauncher.app)' },
      timeout: 10000
    });
    if (Array.isArray(res.data) && res.data.length > 0) {
      const major = cleanGv.split('.').slice(0, 2).join('.');
      const match = res.data.find(v => v.game_versions?.some(gv => gv.startsWith(major)));
      return match || res.data[0];
    }
  } catch (e) {}

  // 3. Fallback: all versions of project
  try {
    const vUrl = `https://api.modrinth.com/v2/project/${encodeURIComponent(projectId)}/version`;
    const res = await axios.get(vUrl, {
      headers: { 'User-Agent': 'MaterialLauncher/1.0.0 (admin@materiallauncher.app)' },
      timeout: 10000
    });
    if (Array.isArray(res.data) && res.data.length > 0) {
      const match = res.data.find(v => v.loaders?.includes(cleanLoader));
      return match || res.data[0];
    }
  } catch (e) {}

  return null;
}

function updateModInConfig(instanceId, modId, fields) {
  const cfg = loadConfig();
  const inst = (cfg.instances || []).find(i => i.id === instanceId);
  if (inst && Array.isArray(inst.mods)) {
    const m = inst.mods.find(x => x.id === modId || x.slug === modId);
    if (m) {
      Object.assign(m, fields);
      saveConfig(cfg);
    }
  }
}

// Streaming download with .tmp and atomic rename + optional SHA-1 validation
async function streamDownloadToFile(url, destPath, expectedSha1 = null) {
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const tmpPath = `${destPath}.tmp.${Date.now()}_${randomSuffix}`;
  const writer = fs.createWriteStream(tmpPath);

  const response = await axios.get(url, {
    responseType: 'stream',
    headers: { 'User-Agent': 'MaterialLauncher/1.0.0 (admin@materiallauncher.app)' },
    timeout: 60000
  });

  const hash = expectedSha1 ? crypto.createHash('sha1') : null;

  await new Promise((resolve, reject) => {
    let error = null;
    response.data.on('data', chunk => {
      if (hash) hash.update(chunk);
    });
    response.data.on('error', err => {
      error = err;
      writer.destroy();
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) {}
      reject(err);
    });
    response.data.pipe(writer);
    writer.on('error', err => {
      error = err;
      writer.close();
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) {}
      reject(err);
    });
    writer.on('close', () => {
      if (!error) resolve();
    });
  });

  const stats = fs.statSync(tmpPath);
  if (stats.size === 0) {
    try { fs.unlinkSync(tmpPath); } catch (e) {}
    throw new Error('Файл загрузился пустым (0 байт)');
  }

  if (expectedSha1 && hash) {
    const actualSha1 = hash.digest('hex');
    if (actualSha1.toLowerCase() !== expectedSha1.toLowerCase()) {
      try { fs.unlinkSync(tmpPath); } catch (e) {}
      throw new Error(`Ошибка контрольной суммы SHA-1 для ${path.basename(destPath)}`);
    }
  }

  if (fs.existsSync(destPath)) {
    try { fs.unlinkSync(destPath); } catch (e) {}
  }
  fs.renameSync(tmpPath, destPath);
  return stats.size;
}

// Download a single mod into instance mods folder with streaming and dependency auto-resolution
async function downloadModFile(instanceId, modObj, targetGameVersion, targetLoader) {
  const modsDir = getInstanceModsDir(instanceId);
  const cfg = loadConfig();
  const inst = (cfg.instances || []).find(i => i.id === instanceId);
  const gv = targetGameVersion || inst?.gameVersion || '1.20.1';
  const loader = targetLoader || inst?.loader || 'fabric';

  // Check if we already have the jar file on disk
  if (modObj.fileName) {
    const existingPath = path.join(modsDir, modObj.fileName);
    if (fs.existsSync(existingPath) && fs.statSync(existingPath).size > 0) {
      return { success: true, fileName: modObj.fileName, fileSize: fs.statSync(existingPath).size, cached: true };
    }
  }

  // Resolve version from Modrinth
  const projectId = modObj.slug || modObj.id;
  const versionData = await resolveModrinthVersion(projectId, gv, loader);
  if (!versionData || !Array.isArray(versionData.files) || versionData.files.length === 0) {
    throw new Error(`Не удалось найти файл для мода "${modObj.title || projectId}" (${loader} ${gv})`);
  }

  const fileInfo = versionData.files.find(f => f.primary) || versionData.files[0];
  const destPath = path.join(modsDir, fileInfo.filename);

  // If file already exists with same size, return cached
  if (fs.existsSync(destPath) && fs.statSync(destPath).size === fileInfo.size) {
    updateModInConfig(instanceId, modObj.id, { fileName: fileInfo.filename, fileSize: fileInfo.size, fileUrl: fileInfo.url });
    return { success: true, fileName: fileInfo.filename, fileSize: fileInfo.size, cached: true };
  }

  // Stream download into .tmp and atomically rename
  const downloadedSize = await streamDownloadToFile(fileInfo.url, destPath, fileInfo.hashes?.sha1);

  // Update mod record in instance config
  updateModInConfig(instanceId, modObj.id, {
    fileName: fileInfo.filename,
    fileSize: fileInfo.size || downloadedSize,
    fileUrl: fileInfo.url,
    downloadedAt: Date.now()
  });

  // Auto-resolve required dependencies (e.g. Fabric API, Sodium, etc.)
  if (Array.isArray(versionData.dependencies) && versionData.dependencies.length > 0) {
    try {
      await resolveModDependencies(instanceId, versionData.dependencies, gv, loader);
    } catch (depErr) {
      console.warn(`Failed to auto-resolve dependencies for ${projectId}:`, depErr.message);
    }
  }

  return {
    success: true,
    fileName: fileInfo.filename,
    fileSize: fileInfo.size || downloadedSize
  };
}

// Auto-resolve and download required mod dependencies recursively
async function resolveModDependencies(instanceId, dependencies, gameVersion, loader, visited = new Set(), onStatus) {
  const cfg = loadConfig();
  const inst = (cfg.instances || []).find(i => i.id === instanceId);
  if (!inst) return;

  const requiredDeps = (dependencies || []).filter(d => d.dependency_type === 'required' && d.project_id);

  for (const dep of requiredDeps) {
    const projId = dep.project_id;
    if (visited.has(projId)) continue;
    visited.add(projId);

    // Check if already in instance mods
    const alreadyInstalled = (inst.mods || []).some(m => m.id === projId || m.slug === projId);
    if (alreadyInstalled) continue;

    try {
      if (onStatus) onStatus(`Разрешение зависимости: ${projId}...`);
      const pRes = await axios.get(`https://api.modrinth.com/v2/project/${encodeURIComponent(projId)}`, {
        headers: { 'User-Agent': 'MaterialLauncher/1.0.0 (admin@materiallauncher.app)' },
        timeout: 8000
      });
      const pData = pRes.data;
      if (!pData) continue;

      const depModObj = {
        id: pData.id,
        slug: pData.slug,
        title: pData.title,
        description: pData.description || 'Обязательная зависимость',
        author: pData.author || '',
        icon_url: pData.icon_url || '',
        isDependency: true
      };

      inst.mods.push(depModObj);
      saveConfig(cfg);

      const vData = await resolveModrinthVersion(projId, gameVersion, loader);
      if (vData && Array.isArray(vData.files) && vData.files.length > 0) {
        const fInfo = vData.files.find(f => f.primary) || vData.files[0];
        const destPath = path.join(getInstanceModsDir(instanceId), fInfo.filename);
        await streamDownloadToFile(fInfo.url, destPath, fInfo.hashes?.sha1);
        depModObj.fileName = fInfo.filename;
        depModObj.fileSize = fInfo.size;
        depModObj.fileUrl = fInfo.url;
        saveConfig(cfg);

        if (Array.isArray(vData.dependencies) && vData.dependencies.length > 0) {
          await resolveModDependencies(instanceId, vData.dependencies, gameVersion, loader, visited, onStatus);
        }
      }
    } catch (e) {
      console.warn(`Failed to auto-resolve dependency ${projId}:`, e.message);
    }
  }
}

// Download all mods for an instance
async function downloadAllInstanceMods(instanceId, onStatus) {
  const cfg = loadConfig();
  const inst = (cfg.instances || []).find(i => i.id === instanceId);
  if (!inst || !Array.isArray(inst.mods) || inst.mods.length === 0) {
    return { success: true, count: 0 };
  }

  let count = 0;
  // Snapshot array to prevent re-entrant mutation loops when resolveModDependencies adds items
  const initialMods = [...inst.mods];
  for (const mod of initialMods) {
    if (mod.disabled) continue;
    if (onStatus) onStatus(`Скачивание мода: ${mod.title || mod.id}...`);
    try {
      await downloadModFile(instanceId, mod, inst.gameVersion, inst.loader);
      count++;
    } catch (e) {
      console.warn(`Failed to download mod ${mod.id}:`, e.message);
      if (onStatus) onStatus(`Ошибка скачивания ${mod.title || mod.id}: ${e.message}`);
    }
  }

  return { success: true, count };
}

// Toggle mod enable/disable via .jar <-> .jar.disabled (Soft-disable, non-blocking async)
async function toggleModState(instanceId, modId, enabled) {
  const modsDir = getInstanceModsDir(instanceId);
  const cfg = loadConfig();
  const inst = (cfg.instances || []).find(i => i.id === instanceId);
  if (!inst) throw new Error('Инстанс не найден');

  const mod = (inst.mods || []).find(m => m.id === modId);
  if (!mod) throw new Error('Мод не найден');

  if (!fs.existsSync(modsDir)) {
    await fs.promises.mkdir(modsDir, { recursive: true });
  }

  const files = await fs.promises.readdir(modsDir);
  const cleanId = String(mod.id || mod.slug).toLowerCase().replace(/[^a-z0-9]/g, '');

  let currentFile = null;
  if (mod.fileName) {
    if (files.includes(mod.fileName)) currentFile = mod.fileName;
    else if (files.includes(mod.fileName + '.disabled')) currentFile = mod.fileName + '.disabled';
    else if (files.includes(mod.fileName.replace(/\.disabled$/, ''))) currentFile = mod.fileName.replace(/\.disabled$/, '');
  }

  if (!currentFile) {
    currentFile = files.find(f => {
      const cf = f.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cf.includes(cleanId) && (f.endsWith('.jar') || f.endsWith('.jar.disabled'));
    });
  }

  if (currentFile) {
    const oldPath = path.join(modsDir, currentFile);
    let newFileName;
    if (enabled) {
      newFileName = currentFile.replace(/\.disabled$/, '');
      if (!newFileName.endsWith('.jar')) newFileName += '.jar';
    } else {
      newFileName = currentFile.endsWith('.disabled') ? currentFile : (currentFile + '.disabled');
    }

    const newPath = path.join(modsDir, newFileName);
    if (oldPath !== newPath && fs.existsSync(oldPath)) {
      await fs.promises.rename(oldPath, newPath);
    }
    mod.fileName = newFileName;
  }

  mod.disabled = !enabled;
  saveConfig(cfg);
  return { success: true, disabled: mod.disabled, fileName: mod.fileName };
}

// Delete mod jar file (both .jar and .disabled, non-blocking async)
async function deleteModFile(instanceId, modId, fileName) {
  const modsDir = getInstanceModsDir(instanceId);
  if (fileName) {
    const cleanFileName = path.basename(fileName);
    const p1 = path.join(modsDir, cleanFileName);
    const p2 = path.join(modsDir, cleanFileName + '.disabled');
    const p3 = path.join(modsDir, cleanFileName.replace(/\.disabled$/, ''));
    for (const p of [p1, p2, p3]) {
      try { if (fs.existsSync(p)) await fs.promises.unlink(p); } catch (e) {}
    }
  }
  try {
    const files = await fs.promises.readdir(modsDir);
    const cleanId = String(modId).toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const f of files) {
      const cleanF = f.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanF.includes(cleanId) && (f.endsWith('.jar') || f.endsWith('.jar.disabled'))) {
        try { await fs.promises.unlink(path.join(modsDir, f)); } catch (e) {}
      }
    }
  } catch (e) {}

  return { success: true };
}

// Delete instance folder safely via OS Recycle Bin (shell.trashItem)
async function deleteInstanceFolder(instanceId) {
  const cleanId = validateInstanceId(instanceId);
  const instancesRoot = path.resolve(getMinecraftDir(), 'instances');
  const instDir = path.resolve(instancesRoot, cleanId);
  if (!instDir.startsWith(instancesRoot + path.sep)) {
    throw new Error('Обнаружена попытка Path Traversal');
  }
  if (fs.existsSync(instDir)) {
    try {
      if (shellModule && shellModule.trashItem) {
        await shellModule.trashItem(instDir);
      } else {
        fs.rmSync(instDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn('shell.trashItem failed, fallback to rmSync:', e.message);
      try {
        fs.rmSync(instDir, { recursive: true, force: true });
      } catch (err) {}
    }
  }
  return { success: true };
}

// Get installed jars in instance
function getInstanceJars(instanceId) {
  const modsDir = getInstanceModsDir(instanceId);
  try {
    return fs.readdirSync(modsDir).filter(f => f.endsWith('.jar'));
  } catch (e) {
    return [];
  }
}

// Ensure ForgeWrapper is present in .minecraft/libraries
async function ensureForgeWrapper() {
  const fwVersion = '1.6.0';
  const fwDir = path.join(getMinecraftDir(), 'libraries', 'io', 'github', 'zekerzhayard', 'ForgeWrapper', fwVersion);
  const fwPath = path.join(fwDir, `ForgeWrapper-${fwVersion}.jar`);
  if (fs.existsSync(fwPath) && fs.statSync(fwPath).size > 10000) {
    return fwPath;
  }
  if (!fs.existsSync(fwDir)) fs.mkdirSync(fwDir, { recursive: true });
  const url = `https://github.com/ZekerZhayard/ForgeWrapper/releases/download/${fwVersion}/ForgeWrapper-${fwVersion}.jar`;
  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  fs.writeFileSync(fwPath, Buffer.from(resp.data));
  return fwPath;
}

function isSnapshotVersion(v) {
  const id = typeof v === 'string' ? v : (v?.id || '');
  const type = typeof v === 'object' ? v?.type : '';
  if (type === 'snapshot') return true;
  if (/snapshot/i.test(id)) return true;
  if (/[-_](pre|rc|beta|alpha)/i.test(id)) return true;
  if (/^\d{2}w\d{2}[a-z]/i.test(id)) return true;
  return false;
}

// Locate or download Forge installer jar
async function ensureForgeInstaller(gameVersion, preferredForgeVer) {
  if (isSnapshotVersion(gameVersion)) {
    throw new Error(`Загрузчик Forge не поддерживает снапшоты (${gameVersion}). Выберите официальный релиз Minecraft или используйте Fabric.`);
  }

  try {
    await ensureForgeWrapper();
  } catch (e) {
    console.warn('ForgeWrapper setup error:', e.message);
  }

  const forgeDir = path.join(LAUNCHER_DATA_DIR, 'forge_installers');
  if (!fs.existsSync(forgeDir)) fs.mkdirSync(forgeDir, { recursive: true });

  const sortVersions = (arr) => arr.filter(v => v.startsWith(gameVersion)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  // 1. Check Prism libraries
  const prismForgeBase = path.join(PRISM_DIR, 'libraries', 'net', 'minecraftforge', 'forge');
  if (fs.existsSync(prismForgeBase)) {
    const versions = sortVersions(fs.readdirSync(prismForgeBase));
    for (const v of versions) {
      const p = path.join(prismForgeBase, v, `forge-${v}-installer.jar`);
      if (fs.existsSync(p) && fs.statSync(p).size > 1000000) return p;
    }
  }

  // 2. Check .minecraft libraries
  const mcForgeBase = path.join(getMinecraftDir(), 'libraries', 'net', 'minecraftforge', 'forge');
  if (fs.existsSync(mcForgeBase)) {
    const versions = sortVersions(fs.readdirSync(mcForgeBase));
    for (const v of versions) {
      const p = path.join(mcForgeBase, v, `forge-${v}-installer.jar`);
      if (fs.existsSync(p) && fs.statSync(p).size > 1000000) return p;
    }
  }

  // 3. Check our local cache
  const localInstallers = fs.readdirSync(forgeDir)
    .filter(f => f.startsWith(`forge-${gameVersion}`) && f.endsWith('-installer.jar'))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  if (localInstallers.length > 0) {
    const p = path.join(forgeDir, localInstallers[0]);
    if (fs.statSync(p).size > 1000000) return p;
  }

  // 4. Resolve latest/recommended Forge version from promotions
  let targetVer = preferredForgeVer;
  if (!targetVer) {
    try {
      const promoRes = await axios.get('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json', { timeout: 8000 });
      const promos = promoRes.data?.promos || {};
      targetVer = promos[`${gameVersion}-recommended`] || promos[`${gameVersion}-latest`];
    } catch (e) {}
  }
  if (!targetVer) {
    const FORGE_RECOMMENDED_MAP = {
      '1.21.4': '54.0.18',
      '1.21.3': '53.0.28',
      '1.21.1': '52.1.20',
      '1.21': '51.0.33',
      '1.20.4': '49.1.0',
      '1.20.2': '48.1.0',
      '1.20.1': '47.4.10',
      '1.20': '46.0.14',
      '1.19.4': '45.3.0',
      '1.19.3': '44.1.23',
      '1.19.2': '43.4.0',
      '1.19.1': '42.0.9',
      '1.19': '41.1.0',
      '1.18.2': '40.2.21',
      '1.18.1': '39.1.2',
      '1.18': '38.0.17',
      '1.17.1': '37.1.1',
      '1.16.5': '36.2.39',
      '1.16.4': '35.1.37',
      '1.16.3': '34.1.42',
      '1.15.2': '31.2.57',
      '1.14.4': '28.2.26',
      '1.13.2': '25.0.223',
      '1.12.2': '14.23.5.2860',
      '1.7.10': '10.13.4.1614'
    };
    targetVer = FORGE_RECOMMENDED_MAP[gameVersion] || '47.4.10';
  }

  const fullVersion = `${gameVersion}-${targetVer}`;
  const filename = `forge-${fullVersion}-installer.jar`;
  const destPath = path.join(forgeDir, filename);

  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000000) {
    return destPath;
  }

  const downloadUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${fullVersion}/${filename}`;
  const resp = await axios.get(downloadUrl, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'MaterialLauncher/1.0.0' },
    timeout: 60000
  });

  fs.writeFileSync(destPath, Buffer.from(resp.data));
  return destPath;
}

// Fabric version profile json setup
async function ensureFabricProfile(gameVersion) {
  try {
    const metaRes = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${gameVersion}`, {
      headers: { 'User-Agent': 'MaterialLauncher/1.0.0' },
      timeout: 8000
    });
    if (!Array.isArray(metaRes.data) || metaRes.data.length === 0) return null;
    const loaderVer = metaRes.data[0].loader.version;
    const profileId = `fabric-loader-${loaderVer}-${gameVersion}`;
    const vDir = path.join(getMinecraftDir(), 'versions', profileId);
    const vJsonPath = path.join(vDir, `${profileId}.json`);

    if (fs.existsSync(vJsonPath) && fs.statSync(vJsonPath).size > 500) {
      return profileId;
    }

    const profileRes = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${gameVersion}/${loaderVer}/profile/json`, {
      headers: { 'User-Agent': 'MaterialLauncher/1.0.0' },
      timeout: 8000
    });
    if (!fs.existsSync(vDir)) fs.mkdirSync(vDir, { recursive: true });
    fs.writeFileSync(vJsonPath, JSON.stringify(profileRes.data, null, 2), 'utf8');
    return profileId;
  } catch (e) {
    console.warn('Fabric profile fetch error:', e.message);
    return null;
  }
}

// Quilt version profile json setup
async function ensureQuiltProfile(gameVersion) {
  try {
    const metaRes = await axios.get(`https://meta.quiltmc.org/v3/versions/loader/${gameVersion}`, {
      headers: { 'User-Agent': 'MaterialLauncher/1.0.0' },
      timeout: 8000
    });
    if (!Array.isArray(metaRes.data) || metaRes.data.length === 0) return null;
    const loaderVer = metaRes.data[0].loader.version;
    const profileId = `quilt-loader-${loaderVer}-${gameVersion}`;
    const vDir = path.join(getMinecraftDir(), 'versions', profileId);
    const vJsonPath = path.join(vDir, `${profileId}.json`);

    if (fs.existsSync(vJsonPath) && fs.statSync(vJsonPath).size > 500) {
      return profileId;
    }

    const profileRes = await axios.get(`https://meta.quiltmc.org/v3/versions/loader/${gameVersion}/${loaderVer}/profile/json`, {
      headers: { 'User-Agent': 'MaterialLauncher/1.0.0' },
      timeout: 8000
    });
    if (!fs.existsSync(vDir)) fs.mkdirSync(vDir, { recursive: true });
    fs.writeFileSync(vJsonPath, JSON.stringify(profileRes.data, null, 2), 'utf8');
    return profileId;
  } catch (e) {
    console.warn('Quilt profile fetch error:', e.message);
    return null;
  }
}

// GPU Offloading: Registry and Environment configuration
function applyWindowsGpuPreference(javawPath) {
  if (process.platform !== 'win32' || !javawPath) return;
  try {
    const cleanPath = javawPath.replace(/\//g, '\\');
    // Set DirectX UserGpuPreferences: GpuPreference=2; (High Performance / discrete GPU)
    execSync(`reg add "HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences" /v "${cleanPath}" /t REG_SZ /d "GpuPreference=2;" /f`, { stdio: 'ignore', timeout: 2000 });
  } catch (e) {}
}

// Crash Diagnosis, Sanitization and mclo.gs API
function analyzeCrashLog(logLines) {
  const fullText = Array.isArray(logLines) ? logLines.join('\n') : String(logLines || '');

  if (/OutOfMemoryError|java\.lang\.OutOfMemoryError/i.test(fullText)) {
    return {
      type: 'OutOfMemory',
      title: 'Недостаточно оперативной памяти (OutOfMemoryError)',
      description: 'Игре не хватило выделенной памяти. Перейдите в Настройки -> Java и увеличьте максимальный объем RAM (например, до 6144 MB или 8192 MB).',
      severity: 'error'
    };
  }

  if (/UnsupportedClassVersionError|compiled by a more recent version of the Java/i.test(fullText)) {
    return {
      type: 'JavaMismatch',
      title: 'Несовместимая версия Java (UnsupportedClassVersionError)',
      description: 'Версия Java не соответствует требованиям Minecraft или мода. Для 1.18+ требуется Java 17, для 1.20.5+ — Java 21, для 25w/26.x — Java 25. Включите автопереключение Java в Настройках.',
      severity: 'error'
    };
  }

  if (/DuplicateModsException|Found duplicate mods/i.test(fullText)) {
    return {
      type: 'DuplicateMods',
      title: 'Обнаружены дубликаты модов (DuplicateModsException)',
      description: 'В папке mods находятся конфликтующие или дублирующиеся версии модов. Удалите старую версию мода в списке установленных.',
      severity: 'error'
    };
  }

  if (/MixinApplyError|Mixin apply failed|org\.spongepowered\.asm\.mixin|in config\s+\[|Mixin\s+\[/i.test(fullText)) {
    const match = fullText.match(/in mixin (\S+)|failed to apply (\S+)|apply failed:?\s+(\S+)|Mixin\s+\[([^\]]+)\]|in config\s+\[([^\]]+)\]/i);
    const captured = match ? match.slice(1).find(Boolean) : null;
    const modHint = captured ? ` (${captured})` : '';
    return {
      type: 'MixinError',
      title: 'Ошибка инициализации модов (Mixin Error)',
      description: `Один из установленных модов${modHint} несовместим с текущей версией игры или конфликтует с другим модом. Попробуйте временно отключить его тумблером в списке модов.`,
      severity: 'error'
    };
  }

  if (/Exit code: 1|Process crashed with exit code 1/i.test(fullText)) {
    return {
      type: 'GenericCrash',
      title: 'Сбой инициализации клиента (Exit Code 1)',
      description: 'Minecraft завершился с ошибкой. Часто это происходит из-за отсутствия обязательной зависимости (например, Fabric API) или несовместимого мода.',
      severity: 'warning'
    };
  }

  return {
    type: 'Unknown',
    title: 'Игра аварийно закрылась',
    description: 'Minecraft завершил работу с ненулевым кодом выхода. Ознакомьтесь с подробным логом или загрузите его на mclo.gs.',
    severity: 'info'
  };
}

function sanitizeLog(text) {
  if (!text) return '';
  let sanitized = String(text);
  sanitized = sanitized.replace(/(access_token|refresh_token|Token|Bearer|client_token)["':\s]+[a-zA-Z0-9_\-\.]{20,}/gi, '$1: [REDACTED_TOKEN]');
  sanitized = sanitized.replace(/([a-zA-Z]:[\\\/]Users[\\\/])[^\\\/]+/gi, '$1<User>');
  sanitized = sanitized.replace(/(\/(?:home|Users)\/)[^\/]+/gi, '$1<User>');
  sanitized = sanitized.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_REDACTED]');
  return sanitized;
}

async function uploadToMclogs(rawLogText) {
  let sanitized = sanitizeLog(rawLogText);
  // mclo.gs has a strict 25,000 lines limit. If the log exceeds 20,000 lines, preserve the head and tail.
  const lines = sanitized.split(/\r?\n/);
  if (lines.length > 20000) {
    const head = lines.slice(0, 1000);
    const tail = lines.slice(-15000);
    sanitized = [...head, `\n... [${lines.length - 16000} строк пропущено для предотвращения лимита mclo.gs] ...\n`, ...tail].join('\n');
  }

  const response = await axios.post(
    'https://api.mclo.gs/1/log',
    new URLSearchParams({ content: sanitized }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000
    }
  );
  if (response.data && response.data.success && response.data.url) {
    return { success: true, url: response.data.url, raw: response.data.raw };
  }
  throw new Error(response.data?.error || 'Не удалось отправить лог на mclo.gs');
}

// Modpack Importer (.mrpack) with strict Zip Slip protection
async function importModpackMrpack(mrpackPath, onStatus) {
  if (!mrpackPath || !fs.existsSync(mrpackPath)) {
    throw new Error('Файл .mrpack не найден');
  }

  if (onStatus) onStatus({ status: 'preparing', message: 'Анализ модпака (.mrpack)...' });

  const zip = new AdmZip(mrpackPath);
  const zipEntries = zip.getEntries();

  // 1. Find and parse modrinth.index.json
  const indexEntry = zipEntries.find(e => e.entryName === 'modrinth.index.json');
  if (!indexEntry) {
    throw new Error('Некорректный .mrpack: отсутствует modrinth.index.json');
  }

  const index = JSON.parse(indexEntry.getData().toString('utf8'));
  const packName = index.name || path.basename(mrpackPath, '.mrpack');
  const gameVersion = index.dependencies?.minecraft || '1.20.1';

  let loader = 'fabric';
  if (index.dependencies?.forge) loader = 'forge';
  else if (index.dependencies?.neoforge) loader = 'neoforge';
  else if (index.dependencies?.quilt) loader = 'quilt';
  else if (index.dependencies?.['fabric-loader']) loader = 'fabric';

  const instanceId = 'inst-pack-' + Date.now();
  const instanceDir = getInstanceDir(instanceId);
  const normalizedInstDir = path.resolve(instanceDir);

  // 2. Extract overrides & client-overrides with Zip Slip Protection
  if (onStatus) onStatus({ status: 'preparing', message: 'Распаковка конфигурации...' });

  for (const entry of zipEntries) {
    if (entry.isDirectory) continue;
    const cleanEntryName = entry.entryName.replace(/\\/g, '/');
    let targetRelative = null;

    if (cleanEntryName.startsWith('overrides/')) {
      targetRelative = cleanEntryName.slice('overrides/'.length);
    } else if (cleanEntryName.startsWith('client-overrides/')) {
      targetRelative = cleanEntryName.slice('client-overrides/'.length);
    }

    if (targetRelative) {
      const destPath = path.resolve(normalizedInstDir, targetRelative);
      // Strict Zip Slip Check
      if (!destPath.startsWith(normalizedInstDir + path.sep)) {
        throw new Error(`Обнаружена угроза Zip Slip (Path Traversal): ${entry.entryName}`);
      }

      const parentDir = path.dirname(destPath);
      if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
      fs.writeFileSync(destPath, entry.getData());
    }
  }

  // 3. Download files from modrinth.index.json using a parallel worker pool (6 concurrent workers)
  const files = Array.isArray(index.files) ? index.files : [];
  const clientFiles = files.filter(f => f.env?.client !== 'unsupported');
  const total = clientFiles.length;
  let completed = 0;
  let nextIndex = 0;

  const instanceMods = [];
  const CONCURRENCY = 6;

  async function downloadWorker() {
    while (nextIndex < clientFiles.length) {
      const idx = nextIndex++;
      const f = clientFiles[idx];
      const destRelative = f.path; // e.g. "mods/example.jar"
      const destPath = path.resolve(normalizedInstDir, destRelative);

      // Strict Zip Slip Check
      if (!destPath.startsWith(normalizedInstDir + path.sep)) {
        throw new Error(`Обнаружена угроза Zip Slip в манифесте: ${destRelative}`);
      }

      const downloadUrl = (f.downloads && f.downloads.length > 0) ? f.downloads[0] : null;
      const fileName = path.basename(destPath);

      if (downloadUrl) {
        await streamDownloadToFile(downloadUrl, destPath, f.hashes?.sha1);
      }

      completed++;
      if (onStatus) {
        const pct = total ? Math.round((completed / total) * 100) : 100;
        onStatus({
          status: 'downloading',
          message: `Скачивание (${completed}/${total}): ${fileName}`,
          percent: pct,
          current: completed,
          total
        });
      }

      if (destRelative.startsWith('mods/') || destRelative.startsWith('mods\\')) {
        const cleanName = fileName.replace(/\.jar(\.disabled)?$/, '');
        instanceMods.push({
          id: cleanName,
          title: cleanName,
          fileName: fileName,
          fileSize: f.fileSize || 0,
          disabled: false
        });
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, clientFiles.length || 1) }, () => downloadWorker());
  await Promise.all(workers);

  // 4. Register new instance in config
  const cfg = loadConfig();
  if (!Array.isArray(cfg.instances)) cfg.instances = [];
  const newInst = {
    id: instanceId,
    name: packName,
    gameVersion: gameVersion,
    loader: loader,
    loaderVersion: 'latest',
    modProvider: 'modrinth',
    icon: loader === 'forge' ? 'forge' : 'fabric',
    created: Date.now(),
    mods: instanceMods
  };
  cfg.instances.unshift(newInst);
  cfg.selectedInstanceId = instanceId;
  saveConfig(cfg);

  if (onStatus) onStatus({ status: 'done', message: `Модпак "${packName}" успешно установлен!` });
  return { success: true, instanceId, instanceName: packName };
}

// Minecraft Launcher
let activeProcess = null;

async function launchMinecraft(opts, callbacks = {}) {
  const { onProgress, onStatus, onLog, onClose } = callbacks;
  const launcher = new Client();

  const cfg = loadConfig();
  const versionId = opts.version || cfg.selectedVersion || '26.1.2';
  const versionType = opts.versionType || cfg.selectedVersionType || 'release';

  // Instance & Loader resolution early for Java matching
  const activeInstanceId = opts.instanceId !== undefined ? opts.instanceId : cfg.selectedInstanceId;
  const targetInst = (cfg.instances || []).find(i => i.id === activeInstanceId);
  const loaderType = (targetInst?.loader || (versionType !== 'release' && versionType !== 'snapshot' ? versionType : 'vanilla')).toLowerCase();

  // Smart Java Resolution: automatically matches Java 8, 17, 21 or 25!
  const isAutoJava = opts.autoJavaSwitch !== undefined ? opts.autoJavaSwitch : cfg.autoJavaSwitch;
  const manualJava = opts.manualJavaPath || cfg.manualJavaPath || '';
  const selectedJava = resolveJavaForVersion(versionId, isAutoJava, manualJava, loaderType);

  const minRamMB = parseInt(opts.minRam || cfg.minRam, 10) || 512;
  const maxRamMB = parseInt(opts.maxRam || cfg.maxRam || opts.ram, 10) || 4096;
  const safeMinRam = Math.max(256, minRamMB);
  const safeMaxRam = Math.max(safeMinRam, maxRamMB);
  const permGenMB = parseInt(opts.permGen || cfg.permGen, 10) || 128;

  const width = parseInt(opts.windowWidth || cfg.windowWidth || opts.resolution?.width, 10) || 854;
  const height = parseInt(opts.windowHeight || cfg.windowHeight || opts.resolution?.height, 10) || 480;
  const fullscreen = opts.fullscreen !== undefined ? opts.fullscreen : cfg.fullscreen;

  // Custom launch & JVM arguments
  const customLaunchArgs = [];
  const customJvmArgs = [];
  if (fullscreen) {
    customLaunchArgs.push('--fullscreen');
  }

  // Account & Token Refresh
  const activeAcc = opts.account || cfg.accounts.find(a => a.active) || cfg.accounts[0] || { name: 'Player', type: 'offline' };
  let authData = null;

  if (process.env.FLATPAK_ID && activeAcc.type !== 'mojang') {
    throw new Error('In compliance with Flathub distribution policy, only official Microsoft accounts are permitted.');
  }

  if (activeAcc.type === 'mojang' && activeAcc.refresh_token) {
    try {
      const authManager = require('./authManager');
      const refreshed = await authManager.refreshMicrosoftToken(activeAcc);
      if (refreshed?.success && refreshed.account) {
        Object.assign(activeAcc, refreshed.account);
        saveConfig(cfg);
        if (onLog) onLog('[MaterialLauncher]: Токен Microsoft успешно обновлен в фоне.');
      }
    } catch (e) {
      if (onLog) onLog(`[MaterialLauncher]: Фоновое обновление токена пропущено: ${e.message}`);
    }
  }

  // Set Windows discrete GPU preference for javaw
  applyWindowsGpuPreference(selectedJava);

  if (activeAcc.type === 'mojang' && activeAcc.access_token) {
    authData = {
      access_token: activeAcc.access_token,
      client_token: activeAcc.uuid || activeAcc.access_token,
      uuid: activeAcc.uuid,
      name: activeAcc.name,
      user_properties: '{}'
    };
  } else if (activeAcc.type === 'elyby') {
    authData = {
      access_token: activeAcc.access_token || 'ely_dummy_token',
      client_token: activeAcc.client_token || activeAcc.uuid,
      uuid: activeAcc.uuid || 'ely_' + activeAcc.name,
      name: activeAcc.name,
      user_properties: '{}'
    };
    try {
      const injectorPath = await ensureAuthlibInjector();
      if (injectorPath && fs.existsSync(injectorPath)) {
        customJvmArgs.push(`-javaagent:${injectorPath}=ely.by`);
      }
    } catch (e) {
      console.warn('Could not setup authlib-injector for Ely.by:', e);
    }
  } else {
    authData = await Authenticator.getAuth(activeAcc.name || 'Player');
  }

  // PermGen was removed in Java 8 (replaced by Metaspace). Modern JVMs (Java 8, 17, 21, 25)
  // crash with fatal error "Unrecognized VM option 'PermSize'" if passed -XX:PermSize.
  // Only pass PermSize for legacy Java (<= 7).
  const isLegacyJava = selectedJava && (
    selectedJava.includes('1.7') || 
    selectedJava.includes('1.6') || 
    selectedJava.includes('jre7') || 
    selectedJava.includes('jre6')
  );
  if (permGenMB && isLegacyJava) {
    customJvmArgs.push(`-XX:PermSize=${permGenMB}M`);
  }
  const extraJvm = (opts.jvmArgs || cfg.jvmArgs || '').trim();
  if (extraJvm) {
    extraJvm.split(/\s+/).forEach(arg => {
      if (arg) customJvmArgs.push(arg);
    });
  }

  // Garbage Collection Presets: Generational ZGC for Java 21+ or Aikar's optimized G1GC
  const gcPreset = (opts.gcPreset || cfg.gcPreset || 'auto').toLowerCase();
  const isJava21Plus = selectedJava && (
    selectedJava.includes('21.') || 
    selectedJava.includes('25.') || 
    selectedJava.includes('jdk-21') || 
    selectedJava.includes('jdk-25') ||
    selectedJava.includes('runtime-delta') ||
    selectedJava.includes('runtime-epsilon')
  );

  if (gcPreset === 'zgc' || (gcPreset === 'auto' && isJava21Plus && maxRamMB >= 6144)) {
    customJvmArgs.push('-XX:+UseZGC', '-XX:+ZGenerational');
    if (onLog) onLog('[MaterialLauncher]: Активирован ультранизколатентный Generational ZGC');
  } else if (!customJvmArgs.some(a => a.includes('UseG1GC') || a.includes('UseZGC') || a.includes('UseParallelGC'))) {
    // Aikar's flags: industry standard for Minecraft to eliminate GC stutters
    customJvmArgs.push(
      '-XX:+UseG1GC',
      '-XX:+ParallelRefProcEnabled',
      '-XX:MaxGCPauseMillis=200',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+DisableExplicitGC',
      '-XX:+AlwaysPreTouch',
      '-XX:G1NewSizePercent=30',
      '-XX:G1MaxNewSizePercent=40',
      '-XX:G1ReservePercent=20',
      '-XX:G1HeapWastePercent=5',
      '-XX:G1MixedGCCountTarget=4',
      '-XX:InitiatingHeapOccupancyPercent=15',
      '-XX:G1MixedGCLiveThresholdPercent=90',
      '-XX:G1RSetUpdatingPauseTimePercent=5',
      '-XX:SurvivorRatio=32'
    );
    if (onLog) onLog('[MaterialLauncher]: Активированы оптимизированные GC-флаги Aikar G1GC');
  }

  // Instance Isolation & Custom Directories
  let instanceDir = null;

  if (targetInst) {
    instanceDir = getInstanceDir(targetInst.id);
    const instanceModsDir = getInstanceModsDir(targetInst.id);

    if (onLog) {
      onLog(`[MaterialLauncher]: Изолированная папка версии: ${instanceDir}`);
      onLog(`[MaterialLauncher]: Изолированная папка модов: ${instanceModsDir}`);
    }

    // Auto-download any missing mods before launching!
    if (Array.isArray(targetInst.mods) && targetInst.mods.length > 0) {
      if (onStatus) onStatus({ status: 'downloading', message: 'Проверка и скачивание модов...' });
      await downloadAllInstanceMods(targetInst.id, (msg) => {
        if (onLog) onLog(`[MaterialLauncher]: ${msg}`);
      });
    }

    // Note: overrides.gameDirectory automatically passes --gameDir to Minecraft launch arguments!
    // We do NOT add duplicate --gameDir to customLaunchArgs to avoid argument parsing collisions.
  }

  // Mod loader setup (Forge / Fabric / Vanilla)
  let forgeInstallerPath = null;
  let customVersionProfile = null;

  if (loaderType === 'forge') {
    if (onStatus) onStatus({ status: 'preparing', message: 'Подготовка загрузчика Forge...' });
    if (onLog) onLog(`[MaterialLauncher]: Настройка загрузчика Forge для ${versionId}...`);
    try {
      forgeInstallerPath = await ensureForgeInstaller(versionId);
      if (onLog) onLog(`[MaterialLauncher]: Найден установщик Forge: ${forgeInstallerPath}`);
    } catch (e) {
      if (onLog) onLog(`[MaterialLauncher]: Ошибка подготовки Forge: ${e.message}`);
    }
  } else if (loaderType === 'fabric') {
    if (onStatus) onStatus({ status: 'preparing', message: 'Подготовка загрузчика Fabric...' });
    if (onLog) onLog(`[MaterialLauncher]: Настройка загрузчика Fabric для ${versionId}...`);
    try {
      customVersionProfile = await ensureFabricProfile(versionId);
      if (onLog) onLog(`[MaterialLauncher]: Установлен профиль Fabric: ${customVersionProfile}`);
    } catch (e) {
      if (onLog) onLog(`[MaterialLauncher]: Ошибка подготовки Fabric: ${e.message}`);
    }
  } else if (loaderType === 'quilt') {
    if (onStatus) onStatus({ status: 'preparing', message: 'Подготовка загрузчика Quilt...' });
    if (onLog) onLog(`[MaterialLauncher]: Настройка загрузчика Quilt для ${versionId}...`);
    try {
      customVersionProfile = await ensureQuiltProfile(versionId);
      if (onLog) onLog(`[MaterialLauncher]: Установлен профиль Quilt: ${customVersionProfile}`);
    } catch (e) {
      if (onLog) onLog(`[MaterialLauncher]: Ошибка подготовки Quilt: ${e.message}`);
    }
  }

  // Asset optimization: reuse PrismLauncher assets if present so we don't redownload 10,000 files!
  const mcDir = getMinecraftDir(cfg);
  const assetRootToUse = fs.existsSync(PRISM_ASSETS_DIR) ? PRISM_ASSETS_DIR : path.join(mcDir, 'assets');

  const launchOpts = {
    authorization: authData,
    root: mcDir,
    javaPath: selectedJava,
    version: {
      number: versionId,
      type: 'release',
      ...(customVersionProfile ? { custom: customVersionProfile } : {})
    },
    ...(forgeInstallerPath ? { forge: forgeInstallerPath } : {}),
    memory: {
      max: `${safeMaxRam}M`,
      min: `${safeMinRam}M`
    },
    window: {
      width: width,
      height: height
    },
    customLaunchArgs: customLaunchArgs,
    customArgs: customJvmArgs,
    overrides: {
      detached: false,
      gameDirectory: instanceDir || mcDir,
      cwd: instanceDir || mcDir,
      assetRoot: assetRootToUse,
      env: {
        ...process.env,
        __NV_PRIME_RENDER_OFFLOAD: '1',
        __GLX_VENDOR_LIBRARY_NAME: 'nvidia',
        DRI_PRIME: '1',
        SHIM_MCCOMPAT: '0'
      },
      url: {
        meta: 'https://piston-meta.mojang.com',
        mavenForge: 'https://files.minecraftforge.net/maven/'
      },
      fw: {
        baseUrl: 'https://github.com/ZekerZhayard/ForgeWrapper/releases/download/',
        version: '1.6.0',
        sh1: '035a51fe6439792a61507630d89382f621da0f1f',
        size: 28679
      }
    }
  };

  if (onLog) {
    onLog(`[MaterialLauncher]: Запуск Minecraft ${versionId} (${versionType})`);
    onLog(`[MaterialLauncher]: Java: ${selectedJava}`);
    onLog(`[MaterialLauncher]: Игрок: ${activeAcc.name} (${activeAcc.type})`);
    onLog(`[MaterialLauncher]: Память: ${minRamMB}M - ${maxRamMB}M, Разрешение: ${width}x${height}`);
  }

  if (onStatus) onStatus({ status: 'preparing', message: `Подготовка к запуску ${versionId}...` });

  // Throttled progress reporting to prevent IPC flooding
  let lastProgressReportTime = 0;

  launcher.on('debug', (e) => {
    if (onLog) onLog(`[MCLC Debug]: ${e}`);
  });

  launcher.on('progress', (e) => {
    const now = Date.now();
    if (now - lastProgressReportTime > 200 || e.task === e.total) {
      lastProgressReportTime = now;
      const pct = e.total ? Math.min(100, Math.round((e.task / e.total) * 100)) : 0;
      if (onProgress) onProgress({ type: e.type, current: e.task, total: e.total, percent: pct });
      if (onStatus) onStatus({ status: 'downloading', percent: pct, type: e.type, current: e.task, total: e.total });
    }
  });

  launcher.on('data', (e) => {
    let str = typeof e === 'string' ? e : e ? e.toString() : '';
    // Filter out repetitive Forge installer processor noise (e.g. 20,000+ 'Slim ... .class' lines from jarsplitter)
    if (str.includes('.class')) {
      const filtered = str.split(/\r?\n/).filter(line => !/^\s*(Slim|Data)\s+\S+\.class\s*$/.test(line)).join('\n');
      if (!filtered.trim()) return;
      str = filtered;
    }
    if (onLog) onLog(str);
    if (onStatus && !activeProcess) {
      onStatus({ status: 'running', message: 'Minecraft запущен' });
    }
  });

  launcher.on('close', (code) => {
    activeProcess = null;
    if (onLog) onLog(`Minecraft завершил работу с кодом: ${code}`);
    if (onClose) onClose(code);
    if (onStatus) onStatus({ status: 'closed', message: `Minecraft закрыт (${code})`, exitCode: code });
  });

  try {
    activeProcess = await launcher.launch(launchOpts);
    if (onStatus) onStatus({ status: 'running', message: 'Minecraft запущен' });
    return { success: true };
  } catch (err) {
    activeProcess = null;
    if (onLog) onLog(`[Launch Error]: ${err.stack || err.message}`);
    if (onStatus) onStatus({ status: 'error', message: err.message || 'Ошибка запуска' });
    throw err;
  }
}

module.exports = {
  get MINECRAFT_DIR() { return getMinecraftDir(); },
  getMinecraftDir,
  getDefaultMinecraftDir,
  DEFAULT_MINECRAFT_DIR,
  LAUNCHER_DATA_DIR,
  PRISM_DIR,
  setCryptoHelpers,
  setShell,
  loadConfig,
  saveConfig,
  findInstalledJavas,
  resolveJavaForVersion,
  getVersionManifest,
  launchMinecraft,
  getInstanceDir,
  getInstanceModsDir,
  downloadModFile,
  downloadAllInstanceMods,
  deleteModFile,
  toggleModState,
  deleteInstanceFolder,
  getInstanceJars,
  analyzeCrashLog,
  sanitizeLog,
  uploadToMclogs,
  importModpackMrpack
};
