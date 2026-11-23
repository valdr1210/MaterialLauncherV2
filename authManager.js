const axios = require('axios');
const { BrowserWindow } = require('electron');

const CLIENT_ID = '00000000402b5328';
const REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf';
const SCOPE = 'service::user.auth.xboxlive.com::MBI_SSL';

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
  return err.response?.data?.errorMessage || err.message || 'Ошибка авторизации Microsoft';
}

async function loginWithMicrosoft(parentWindow) {
  return new Promise((resolve, reject) => {
    const authUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${CLIENT_ID}&response_type=code&scope=${encodeURIComponent(SCOPE)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

    const loginWin = new BrowserWindow({
      width: 520,
      height: 670,
      parent: parentWindow || null,
      modal: true,
      title: 'Войти через Microsoft / Mojang',
      backgroundColor: '#1D1B20',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    loginWin.setMenuBarVisibility(false);
    loginWin.loadURL(authUrl);

    let isDone = false;

    const handleRedirect = async (url) => {
      if (url.startsWith(REDIRECT_URI)) {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');
        const error = urlObj.searchParams.get('error_description') || urlObj.searchParams.get('error');

        if (error) {
          isDone = true;
          loginWin.close();
          return resolve({ success: false, error });
        }

        if (code) {
          isDone = true;
          loginWin.close();
          try {
            const account = await exchangeCodeForMinecraft(code);
            return resolve({ success: true, account });
          } catch (err) {
            console.error('Error in exchangeCodeForMinecraft:', err.response?.data || err.message);
            return resolve({
              success: false,
              error: getXboxErrorMessage(err)
            });
          }
        }
      }
    };

    loginWin.webContents.on('will-redirect', (event, url) => {
      handleRedirect(url);
    });

    loginWin.webContents.on('will-navigate', (event, url) => {
      handleRedirect(url);
    });

    loginWin.on('closed', () => {
      if (!isDone) {
        resolve({ success: false, error: 'Окно входа было закрыто' });
      }
    });
  });
}

async function exchangeCodeForMinecraft(code) {
  // 1. Get Live Token
  const tokenResp = await axios.post(
    'https://login.live.com/oauth20_token.srf',
    new URLSearchParams({
      client_id: CLIENT_ID,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000
    }
  );

  const msAccessToken = tokenResp.data.access_token;
  const msRefreshToken = tokenResp.data.refresh_token;

  // 2. Xbox Live Authenticate
  const xblResp = await axios.post(
    'https://user.auth.xboxlive.com/user/authenticate',
    {
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: msAccessToken.startsWith('d=') ? msAccessToken : `d=${msAccessToken}`
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT'
    },
    {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: 15000
    }
  );

  const xblToken = xblResp.data.Token;
  const userHash = xblResp.data.DisplayClaims.xui[0].uhs;

  // 3. XSTS Authenticate
  const xstsResp = await axios.post(
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
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: 15000
    }
  );

  const xstsToken = xstsResp.data.Token;

  // 4. Minecraft Services Login
  const mcLoginResp = await axios.post(
    'https://api.minecraftservices.com/authentication/login_with_xbox',
    {
      identityToken: `XBL3.0 x=${userHash};${xstsToken}`
    },
    {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: 15000
    }
  );

  const mcAccessToken = mcLoginResp.data.access_token;

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
    const profileResp = await axios.get('https://api.minecraftservices.com/minecraft/profile', {
      headers: { Authorization: `Bearer ${mcAccessToken}` },
      timeout: 15000
    });

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
        skinUrl: `http://skinsystem.ely.by/skins/${encodeURIComponent(profile.name)}.png`,
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
    const tokenResp = await axios.post(
      'https://login.live.com/oauth20_token.srf',
      new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: account.refresh_token,
        redirect_uri: REDIRECT_URI,
        scope: SCOPE
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000
      }
    );

    const msAccessToken = tokenResp.data.access_token;
    const msRefreshToken = tokenResp.data.refresh_token || account.refresh_token;

    // 2. Xbox Live Authenticate
    const xblResp = await axios.post(
      'https://user.auth.xboxlive.com/user/authenticate',
      {
        Properties: {
          AuthMethod: 'RPS',
          SiteName: 'user.auth.xboxlive.com',
          RpsTicket: msAccessToken.startsWith('d=') ? msAccessToken : `d=${msAccessToken}`
        },
        RelyingParty: 'http://auth.xboxlive.com',
        TokenType: 'JWT'
      },
      {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 15000
      }
    );

    const xblToken = xblResp.data.Token;
    const userHash = xblResp.data.DisplayClaims.xui[0].uhs;

    // 3. XSTS Authenticate
    const xstsResp = await axios.post(
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
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 15000
      }
    );

    const xstsToken = xstsResp.data.Token;

    // 4. Minecraft Services Login
    const mcLoginResp = await axios.post(
      'https://api.minecraftservices.com/authentication/login_with_xbox',
      {
        identityToken: `XBL3.0 x=${userHash};${xstsToken}`
      },
      {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 15000
      }
    );

    const mcAccessToken = mcLoginResp.data.access_token;

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
  refreshMicrosoftToken,
  loginWithElyBy
};
