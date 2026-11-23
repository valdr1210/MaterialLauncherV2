// i18n Internationalization Engine for MaterialLauncher
(function() {
  const SUPPORTED_LOCALES = [
    { code: 'ru_RU', name: 'Русский', nativeName: 'Русский', flag: '🇷🇺' },
    { code: 'en_US', name: 'English (US)', nativeName: 'English', flag: '🇺🇸' },
    { code: 'zh_CN', name: 'Chinese Simplified', nativeName: '简体中文', flag: '🇨🇳' },
    { code: 'de_DE', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
    { code: 'fr_FR', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
    { code: 'es_ES', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
    { code: 'pt_BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', flag: '🇧🇷' },
    { code: 'ja_JP', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' }
  ];

  let currentLang = localStorage.getItem('launcher_language') || 'ru_RU';
  let currentTranslations = {};

  async function fetchLocaleData(code) {
    if (window.electronAPI?.getLocale) {
      try {
        const data = await window.electronAPI.getLocale(code);
        if (data && typeof data === 'object') return data;
      } catch (e) {
        console.warn('IPC getLocale failed, falling back to fetch:', e);
      }
    }

    try {
      const res = await fetch(`./locales/${code}.json`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error(`Failed to fetch ./locales/${code}.json:`, e);
    }
    return null;
  }

  function t(key, fallback = '') {
    if (currentTranslations && currentTranslations[key]) {
      return currentTranslations[key];
    }
    return fallback || key;
  }

  function applyTranslations() {
    // 1. Text elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (currentTranslations[key]) {
        el.textContent = currentTranslations[key];
      }
    });

    // 2. Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (currentTranslations[key]) {
        el.placeholder = currentTranslations[key];
      }
    });

    // 3. Titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (currentTranslations[key]) {
        el.title = currentTranslations[key];
      }
    });

    // Dispatch custom event for dynamic components (Play buttons, cards, status)
    window.dispatchEvent(new CustomEvent('launcher-language-changed', {
      detail: { lang: currentLang, translations: currentTranslations }
    }));
  }

  async function setLanguage(code) {
    const target = SUPPORTED_LOCALES.find(l => l.code === code) || SUPPORTED_LOCALES[0];
    const data = await fetchLocaleData(target.code);
    if (data) {
      currentLang = target.code;
      currentTranslations = data;
      localStorage.setItem('launcher_language', target.code);
      applyTranslations();
      return true;
    }
    return false;
  }

  window.I18N = {
    SUPPORTED_LOCALES,
    get currentLanguage() { return currentLang; },
    get translations() { return currentTranslations; },
    t,
    setLanguage,
    applyTranslations,
    init: async function() {
      await setLanguage(currentLang);
    }
  };
})();
