const axios = require('axios');
const { BrowserWindow, shell, clipboard } = require('electron');

const CLIENT_ID = '00000000402b5328';
const REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf';
const SCOPE = 'service::user.auth.xboxlive.com::MBI_SSL';
const AUTH_USER_AGENT = 'MaterialLauncher/1.3.0';

async function requestWithRetry(fn, stepName, retries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      if (attempt < retries && (!status || status >= 500 || status === 429)) {
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      break;
    }
  }
  if (lastErr && !lastErr._authStep) {
    lastErr._authStep = stepName;
  }
  throw lastErr;
}

function getXboxErrorMessage(err) {
  const xErr = err.response?.data?.XErr;
  if (xErr) {
    switch (String(xErr)) {
      case '2148916233':
        return 'Для этой учётной записи Microsoft ещё не создан профиль Xbox Live. Войдите на xbox.com и создайте тег игрока.';
      case '2148916235':
        return 'Служба Xbox Live недоступна в вашей стране или регионе.';
      case '2148916236':
      case '2148916237':
        return 'Требуется подтверждение возраста совершеннолетнего (для Южной Кореи).';
      case '2148916238':
        return 'Это детская учётная запись. Родитель должен добавить её в семейную группу Microsoft и разрешить доступ.';
    }
  }
  const status = err.response?.status;
  const step = err._authStep ? `[${err._authStep}] ` : '';
  const errDesc = err.response?.data?.error_description || err.response?.data?.errorMessage || err.message || '';
  if (err.response?.data?.error === 'invalid_grant' || /code has expired/i.test(errDesc)) {
    return `${step}Код авторизации Microsoft истёк или уже использован. Попробуйте войти заново.`;
  }
  if (status && status >= 500) {
    return `${step}Сервер авторизации Microsoft/Minecraft временно вернул ошибку ${status}. Попробуйте ещё раз через минуту.`;
  }
  return `${step}${errDesc || 'Ошибка авторизации Microsoft'}`;
}

let activeDeviceLoginToken = null;

function cancelMicrosoftLogin() {
  if (activeDeviceLoginToken) {
    activeDeviceLoginToken.cancelled = true;
  }
}

async function loginWithMicrosoft(parentWindow) {
  return new Promise((resolve) => {
    const authUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${CLIENT_ID}&response_type=token&scope=${encodeURIComponent(SCOPE)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&prompt=select_account`;

    const loginWin = new BrowserWindow({
      width: 520,
      height: 670,
      parent: parentWindow || null,
      modal: true,
      title: 'Войти через Microsoft / Mojang',
      backgroundColor: '#1D1B20',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: `ms-auth-${Date.now()}`
      }
    });

    loginWin.setMenuBarVisibility(false);
    loginWin.loadURL(authUrl);

    let isDone = false;

    const handleRedirect = async (event, url) => {
      if (isDone || !url || !url.startsWith(REDIRECT_URI)) return;
      let urlObj;
      try {
        urlObj = new URL(url);
      } catch (e) {
        return;
      }
      const hashParams = new URLSearchParams((urlObj.hash || '').replace(/^#/, ''));
      const accessToken = hashParams.get('access_token') || urlObj.searchParams.get('access_token');
      const code = urlObj.searchParams.get('code');
      const error = hashParams.get('error_description') || hashParams.get('error') || urlObj.searchParams.get('error_description') || urlObj.searchParams.get('error');

      if (!error && !accessToken && !code) return;
      isDone = true;
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }

      if (error) {
        loginWin.close();
        return resolve({ success: false, error });
      }

      loginWin.close();
      try {
        let account;
        if (accessToken) {
          const mcAccessToken = await authenticateXboxToMinecraft(accessToken);
          account = await fetchMinecraftProfile(mcAccessToken, '');
        } else {
          account = await exchangeCodeForMinecraft(code);
        }
        return resolve({ success: true, account });
      } catch (err) {
        console.error('Error in Microsoft login:', err._authStep || '', err.response?.status || '', err.response?.data || err.message);
        return resolve({
          success: false,
          error: getXboxErrorMessage(err)
        });
      }
    };

    loginWin.webContents.on('will-redirect', (event, url) => {
      handleRedirect(event, url);
    });
    loginWin.webContents.on('did-navigate', (event, url) => {
      handleRedirect(event, url);
    });

    loginWin.on('closed', () => {
      if (!isDone) {
        resolve({ success: false, error: 'Окно входа было закрыто' });
      }
    });
  });
}

async function loginWithMicrosoftBrowser(callbacks = {}) {
  if (activeDeviceLoginToken) {
    activeDeviceLoginToken.cancelled = true;
  }
  const cancelToken = { cancelled: false };
  activeDeviceLoginToken = cancelToken;
  try {
    const devResp = await requestWithRetry(() => axios.post(
      'https://login.live.com/oauth20_connect.srf',
      new URLSearchParams({
        client_id: CLIENT_ID,
        scope: SCOPE,
        response_type: 'device_code'
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': AUTH_USER_AGENT },
        timeout: 15000
      }
    ), 'Device Code');

    const { user_code, device_code, verification_uri, interval, expires_in } = devResp.data || {};
    if (!user_code || !device_code || !verification_uri) {
      return { success: false, error: 'Не удалось получить код авторизации Microsoft' };
    }

    const browserUrl = `${verification_uri}${verification_uri.includes('?') ? '&' : '?'}otc=${encodeURIComponent(user_code)}`;
    try { clipboard.writeText(user_code); } catch (e) {}
    try { await shell.openExternal(browserUrl); } catch (e) {}

    if (typeof callbacks.onCode === 'function') {
      callbacks.onCode({
        userCode: user_code,
        verificationUri: verification_uri,
        browserUrl
      });
    }

    let pollIntervalMs = Math.max(Number(interval) || 5, 3) * 1000;
    const deadline = Date.now() + (Math.max(Number(expires_in) || 900, 60) * 1000);

    while (Date.now() < deadline) {
      if (cancelToken.cancelled) {
        return { success: false, error: 'Вход отменён пользователем' };
      }

      await new Promise(r => setTimeout(r, pollIntervalMs));
      if (cancelToken.cancelled) {
        return { success: false, error: 'Вход отменён пользователем' };
      }

      try {
        const tokenResp = await axios.post(
          'https://login.live.com/oauth20_token.srf',
          new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            device_code
          }).toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': AUTH_USER_AGENT },
            timeout: 15000
          }
        );

        const msAccessToken = tokenResp.data?.access_token;
        const msRefreshToken = tokenResp.data?.refresh_token;
        if (msAccessToken) {
          const mcAccessToken = await authenticateXboxToMinecraft(msAccessToken);
          const account = await fetchMinecraftProfile(mcAccessToken, msRefreshToken);
          return { success: true, account };
        }
      } catch (pollErr) {
        const errCode = pollErr.response?.data?.error;
        if (errCode === 'authorization_pending') {
          continue;
        }
        if (errCode === 'slow_down') {
          pollIntervalMs += 5000;
          continue;
        }
        if (errCode === 'expired_token') {
          return { success: false, error: 'Время ожидания входа в браузере истекло. Попробуйте снова.' };
        }
        if (errCode === 'access_denied') {
          return { success: false, error: 'Доступ отклонён пользователем в браузере.' };
        }
        if (!pollErr.response || pollErr.response.status >= 500) {
          continue;
        }
        return { success: false, error: getXboxErrorMessage(pollErr) };
      }
    }

    return { success: false, error: 'Время ожидания входа в браузере истекло. Попробуйте снова.' };
  } catch (err) {
    console.error('Error in loginWithMicrosoft:', err._authStep || '', err.response?.status || '', err.response?.data || err.message);
    return {
      success: false,
      error: getXboxErrorMessage(err)
    };
  }
}

async function authenticateXboxToMinecraft(msAccessToken) {
  // 2. Xbox Live Authenticate (try with d= prefix first, fallback to raw token if needed)
  let xblResp;
  const rpsWithPrefix = msAccessToken.startsWith('d=') ? msAccessToken : `d=${msAccessToken}`;
  const rpsRaw = msAccessToken.startsWith('d=') ? msAccessToken.slice(2) : msAccessToken;
  try {
    xblResp = await requestWithRetry(() => axios.post(
      'https://user.auth.xboxlive.com/user/authenticate',
      {
        Properties: {
          AuthMethod: 'RPS',
          SiteName: 'user.auth.xboxlive.com',
          RpsTicket: rpsWithPrefix
        },
        RelyingParty: 'http://auth.xboxlive.com',
        TokenType: 'JWT'
      },
      {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': AUTH_USER_AGENT },
        timeout: 15000
      }
    ), 'Xbox Live');
  } catch (firstErr) {
    xblResp = await requestWithRetry(() => axios.post(
      'https://user.auth.xboxlive.com/user/authenticate',
      {
        Properties: {
          AuthMethod: 'RPS',
          SiteName: 'user.auth.xboxlive.com',
          RpsTicket: rpsRaw
        },
        RelyingParty: 'http://auth.xboxlive.com',
        TokenType: 'JWT'
      },
      {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': AUTH_USER_AGENT },
        timeout: 15000
      }
    ), 'Xbox Live');
  }

  const xblToken = xblResp.data?.Token;
  const userHash = xblResp.data?.DisplayClaims?.xui?.[0]?.uhs;
  if (!xblToken || !userHash) {
    const err = new Error('Xbox Live не вернул токен или UHS');
    err._authStep = 'Xbox Live';
    throw err;
  }

  // 3. XSTS Authenticate
  const xstsResp = await requestWithRetry(() => axios.post(
    'https://xsts.auth.xboxlive.com/xsts/authorize',
    {
      Properties: {
        SandboxId: 'RETAIL',
        UserTokens: [xblToken]
      },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT'
    },
    {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': AUTH_USER_AGENT },
      timeout: 15000
    }
  ), 'XSTS');

  const xstsToken = xstsResp.data.Token;

  // 4. Minecraft Services Login
  const mcLoginResp = await requestWithRetry(() => axios.post(
    'https://api.minecraftservices.com/authentication/login_with_xbox',
    {
      identityToken: `XBL3.0 x=${userHash};${xstsToken}`
    },
    {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': AUTH_USER_AGENT },
      timeout: 15000
    }
  ), 'Minecraft Login');

  return mcLoginResp.data.access_token;
}

async function exchangeCodeForMinecraft(code) {
  // 1. Get Live Token
  const tokenResp = await requestWithRetry(() => axios.post(
    'https://login.live.com/oauth20_token.srf',
    new URLSearchParams({
      client_id: CLIENT_ID,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': AUTH_USER_AGENT },
      timeout: 15000
    }
  ), 'Live Token');

  const msAccessToken = tokenResp.data.access_token;
  const msRefreshToken = tokenResp.data.refresh_token;

  const mcAccessToken = await authenticateXboxToMinecraft(msAccessToken);
  return await fetchMinecraftProfile(mcAccessToken, msRefreshToken);
}

async function fetchMinecraftProfile(mcAccessToken, msRefreshToken) {

  // 4.5 Check Entitlements (License Check)
  let hasLicense = false;
  try {
    const entitlementsResp = await axios.get('https://api.minecraftservices.com/entitlements/mcstore', {
      headers: { Authorization: `Bearer ${mcAccessToken}` },
      timeout: 10000
    });
    const items = entitlementsResp.data?.items || [];
    hasLicense = items.length > 0 && items.some(it => it.name === 'product_minecraft' || it.name === 'game_minecraft');
    if (!hasLicense) {
      console.warn('Microsoft entitlements present, but Minecraft Java Edition is not owned.');
    }
  } catch (entErr) {
    console.warn('Entitlements check skipped or timed out:', entErr.message);
  }

  // 5. Fetch Minecraft Profile
  try {
    const profileResp = await requestWithRetry(() => axios.get('https://api.minecraftservices.com/minecraft/profile', {
      headers: { Authorization: `Bearer ${mcAccessToken}`, 'User-Agent': AUTH_USER_AGENT },
      timeout: 15000
    }), 'Minecraft Profile');

    const profile = profileResp.data;
    const skinUrl = profile.skins && profile.skins.length > 0 ? profile.skins[0].url : null;

    return {
      type: 'mojang',
      name: profile.name,
      uuid: profile.id,
      access_token: mcAccessToken,
      refresh_token: msRefreshToken,
      skinUrl: skinUrl,
      hasLicense: !!hasLicense,
      authProvider: 'Mojang / Microsoft'
    };
  } catch (profErr) {
    if (profErr.response?.status === 404) {
      throw new Error('На этой учётной записи Microsoft не найдена лицензия Minecraft Java Edition. Приобретите игру или создайте профиль на minecraft.net.');
    }
    throw profErr;
  }
}

async function loginWithElyBy(usernameOrEmail, password) {
  try {
    const user = (usernameOrEmail || '').trim();
    const pass = (password || '').trim();

    if (!user || !pass) {
      return { success: false, error: 'Введите логин/email и пароль' };
    }

    const resp = await axios.post(
      'https://authserver.ely.by/auth/authenticate',
      {
        username: user,
        password: pass,
        requestUser: true
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        timeout: 15000
      }
    );

    const data = resp.data;
    const profile = data.selectedProfile || (data.availableProfiles && data.availableProfiles[0]) || {
      id: data.user?.id || 'ely_' + Date.now(),
      name: data.user?.username || user
    };

    return {
      success: true,
      account: {
        type: 'elyby',
        name: profile.name,
        uuid: profile.id,
        access_token: data.accessToken,
        client_token: data.clientToken,
        skinUrl: `https://skinsystem.ely.by/skins/${encodeURIComponent(profile.name)}.png`,
        authProvider: 'Ely.by'
      }
    };
  } catch (err) {
    console.error('Ely.by login failed:', err.response?.data || err.message);
    const msg =
      err.response?.data?.errorMessage ||
      (err.response?.status === 403 ? 'Неверный логин или пароль на Ely.by' : null) ||
      err.message ||
      'Ошибка входа через Ely.by';
    return { success: false, error: msg };
  }
}

async function refreshMicrosoftToken(account) {
  if (!account || !account.refresh_token) {
    return { success: false, error: 'No refresh token available' };
  }
  try {
    const tokenResp = await requestWithRetry(() => axios.post(
      'https://login.live.com/oauth20_token.srf',
      new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: account.refresh_token,
        redirect_uri: REDIRECT_URI,
        scope: SCOPE
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': AUTH_USER_AGENT },
        timeout: 15000
      }
    ), 'Live Token Refresh');

    const msAccessToken = tokenResp.data.access_token;
    const msRefreshToken = tokenResp.data.refresh_token || account.refresh_token;

    const mcAccessToken = await authenticateXboxToMinecraft(msAccessToken);

    account.access_token = mcAccessToken;
    account.refresh_token = msRefreshToken;
    account.lastRefreshed = Date.now();

    return { success: true, account };
  } catch (err) {
    console.warn('Failed to refresh Microsoft token:', err.response?.data || err.message);
    return { success: false, error: getXboxErrorMessage(err) };
  }
}

module.exports = {
  loginWithMicrosoft,
  loginWithMicrosoftBrowser,
  cancelMicrosoftLogin,
  refreshMicrosoftToken,
  loginWithElyBy
};
