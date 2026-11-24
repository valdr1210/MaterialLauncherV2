document.addEventListener('DOMContentLoaded', () => {
  // Helper: Escape HTML to prevent XSS injection
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // M3 Snackbar & Confirm Dialog Elements
  const m3SnackbarContainer = document.getElementById('m3SnackbarContainer');
  const confirmDialogModal = document.getElementById('confirmDialogModal');
  const confirmDialogTitle = document.getElementById('confirmDialogTitle');
  const confirmDialogMessage = document.getElementById('confirmDialogMessage');
  const confirmDialogIcon = document.getElementById('confirmDialogIcon');
  const confirmDialogConfirmBtn = document.getElementById('confirmDialogConfirmBtn');
  const confirmDialogCancelBtn = document.getElementById('confirmDialogCancelBtn');

  function showSnackbar(message, type = 'info', actionText = null, onAction = null, duration = 3500) {
    if (!m3SnackbarContainer) return;
    const snackbar = document.createElement('div');
    snackbar.className = `m3-snackbar ${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
    } else if (type === 'warning') {
      iconSvg = '<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>';
    } else {
      iconSvg = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';
    }

    snackbar.innerHTML = `
      <div class="m3-snackbar-icon">${iconSvg}</div>
      <div class="m3-snackbar-message">${escapeHtml(message)}</div>
      ${actionText ? `<button class="m3-snackbar-action">${escapeHtml(actionText)}</button>` : ''}
    `;

    function removeSnackbar() {
      snackbar.classList.remove('show');
      setTimeout(() => snackbar.remove(), 250);
    }

    if (actionText && onAction) {
      snackbar.querySelector('.m3-snackbar-action')?.addEventListener('click', () => {
        onAction();
        removeSnackbar();
      });
    }

    m3SnackbarContainer.appendChild(snackbar);
    requestAnimationFrame(() => snackbar.classList.add('show'));

    const timer = setTimeout(removeSnackbar, duration);
    snackbar.addEventListener('click', (e) => {
      if (e.target.closest('.m3-snackbar-action')) return;
      clearTimeout(timer);
      removeSnackbar();
    });
  }

  let confirmDialogResolver = null;
  function showConfirmDialog({ title, message, iconType = 'info', confirmText = null, cancelText = null }) {
    return new Promise((resolve) => {
      if (!confirmDialogModal) {
        resolve(true);
        return;
      }
      confirmDialogResolver = resolve;
      if (confirmDialogTitle) confirmDialogTitle.textContent = title || (window.I18N ? window.I18N.t('dialog_confirm_default_title', 'Подтверждение') : 'Подтверждение');
      if (confirmDialogMessage) confirmDialogMessage.textContent = message || '';
      if (confirmDialogConfirmBtn) {
        confirmDialogConfirmBtn.textContent = confirmText || (window.I18N ? window.I18N.t('dialog_confirm', 'Подтвердить') : 'Подтвердить');
      }
      if (confirmDialogCancelBtn) {
        confirmDialogCancelBtn.textContent = cancelText || (window.I18N ? window.I18N.t('dialog_cancel', 'Отмена') : 'Отмена');
      }
      if (confirmDialogIcon) {
        confirmDialogIcon.className = `m3-dialog-icon ${iconType === 'danger' ? 'danger' : ''}`;
      }
      confirmDialogModal.classList.add('open');
    });
  }

  function closeConfirmDialog(result) {
    if (confirmDialogModal) confirmDialogModal.classList.remove('open');
    if (confirmDialogResolver) {
      confirmDialogResolver(result);
      confirmDialogResolver = null;
    }
  }

  confirmDialogConfirmBtn?.addEventListener('click', () => closeConfirmDialog(true));
  confirmDialogCancelBtn?.addEventListener('click', () => closeConfirmDialog(false));
  confirmDialogModal?.addEventListener('click', (e) => {
    if (e.target === confirmDialogModal) closeConfirmDialog(false);
  });

  // Global Escape key handler for all modals, confirm dialog & context menu
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideContextMenu();
      hideAccountContextMenu();
      if (confirmDialogModal?.classList.contains('open')) {
        closeConfirmDialog(false);
        return;
      }
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });

  // 0. Themed SVG App Logo
  const titlebarAppIcon = document.getElementById('titlebarAppIcon');
  if (titlebarAppIcon) {
    fetch('./assets/logo-themed.svg')
      .then(res => res.text())
      .then(svgText => {
        titlebarAppIcon.innerHTML = svgText;
      })
      .catch(err => console.warn('Could not load themed SVG:', err));
  }

  // 1. Window Controls
  const btnMinimize = document.getElementById('btnMinimize');
  const btnMaximize = document.getElementById('btnMaximize');
  const btnClose = document.getElementById('btnClose');

  if (window.electronAPI) {
    btnMinimize?.addEventListener('click', () => window.electronAPI.minimize());
    btnMaximize?.addEventListener('click', () => window.electronAPI.maximize());
    btnClose?.addEventListener('click', () => window.electronAPI.close());

    window.electronAPI.onWindowStateChange((state) => {
      const isMax = !!(state?.isMaximized || state?.maximized);
      document.body.classList.toggle('maximized', isMax);
      if (btnMaximize) {
        btnMaximize.title = isMax ? 'Restore' : 'Maximize';
      }
    });
  }

  // 2. Tab Navigation
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const sidebarPlayButton = document.getElementById('sidebarPlayButton');

  function updatePlayButtonPlacement(tabName) {
    if (!sidebarPlayButton) return;
    if (tabName === 'home') {
      sidebarPlayButton.style.display = 'none';
    } else {
      sidebarPlayButton.style.display = 'flex';
    }
  }

  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabTarget = btn.getAttribute('data-tab');

      navItems.forEach(n => {
        n.classList.remove('active');
        n.setAttribute('aria-selected', 'false');
      });
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const activePane = document.getElementById(`tab-${tabTarget}`);
      if (activePane) {
        activePane.classList.add('active');
      }

      if (tabTarget === 'settings') {
        applyConfigToUI();
      }

      updatePlayButtonPlacement(tabTarget);
    });
  });

  // Initial placement (Home is active)
  updatePlayButtonPlacement('home');

  // 3. Theme Toggle (Material 3 Dark/Light)
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeToggleIcon = document.getElementById('themeToggleIcon');
  const themeLabel = document.getElementById('themeLabel');
  const htmlEl = document.documentElement;

  // 10. Accent Color Customization (Material You Dynamic Colors & Surfaces)
  const ACCENT_PALETTES = {
    lavender: {
      primary: '#EADDFF',
      onPrimary: '#1D1B20',
      primaryContainer: '#4F378B',
      onPrimaryContainer: '#EADDFF',
      secContainer: 'rgba(234, 221, 255, 0.16)',
      onSecContainer: '#EADDFF',
      iconBorder: '#79747E',
      iconLetters: '#EADDFF',
      iconBg: '#1D1B20',
      lightPrimary: '#6750A4',
      lightOnPrimary: '#FFFFFF',
      lightPrimaryContainer: '#EADDFF',
      lightOnPrimaryContainer: '#21005D',
      lightSecContainer: '#E8DEF8',
      lightOnSecContainer: '#1D192B',
      lightIconBorder: '#79747E',
      lightIconLetters: '#6750A4',
      lightIconBg: '#FEF7FF',
      darkSurfaces: {
        surface: '#1D1B20',
        surfaceDim: '#16141A',
        surfaceBright: '#302C3A',
        surfaceContainerLowest: '#141217',
        surfaceContainerLow: '#25222D',
        surfaceContainer: '#2D2937',
        surfaceContainerHigh: '#353040',
        surfaceContainerHighest: '#3E384C',
        onSurface: '#E6E1E5',
        onSurfaceVariant: '#CAC4D0',
        outline: '#79747E',
        outlineVariant: '#49454F'
      },
      lightSurfaces: {
        surface: '#FEF7FF',
        surfaceDim: '#DED8E1',
        surfaceBright: '#FEF7FF',
        surfaceContainerLowest: '#FFFFFF',
        surfaceContainerLow: '#F7F2FA',
        surfaceContainer: '#F3EDF7',
        surfaceContainerHigh: '#ECE6F0',
        surfaceContainerHighest: '#E6E0E9',
        onSurface: '#1D1B20',
        onSurfaceVariant: '#49454F',
        outline: '#79747E',
        outlineVariant: '#CAC4D0'
      }
    },
    emerald: {
      primary: '#9fe870',
      onPrimary: '#0e3012',
      primaryContainer: '#204624',
      onPrimaryContainer: '#c4f7a7',
      secContainer: '#2b3b2e',
      onSecContainer: '#d9f3dc',
      iconBorder: '#4ade80',
      iconLetters: '#9fe870',
      iconBg: '#1c271f',
      lightPrimary: '#386A20',
      lightOnPrimary: '#FFFFFF',
      lightPrimaryContainer: '#B7F397',
      lightOnPrimaryContainer: '#042100',
      lightSecContainer: '#D8E7CB',
      lightOnSecContainer: '#131F0D',
      lightIconBorder: '#728476',
      lightIconLetters: '#386A20',
      lightIconBg: '#F6FAF4',
      darkSurfaces: {
        surface: '#101712',
        surfaceDim: '#0d130f',
        surfaceBright: '#1c261e',
        surfaceContainerLowest: '#0b100c',
        surfaceContainerLow: '#141b16',
        surfaceContainer: '#18221b',
        surfaceContainerHigh: '#1e2a22',
        surfaceContainerHighest: '#243329',
        onSurface: '#e2ece3',
        onSurfaceVariant: '#7d9484',
        outline: '#38493d',
        outlineVariant: '#223126'
      },
      lightSurfaces: {
        surface: '#f6faf4',
        surfaceDim: '#e8eee6',
        surfaceBright: '#ffffff',
        surfaceContainerLowest: '#ffffff',
        surfaceContainerLow: '#f0f5ee',
        surfaceContainer: '#e6ede4',
        surfaceContainerHigh: '#dde5db',
        surfaceContainerHighest: '#d4ddd2',
        onSurface: '#171f18',
        onSurfaceVariant: '#4e6052',
        outline: '#728476',
        outlineVariant: '#c3d2c6'
      }
    },
    blue: {
      primary: '#60cdff',
      onPrimary: '#003548',
      primaryContainer: '#004d67',
      onPrimaryContainer: '#b8e8ff',
      secContainer: '#1b3245',
      onSecContainer: '#d0eaff',
      iconBorder: '#38bdf8',
      iconLetters: '#60cdff',
      iconBg: '#132230',
      lightPrimary: '#00658B',
      lightOnPrimary: '#FFFFFF',
      lightPrimaryContainer: '#C4E7FF',
      lightOnPrimaryContainer: '#001E2C',
      lightSecContainer: '#CEE5FF',
      lightOnSecContainer: '#001D32',
      lightIconBorder: '#708090',
      lightIconLetters: '#00658B',
      lightIconBg: '#F5F9FC',
      darkSurfaces: {
        surface: '#0f1824',
        surfaceDim: '#0b121c',
        surfaceBright: '#1c2838',
        surfaceContainerLowest: '#080d14',
        surfaceContainerLow: '#131f2e',
        surfaceContainer: '#172637',
        surfaceContainerHigh: '#1e2f44',
        surfaceContainerHighest: '#253952',
        onSurface: '#e2efff',
        onSurfaceVariant: '#8ea3bd',
        outline: '#364f6b',
        outlineVariant: '#1f3248'
      },
      lightSurfaces: {
        surface: '#f5f9fc',
        surfaceDim: '#e8eff5',
        surfaceBright: '#ffffff',
        surfaceContainerLowest: '#ffffff',
        surfaceContainerLow: '#edf4f9',
        surfaceContainer: '#e1ecf4',
        surfaceContainerHigh: '#d6e3ed',
        surfaceContainerHighest: '#cbdae5',
        onSurface: '#151c22',
        onSurfaceVariant: '#4d5d6c',
        outline: '#708090',
        outlineVariant: '#c0d0dd'
      }
    },
    purple: {
      primary: '#cfbcff',
      onPrimary: '#381e72',
      primaryContainer: '#4f378a',
      onPrimaryContainer: '#e9ddff',
      secContainer: '#3b2e52',
      onSecContainer: '#ecdfff',
      iconBorder: '#c084fc',
      iconLetters: '#cfbcff',
      iconBg: '#251a34',
      lightPrimary: '#6B4EA2',
      lightOnPrimary: '#FFFFFF',
      lightPrimaryContainer: '#ECD9FF',
      lightOnPrimaryContainer: '#260058',
      lightSecContainer: '#E9DEF8',
      lightOnSecContainer: '#1F162C',
      lightIconBorder: '#81738D',
      lightIconLetters: '#6B4EA2',
      lightIconBg: '#FAF6FC',
      darkSurfaces: {
        surface: '#181124',
        surfaceDim: '#120d1c',
        surfaceBright: '#271c3a',
        surfaceContainerLowest: '#0d0815',
        surfaceContainerLow: '#1e162d',
        surfaceContainer: '#251c37',
        surfaceContainerHigh: '#2d2243',
        surfaceContainerHighest: '#372a51',
        onSurface: '#f2e8ff',
        onSurfaceVariant: '#a493be',
        outline: '#4f3c6d',
        outlineVariant: '#2b1f40'
      },
      lightSurfaces: {
        surface: '#faf6fc',
        surfaceDim: '#ede6f2',
        surfaceBright: '#ffffff',
        surfaceContainerLowest: '#ffffff',
        surfaceContainerLow: '#f4ecf7',
        surfaceContainer: '#e9e0ed',
        surfaceContainerHigh: '#dfd5e4',
        surfaceContainerHighest: '#d4c9da',
        onSurface: '#1c1622',
        onSurfaceVariant: '#5d5069',
        outline: '#81738d',
        outlineVariant: '#cac0d0'
      }
    },
    amber: {
      primary: '#ffb77c',
      onPrimary: '#4d2600',
      primaryContainer: '#6c3a00',
      onPrimaryContainer: '#ffdcbe',
      secContainer: '#4a3220',
      onSecContainer: '#ffdfcc',
      iconBorder: '#fb923c',
      iconLetters: '#ffb77c',
      iconBg: '#2e1e14',
      lightPrimary: '#8B5000',
      lightOnPrimary: '#FFFFFF',
      lightPrimaryContainer: '#FFDCBE',
      lightOnPrimaryContainer: '#2C1600',
      lightSecContainer: '#FFDCBE',
      lightOnSecContainer: '#2A1800',
      lightIconBorder: '#8C7B70',
      lightIconLetters: '#8B5000',
      lightIconBg: '#FCF7F3',
      darkSurfaces: {
        surface: '#1a130e',
        surfaceDim: '#130e09',
        surfaceBright: '#2c2017',
        surfaceContainerLowest: '#0e0905',
        surfaceContainerLow: '#201811',
        surfaceContainer: '#291f16',
        surfaceContainerHigh: '#33271c',
        surfaceContainerHighest: '#3d2f22',
        onSurface: '#fff1e6',
        onSurfaceVariant: '#b59e8b',
        outline: '#624a35',
        outlineVariant: '#36281b'
      },
      lightSurfaces: {
        surface: '#fcf7f3',
        surfaceDim: '#f0e8e0',
        surfaceBright: '#ffffff',
        surfaceContainerLowest: '#ffffff',
        surfaceContainerLow: '#f7efe7',
        surfaceContainer: '#ede3d9',
        surfaceContainerHigh: '#e3d8cc',
        surfaceContainerHighest: '#d9ccbf',
        onSurface: '#221a15',
        onSurfaceVariant: '#68594e',
        outline: '#8c7b70',
        outlineVariant: '#cfc1b2'
      }
    },
    rose: {
      primary: '#ffb0cd',
      onPrimary: '#54112e',
      primaryContainer: '#722745',
      onPrimaryContainer: '#ffd9e4',
      secContainer: '#4c2536',
      onSecContainer: '#ffd9e4',
      iconBorder: '#f472b6',
      iconLetters: '#ffb0cd',
      iconBg: '#2f1722',
      lightPrimary: '#9A4060',
      lightOnPrimary: '#FFFFFF',
      lightPrimaryContainer: '#FFD9E2',
      lightOnPrimaryContainer: '#3E001D',
      lightSecContainer: '#FFD9E2',
      lightOnSecContainer: '#3E001D',
      lightIconBorder: '#8A737E',
      lightIconLetters: '#9A4060',
      lightIconBg: '#FCF5F7',
      darkSurfaces: {
        surface: '#1a1015',
        surfaceDim: '#140a0f',
        surfaceBright: '#2c1b24',
        surfaceContainerLowest: '#0f070b',
        surfaceContainerLow: '#21141b',
        surfaceContainer: '#2a1923',
        surfaceContainerHigh: '#34202c',
        surfaceContainerHighest: '#402737',
        onSurface: '#ffeaf2',
        onSurfaceVariant: '#b58fa0',
        outline: '#61394e',
        outlineVariant: '#351e2b'
      },
      lightSurfaces: {
        surface: '#fcf5f7',
        surfaceDim: '#f2e6ea',
        surfaceContainerLowest: '#ffffff',
        surfaceContainerLow: '#f8edf0',
        surfaceContainer: '#ede0e5',
        surfaceContainerHigh: '#e3d4da',
        surfaceContainerHighest: '#d8c7ce',
        onSurface: '#22161c',
        onSurfaceVariant: '#67515b',
        outline: '#8a737e',
        outlineVariant: '#ccb9c1'
      }
    }
  };

  const colorSwatches = document.querySelectorAll('.color-swatch');
  const customColorPicker = document.getElementById('customColorPicker');
  const customSwatchLabel = document.querySelector('.color-swatch-custom');

  function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    return [
      parseInt(clean.slice(0, 2), 16) || 0,
      parseInt(clean.slice(2, 4), 16) || 0,
      parseInt(clean.slice(4, 6), 16) || 0
    ];
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h * 360, s, l];
  }

  function hslToRgb(h, s, l) {
    h /= 360;
    if (s === 0) {
      const v = Math.round(l * 255);
      return [v, v, v];
    }
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
    const g = Math.round(hue2rgb(p, q, h) * 255);
    const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
    return [r, g, b];
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => Math.min(255, Math.max(0, Math.round(x))).toString(16).padStart(2, '0')).join('');
  }

  function blendColors(baseRgb, tintRgb, factor) {
    return '#' + [0, 1, 2].map(i => {
      const v = Math.round(baseRgb[i] * (1 - factor) + tintRgb[i] * factor);
      return Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0');
    }).join('');
  }

  function applyAccentPalette(name, customHex = null) {
    const root = document.documentElement;
    const isLight = root.getAttribute('data-theme') === 'light';

    if (name === 'custom' && customHex) {
      const rgb = hexToRgb(customHex);
      const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
      const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);

      // Adaptive text and icon colors:
      // When the chosen color is dark on a dark background, we automatically calculate a
      // bright high-contrast tone (Tone 80 / lightness ~78% or white) so icons, active tabs,
      // badges and labels remain crisp and readable.
      let fgHex = customHex;
      let fgRgb = rgb;
      let secContainerBg = '';

      if (!isLight) {
        if (luminance < 0.55 || l < 0.55) {
          if (s < 0.12) {
            // Near black/monochrome: clean crisp white
            fgRgb = [242, 245, 250];
          } else {
            // Chromatic: boost lightness to 78% for clear visibility on dark background
            fgRgb = hslToRgb(h, Math.min(s, 0.72), 0.78);
          }
          fgHex = rgbToHex(fgRgb[0], fgRgb[1], fgRgb[2]);
          secContainerBg = `rgba(${fgRgb[0]}, ${fgRgb[1]}, ${fgRgb[2]}, 0.18)`;
        } else {
          secContainerBg = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.22)`;
        }
      } else {
        if (luminance > 0.65 || l > 0.65) {
          if (s < 0.12) {
            fgRgb = [30, 30, 35];
          } else {
            fgRgb = hslToRgb(h, Math.max(s, 0.6), 0.32);
          }
          fgHex = rgbToHex(fgRgb[0], fgRgb[1], fgRgb[2]);
          secContainerBg = `rgba(${fgRgb[0]}, ${fgRgb[1]}, ${fgRgb[2]}, 0.14)`;
        } else {
          secContainerBg = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.14)`;
        }
      }

      const fgLuminance = (0.299 * fgRgb[0] + 0.587 * fgRgb[1] + 0.114 * fgRgb[2]) / 255;
      const onPrimary = fgLuminance > 0.5 ? '#121212' : '#ffffff';

      root.style.setProperty('--md-sys-color-primary', fgHex);
      root.style.setProperty('--md-sys-color-on-primary', onPrimary);
      root.style.setProperty('--md-sys-color-primary-container', blendColors([40, 40, 40], rgb, 0.4));
      root.style.setProperty('--md-sys-color-on-primary-container', fgHex);
      root.style.setProperty('--md-sys-color-secondary-container', secContainerBg);
      root.style.setProperty('--md-sys-color-on-secondary-container', fgHex);
      root.style.setProperty('--md-sys-color-accent-text-icon', fgHex);
      root.style.setProperty('--ml-icon-border', fgHex);
      root.style.setProperty('--ml-icon-letters', fgHex);
      root.style.setProperty('--ml-icon-bg', blendColors([20, 20, 20], rgb, 0.25));

      // Dynamic surface generation from custom hex
      if (isLight) {
        root.style.setProperty('--md-sys-color-surface', blendColors([250, 250, 250], rgb, 0.05));
        root.style.setProperty('--md-sys-color-surface-dim', blendColors([235, 235, 235], rgb, 0.08));
        root.style.setProperty('--md-sys-color-surface-bright', '#ffffff');
        root.style.setProperty('--md-sys-color-surface-container-lowest', '#ffffff');
        root.style.setProperty('--md-sys-color-surface-container-low', blendColors([245, 245, 245], rgb, 0.07));
        root.style.setProperty('--md-sys-color-surface-container', blendColors([238, 238, 238], rgb, 0.10));
        root.style.setProperty('--md-sys-color-surface-container-high', blendColors([230, 230, 230], rgb, 0.13));
        root.style.setProperty('--md-sys-color-surface-container-highest', blendColors([220, 220, 220], rgb, 0.16));
        root.style.setProperty('--md-sys-color-on-surface', blendColors([25, 25, 25], rgb, 0.15));
        root.style.setProperty('--md-sys-color-on-surface-variant', blendColors([90, 90, 90], rgb, 0.2));
        root.style.setProperty('--md-sys-color-outline', blendColors([130, 130, 130], rgb, 0.25));
        root.style.setProperty('--md-sys-color-outline-variant', blendColors([200, 200, 200], rgb, 0.25));
      } else {
        root.style.setProperty('--md-sys-color-surface', blendColors([14, 14, 14], rgb, 0.12));
        root.style.setProperty('--md-sys-color-surface-dim', blendColors([10, 10, 10], rgb, 0.10));
        root.style.setProperty('--md-sys-color-surface-bright', blendColors([24, 24, 24], rgb, 0.16));
        root.style.setProperty('--md-sys-color-surface-container-lowest', blendColors([8, 8, 8], rgb, 0.08));
        root.style.setProperty('--md-sys-color-surface-container-low', blendColors([18, 18, 18], rgb, 0.14));
        root.style.setProperty('--md-sys-color-surface-container', blendColors([24, 24, 24], rgb, 0.18));
        root.style.setProperty('--md-sys-color-surface-container-high', blendColors([30, 30, 30], rgb, 0.22));
        root.style.setProperty('--md-sys-color-surface-container-highest', blendColors([38, 38, 38], rgb, 0.26));
        root.style.setProperty('--md-sys-color-on-surface', blendColors([235, 235, 235], rgb, 0.12));
        root.style.setProperty('--md-sys-color-on-surface-variant', blendColors([140, 140, 140], rgb, 0.22));
        root.style.setProperty('--md-sys-color-outline', blendColors([60, 60, 60], rgb, 0.3));
        root.style.setProperty('--md-sys-color-outline-variant', blendColors([36, 36, 36], rgb, 0.3));
      }

      localStorage.setItem('launcher_accent', 'custom');
      localStorage.setItem('launcher_accent_custom', customHex);
      return;
    }

    const palette = ACCENT_PALETTES[name] || ACCENT_PALETTES.lavender;
    if (isLight) {
      root.style.setProperty('--md-sys-color-primary', palette.lightPrimary || '#6750A4');
      root.style.setProperty('--md-sys-color-on-primary', palette.lightOnPrimary || '#ffffff');
      root.style.setProperty('--md-sys-color-primary-container', palette.lightPrimaryContainer || '#EADDFF');
      root.style.setProperty('--md-sys-color-on-primary-container', palette.lightOnPrimaryContainer || '#21005D');
      root.style.setProperty('--md-sys-color-secondary-container', palette.lightSecContainer || '#E8DEF8');
      root.style.setProperty('--md-sys-color-on-secondary-container', palette.lightOnSecContainer || '#1D192B');
      root.style.setProperty('--md-sys-color-accent-text-icon', palette.lightPrimary || '#6750A4');
      root.style.setProperty('--ml-icon-border', palette.lightIconBorder || '#79747E');
      root.style.setProperty('--ml-icon-letters', palette.lightIconLetters || '#6750A4');
      root.style.setProperty('--ml-icon-bg', palette.lightIconBg || '#FEF7FF');
    } else {
      root.style.setProperty('--md-sys-color-primary', palette.primary);
      root.style.setProperty('--md-sys-color-on-primary', palette.onPrimary);
      root.style.setProperty('--md-sys-color-primary-container', palette.primaryContainer);
      root.style.setProperty('--md-sys-color-on-primary-container', palette.onPrimaryContainer);
      root.style.setProperty('--md-sys-color-secondary-container', palette.secContainer);
      root.style.setProperty('--md-sys-color-on-secondary-container', palette.onSecContainer);
      root.style.setProperty('--md-sys-color-accent-text-icon', palette.primary);
      root.style.setProperty('--ml-icon-border', palette.iconBorder);
      root.style.setProperty('--ml-icon-letters', palette.iconLetters);
      root.style.setProperty('--ml-icon-bg', palette.iconBg);
    }

    // Apply Material You tinted surfaces (backgrounds)
    const surfaces = isLight ? palette.lightSurfaces : palette.darkSurfaces;
    if (surfaces) {
      root.style.setProperty('--md-sys-color-surface', surfaces.surface);
      root.style.setProperty('--md-sys-color-surface-dim', surfaces.surfaceDim);
      root.style.setProperty('--md-sys-color-surface-bright', surfaces.surfaceBright);
      root.style.setProperty('--md-sys-color-surface-container-lowest', surfaces.surfaceContainerLowest);
      root.style.setProperty('--md-sys-color-surface-container-low', surfaces.surfaceContainerLow);
      root.style.setProperty('--md-sys-color-surface-container', surfaces.surfaceContainer);
      root.style.setProperty('--md-sys-color-surface-container-high', surfaces.surfaceContainerHigh);
      root.style.setProperty('--md-sys-color-surface-container-highest', surfaces.surfaceContainerHighest);
      root.style.setProperty('--md-sys-color-on-surface', surfaces.onSurface);
      root.style.setProperty('--md-sys-color-on-surface-variant', surfaces.onSurfaceVariant);
      root.style.setProperty('--md-sys-color-outline', surfaces.outline);
      root.style.setProperty('--md-sys-color-outline-variant', surfaces.outlineVariant);
    }

    localStorage.setItem('launcher_accent', name);
  }

  // Restore saved theme before applying accent colors so isLight is immediately accurate
  const savedTheme = localStorage.getItem('launcher_theme') || 'dark';
  htmlEl.setAttribute('data-theme', savedTheme);
  updateThemeUI(savedTheme);

  // Restore saved accent color (default to lavender with #1D1B20 / #79747E / #EADDFF)
  let savedAccent = localStorage.getItem('launcher_accent');
  if (!savedAccent || savedAccent === 'emerald' || savedAccent === 'purple') {
    savedAccent = 'lavender';
    localStorage.setItem('launcher_accent', 'lavender');
  }
  if (savedAccent === 'custom') {
    const customVal = localStorage.getItem('launcher_accent_custom') || '#EADDFF';
    if (customColorPicker) customColorPicker.value = customVal;
    applyAccentPalette('custom', customVal);
    colorSwatches.forEach(s => s.classList.remove('active'));
    customSwatchLabel?.classList.add('active');
  } else {
    applyAccentPalette(savedAccent);
    colorSwatches.forEach(s => {
      if (s.getAttribute('data-color') === savedAccent) {
        s.classList.add('active');
      } else {
        s.classList.remove('active');
      }
    });
  }

  // Preset Swatch click handlers
  colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      colorSwatches.forEach(s => s.classList.remove('active'));
      customSwatchLabel?.classList.remove('active');
      swatch.classList.add('active');

      const colorName = swatch.getAttribute('data-color');
      applyAccentPalette(colorName);
      appConfig.accentColor = colorName;
      saveConfig();
    });
  });

  // Custom Color Picker input & change handlers
  const onCustomColorUpdate = (val) => {
    colorSwatches.forEach(s => s.classList.remove('active'));
    customSwatchLabel?.classList.add('active');
    applyAccentPalette('custom', val);
    appConfig.accentColor = 'custom';
    appConfig.customAccentHex = val;
    saveConfig();
  };

  customColorPicker?.addEventListener('input', (e) => {
    onCustomColorUpdate(e.target.value);
  });
  customColorPicker?.addEventListener('change', (e) => {
    onCustomColorUpdate(e.target.value);
  });

  themeToggleBtn?.addEventListener('click', () => {
    const currentTheme = htmlEl.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    htmlEl.setAttribute('data-theme', newTheme);
    localStorage.setItem('launcher_theme', newTheme);
    appConfig.theme = newTheme;
    saveConfig();
    updateThemeUI(newTheme);

    // Re-apply current accent surfaces for the new light/dark theme
    const activeAccent = localStorage.getItem('launcher_accent') || 'lavender';
    if (activeAccent === 'custom') {
      applyAccentPalette('custom', localStorage.getItem('launcher_accent_custom'));
    } else {
      applyAccentPalette(activeAccent);
    }
  });

  function updateThemeUI(theme) {
    if (!themeLabel) return;
    const t = (k, fb) => (window.I18N ? window.I18N.t(k, fb) : fb);
    if (theme === 'dark') {
      themeLabel.textContent = t('theme_light', 'Light mode');
      if (themeToggleIcon) {
        themeToggleIcon.innerHTML = `<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>`;
      }
    } else {
      themeLabel.textContent = t('theme_dark', 'Dark mode');
      if (themeToggleIcon) {
        themeToggleIcon.innerHTML = `<path d="M12.3 2a10 10 0 0 0-.19 20 10 10 0 0 0 8.35-4.52.75.75 0 0 0-.64-1.16 8 8 0 1 1-8.68-13.68.75.75 0 0 0 .16-1.48A9.87 9.87 0 0 0 12.3 2z"/>`;
      }
    }
  }

  // 4. Real Version Selector & Manifest Loader
  const versionSelectorWidget = document.getElementById('versionSelectorWidget');
  const versionModal = document.getElementById('versionModal');
  const closeVersionModalBtn = document.getElementById('closeVersionModalBtn');
  const versionListContainer = document.getElementById('versionListContainer');
  const versionSearchInput = document.getElementById('versionSearchInput');
  const versionTypeChips = document.querySelectorAll('.version-type-chip');
  const currentVersionText = document.getElementById('currentVersionText');
  const launchVersionTitle = document.getElementById('launchVersionTitle');
  const versionSelectorLabel = document.querySelector('.version-selector-widget .version-label');

  let manifestData = null;
  let allVersions = [];
  let selectedVersionType = 'release';
  let activeVersionFilter = 'release';
  let selectedVersion = localStorage.getItem('minecraft_version') || '26.1.2';

  // Load versions from electronAPI
  async function loadVersions() {
    try {
      if (window.electronAPI?.getVersions) {
        manifestData = await window.electronAPI.getVersions();
        if (manifestData?.versions) {
          allVersions = manifestData.versions;
        }
      }
    } catch (e) {
      console.warn('Could not load version manifest via IPC:', e);
    }

    if (!allVersions.length) {
      // Fallback version list
      allVersions = [
        { id: '26.1.2', type: 'release', releaseTime: '2024-12-10' },
        { id: '1.21.4', type: 'release', releaseTime: '2024-12-03' },
        { id: '1.21.3', type: 'release', releaseTime: '2024-10-23' },
        { id: '1.20.4', type: 'release', releaseTime: '2023-12-07' },
        { id: '1.16.5', type: 'release', releaseTime: '2021-01-15' },
        { id: '1.12.2', type: 'release', releaseTime: '2017-09-18' },
        { id: '1.8.9', type: 'release', releaseTime: '2015-12-09' }
      ];
    }

    renderVersionsList();
    applyVersion(selectedVersion);
  }

  function formatLocalDate(timestampOrDateStr) {
    if (!timestampOrDateStr) return '';
    try {
      const d = new Date(timestampOrDateStr);
      if (isNaN(d.getTime())) return '';
      const currentLang = window.I18N ? window.I18N.getCurrentLang() : 'en_US';
      const bcp47 = (currentLang || 'en_US').replace('_', '-');
      return d.toLocaleDateString(bcp47, { year: 'numeric', month: 'short' });
    } catch (e) {
      return '';
    }
  }

  function renderVersionsList() {
    if (!versionListContainer) return;
    const search = (versionSearchInput?.value || '').toLowerCase().trim();
    const t = (k, fb) => (window.I18N ? window.I18N.t(k, fb) : fb);

    // 1. Custom instances tab (created in Mods view)
    if (activeVersionFilter === 'custom') {
      const instances = Array.isArray(appConfig.instances) ? appConfig.instances : [];
      const filteredInst = instances.filter(i => {
        if (!search) return true;
        return (i.name || '').toLowerCase().includes(search) ||
               (i.gameVersion || '').toLowerCase().includes(search) ||
               (i.loader || '').toLowerCase().includes(search);
      });

      if (filteredInst.length === 0) {
        if (instances.length === 0) {
          const noCustomMsg = t('modal_version_no_custom', 'No custom builds created yet.');
          const btnCreateMsg = t('modal_version_btn_create', 'Create a build in "Mods" tab');
          versionListContainer.innerHTML = `
            <div class="version-loading-placeholder">
              <span>${noCustomMsg}</span>
              <button class="version-create-shortcut-btn" id="btnVersionModalGoCreate">
                <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                <span>${btnCreateMsg}</span>
              </button>
            </div>
          `;
          document.getElementById('btnVersionModalGoCreate')?.addEventListener('click', () => {
            versionModal?.classList.remove('open');
            const modsNav = document.querySelector('.nav-item[data-tab="mods"]');
            modsNav?.click();
          });
        } else {
          versionListContainer.innerHTML = `<div class="version-loading-placeholder">${t('modal_version_not_found', 'No versions found')}</div>`;
        }
        return;
      }

      const activeText = t('version_card_active', '● Active');
      const noModsText = t('version_card_no_mods', 'No mods');
      const modsCountTpl = t('version_card_mods_count', '{count} mods');

      versionListContainer.innerHTML = filteredInst.map(inst => {
        const isSelected = appConfig.selectedInstanceId === inst.id;
        const loaderName = (inst.loader || 'fabric').toUpperCase();
        const providerName = inst.modProvider === 'curseforge' ? 'CurseForge' : 'Modrinth';
        const modsCount = (inst.mods || []).length;
        const dateStr = formatLocalDate(inst.created);
        const modsLabel = modsCount > 0 ? modsCountTpl.replace('{count}', modsCount) : noModsText;

        return `
          <div class="version-option version-option-custom ${isSelected ? 'active' : ''}" data-instance-id="${escapeHtml(inst.id)}">
            <div class="version-opt-left">
              <span class="version-opt-name">${escapeHtml(inst.name)}</span>
              <span class="version-opt-tag version-opt-tag-custom">${escapeHtml(loaderName)} ${escapeHtml(inst.gameVersion)}</span>
              <span class="version-opt-tag version-opt-tag-provider">${escapeHtml(providerName)}</span>
              <span class="version-opt-tag ${modsCount > 0 ? 'version-opt-tag-mods' : ''}">${escapeHtml(modsLabel)}</span>
            </div>
            <div class="version-opt-right">
              ${dateStr ? `<span class="version-opt-date">${escapeHtml(dateStr)}</span>` : ''}
            </div>
          </div>
        `;
      }).join('');

      versionListContainer.querySelectorAll('.version-option-custom').forEach(opt => {
        opt.addEventListener('click', () => {
          const instId = opt.getAttribute('data-instance-id');
          if (instId) {
            selectInstance(instId);
            versionModal?.classList.remove('open');
          }
        });
      });
      return;
    }

    // 2. Regular Mojang release / snapshot list
    let filtered = allVersions.filter(v => {
      if (activeVersionFilter === 'release' && v.type !== 'release') return false;
      if (activeVersionFilter === 'snapshot' && v.type !== 'snapshot') return false;
      if (search && !v.id.toLowerCase().includes(search)) return false;
      return true;
    });

    // Render all matching versions from 1.0 to the newest release without artificial cutoffs
    const toRender = filtered;

    if (toRender.length === 0) {
      versionListContainer.innerHTML = `<div class="version-loading-placeholder">${t('modal_version_not_found', 'No versions found')}</div>`;
      return;
    }

    const latestRelease = manifestData?.latest?.release;
    const latestSnapshot = manifestData?.latest?.snapshot;
    const labelLatestRelease = t('label_latest_release', 'Latest Release');
    const labelSnapshot = t('label_snapshot', 'Snapshot');
    const labelRelease = t('label_release', 'Release');

    versionListContainer.innerHTML = toRender.map(v => {
      const isActive = !appConfig.selectedInstanceId && v.id === selectedVersion;
      let tagText = '';
      if (v.id === latestRelease) {
        tagText = labelLatestRelease;
      } else if (v.id === latestSnapshot || v.type === 'snapshot') {
        tagText = labelSnapshot;
      }

      const dateStr = formatLocalDate(v.releaseTime);

      return `
        <div class="version-option ${isActive ? 'active' : ''}" data-version="${escapeHtml(v.id)}" data-type="${escapeHtml(v.type)}">
          <div class="version-opt-left">
            <span class="version-opt-name">${escapeHtml(v.id)}</span>
            ${tagText ? `<span class="version-opt-tag">${escapeHtml(tagText)}</span>` : ''}
          </div>
          ${dateStr ? `<span class="version-opt-date">${escapeHtml(dateStr)}</span>` : ''}
        </div>
      `;
    }).join('');

    // Attach click events
    versionListContainer.querySelectorAll('.version-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const ver = opt.getAttribute('data-version');
        const vtype = opt.getAttribute('data-type') || 'release';
        if (ver) {
          selectVanillaVersion(ver, vtype);
          versionModal?.classList.remove('open');
        }
      });
    });
  }

  function getActiveInstance() {
    if (!Array.isArray(appConfig.instances) || appConfig.instances.length === 0) {
      return null;
    }
    if (!appConfig.selectedInstanceId) {
      return null;
    }
    let inst = appConfig.instances.find(i => i.id === appConfig.selectedInstanceId);
    if (!inst) {
      return null;
    }
    if (!Array.isArray(inst.mods)) inst.mods = [];
    return inst;
  }

  function selectInstance(instanceId) {
    if (!Array.isArray(appConfig.instances)) appConfig.instances = [];
    const inst = appConfig.instances.find(i => i.id === instanceId);
    if (!inst) return;

    appConfig.selectedInstanceId = inst.id;
    appConfig.selectedVersion = inst.gameVersion;
    appConfig.selectedVersionType = inst.loader || 'custom';
    selectedVersion = inst.gameVersion;
    selectedVersionType = inst.loader || 'custom';
    localStorage.setItem('minecraft_version', inst.gameVersion);
    localStorage.setItem('minecraft_version_type', inst.loader || 'custom');
    saveConfig();

    applyVersion(inst.gameVersion, inst.loader || 'custom');
    updateInstancesUI();
    renderVersionsList();
  }

  function selectVanillaVersion(ver, type) {
    appConfig.selectedInstanceId = null;
    selectedVersion = ver;
    selectedVersionType = type || 'release';
    appConfig.selectedVersion = ver;
    appConfig.selectedVersionType = selectedVersionType;
    localStorage.setItem('minecraft_version', ver);
    localStorage.setItem('minecraft_version_type', selectedVersionType);
    saveConfig();

    applyVersion(ver, selectedVersionType);
    updateInstancesUI();
    renderVersionsList();
  }

  function applyVersion(ver, type) {
    const t = (k, fb) => (window.I18N ? window.I18N.t(k, fb) : fb);
    const inst = appConfig.selectedInstanceId ? getActiveInstance() : null;

    if (currentVersionText) {
      currentVersionText.innerHTML = `${escapeHtml(ver)} <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>`;
    }
    if (launchVersionTitle && isLaunching) {
      // Keep download progress or leave clear
    } else if (launchVersionTitle) {
      launchVersionTitle.textContent = '';
    }
    if (versionSelectorLabel) {
      if (inst) {
        versionSelectorLabel.textContent = (inst.loader || 'Fabric').toUpperCase();
      } else {
        const isLatest = manifestData?.latest?.release === ver;
        if (isLatest) {
          versionSelectorLabel.textContent = t('label_latest_release', 'Latest Release');
        } else if (type === 'snapshot' || ver.includes('snapshot') || ver.includes('w')) {
          versionSelectorLabel.textContent = t('label_snapshot', 'Snapshot');
        } else {
          versionSelectorLabel.textContent = t('label_release', 'Release');
        }
      }
    }
  }

  versionSelectorWidget?.addEventListener('click', () => {
    versionModal?.classList.add('open');
    if (appConfig.selectedInstanceId) {
      activeVersionFilter = 'custom';
      versionTypeChips.forEach(c => {
        if (c.getAttribute('data-type') === 'custom') c.classList.add('active');
        else c.classList.remove('active');
      });
    } else {
      activeVersionFilter = (selectedVersionType === 'snapshot' || (selectedVersion && (selectedVersion.includes('w') || selectedVersion.includes('snapshot')))) ? 'snapshot' : 'release';
      versionTypeChips.forEach(c => {
        if (c.getAttribute('data-type') === activeVersionFilter) c.classList.add('active');
        else c.classList.remove('active');
      });
    }
    renderVersionsList();
    versionSearchInput?.focus();
  });

  closeVersionModalBtn?.addEventListener('click', () => {
    versionModal?.classList.remove('open');
  });

  versionModal?.addEventListener('click', (e) => {
    if (e.target === versionModal) {
      versionModal.classList.remove('open');
    }
  });

  let versionSearchDebounceTimer = null;
  versionSearchInput?.addEventListener('input', () => {
    clearTimeout(versionSearchDebounceTimer);
    versionSearchDebounceTimer = setTimeout(() => {
      renderVersionsList();
    }, 200);
  });

  versionTypeChips.forEach(chip => {
    chip.addEventListener('click', () => {
      versionTypeChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeVersionFilter = chip.getAttribute('data-type') || 'all';
      renderVersionsList();
    });
  });

  loadVersions();

  // 5. PRISM LAUNCHER SETTINGS & CONFIGURATION ENGINE
  // Sub-Navigation tabs inside Settings
  const settingsNavTabs = document.querySelectorAll('.settings-nav-tab');
  const settingsSubpanes = document.querySelectorAll('.settings-subpane');

  settingsNavTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      settingsNavTabs.forEach(t => t.classList.remove('active'));
      settingsSubpanes.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const sub = tab.getAttribute('data-subtab');
      const pane = document.getElementById(`subpane-${sub}`);
      if (pane) pane.classList.add('active');
    });
  });

  // Java Sub-Navigation (General vs Installations)
  const javaSubnavBtns = document.querySelectorAll('.java-subnav-btn');
  const javaSubpanes = document.querySelectorAll('.java-subpane-view');

  javaSubnavBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      javaSubnavBtns.forEach(b => b.classList.remove('active'));
      javaSubpanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const sub = btn.getAttribute('data-javasub');
      const pane = document.getElementById(`javasub-${sub}`);
      if (pane) pane.classList.add('active');
    });
  });

  // App Configuration State
  let appConfig = {
    accounts: [
      { type: 'offline', name: 'Player', uuid: 'offline_Player', active: true }
    ],
    selectedVersion: '26.1.2',
    selectedVersionType: 'release',
    fullscreen: false,
    windowWidth: 854,
    windowHeight: 480,
    hideLauncherOnLaunch: false,
    closeLauncherOnExit: false,
    showConsoleOnLaunch: false,
    showConsoleOnError: true,
    autoCloseConsole: false,
    autoJavaSwitch: true,
    manualJavaPath: '',
    skipJavaCheck: false,
    skipPromptCheck: false,
    autoDownloadMojangJava: true,
    minRam: 512,
    maxRam: 4096,
    permGen: 128,
    warnLowMemory: true,
    jvmArgs: '',
    language: 'ru_RU',
    theme: 'dark',
    accentColor: 'lavender',
    customAccentHex: '#EADDFF'
  };

  // DOM Elements - Settings Controls
  const mcFullscreenCheck = document.getElementById('mcFullscreenCheck');
  const mcWinWidthInput = document.getElementById('mcWinWidthInput');
  const mcWinHeightInput = document.getElementById('mcWinHeightInput');
  const mcHideLauncherCheck = document.getElementById('mcHideLauncherCheck');
  const mcCloseLauncherCheck = document.getElementById('mcCloseLauncherCheck');
  const mcShowConsoleLaunchCheck = document.getElementById('mcShowConsoleLaunchCheck');
  const mcShowConsoleErrorCheck = document.getElementById('mcShowConsoleErrorCheck');
  const mcHideConsoleExitCheck = document.getElementById('mcHideConsoleExitCheck');
  const btnOpenConsoleNow = document.getElementById('btnOpenConsoleNow');
  const mcCustomPathInput = document.getElementById('mcCustomPathInput');
  const btnBrowseMcPath = document.getElementById('btnBrowseMcPath');
  const btnOpenMcPath = document.getElementById('btnOpenMcPath');
  const btnResetMcPath = document.getElementById('btnResetMcPath');

  const javaPathInput = document.getElementById('javaPathInput');
  const btnFindJava = document.getElementById('btnFindJava');
  const btnBrowseJava = document.getElementById('btnBrowseJava');
  const javaSkipCheck = document.getElementById('javaSkipCheck');
  const javaSkipPromptCheck = document.getElementById('javaSkipPromptCheck');
  const javaAutoDetectCheck = document.getElementById('javaAutoDetectCheck');
  const javaAutoDownloadCheck = document.getElementById('javaAutoDownloadCheck');
  const btnTestJavaSettings = document.getElementById('btnTestJavaSettings');
  const javaTestStatus = document.getElementById('javaTestStatus');
  const javaMinRamInput = document.getElementById('javaMinRamInput');
  const javaMaxRamInput = document.getElementById('javaMaxRamInput');
  const javaPermGenInput = document.getElementById('javaPermGenInput');
  const javaWarnMemoryCheck = document.getElementById('javaWarnMemoryCheck');
  const javaArgsInput = document.getElementById('javaArgsInput');

  const btnSelectJavaActive = document.getElementById('btnSelectJavaActive');
  const btnRefreshJava = document.getElementById('btnRefreshJava');
  const javaTableBody = document.getElementById('javaTableBody');

  const accountsTableBody = document.getElementById('accountsTableBody');
  const btnAccAddMicrosoft = document.getElementById('btnAccAddMicrosoft');
  const btnAccAddElyBy = document.getElementById('btnAccAddElyBy');
  const btnAccAddOffline = document.getElementById('btnAccAddOffline');
  const btnAccDelete = document.getElementById('btnAccDelete');

  // Ely.by Modal
  const elyModal = document.getElementById('elyModal');
  const btnCloseElyModal = document.getElementById('btnCloseElyModal');
  const elyLoginUserInput = document.getElementById('elyLoginUserInput');
  const elyLoginPasswordInput = document.getElementById('elyLoginPasswordInput');
  const elyStatusMsg = document.getElementById('elyStatusMsg');
  const linkElyRegister = document.getElementById('linkElyRegister');
  const btnCancelElyLogin = document.getElementById('btnCancelElyLogin');
  const btnConfirmElyLogin = document.getElementById('btnConfirmElyLogin');

  // Auth Modal
  const authModal = document.getElementById('authModal');
  const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
  const modalAccountsList = document.getElementById('modalAccountsList');
  const btnToggleAddAccountInModal = document.getElementById('btnToggleAddAccountInModal');
  const modalAddOptions = document.getElementById('modalAddOptions');
  const msLoginBtn = document.getElementById('msLoginBtn');
  const modalElyLoginBtn = document.getElementById('modalElyLoginBtn');
  const modalBtnAddOfflineChoice = document.getElementById('modalBtnAddOfflineChoice');

  // Flathub compliance: hide third-party / offline auth if running in Flatpak
  if (window.electronAPI?.isFlatpak) {
    if (btnAccAddElyBy) btnAccAddElyBy.style.display = 'none';
    if (btnAccAddOffline) btnAccAddOffline.style.display = 'none';
    if (modalElyLoginBtn) modalElyLoginBtn.style.display = 'none';
    if (modalBtnAddOfflineChoice) modalBtnAddOfflineChoice.style.display = 'none';
  }

  // Console Modal
  const consoleModal = document.getElementById('consoleModal');
  const btnCloseConsoleModal = document.getElementById('btnCloseConsoleModal');
  const btnCopyConsole = document.getElementById('btnCopyConsole');
  const btnClearConsole = document.getElementById('btnClearConsole');
  const consoleOutputText = document.getElementById('consoleOutputText');

  // Add Offline Modal
  const addOfflineModal = document.getElementById('addOfflineModal');
  const btnCloseAddOfflineModal = document.getElementById('btnCloseAddOfflineModal');
  const newOfflineNicknameInput = document.getElementById('newOfflineNicknameInput');
  const btnCancelAddOffline = document.getElementById('btnCancelAddOffline');
  const btnConfirmAddOffline = document.getElementById('btnConfirmAddOffline');

  // Sidebar profile
  const profileCard = document.getElementById('profileCard');
  const profileUsername = document.getElementById('profileUsername');
  const profileAccountType = document.getElementById('profileAccountType');
  const userAvatarBox = document.getElementById('userAvatarBox') || document.getElementById('userAvatarImg');

  // Languages Grid
  const languagesGrid = document.getElementById('languagesGrid');

  let installedJavasList = [];
  let selectedJavaRowIndex = -1;
  let selectedAccountRowIndex = -1;

  function collectConfigFromUI() {
    if (mcCustomPathInput) appConfig.minecraftPath = mcCustomPathInput.value.trim();
    if (mcFullscreenCheck) appConfig.fullscreen = mcFullscreenCheck.checked;
    if (mcWinWidthInput) appConfig.windowWidth = parseInt(mcWinWidthInput.value, 10) || 854;
    if (mcWinHeightInput) appConfig.windowHeight = parseInt(mcWinHeightInput.value, 10) || 480;
    if (mcHideLauncherCheck) appConfig.hideLauncherOnLaunch = mcHideLauncherCheck.checked;
    if (mcCloseLauncherCheck) appConfig.closeLauncherOnExit = mcCloseLauncherCheck.checked;

    if (mcShowConsoleLaunchCheck) appConfig.showConsoleOnLaunch = mcShowConsoleLaunchCheck.checked;
    if (mcShowConsoleErrorCheck) appConfig.showConsoleOnError = mcShowConsoleErrorCheck.checked;
    if (mcHideConsoleExitCheck) appConfig.autoCloseConsole = mcHideConsoleExitCheck.checked;

    if (javaSkipCheck) appConfig.skipJavaCheck = javaSkipCheck.checked;
    if (javaSkipPromptCheck) appConfig.skipPromptCheck = javaSkipPromptCheck.checked;
    if (javaAutoDetectCheck) appConfig.autoJavaSwitch = javaAutoDetectCheck.checked;
    if (javaAutoDownloadCheck) appConfig.autoDownloadMojangJava = javaAutoDownloadCheck.checked;

    if (javaMinRamInput) appConfig.minRam = parseInt(javaMinRamInput.value, 10) || 512;
    if (javaMaxRamInput) appConfig.maxRam = parseInt(javaMaxRamInput.value, 10) || 4096;
    if (javaPermGenInput) appConfig.permGen = parseInt(javaPermGenInput.value, 10) || 128;
    if (javaWarnMemoryCheck) appConfig.warnLowMemory = javaWarnMemoryCheck.checked;
    if (javaArgsInput) appConfig.jvmArgs = javaArgsInput.value.trim();

    if (selectedVersion) appConfig.selectedVersion = selectedVersion;
    if (selectedVersionType) appConfig.selectedVersionType = selectedVersionType;

    if (window.I18N?.currentLanguage) appConfig.language = window.I18N.currentLanguage;
    const currentAccent = localStorage.getItem('launcher_accent') || 'lavender';
    appConfig.accentColor = currentAccent;
    if (currentAccent === 'custom') {
      appConfig.customAccentHex = localStorage.getItem('launcher_accent_custom') || '#EADDFF';
    }
  }

  async function saveConfig(showFeedback = false) {
    collectConfigFromUI();
    try {
      localStorage.setItem('material_launcher_config', JSON.stringify(appConfig));
    } catch (e) {}

    if (window.electronAPI?.saveConfig) {
      try {
        await window.electronAPI.saveConfig(appConfig);
      } catch (e) {
        console.error('Failed to save config via IPC:', e);
      }
    }

    if (showFeedback) {
      const successText = window.I18N ? window.I18N.t('settings_saved_success', 'Настройки успешно сохранены!') : 'Настройки успешно сохранены!';
      showSnackbar(successText, 'success');
    }
  }

  function renderLanguagesGrid() {
    if (!languagesGrid || !window.I18N) return;
    languagesGrid.innerHTML = '';

    const currentCode = window.I18N.currentLanguage;

    window.I18N.SUPPORTED_LOCALES.forEach(loc => {
      const card = document.createElement('div');
      card.className = `language-card ${loc.code === currentCode ? 'active' : ''}`;
      card.innerHTML = `
        <span class="language-flag">${loc.flag}</span>
        <div class="language-info">
          <span class="language-native-name">${loc.nativeName}</span>
          <span class="language-code">${loc.name} (${loc.code})</span>
        </div>
      `;

      card.addEventListener('click', async () => {
        if (loc.code === window.I18N.currentLanguage) return;
        await window.I18N.setLanguage(loc.code);
        appConfig.language = loc.code;
        saveConfig();
        renderLanguagesGrid();
        updateSidebarProfile();
        resetPlayButtons();
      });

      languagesGrid.appendChild(card);
    });
  }

  function getActiveAccount() {
    if (!appConfig.accounts || appConfig.accounts.length === 0) {
      return { type: 'offline', name: 'Player', active: true };
    }
    const found = appConfig.accounts.find(a => a.active);
    return found || appConfig.accounts[0];
  }

  function updateSidebarProfile() {
    const acc = getActiveAccount();
    if (profileUsername) profileUsername.textContent = acc.name;
    if (profileAccountType) {
      const t = (k, fb) => (window.I18N ? window.I18N.t(k, fb) : fb);
      if (acc.type === 'mojang' || acc.type === 'microsoft') {
        profileAccountType.textContent = t('sidebar_account_ms', 'Microsoft Account');
      } else if (acc.type === 'elyby') {
        profileAccountType.textContent = t('sidebar_account_ely', 'Ely.by Account');
      } else {
        profileAccountType.textContent = t('sidebar_account_offline', 'Offline Account');
      }
    }

    if (window.LauncherSkin && userAvatarBox) {
      window.LauncherSkin.updateElementAvatar(userAvatarBox, acc.skinUrl, acc.name, 32);
    }
  }

  function renderAccountsTable() {
    if (!accountsTableBody) return;
    accountsTableBody.innerHTML = '';

    appConfig.accounts.forEach((acc, idx) => {
      const tr = document.createElement('tr');
      if (acc.active) {
        selectedAccountRowIndex = idx;
        tr.classList.add('selected');
      } else if (idx === selectedAccountRowIndex) {
        tr.classList.add('selected');
      }

      const isMs = acc.type === 'mojang' || acc.type === 'microsoft';
      const isEly = acc.type === 'elyby';
      let typeLabel = window.I18N ? window.I18N.t('acc_type_offline', 'Автономная') : 'Автономная';
      if (isMs) typeLabel = window.I18N ? window.I18N.t('acc_type_ms', 'Microsoft') : 'Microsoft';
      else if (isEly) typeLabel = window.I18N ? window.I18N.t('acc_type_ely', 'Ely.by') : 'Ely.by';

      const statusText = acc.active
        ? (window.I18N ? window.I18N.t('acc_status_active', 'Активен') : 'Активен')
        : (window.I18N ? window.I18N.t('acc_status_ready', 'Готов') : 'Готов');

      const headHtml = window.LauncherSkin ? window.LauncherSkin.getHeadHtml(acc.skinUrl, acc.name, 24) : '';

      tr.innerHTML = `
        <td style="text-align: center; vertical-align: middle;">
          ${headHtml}
        </td>
        <td style="font-weight: 600;">${escapeHtml(acc.name)}</td>
        <td>${escapeHtml(typeLabel)}</td>
        <td>
          <span class="account-status-badge ${acc.active ? 'account-status-active' : 'account-status-ready'}">
            ${escapeHtml(statusText)}
          </span>
        </td>
      `;

      tr.addEventListener('click', () => {
        selectedAccountRowIndex = idx;
        appConfig.accounts.forEach((a, i) => {
          a.active = (i === idx);
        });
        saveConfig();
        renderAccountsTable();
        updateSidebarProfile();
      });

      tr.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectedAccountRowIndex = idx;
        renderAccountsTable();
        showAccountContextMenu(e.clientX, e.clientY, acc);
      });

      accountsTableBody.appendChild(tr);
    });

    updateSidebarProfile();
  }

  async function loadInstalledJavas() {
    if (!window.electronAPI?.getInstalledJavas) return;
    try {
      installedJavasList = await window.electronAPI.getInstalledJavas();
      renderJavaTable();
    } catch (e) {
      console.warn('Error loading Java runtimes:', e);
    }
  }

  function renderJavaTable() {
    if (!javaTableBody) return;
    javaTableBody.innerHTML = '';

    if (!installedJavasList || installedJavasList.length === 0) {
      const searchingText = window.I18N ? window.I18N.t('java_searching', 'Поиск установленных сред Java...') : 'Поиск установленных сред Java...';
      javaTableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--md-sys-color-on-surface-variant); padding: 16px;">${escapeHtml(searchingText)}</td></tr>`;
      return;
    }

    installedJavasList.forEach((j, idx) => {
      const tr = document.createElement('tr');
      if (idx === selectedJavaRowIndex || (appConfig.manualJavaPath && appConfig.manualJavaPath === j.path)) {
        tr.classList.add('selected');
        if (selectedJavaRowIndex === -1) selectedJavaRowIndex = idx;
      }

      tr.innerHTML = `
        <td style="font-weight: 600;">${escapeHtml(j.version || j.major)}</td>
        <td>${escapeHtml(j.arch || 'amd64')}</td>
        <td style="font-family: monospace; font-size: 11px; word-break: break-all;">${escapeHtml(j.path)}</td>
      `;

      tr.addEventListener('click', () => {
        selectedJavaRowIndex = idx;
        renderJavaTable();
      });

      tr.addEventListener('dblclick', () => {
        selectedJavaRowIndex = idx;
        applySelectedJavaInstallation();
      });

      javaTableBody.appendChild(tr);
    });
  }

  function applySelectedJavaInstallation() {
    if (selectedJavaRowIndex >= 0 && installedJavasList[selectedJavaRowIndex]) {
      const chosen = installedJavasList[selectedJavaRowIndex];
      appConfig.manualJavaPath = chosen.path;
      appConfig.autoJavaSwitch = false;
      if (javaPathInput) javaPathInput.value = chosen.path;
      if (javaAutoDetectCheck) javaAutoDetectCheck.checked = false;
      saveConfig();
      renderJavaTable();
      if (javaTestStatus) {
        javaTestStatus.textContent = (window.I18N ? window.I18N.t('java_selected_status', 'Выбрана Java {version}') : 'Выбрана Java {version}').replace('{version}', chosen.version || chosen.major);
        javaTestStatus.style.color = 'var(--md-sys-color-success)';
      }
    }
  }

  function applyConfigToUI() {
    if (mcCustomPathInput) {
      mcCustomPathInput.value = appConfig.minecraftPath || '';
    }
    if (mcFullscreenCheck) mcFullscreenCheck.checked = !!appConfig.fullscreen;
    if (mcWinWidthInput) mcWinWidthInput.value = appConfig.windowWidth || 854;
    if (mcWinHeightInput) mcWinHeightInput.value = appConfig.windowHeight || 480;
    if (mcHideLauncherCheck) mcHideLauncherCheck.checked = !!appConfig.hideLauncherOnLaunch;
    if (mcCloseLauncherCheck) mcCloseLauncherCheck.checked = !!appConfig.closeLauncherOnExit;

    if (mcShowConsoleLaunchCheck) mcShowConsoleLaunchCheck.checked = !!appConfig.showConsoleOnLaunch;
    if (mcShowConsoleErrorCheck) mcShowConsoleErrorCheck.checked = appConfig.showConsoleOnError !== undefined ? appConfig.showConsoleOnError : true;
    if (mcHideConsoleExitCheck) mcHideConsoleExitCheck.checked = !!appConfig.autoCloseConsole;

    if (javaPathInput) {
      javaPathInput.value = appConfig.manualJavaPath || '';
    }
    if (javaSkipCheck) javaSkipCheck.checked = !!appConfig.skipJavaCheck;
    if (javaSkipPromptCheck) javaSkipPromptCheck.checked = !!appConfig.skipPromptCheck;
    if (javaAutoDetectCheck) javaAutoDetectCheck.checked = appConfig.autoJavaSwitch !== undefined ? appConfig.autoJavaSwitch : true;
    if (javaAutoDownloadCheck) javaAutoDownloadCheck.checked = appConfig.autoDownloadMojangJava !== undefined ? appConfig.autoDownloadMojangJava : true;

    if (javaMinRamInput) javaMinRamInput.value = appConfig.minRam || 512;
    if (javaMaxRamInput) javaMaxRamInput.value = appConfig.maxRam || 4096;
    if (javaPermGenInput) javaPermGenInput.value = appConfig.permGen || 128;
    if (javaWarnMemoryCheck) javaWarnMemoryCheck.checked = appConfig.warnLowMemory !== undefined ? appConfig.warnLowMemory : true;
    if (javaArgsInput) javaArgsInput.value = appConfig.jvmArgs || '';

    if (appConfig.selectedInstanceId) {
      const activeInst = getActiveInstance();
      if (activeInst) {
        selectedVersion = activeInst.gameVersion;
        selectedVersionType = activeInst.loader || 'custom';
        appConfig.selectedVersion = activeInst.gameVersion;
        appConfig.selectedVersionType = selectedVersionType;
        applyVersion(selectedVersion, selectedVersionType);
      }
    } else if (appConfig.selectedVersion) {
      selectedVersion = appConfig.selectedVersion;
      selectedVersionType = appConfig.selectedVersionType || 'release';
      applyVersion(selectedVersion, selectedVersionType);
    }

    renderAccountsTable();
    loadInstalledJavas();
    renderLanguagesGrid();
  }

  // Bind Input Change Handlers
  mcFullscreenCheck?.addEventListener('change', (e) => {
    appConfig.fullscreen = e.target.checked;
    saveConfig();
  });
  mcWinWidthInput?.addEventListener('input', (e) => {
    appConfig.windowWidth = parseInt(e.target.value, 10) || 854;
    saveConfig();
  });
  mcWinHeightInput?.addEventListener('input', (e) => {
    appConfig.windowHeight = parseInt(e.target.value, 10) || 480;
    saveConfig();
  });
  mcHideLauncherCheck?.addEventListener('change', (e) => {
    appConfig.hideLauncherOnLaunch = e.target.checked;
    saveConfig();
  });
  mcCloseLauncherCheck?.addEventListener('change', (e) => {
    appConfig.closeLauncherOnExit = e.target.checked;
    saveConfig();
  });

  mcShowConsoleLaunchCheck?.addEventListener('change', (e) => {
    appConfig.showConsoleOnLaunch = e.target.checked;
    saveConfig();
  });
  mcShowConsoleErrorCheck?.addEventListener('change', (e) => {
    appConfig.showConsoleOnError = e.target.checked;
    saveConfig();
  });
  mcHideConsoleExitCheck?.addEventListener('change', (e) => {
    appConfig.autoCloseConsole = e.target.checked;
    saveConfig();
  });

  mcCustomPathInput?.addEventListener('change', (e) => {
    appConfig.minecraftPath = e.target.value.trim();
    saveConfig();
  });

  btnBrowseMcPath?.addEventListener('click', async () => {
    if (window.electronAPI?.selectMinecraftFolderDialog) {
      const selected = await window.electronAPI.selectMinecraftFolderDialog();
      if (selected) {
        if (mcCustomPathInput) mcCustomPathInput.value = selected;
        appConfig.minecraftPath = selected;
        await saveConfig();
        showSnackbar(window.I18N?.t?.('toast_mc_path_updated', 'Директория Minecraft обновлена') || 'Директория Minecraft обновлена', 'success');
        if (typeof renderInstancesGrid === 'function') renderInstancesGrid();
      }
    }
  });

  btnOpenMcPath?.addEventListener('click', () => {
    if (window.electronAPI?.openMinecraftFolder) {
      window.electronAPI.openMinecraftFolder();
    }
  });

  btnResetMcPath?.addEventListener('click', async () => {
    if (mcCustomPathInput) mcCustomPathInput.value = '';
    appConfig.minecraftPath = '';
    await saveConfig();
    showSnackbar(window.I18N?.t?.('toast_mc_path_reset', 'Путь Minecraft сброшен по умолчанию') || 'Путь Minecraft сброшен по умолчанию', 'info');
    if (typeof renderInstancesGrid === 'function') renderInstancesGrid();
  });

  javaSkipCheck?.addEventListener('change', (e) => {
    appConfig.skipJavaCheck = e.target.checked;
    saveConfig();
  });
  javaSkipPromptCheck?.addEventListener('change', (e) => {
    appConfig.skipPromptCheck = e.target.checked;
    saveConfig();
  });
  javaAutoDetectCheck?.addEventListener('change', (e) => {
    appConfig.autoJavaSwitch = e.target.checked;
    if (e.target.checked) {
      appConfig.manualJavaPath = '';
      if (javaPathInput) javaPathInput.value = '';
    }
    saveConfig();
    renderJavaTable();
  });
  javaAutoDownloadCheck?.addEventListener('change', (e) => {
    appConfig.autoDownloadMojangJava = e.target.checked;
    saveConfig();
  });

  javaMinRamInput?.addEventListener('input', (e) => {
    appConfig.minRam = parseInt(e.target.value, 10) || 512;
    saveConfig();
  });
  javaMaxRamInput?.addEventListener('input', (e) => {
    appConfig.maxRam = parseInt(e.target.value, 10) || 4096;
    saveConfig();
  });
  javaPermGenInput?.addEventListener('input', (e) => {
    appConfig.permGen = parseInt(e.target.value, 10) || 128;
    saveConfig();
  });
  javaWarnMemoryCheck?.addEventListener('change', (e) => {
    appConfig.warnLowMemory = e.target.checked;
    saveConfig();
  });
  javaArgsInput?.addEventListener('input', (e) => {
    appConfig.jvmArgs = e.target.value;
    saveConfig();
  });

  // Java Toolbar & Actions
  btnBrowseJava?.addEventListener('click', async () => {
    if (window.electronAPI?.selectJavaDialog) {
      const selected = await window.electronAPI.selectJavaDialog();
      if (selected) {
        appConfig.manualJavaPath = selected;
        appConfig.autoJavaSwitch = false;
        if (javaPathInput) javaPathInput.value = selected;
        if (javaAutoDetectCheck) javaAutoDetectCheck.checked = false;
        saveConfig();
        if (javaTestStatus) {
          javaTestStatus.textContent = window.I18N ? window.I18N.t('java_status_file_selected', 'Java файл выбран!') : 'Java файл выбран!';
          javaTestStatus.style.color = 'var(--md-sys-color-success)';
        }
      }
    }
  });

  btnFindJava?.addEventListener('click', async () => {
    await loadInstalledJavas();
    if (installedJavasList.length > 0) {
      // Pick highest version
      const highest = [...installedJavasList].sort((a, b) => (b.major || 0) - (a.major || 0))[0];
      appConfig.manualJavaPath = highest.path;
      appConfig.autoJavaSwitch = false;
      if (javaPathInput) javaPathInput.value = highest.path;
      if (javaAutoDetectCheck) javaAutoDetectCheck.checked = false;
      saveConfig();
      renderJavaTable();
      if (javaTestStatus) {
        javaTestStatus.textContent = `Java ${highest.version || highest.major}`;
        javaTestStatus.style.color = 'var(--md-sys-color-success)';
      }
    } else {
      if (javaTestStatus) {
        javaTestStatus.textContent = window.I18N ? window.I18N.t('java_status_no_runtimes', 'Установленные среды Java не обнаружены.') : 'Установленные среды Java не обнаружены.';
        javaTestStatus.style.color = 'var(--md-sys-color-error)';
      }
    }
  });

  btnTestJavaSettings?.addEventListener('click', () => {
    if (appConfig.autoJavaSwitch) {
      if (javaTestStatus) {
        javaTestStatus.textContent = window.I18N ? window.I18N.t('java_status_autodetect_active', 'Автоопределение активно: версия Java будет подобрана автоматически под версию игры.') : 'Автоопределение активно: версия Java будет подобрана автоматически под версию игры.';
        javaTestStatus.style.color = 'var(--md-sys-color-success)';
      }
    } else if (appConfig.manualJavaPath) {
      if (javaTestStatus) {
        javaTestStatus.textContent = window.I18N ? window.I18N.t('java_status_config_ok', 'Конфигурация проверена: путь к Java задан корректно.') : 'Конфигурация проверена: путь к Java задан корректно.';
        javaTestStatus.style.color = 'var(--md-sys-color-success)';
      }
    } else {
      if (javaTestStatus) {
        javaTestStatus.textContent = window.I18N ? window.I18N.t('java_status_path_empty', 'Путь к Java не указан. Включите автоопределение.') : 'Путь к Java не указан. Включите автоопределение.';
        javaTestStatus.style.color = 'var(--md-sys-color-error)';
      }
    }
  });

  btnSelectJavaActive?.addEventListener('click', applySelectedJavaInstallation);
  btnRefreshJava?.addEventListener('click', loadInstalledJavas);

  // Accounts Toolbar & Actions
  btnAccAddMicrosoft?.addEventListener('click', async () => {
    if (!window.electronAPI?.loginMicrosoft) {
      showSnackbar((window.I18N ? window.I18N.t('toast_ms_login_desktop_only', 'Microsoft Login доступен в десктопном приложении Electron.') : 'Microsoft Login доступен в десктопном приложении Electron.'), 'warning');
      return;
    }
    btnAccAddMicrosoft.disabled = true;
    appendConsoleLog('[Auth]: Открытие окна авторизации Microsoft...');

    try {
      const res = await window.electronAPI.loginMicrosoft();
      if (res.success && res.account) {
        const newAcc = {
          type: 'mojang',
          name: res.account.name,
          uuid: res.account.uuid,
          access_token: res.account.access_token,
          skinUrl: res.account.skinUrl,
          active: true
        };

        // Mark previous accounts inactive
        appConfig.accounts.forEach(a => a.active = false);
        const existingIdx = appConfig.accounts.findIndex(a => a.name.toLowerCase() === newAcc.name.toLowerCase());
        if (existingIdx >= 0) {
          appConfig.accounts[existingIdx] = newAcc;
        } else {
          appConfig.accounts.push(newAcc);
        }

        saveConfig();
        renderAccountsTable();
        appendConsoleLog(`[Auth]: Успешный вход в аккаунт Microsoft: ${newAcc.name}`);
        showSnackbar((window.I18N ? window.I18N.t('toast_login_success', 'Вход выполнен: {name}') : 'Вход выполнен: {name}').replace('{name}', newAcc.name), 'success');
      } else {
        const errText = window.I18N ? window.I18N.t('error_login_failed', 'Ошибка входа: ') : 'Ошибка входа: ';
        showSnackbar(errText + (res.error || (window.I18N ? window.I18N.t('error_login_failed', 'Не удалось авторизоваться') : 'Не удалось авторизоваться')), 'error');
      }
    } catch (err) {
      const connText = window.I18N ? window.I18N.t('error_connect_failed', 'Ошибка подключения: ') : 'Ошибка подключения: ';
      showSnackbar(connText + err.message, 'error');
    } finally {
      btnAccAddMicrosoft.disabled = false;
    }
  });

  btnAccAddOffline?.addEventListener('click', () => {
    if (addOfflineModal) {
      addOfflineModal.classList.add('open');
      if (newOfflineNicknameInput) {
        newOfflineNicknameInput.value = '';
        newOfflineNicknameInput.focus();
      }
    }
  });

  btnCloseAddOfflineModal?.addEventListener('click', () => addOfflineModal?.classList.remove('open'));
  btnCancelAddOffline?.addEventListener('click', () => addOfflineModal?.classList.remove('open'));

  btnConfirmAddOffline?.addEventListener('click', () => {
    const rawName = newOfflineNicknameInput?.value || '';
    const cleanName = rawName.trim().replace(/[^a-zA-Z0-9_]/g, '');
    const t = (k, fb) => (window.I18N ? window.I18N.t(k, fb) : fb);

    if (!cleanName || cleanName.length < 3) {
      showSnackbar(t('nickname_min_length', 'Пожалуйста, введите никнейм от 3 до 16 символов (только буквы, цифры и _).'), 'warning');
      return;
    }

    const newAcc = {
      type: 'offline',
      name: cleanName,
      uuid: 'offline_' + cleanName,
      active: true
    };

    appConfig.accounts.forEach(a => a.active = false);
    const existingIdx = appConfig.accounts.findIndex(a => a.name.toLowerCase() === cleanName.toLowerCase());
    if (existingIdx >= 0) {
      appConfig.accounts[existingIdx] = newAcc;
    } else {
      appConfig.accounts.push(newAcc);
    }

    saveConfig();
    renderAccountsTable();
    addOfflineModal?.classList.remove('open');
    appendConsoleLog(`[Auth]: Добавлен автономный профиль: ${cleanName}`);
    showSnackbar((window.I18N ? window.I18N.t('toast_profile_added', 'Профиль "{name}" добавлен') : 'Профиль "{name}" добавлен').replace('{name}', cleanName), 'success');
  });

  async function deleteAccountByIndex(index) {
    const t = (k, fb) => (window.I18N ? window.I18N.t(k, fb) : fb);
    if (index < 0 || !appConfig.accounts[index]) {
      showSnackbar(t('acc_select_to_delete', 'Выберите учётную запись для удаления.'), 'warning');
      return;
    }
    if (appConfig.accounts.length <= 1) {
      showSnackbar(t('acc_cannot_delete_only', 'Нельзя удалить единственную учётную запись.'), 'warning');
      return;
    }

    const accToRemove = appConfig.accounts[index];
    const confirmed = await showConfirmDialog({
      title: t('dialog_delete_title', 'Удаление'),
      message: t('dialog_delete_acc_msg', `Удалить учётную запись ${accToRemove.name}?`).replace('{name}', accToRemove.name),
      iconType: 'danger',
      confirmText: t('acc_btn_delete', 'Удалить')
    });

    if (confirmed) {
      const wasActive = accToRemove.active;
      appConfig.accounts.splice(index, 1);
      if (wasActive && appConfig.accounts.length > 0) {
        appConfig.accounts[0].active = true;
      }
      selectedAccountRowIndex = 0;
      saveConfig();
      renderAccountsTable();
      renderModalAccountsList();
      updateSidebarProfile();
      showSnackbar(t('toast_acc_deleted', 'Учётная запись удалена'), 'info');
    }
  }

  btnAccDelete?.addEventListener('click', async () => {
    await deleteAccountByIndex(selectedAccountRowIndex);
  });

  // Ely.by Account Actions & Modal
  function openElyModal() {
    if (authModal) authModal.classList.remove('open');
    if (elyModal) {
      elyModal.classList.add('open');
      if (elyStatusMsg) elyStatusMsg.style.display = 'none';
      if (elyLoginUserInput) {
        elyLoginUserInput.value = '';
        elyLoginUserInput.focus();
      }
      if (elyLoginPasswordInput) {
        elyLoginPasswordInput.value = '';
      }
    }
  }

  btnAccAddElyBy?.addEventListener('click', openElyModal);
  modalElyLoginBtn?.addEventListener('click', openElyModal);

  function openElyRegister() {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal('https://ely.by/register');
    }
  }

  linkElyRegister?.addEventListener('click', (e) => {
    e.preventDefault();
    openElyRegister();
  });

  btnCloseElyModal?.addEventListener('click', () => elyModal?.classList.remove('open'));
  btnCancelElyLogin?.addEventListener('click', () => elyModal?.classList.remove('open'));

  btnConfirmElyLogin?.addEventListener('click', async () => {
    const user = (elyLoginUserInput?.value || '').trim();
    const pass = (elyLoginPasswordInput?.value || '').trim();

    if (!user || !pass) {
      if (elyStatusMsg) {
        elyStatusMsg.textContent = window.I18N ? window.I18N.t('ely_enter_creds', 'Пожалуйста, введите логин/email и пароль.') : 'Пожалуйста, введите логин/email и пароль.';
        elyStatusMsg.style.display = 'block';
      }
      return;
    }

    if (btnConfirmElyLogin) {
      btnConfirmElyLogin.disabled = true;
      btnConfirmElyLogin.innerHTML = '<span>' + (window.I18N ? window.I18N.t('btn_ely_logging_in', 'Вход...') : 'Вход...') + '</span>';
    }
    if (elyStatusMsg) elyStatusMsg.style.display = 'none';

    try {
      if (!window.electronAPI?.loginElyBy) {
        throw new Error('Функция входа Ely.by не поддерживается');
      }

      const res = await window.electronAPI.loginElyBy({ username: user, password: pass });
      if (res && res.success && res.account) {
        const newAcc = res.account;
        newAcc.active = true;

        // Deactivate other accounts
        appConfig.accounts.forEach(a => a.active = false);

        const existingIdx = appConfig.accounts.findIndex(
          a => a.name.toLowerCase() === newAcc.name.toLowerCase() && a.type === 'elyby'
        );
        if (existingIdx >= 0) {
          appConfig.accounts[existingIdx] = newAcc;
        } else {
          appConfig.accounts.push(newAcc);
        }

        saveConfig();
        renderAccountsTable();
        updateSidebarProfile();
        elyModal?.classList.remove('open');
        appendConsoleLog(`[Auth]: Успешный вход в аккаунт Ely.by: ${newAcc.name}`);
        showSnackbar((window.I18N ? window.I18N.t('toast_ely_login_success', 'Вход в Ely.by выполнен: {name}') : 'Вход в Ely.by выполнен: {name}').replace('{name}', newAcc.name), 'success');
      } else {
        if (elyStatusMsg) {
          elyStatusMsg.textContent = res?.error || (window.I18N ? window.I18N.t('ely_login_invalid', 'Неверный логин или пароль на Ely.by') : 'Неверный логин или пароль на Ely.by');
          elyStatusMsg.style.display = 'block';
        }
      }
    } catch (err) {
      if (elyStatusMsg) {
        elyStatusMsg.textContent = err.message || (window.I18N ? window.I18N.t('ely_connect_error', 'Ошибка подключения к Ely.by') : 'Ошибка подключения к Ely.by');
        elyStatusMsg.style.display = 'block';
      }
    } finally {
      if (btnConfirmElyLogin) {
        btnConfirmElyLogin.disabled = false;
        btnConfirmElyLogin.innerHTML = '<span>' + (window.I18N ? window.I18N.t('btn_ely_login', 'Войти') : 'Войти') + '</span>';
      }
    }
  });

  // Auth Modal: Account Switcher & Add Account
  function renderModalAccountsList() {
    if (!modalAccountsList) return;
    modalAccountsList.innerHTML = '';

    if (!appConfig.accounts || appConfig.accounts.length === 0) {
      const emptyText = window.I18N ? window.I18N.t('modal_no_accounts', 'Нет добавленных аккаунтов') : 'Нет добавленных аккаунтов';
      modalAccountsList.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--md-sys-color-on-surface-variant); font-size: 13px;">
          ${escapeHtml(emptyText)}
        </div>
      `;
      return;
    }

    appConfig.accounts.forEach((acc) => {
      const item = document.createElement('div');
      item.className = `modal-account-item ${acc.active ? 'active' : ''}`;

      const headHtml = window.LauncherSkin ? window.LauncherSkin.getHeadHtml(acc.skinUrl, acc.name, 32) : '';

      const isMs = acc.type === 'mojang' || acc.type === 'microsoft';
      const isEly = acc.type === 'elyby';
      let typeLabel = window.I18N ? window.I18N.t('acc_type_offline', 'Автономная') : 'Автономная';
      if (isMs) typeLabel = window.I18N ? window.I18N.t('acc_type_ms', 'Microsoft') : 'Microsoft';
      else if (isEly) typeLabel = window.I18N ? window.I18N.t('acc_type_ely', 'Ely.by') : 'Ely.by';

      const activeText = window.I18N ? window.I18N.t('acc_status_active', 'Активен') : 'Активен';

      item.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          ${headHtml}
        </div>
        <div class="modal-account-info">
          <span class="modal-account-name">${escapeHtml(acc.name)}</span>
          <span class="modal-account-type">${escapeHtml(typeLabel)}</span>
        </div>
        ${acc.active ? `
          <span class="modal-account-badge">
            <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            <span>${escapeHtml(activeText)}</span>
          </span>
        ` : ''}
      `;

      item.addEventListener('click', () => {
        appConfig.accounts.forEach(a => a.active = (a.uuid === acc.uuid && a.name === acc.name));
        saveConfig();
        updateSidebarProfile();
        renderAccountsTable();
        renderModalAccountsList();
      });

      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showAccountContextMenu(e.clientX, e.clientY, acc);
      });

      modalAccountsList.appendChild(item);
    });
  }

  modalAccountsList?.addEventListener('contextmenu', (e) => {
    if (e.target === modalAccountsList || !e.target.closest('.modal-account-item')) {
      e.preventDefault();
      showAccountContextMenu(e.clientX, e.clientY, null);
    }
  });

  function openAuthModal() {
    if (!authModal) return;
    if (modalAddOptions) modalAddOptions.style.display = 'none';
    renderModalAccountsList();
    authModal.classList.add('open');
  }

  profileCard?.addEventListener('click', openAuthModal);
  closeAuthModalBtn?.addEventListener('click', () => authModal?.classList.remove('open'));

  btnToggleAddAccountInModal?.addEventListener('click', () => {
    if (!modalAddOptions) return;
    const isHidden = modalAddOptions.style.display === 'none';
    modalAddOptions.style.display = isHidden ? 'flex' : 'none';
  });

  msLoginBtn?.addEventListener('click', () => {
    authModal?.classList.remove('open');
    btnAccAddMicrosoft?.click();
  });

  modalElyLoginBtn?.addEventListener('click', () => {
    authModal?.classList.remove('open');
    openElyModal();
  });

  modalBtnAddOfflineChoice?.addEventListener('click', () => {
    authModal?.classList.remove('open');
    btnAccAddOffline?.click();
  });

  // Console Modal Controls & Logging
  function appendConsoleLog(line) {
    if (!consoleOutputText) return;
    const now = new Date().toLocaleTimeString();
    consoleOutputText.textContent += `\n[${now}] ${line}`;
    consoleOutputText.scrollTop = consoleOutputText.scrollHeight;
  }

  btnOpenConsoleNow?.addEventListener('click', () => {
    consoleModal?.classList.add('open');
  });

  btnCloseConsoleModal?.addEventListener('click', () => {
    consoleModal?.classList.remove('open');
  });

  consoleModal?.addEventListener('click', (e) => {
    if (e.target === consoleModal) {
      consoleModal.classList.remove('open');
    }
  });

  btnClearConsole?.addEventListener('click', () => {
    if (consoleOutputText) {
      consoleOutputText.textContent = window.I18N ? window.I18N.t('console_cleared', 'Консоль очищена.') : 'Консоль очищена.';
    }
  });

  btnCopyConsole?.addEventListener('click', () => {
    if (consoleOutputText) {
      navigator.clipboard.writeText(consoleOutputText.textContent).then(() => {
        const oldText = btnCopyConsole.textContent;
        btnCopyConsole.textContent = window.I18N ? window.I18N.t('console_copied', 'Скопировано!') : 'Скопировано!';
        setTimeout(() => { btnCopyConsole.textContent = oldText; }, 1500);
      });
    }
  });

  // Crash Report Modal (AppSec & Diagnostic Handler)
  const crashReportModal = document.getElementById('crashReportModal');
  const crashReportExitCodeBadge = document.getElementById('crashReportExitCodeBadge');
  const crashDiagTitle = document.getElementById('crashDiagTitle');
  const crashDiagDesc = document.getElementById('crashDiagDesc');
  const crashLogSnippet = document.getElementById('crashLogSnippet');
  const crashMclogsResultLink = document.getElementById('crashMclogsResultLink');
  const btnCloseCrashModal = document.getElementById('btnCloseCrashModal');
  const btnDismissCrashModal = document.getElementById('btnDismissCrashModal');
  const btnCrashOpenConsole = document.getElementById('btnCrashOpenConsole');
  const btnCrashCopyLog = document.getElementById('btnCrashCopyLog');
  const btnCrashShareMclogs = document.getElementById('btnCrashShareMclogs');

  function openCrashReport(code, logText) {
    if (!crashReportModal) return;
    const t = (k, fb) => (window.I18N ? window.I18N.t(k, fb) : fb);
    if (crashReportExitCodeBadge) {
      crashReportExitCodeBadge.textContent = t('crash_exit_code_badge', 'Код: {code}').replace('{code}', code);
    }

    function applyDiag(d) {
      if (!d) return;
      let title = d.title;
      let desc = d.description;
      if (d.type) {
        title = t('crash_type_' + d.type.toLowerCase() + '_title', d.title);
        desc = t('crash_type_' + d.type.toLowerCase() + '_desc', d.description);
      }
      if (crashDiagTitle) crashDiagTitle.textContent = title;
      if (crashDiagDesc) crashDiagDesc.textContent = desc;
    }

    let defaultDiag = {
      title: t('crash_diag_default_title', 'Сбой инициализации Minecraft'),
      description: t('crash_diag_default_desc', 'Процесс завершился с кодом ошибки. Ознакомьтесь с подробностями или загрузите лог на mclo.gs для помощи.')
    };
    applyDiag(defaultDiag);

    if (window.electronAPI?.analyzeCrash) {
      window.electronAPI.analyzeCrash(logText).then(res => {
        if (res?.success && res.diagnosis) {
          applyDiag(res.diagnosis);
        }
      }).catch(() => {});
    }

    const lines = (logText || '').split(/\r?\n/).filter(Boolean);
    const snippet = lines.slice(-25).join('\n');
    if (crashLogSnippet) crashLogSnippet.textContent = snippet || t('crash_log_no_data', '(Нет данных лога)');
    if (crashMclogsResultLink) crashMclogsResultLink.innerHTML = '';

    crashReportModal.classList.add('open');
  }

  btnCloseCrashModal?.addEventListener('click', () => crashReportModal?.classList.remove('open'));
  btnDismissCrashModal?.addEventListener('click', () => crashReportModal?.classList.remove('open'));
  btnCrashOpenConsole?.addEventListener('click', () => {
    crashReportModal?.classList.remove('open');
    consoleModal?.classList.add('open');
  });

  btnCrashCopyLog?.addEventListener('click', () => {
    const fullLog = consoleOutputText?.textContent || '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullLog).then(() => {
        showSnackbar((window.I18N ? window.I18N.t('toast_log_copied', 'Лог скопирован в буфер обмена') : 'Лог скопирован в буфер обмена'), 'success');
      });
    }
  });

  btnCrashShareMclogs?.addEventListener('click', async () => {
    const fullLog = consoleOutputText?.textContent || '';
    if (!btnCrashShareMclogs) return;
    btnCrashShareMclogs.disabled = true;
    btnCrashShareMclogs.textContent = (window.I18N ? window.I18N.t('btn_downloading_status', 'Загрузка...') : 'Загрузка...');
    try {
      if (window.electronAPI?.uploadMclogs) {
        const res = await window.electronAPI.uploadMclogs(fullLog);
        if (res?.success && res.url) {
          if (crashMclogsResultLink) {
            crashMclogsResultLink.innerHTML = '';
            const linkA = document.createElement('a');
            linkA.href = '#';
            linkA.className = 'mclogs-url';
            linkA.style.cssText = 'color: #8ec07c; text-decoration: underline; font-weight: 600;';
            linkA.textContent = res.url;
            linkA.addEventListener('click', (e) => {
              e.preventDefault();
              window.electronAPI?.openExternal(res.url);
            });
            crashMclogsResultLink.appendChild(linkA);
          }
          if (navigator.clipboard) {
            navigator.clipboard.writeText(res.url);
          }
          showSnackbar((window.I18N ? window.I18N.t('toast_mclogs_copied', 'Ссылка mclo.gs скопирована в буфер обмена!') : 'Ссылка mclo.gs скопирована в буфер обмена!'), 'success');
        } else {
          showSnackbar((window.I18N ? window.I18N.t('toast_download_error', 'Ошибка загрузки: {error}') : 'Ошибка загрузки: {error}').replace('{error}', res?.error || 'Сервер недоступен'), 'error');
        }
      }
    } catch (e) {
      showSnackbar((window.I18N ? window.I18N.t('toast_error_generic', 'Ошибка: {error}') : 'Ошибка: {error}').replace('{error}', e.message), 'error');
    } finally {
      btnCrashShareMclogs.disabled = false;
      btnCrashShareMclogs.innerHTML = `
        <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor;"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/></svg>
        <span>${window.I18N ? window.I18N.t('crash_btn_share_mclogs', 'Поделиться (mclo.gs)') : 'Поделиться (mclo.gs)'}</span>
      `;
    }
  });

  // Mrpack Import Button Handler
  const btnImportMrpackInModal = document.getElementById('btnImportMrpackInModal');
  btnImportMrpackInModal?.addEventListener('click', async () => {
    if (!window.electronAPI?.selectMrpackDialog || !window.electronAPI?.importMrpack) return;
    try {
      const filePath = await window.electronAPI.selectMrpackDialog();
      if (!filePath) return;

      showSnackbar((window.I18N ? window.I18N.t('toast_mrpack_started', 'Импорт модпака .mrpack начат...') : 'Импорт модпака .mrpack начат...'), 'info');
      btnImportMrpackInModal.disabled = true;
      const labelSpan = btnImportMrpackInModal.querySelector('.mrpack-banner-btn-label span') || btnImportMrpackInModal;
      labelSpan.textContent = (window.I18N ? window.I18N.t('btn_importing_status', 'Импортирование...') : 'Импортирование...');

      const res = await window.electronAPI.importMrpack(filePath);
      if (res?.success) {
        appConfig = await window.electronAPI.getConfig();
        createVersionModal?.classList.remove('open');
        renderVersionsGrid();
        renderActiveInstanceOnLaunchTab();
        showSnackbar((window.I18N ? window.I18N.t('toast_mrpack_success', 'Модпак "{name}" успешно импортирован!') : 'Модпак "{name}" успешно импортирован!').replace('{name}', res.instanceName), 'success');
      } else {
        showSnackbar((window.I18N ? window.I18N.t('toast_mrpack_error', 'Ошибка импорта: {error}') : 'Ошибка импорта: {error}').replace('{error}', res?.error || 'Неизвестная ошибка'), 'error');
      }
    } catch (e) {
      showSnackbar((window.I18N ? window.I18N.t('toast_mrpack_error', 'Ошибка импорта: {error}') : 'Ошибка импорта: {error}').replace('{error}', e.message), 'error');
    } finally {
      if (btnImportMrpackInModal) {
        btnImportMrpackInModal.disabled = false;
        const labelSpan = btnImportMrpackInModal.querySelector('.mrpack-banner-btn-label span');
        if (labelSpan) {
          labelSpan.textContent = (window.I18N ? window.I18N.t('mrpack_btn_import', 'Импортировать .mrpack') : 'Импортировать .mrpack');
        } else {
          btnImportMrpackInModal.textContent = (window.I18N ? window.I18N.t('mrpack_btn_import', 'Импортировать .mrpack') : 'Импортировать .mrpack');
        }
      }
    }
  });

  // Initial Config Load
  const localBackup = localStorage.getItem('material_launcher_config');
  if (localBackup) {
    try {
      const parsed = JSON.parse(localBackup);
      if (parsed) appConfig = { ...appConfig, ...parsed };
    } catch (e) {}
  }

  if (window.electronAPI?.getConfig) {
    window.electronAPI.getConfig().then(cfg => {
      if (cfg) {
        appConfig = { ...appConfig, ...cfg };
      }
      if (appConfig.selectedInstanceId) {
        const activeInst = getActiveInstance();
        if (activeInst) {
          selectedVersion = activeInst.gameVersion;
          selectedVersionType = activeInst.loader || 'custom';
          appConfig.selectedVersion = activeInst.gameVersion;
          appConfig.selectedVersionType = selectedVersionType;
          localStorage.setItem('minecraft_version', selectedVersion);
          applyVersion(selectedVersion, selectedVersionType);
        }
      } else if (appConfig.selectedVersion) {
        selectedVersion = appConfig.selectedVersion;
        selectedVersionType = appConfig.selectedVersionType || 'release';
        localStorage.setItem('minecraft_version', selectedVersion);
        applyVersion(selectedVersion, selectedVersionType);
      }
      if (appConfig.theme) {
        htmlEl.setAttribute('data-theme', appConfig.theme);
        updateThemeUI(appConfig.theme);
      }
      const accentToApply = appConfig.accentColor || localStorage.getItem('launcher_accent') || 'lavender';
      localStorage.setItem('launcher_accent', accentToApply);
      if (accentToApply === 'custom') {
        const customHex = appConfig.customAccentHex || localStorage.getItem('launcher_accent_custom') || '#EADDFF';
        localStorage.setItem('launcher_accent_custom', customHex);
        applyAccentPalette('custom', customHex);
      } else {
        applyAccentPalette(accentToApply);
      }
      applyConfigToUI();
      if (window.I18N) {
        const langToUse = cfg?.language || appConfig.language || localStorage.getItem('launcher_language') || 'ru_RU';
        window.I18N.setLanguage(langToUse).then(() => {
          renderLanguagesGrid();
          updateSidebarProfile();
          resetPlayButtons();
        });
      }
    }).catch(err => {
      console.warn('Could not read config:', err);
      applyConfigToUI();
    });
  } else {
    applyConfigToUI();
    if (window.I18N) {
      window.I18N.init().then(() => {
        renderLanguagesGrid();
        updateSidebarProfile();
        resetPlayButtons();
      });
    }
  }

  window.addEventListener('launcher-language-changed', () => {
    resetPlayButtons();
    updateSidebarProfile();
    renderAccountsTable();
    renderJavaTable();
    updateInstancesUI();
    renderVersionsList();
    if (typeof renderWizardMods === 'function' && wizardModsList && wizardModsList.children.length > 0) {
      renderWizardMods();
    }
    if (typeof renderManageModsList === 'function' && manageModsList && manageModsList.children.length > 0) {
      renderManageModsList();
    }
    renderActiveInstanceOnLaunchTab();
  });

  function renderActiveInstanceOnLaunchTab() {
    if (launchVersionTitle && !isLaunching) {
      launchVersionTitle.textContent = '';
    }
  }

  // 6. REAL MINECRAFT LAUNCHING (Unified Play handler)
  const playButtons = document.querySelectorAll('.play-btn-trigger');
  const launchWavyProgress = document.getElementById('launchWavyProgress');
  const launchWavyFill = document.getElementById('launchWavyFill');
  let isGameRunning = false;
  let isLaunching = false;

  function updateWavyProgress(percent, show = true) {
    if (!launchWavyProgress) return;
    if (show && isLaunching && !isGameRunning) {
      launchWavyProgress.classList.add('active');
    } else {
      launchWavyProgress.classList.remove('active');
    }
    const pct = Math.min(100, Math.max(0, Math.round(percent)));
    launchWavyProgress.setAttribute('aria-valuenow', pct);
    if (launchWavyFill) {
      launchWavyFill.style.setProperty('--wave-percent', (show ? pct : 0) + '%');
    }
  }

  function setPlayButtonsState(htmlContent, isLaunchingBtn = false) {
    playButtons.forEach(btn => {
      btn.innerHTML = htmlContent;
      if (isLaunchingBtn) {
        btn.classList.add('launching');
      } else {
        btn.classList.remove('launching');
      }
      btn.style.removeProperty('background-color');
      btn.style.removeProperty('color');
    });
  }

  function resetPlayButtons() {
    isLaunching = false;
    isGameRunning = false;
    const playText = window.I18N ? window.I18N.t('btn_play', 'Play') : 'Play';
    setPlayButtonsState(`
      <svg class="play-icon play-icon-idle" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      <span>${playText}</span>
    `, false);
    updateWavyProgress(0, false);
    if (launchVersionTitle) launchVersionTitle.textContent = '';
    renderActiveInstanceOnLaunchTab();
  }

  // Hook Launch Events to Console & Play Button
  if (window.electronAPI) {
    window.electronAPI.onLaunchStatus((stat) => {
      console.log('[MC Status]:', stat);
      appendConsoleLog(`[Статус]: ${stat.message || stat.status}`);

      if (stat.status === 'downloading') {
        if (!isLaunching || isGameRunning) return;
        const dlWord = window.I18N ? window.I18N.t('btn_downloading', 'Загрузка') : 'Загрузка';
        const pct = stat.percent !== undefined ? ` ${stat.percent}%` : '';
        setPlayButtonsState(`
          <svg class="play-icon spinning" viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
          <span>${dlWord}${pct}</span>
        `, true);
        if (stat.percent !== undefined) {
          updateWavyProgress(stat.percent, true);
        }
      } else if (stat.status === 'preparing') {
        if (!isLaunching || isGameRunning) return;
        const prepWord = window.I18N ? window.I18N.t('btn_preparing', 'Подготовка...') : 'Подготовка...';
        setPlayButtonsState(`
          <svg class="play-icon spinning" viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
          <span>${prepWord}</span>
        `, true);
        updateWavyProgress(15, true);
      } else if (stat.status === 'running') {
        isLaunching = false;
        isGameRunning = true;
        resetPlayButtons();
      } else if (stat.status === 'closed') {
        resetPlayButtons();
      } else if (stat.status === 'error') {
        appendConsoleLog(`[СБОЙ]: ${stat.message || 'Ошибка запуска'}`);
        if (appConfig.showConsoleOnError) {
          consoleModal?.classList.add('open');
        }
        showSnackbar((window.I18N ? window.I18N.t('toast_game_launch_error', 'Ошибка при запуске игры: {error}') : 'Ошибка при запуске игры: {error}').replace('{error}', stat.message || 'Неизвестная ошибка'), 'error');
        resetPlayButtons();
      }
    });

    window.electronAPI.onLaunchProgress((prog) => {
      if (!isLaunching || isGameRunning) return;
      if (prog && prog.percent !== undefined) {
        const pct = Math.min(100, Math.max(0, Math.round(prog.percent)));
        updateWavyProgress(pct, true);
        const dlWord = window.I18N ? window.I18N.t('btn_downloading', 'Загрузка') : 'Загрузка';
        setPlayButtonsState(`
          <svg class="play-icon spinning" viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
          <span>${dlWord} ${prog.percent}%</span>
        `, true);
        if (launchVersionTitle) {
          const cur = prog.current !== undefined ? prog.current : (prog.task || 0);
          const tot = prog.total || 0;
          launchVersionTitle.textContent = `${prog.type || 'assets'}: ${cur}/${tot} (${prog.percent}%)`;
        }
        appendConsoleLog(`[Загрузка]: ${prog.type || 'Ресурсы'} - ${prog.percent}% (${prog.current || prog.task || 0}/${prog.total || 0})`);
      }
    });

    window.electronAPI.onLaunchClose((code) => {
      console.log('[MC Process Exit Code]:', code);
      appendConsoleLog(`[Процесс завершён с кодом]: ${code}`);
      resetPlayButtons();

      if (code !== 0) {
        openCrashReport(code, consoleOutputText?.textContent || '');
        if (appConfig.showConsoleOnError) {
          consoleModal?.classList.add('open');
        }
      } else if (code === 0 && appConfig.autoCloseConsole) {
        consoleModal?.classList.remove('open');
      }
    });

    window.electronAPI.onLaunchLog((log) => {
      console.log('[Minecraft]:', log);
      appendConsoleLog(log);
    });
  }

  playButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.classList.contains('launching') || isLaunching || isGameRunning) return;
      isLaunching = true;
      isGameRunning = false;
      updateWavyProgress(0, true);

      if (appConfig.selectedInstanceId) {
        const activeInst = getActiveInstance();
        if (activeInst) {
          selectedVersion = activeInst.gameVersion;
          selectedVersionType = activeInst.loader || 'custom';
          appConfig.selectedVersion = activeInst.gameVersion;
          appConfig.selectedVersionType = selectedVersionType;
        }
      }

      collectConfigFromUI();
      saveConfig();

      const activeAcc = getActiveAccount();

      if (appConfig.showConsoleOnLaunch) {
        consoleModal?.classList.add('open');
      }

      appendConsoleLog('----------------------------------------');
      appendConsoleLog(`[Запуск]: Minecraft ${selectedVersion} (${selectedVersionType})`);
      appendConsoleLog(`[Игрок]: ${activeAcc.name} (${activeAcc.type})`);
      appendConsoleLog(`[Разрешение]: ${appConfig.windowWidth}x${appConfig.windowHeight}, Полноэкранный: ${appConfig.fullscreen}`);
      appendConsoleLog(`[Память]: Min ${appConfig.minRam}M, Max ${appConfig.maxRam}M, PermGen ${appConfig.permGen}M`);

      const launchPayload = {
        version: selectedVersion,
        versionType: selectedVersionType,
        instanceId: appConfig.selectedInstanceId,
        account: activeAcc,
        fullscreen: appConfig.fullscreen,
        windowWidth: appConfig.windowWidth,
        windowHeight: appConfig.windowHeight,
        hideLauncherOnLaunch: appConfig.hideLauncherOnLaunch,
        closeLauncherOnExit: appConfig.closeLauncherOnExit,
        autoJavaSwitch: appConfig.autoJavaSwitch,
        manualJavaPath: appConfig.manualJavaPath,
        skipJavaCheck: appConfig.skipJavaCheck,
        minRam: appConfig.minRam,
        maxRam: appConfig.maxRam,
        permGen: appConfig.permGen,
        jvmArgs: appConfig.jvmArgs
      };

      const prepWord = window.I18N ? window.I18N.t('btn_preparing', 'Подготовка...') : 'Подготовка...';
      setPlayButtonsState(`
        <svg class="play-icon spinning" viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
        <span>${prepWord}</span>
      `, true);

      if (window.electronAPI?.launchMinecraft) {
        try {
          const res = await window.electronAPI.launchMinecraft(launchPayload);
          if (!res.success) {
            appendConsoleLog(`[Ошибка запуска]: ${res.error || 'Неизвестная ошибка'}`);
            if (appConfig.showConsoleOnError) {
              consoleModal?.classList.add('open');
            }
            showSnackbar((window.I18N ? window.I18N.t('toast_mc_launch_failed', 'Не удалось запустить Minecraft: {error}') : 'Не удалось запустить Minecraft: {error}').replace('{error}', res.error || 'Проверьте соединение или версию Java'), 'error');
            resetPlayButtons();
          }
        } catch (err) {
          appendConsoleLog(`[Исключение запуска]: ${err.message}`);
          if (appConfig.showConsoleOnError) {
            consoleModal?.classList.add('open');
          }
          showSnackbar((window.I18N ? window.I18N.t('toast_game_launch_error', 'Ошибка запуска: {error}') : 'Ошибка запуска: {error}').replace('{error}', err.message), 'error');
          resetPlayButtons();
        }
      } else {
        // Fallback for browser preview
        setTimeout(() => {
          resetPlayButtons();
        }, 2000);
      }
    });
  });

  // 8. Mods View & 3-Step Create Version Wizard
  const btnOpenCreateVersionModal = document.getElementById('btnOpenCreateVersionModal');
  const btnOpenModsFolder = document.getElementById('btnOpenModsFolder');
  const minimalInstancesList = document.getElementById('minimalInstancesList');
  const installedVersionsContainer = document.getElementById('installedVersionsContainer');

  // Create Version Wizard Modal elements
  const createVersionModal = document.getElementById('createVersionModal');
  const btnCloseCreateVersionModal = document.getElementById('btnCloseCreateVersionModal');
  const btnCancelCreateVersion = document.getElementById('btnCancelCreateVersion');
  const btnSubmitCreateVersion = document.getElementById('btnSubmitCreateVersion');
  const cvInstanceNameInput = document.getElementById('cvInstanceNameInput');

  // Steps
  const wizardStep1 = document.getElementById('wizardStep1');
  const wizardStep1Header = document.getElementById('wizardStep1Header');
  const wizardStep1Value = document.getElementById('wizardStep1Value');
  const cvLoaderCards = document.querySelectorAll('#cvLoaderCards .cv-loader-card');
  const cvProviderCards = document.querySelectorAll('#cvProviderCards .wizard-provider-chip');

  const wizardStep2 = document.getElementById('wizardStep2');
  const wizardStep2Header = document.getElementById('wizardStep2Header');
  const wizardStep2Value = document.getElementById('wizardStep2Value');
  const wizardVersionSearchInput = document.getElementById('wizardVersionSearchInput');
  const cvShowSnapshotsCheckbox = document.getElementById('cvShowSnapshotsCheckbox');
  const cvShowSnapshotsLabel = document.getElementById('cvShowSnapshotsLabel');
  const cvShowSnapshotsText = document.getElementById('cvShowSnapshotsText');
  const wizardVersionsGrid = document.getElementById('wizardVersionsGrid');

  const wizardStep3 = document.getElementById('wizardStep3');
  const wizardStep3Header = document.getElementById('wizardStep3Header');
  const wizardStep3Value = document.getElementById('wizardStep3Value');
  const wizardModSearchInput = document.getElementById('wizardModSearchInput');
  const wizardModsList = document.getElementById('wizardModsList');

  let selectedCvVersion = '1.21.1';
  let selectedCvLoader = 'fabric';
  let selectedCvProvider = 'modrinth';
  const selectedCvMods = new Set();

  // Curated popular versions list per mod loader
  const LOADER_POPULAR_VERSIONS = {
    fabric: [
      { id: '1.21.4', tag: 'Latest', type: 'release' },
      { id: '1.21.3', tag: '', type: 'release' },
      { id: '1.21.1', tag: 'Рекомендуемая', type: 'release' },
      { id: '1.21', tag: '', type: 'release' },
      { id: '1.20.6', tag: '', type: 'release' },
      { id: '1.20.4', tag: 'Стабильная', type: 'release' },
      { id: '1.20.2', tag: '', type: 'release' },
      { id: '1.20.1', tag: 'Популярная', type: 'release' },
      { id: '1.19.4', tag: '', type: 'release' },
      { id: '1.19.2', tag: 'Популярная', type: 'release' },
      { id: '1.18.2', tag: '', type: 'release' },
      { id: '1.16.5', tag: 'Классика', type: 'release' }
    ],
    forge: [
      { id: '1.21.1', tag: 'Рекомендуемая', type: 'release' },
      { id: '1.20.4', tag: 'Стабильная', type: 'release' },
      { id: '1.20.2', tag: '', type: 'release' },
      { id: '1.20.1', tag: 'Популярная', type: 'release' },
      { id: '1.19.4', tag: '', type: 'release' },
      { id: '1.19.2', tag: 'Популярная', type: 'release' },
      { id: '1.18.2', tag: '', type: 'release' },
      { id: '1.16.5', tag: 'Классика', type: 'release' },
      { id: '1.12.2', tag: 'Forge Классика', type: 'release' },
      { id: '1.7.10', tag: 'Легендарная', type: 'release' }
    ],
    neoforge: [
      { id: '1.21.4', tag: 'Latest', type: 'release' },
      { id: '1.21.3', tag: '', type: 'release' },
      { id: '1.21.1', tag: 'Рекомендуемая', type: 'release' },
      { id: '1.21', tag: '', type: 'release' },
      { id: '1.20.6', tag: '', type: 'release' },
      { id: '1.20.4', tag: 'Стабильная', type: 'release' },
      { id: '1.20.2', tag: '', type: 'release' }
    ],
    quilt: [
      { id: '1.21.4', tag: 'Latest', type: 'release' },
      { id: '1.21.3', tag: '', type: 'release' },
      { id: '1.21.1', tag: 'Рекомендуемая', type: 'release' },
      { id: '1.20.4', tag: 'Стабильная', type: 'release' },
      { id: '1.20.1', tag: 'Популярная', type: 'release' },
      { id: '1.19.4', tag: '', type: 'release' },
      { id: '1.19.2', tag: 'Популярная', type: 'release' },
      { id: '1.18.2', tag: '', type: 'release' },
      { id: '1.16.5', tag: 'Классика', type: 'release' }
    ],
    vanilla: [
      { id: '1.21.4', tag: 'Latest', type: 'release' },
      { id: '1.21.3', tag: '', type: 'release' },
      { id: '1.21.1', tag: 'Рекомендуемая', type: 'release' },
      { id: '1.21', tag: '', type: 'release' },
      { id: '1.20.6', tag: '', type: 'release' },
      { id: '1.20.4', tag: 'Стабильная', type: 'release' },
      { id: '1.20.1', tag: 'Популярная', type: 'release' },
      { id: '1.19.2', tag: '', type: 'release' },
      { id: '1.18.2', tag: '', type: 'release' },
      { id: '1.16.5', tag: 'Классика', type: 'release' },
      { id: '1.12.2', tag: '', type: 'release' },
      { id: '1.7.10', tag: '', type: 'release' }
    ]
  };

  // Legacy fallback reference
  const POPULAR_VERSIONS = LOADER_POPULAR_VERSIONS.fabric;

  // Comprehensive multi-loader curated mods library
  const POPULAR_MODS = [
    // --- FABRIC / QUILT EXCLUSIVE ---
    {
      id: 'fabric-api',
      descKey: 'mod_desc_fabric_api',
      slug: 'fabric-api',
      title: 'Fabric API',
      author: 'modmuss50',
      description: 'Базовая библиотека хуков и API, обязательная для большинства Fabric модов.',
      icon_url: 'https://cdn.modrinth.com/data/P7dR8mSH/icon.png',
      downloads: 65000000,
      categories: ['utility'],
      loaders: ['fabric', 'quilt']
    },
    {
      id: 'sodium',
      descKey: 'mod_desc_sodium',
      slug: 'sodium',
      title: 'Sodium',
      author: 'jellysquid3',
      description: 'Революционный движок рендеринга для Fabric. Максимальный FPS и плавность.',
      icon_url: 'https://cdn.modrinth.com/data/AANobbMI/icon.png',
      downloads: 41200000,
      categories: ['optimization'],
      loaders: ['fabric', 'quilt']
    },
    {
      id: 'iris',
      descKey: 'mod_desc_iris',
      slug: 'iris',
      title: 'Iris Shaders',
      author: 'IrisShaders',
      description: 'Современный и быстрый загрузчик шейдеров для Fabric, совместимый с OptiFine паками.',
      icon_url: 'https://cdn.modrinth.com/data/YL57xq9U/icon.png',
      downloads: 29500000,
      categories: ['optimization', 'decoration'],
      loaders: ['fabric', 'quilt']
    },
    {
      id: 'lithium',
      descKey: 'mod_desc_lithium',
      slug: 'lithium',
      title: 'Lithium',
      author: 'jellysquid3',
      description: 'Глобальная оптимизация серверной части: физика, ИИ мобов и генерация мира.',
      icon_url: 'https://cdn.modrinth.com/data/gvQqBUqZ/icon.png',
      downloads: 24000000,
      categories: ['optimization'],
      loaders: ['fabric', 'quilt']
    },
    {
      id: 'modmenu',
      descKey: 'mod_desc_modmenu',
      slug: 'modmenu',
      title: 'Mod Menu',
      author: 'Prospector',
      description: 'Добавляет экран списка модов и меню настроек прямо в главном меню игры.',
      icon_url: 'https://cdn.modrinth.com/data/mOgUt4GM/icon.png',
      downloads: 31000000,
      categories: ['utility'],
      loaders: ['fabric', 'quilt']
    },
    {
      id: 'indium',
      descKey: 'mod_desc_indium',
      slug: 'indium',
      title: 'Indium',
      author: 'comp500',
      description: 'Реализация Fabric Rendering API для Sodium, необходимая для модов с 3D-блоками.',
      icon_url: 'https://cdn.modrinth.com/data/Orvt0mRa/icon.png',
      downloads: 21000000,
      categories: ['optimization', 'utility'],
      loaders: ['fabric', 'quilt']
    },
    {
      id: 'trinkets',
      descKey: 'mod_desc_trinkets',
      slug: 'trinkets',
      title: 'Trinkets',
      author: 'emilyploszaj',
      description: 'Система дополнительных слотов для колец, поясов и амулетов для Fabric.',
      icon_url: '',
      downloads: 18000000,
      categories: ['utility', 'adventure'],
      loaders: ['fabric', 'quilt']
    },

    // --- FORGE / NEOFORGE EXCLUSIVE & PRIMARY ---
    {
      id: 'embeddium',
      descKey: 'mod_desc_embeddium',
      slug: 'embeddium',
      title: 'Embeddium',
      author: 'embeddedt',
      description: 'Быстрый и стабильный официальный порт Sodium для Forge и NeoForge. Максимальный FPS.',
      icon_url: 'https://cdn.modrinth.com/data/sk9uT7Te/icon.png',
      downloads: 16500000,
      categories: ['optimization'],
      loaders: ['forge', 'neoforge']
    },
    {
      id: 'oculus',
      descKey: 'mod_desc_oculus',
      slug: 'oculus',
      title: 'Oculus',
      author: 'Asek3',
      description: 'Порт Iris Shaders для Forge и NeoForge. Поддержка всех современных шейдеров без OptiFine.',
      icon_url: 'https://cdn.modrinth.com/data/fQEb0iXm/icon.png',
      downloads: 14000000,
      categories: ['optimization', 'decoration'],
      loaders: ['forge', 'neoforge']
    },
    {
      id: 'create',
      descKey: 'mod_desc_create',
      slug: 'create',
      title: 'Create',
      author: 'simibubi',
      description: 'Кинематические механизмы, шестерни, ветряки, поезда и автоматизация производства.',
      icon_url: 'https://cdn.modrinth.com/data/LNytGWDc/icon.png',
      downloads: 36000000,
      categories: ['technology', 'adventure'],
      loaders: ['forge', 'neoforge', 'fabric']
    },
    {
      id: 'ironchests',
      descKey: 'mod_desc_ironchests',
      slug: 'ironchests',
      title: 'Iron Chests',
      author: 'ProgWML6',
      description: 'Вместительные сундуки из меди, железа, золота, алмазов, кристаллов и обсидиана.',
      icon_url: '',
      downloads: 28000000,
      categories: ['storage'],
      loaders: ['forge', 'neoforge', 'fabric']
    },
    {
      id: 'sophisticatedbackpacks',
      descKey: 'mod_desc_sophisticatedbackpacks',
      slug: 'sophisticatedbackpacks',
      title: 'Sophisticated Backpacks',
      author: 'P3pp3rF1y',
      description: 'Улучшаемые рюкзаки с авто-сортировкой, магнитом, плавкой и удобным ношением на спине.',
      icon_url: '',
      downloads: 25000000,
      categories: ['storage', 'adventure'],
      loaders: ['forge', 'neoforge', 'fabric']
    },
    {
      id: 'biomesoplenty',
      descKey: 'mod_desc_biomesoplenty',
      slug: 'biomesoplenty',
      title: "Biomes O' Plenty",
      author: 'Forstride',
      description: 'Более 50 великолепных новых биомов в обычном мире, Незере и Энде с уникальными растениями.',
      icon_url: '',
      downloads: 33000000,
      categories: ['adventure'],
      loaders: ['forge', 'neoforge', 'fabric']
    },
    {
      id: 'alexsmobs',
      descKey: 'mod_desc_alexsmobs',
      slug: 'alexsmobs',
      title: "Alex's Mobs",
      author: 'sbom_xela',
      description: 'Более 85 невероятных существ и животных со своими способностями, анимациями и механикой.',
      icon_url: '',
      downloads: 24000000,
      categories: ['adventure'],
      loaders: ['forge', 'neoforge']
    },
    {
      id: 'curios',
      descKey: 'mod_desc_curios',
      slug: 'curios',
      title: 'Curios API',
      author: 'TheIllusiveC4',
      description: 'Гибкая система слотов экипировки для аксессуаров, колец и магических артефактов.',
      icon_url: '',
      downloads: 39000000,
      categories: ['utility'],
      loaders: ['forge', 'neoforge']
    },
    {
      id: 'mekanism',
      descKey: 'mod_desc_mekanism',
      slug: 'mekanism',
      title: 'Mekanism',
      author: 'aidancbrady',
      description: 'Высокотехнологичный мод: 5-кратная очистка руды, ядерный синтез, реактивные ранцы и лазеры.',
      icon_url: '',
      downloads: 27000000,
      categories: ['technology'],
      loaders: ['forge', 'neoforge']
    },
    {
      id: 'botania',
      descKey: 'mod_desc_botania',
      slug: 'botania',
      title: 'Botania',
      author: 'Vazkii',
      description: 'Увлекательная магия на основе цветов, генерации маны и мистических реликвий.',
      icon_url: '',
      downloads: 23000000,
      categories: ['magic'],
      loaders: ['forge', 'neoforge', 'fabric']
    },
    {
      id: 'twilightforest',
      descKey: 'mod_desc_twilightforest',
      slug: 'twilightforest',
      title: 'The Twilight Forest',
      author: 'Benimatic',
      description: 'Легендарное сумеречное измерение с замками, лабиринтами, уникальными боссами и сокровищами.',
      icon_url: '',
      downloads: 31000000,
      categories: ['adventure'],
      loaders: ['forge', 'neoforge', 'fabric']
    },

    // --- MULTI-LOADER (FORGE, FABRIC, NEOFORGE, QUILT) ---
    {
      id: 'jei',
      descKey: 'mod_desc_jei',
      slug: 'jei',
      title: 'Just Enough Items (JEI)',
      author: 'mezz',
      description: 'Просмотр всех рецептов крафта, плавки и использования предметов прямо в инвентаре.',
      icon_url: 'https://cdn.modrinth.com/data/u6dRKJwZ/icon.png',
      downloads: 38000000,
      categories: ['utility'],
      loaders: ['forge', 'fabric', 'neoforge', 'quilt']
    },
    {
      id: 'appleskin',
      descKey: 'mod_desc_appleskin',
      slug: 'appleskin',
      title: 'AppleSkin',
      author: 'squeek502',
      description: 'Отображает уровень насыщения и точное количество здоровья от еды на панели HUD.',
      icon_url: 'https://cdn.modrinth.com/data/EsAfCjCV/icon.png',
      downloads: 32000000,
      categories: ['utility'],
      loaders: ['fabric', 'forge', 'neoforge', 'quilt']
    },
    {
      id: 'journeymap',
      descKey: 'mod_desc_journeymap',
      slug: 'journeymap',
      title: 'JourneyMap',
      author: 'techbrew',
      description: 'Карта мира в реальном времени с метками, пещерами, радаром мобов и просмотром в браузере.',
      icon_url: '',
      downloads: 22000000,
      categories: ['utility', 'adventure'],
      loaders: ['forge', 'fabric', 'neoforge', 'quilt']
    },
    {
      id: 'xaeros-minimap',
      descKey: 'mod_desc_xaeros_minimap',
      slug: 'xaeros-minimap',
      title: "Xaero's Minimap",
      author: 'xaero96',
      description: 'Легковесная и плавная миникарта с путевыми точками и настройкой интерфейса.',
      icon_url: '',
      downloads: 26000000,
      categories: ['utility', 'adventure'],
      loaders: ['forge', 'fabric', 'neoforge', 'quilt']
    },
    {
      id: 'waystones',
      descKey: 'mod_desc_waystones',
      slug: 'waystones',
      title: 'Waystones',
      author: 'BlayTheNinth',
      description: 'Путевые камни телепортации между базами и локациями с помощью свитков.',
      icon_url: '',
      downloads: 29000000,
      categories: ['adventure', 'magic'],
      loaders: ['forge', 'fabric', 'neoforge', 'quilt']
    },
    {
      id: 'mousetweaks',
      descKey: 'mod_desc_mousetweaks',
      slug: 'mousetweaks',
      title: 'Mouse Tweaks',
      author: 'YaLTeR',
      description: 'Удобное перемещение и быстрая сортировка предметов в сундуках колесиком мыши.',
      icon_url: '',
      downloads: 34000000,
      categories: ['utility'],
      loaders: ['forge', 'fabric', 'neoforge', 'quilt']
    },
    {
      id: 'clumps',
      descKey: 'mod_desc_clumps',
      slug: 'clumps',
      title: 'Clumps',
      author: 'jaredlll08',
      description: 'Объединяет разрозненные сферы опыта в одну большую сферу, ликвидируя лаги.',
      icon_url: '',
      downloads: 30000000,
      categories: ['optimization'],
      loaders: ['forge', 'fabric', 'neoforge', 'quilt']
    },
    {
      id: 'farmersdelight',
      descKey: 'mod_desc_farmersdelight',
      slug: 'farmersdelight',
      title: "Farmer's Delight",
      author: 'vectorwing',
      description: 'Уютная кулинария и фермерство: сковороды, кастрюли, ножи и десятки вкусных блюд.',
      icon_url: '',
      downloads: 27000000,
      categories: ['adventure', 'decoration'],
      loaders: ['forge', 'fabric', 'neoforge', 'quilt']
    },
    {
      id: 'jade',
      descKey: 'mod_desc_jade',
      slug: 'jade',
      title: 'Jade (HWYLA / WAILA)',
      author: 'Snownee',
      description: 'Информативная всплывающая подсказка при наведении на любой блок или существо.',
      icon_url: '',
      downloads: 25000000,
      categories: ['utility'],
      loaders: ['forge', 'fabric', 'neoforge', 'quilt']
    },
    {
      id: 'controlling',
      descKey: 'mod_desc_controlling',
      slug: 'controlling',
      title: 'Controlling',
      author: 'jaredlll08',
      description: 'Удобный поиск и фильтрация занятых и конфликтующих клавиш управления в настройках.',
      icon_url: '',
      downloads: 22000000,
      categories: ['utility'],
      loaders: ['forge', 'fabric', 'neoforge', 'quilt']
    }
  ];

  let activeWizardCategory = 'all';
  let wizardApiHits = [];
  let wizardSearchDebounceTimer = null;
  const wizardCategoriesChips = document.querySelectorAll('#wizardCategoriesChips .filter-chip');

  // Wire up category chips
  wizardCategoriesChips.forEach(chip => {
    chip.addEventListener('click', () => {
      wizardCategoriesChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeWizardCategory = chip.getAttribute('data-category') || 'all';
      renderWizardMods();
    });
  });

  // Instance management & context menu

  const versionContextMenu = document.getElementById('versionContextMenu');
  const ctxMenuDeleteVersion = document.getElementById('ctxMenuDeleteVersion');
  const ctxMenuAddMods = document.getElementById('ctxMenuAddMods');
  const ctxMenuOpenFolder = document.getElementById('ctxMenuOpenFolder');
  let contextMenuTargetInstanceId = null;

  function showContextMenu(x, y) {
    if (!versionContextMenu) return;
    versionContextMenu.style.display = 'flex';
    const menuWidth = 180;
    const menuHeight = 120;
    const posX = Math.max(10, (x + menuWidth > window.innerWidth) ? (window.innerWidth - menuWidth - 10) : x);
    const posY = Math.max(10, (y + menuHeight > window.innerHeight) ? (window.innerHeight - menuHeight - 10) : y);
    versionContextMenu.style.left = `${posX}px`;
    versionContextMenu.style.top = `${posY}px`;
  }

  function hideContextMenu() {
    if (versionContextMenu) {
      versionContextMenu.style.display = 'none';
      contextMenuTargetInstanceId = null;
    }
  }

  ctxMenuAddMods?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!contextMenuTargetInstanceId) return;
    const targetId = contextMenuTargetInstanceId;
    hideContextMenu();
    openManageModsModal(targetId);
  });

  ctxMenuOpenFolder?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const targetId = contextMenuTargetInstanceId;
    hideContextMenu();
    if (window.electronAPI?.openModsFolder) {
      await window.electronAPI.openModsFolder(targetId);
    } else if (window.electronAPI?.openMinecraftFolder) {
      await window.electronAPI.openMinecraftFolder();
    }
  });

  ctxMenuDeleteVersion?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!contextMenuTargetInstanceId) return;
    const targetId = contextMenuTargetInstanceId;
    hideContextMenu();

    const inst = (appConfig.instances || []).find(i => i.id === targetId);
    const instName = inst ? inst.name : 'версию';

    const t = (k, fb) => (window.I18N ? window.I18N.t(k, fb) : fb);
    const confirmed = await showConfirmDialog({
      title: t('dialog_delete_version_title', 'Удаление версии'),
      message: t('dialog_delete_version_msg', `Удалить версию "${instName}" и её настройки?`).replace('{name}', instName),
      iconType: 'danger',
      confirmText: t('ctx_delete_version', 'Удалить')
    });

    if (!confirmed) return;

    if (!Array.isArray(appConfig.instances)) return;
    appConfig.instances = appConfig.instances.filter(i => i.id !== targetId);

    if (window.electronAPI?.deleteInstanceFolder) {
      window.electronAPI.deleteInstanceFolder(targetId);
    }

    if (appConfig.selectedInstanceId === targetId) {
      if (appConfig.instances.length > 0) {
        selectInstance(appConfig.instances[0].id);
      } else {
        selectVanillaVersion('26.1.2', 'release');
      }
    } else {
      saveConfig();
      updateInstancesUI();
      renderVersionsList();
    }
    showSnackbar(t('toast_version_deleted', 'Версия успешно удалена'), 'info');
  });

  window.addEventListener('click', (e) => {
    if (versionContextMenu && versionContextMenu.style.display !== 'none') {
      if (!versionContextMenu.contains(e.target)) {
        hideContextMenu();
      }
    }
    if (accountContextMenu && accountContextMenu.style.display !== 'none') {
      if (!accountContextMenu.contains(e.target)) {
        hideAccountContextMenu();
      }
    }
  });

  // Account Context Menu (Right click in accounts dialog & settings)
  const accountContextMenu = document.getElementById('accountContextMenu');
  const ctxMenuAddAccount = document.getElementById('ctxMenuAddAccount');
  const ctxMenuDeleteAccount = document.getElementById('ctxMenuDeleteAccount');
  const ctxMenuAccountDivider = document.getElementById('ctxMenuAccountDivider');
  let contextMenuTargetAccountUuid = null;

  function showAccountContextMenu(x, y, acc = null) {
    if (!accountContextMenu) return;
    contextMenuTargetAccountUuid = acc ? acc.uuid : null;
    if (ctxMenuDeleteAccount) {
      ctxMenuDeleteAccount.style.display = acc ? 'flex' : 'none';
    }
    if (ctxMenuAccountDivider) {
      ctxMenuAccountDivider.style.display = acc ? 'block' : 'none';
    }
    accountContextMenu.style.display = 'flex';
    const menuWidth = 180;
    const menuHeight = acc ? 90 : 50;
    const posX = Math.max(10, (x + menuWidth > window.innerWidth) ? (window.innerWidth - menuWidth - 10) : x);
    const posY = Math.max(10, (y + menuHeight > window.innerHeight) ? (window.innerHeight - menuHeight - 10) : y);
    accountContextMenu.style.left = `${posX}px`;
    accountContextMenu.style.top = `${posY}px`;
  }

  function hideAccountContextMenu() {
    if (accountContextMenu) {
      accountContextMenu.style.display = 'none';
      contextMenuTargetAccountUuid = null;
    }
  }

  ctxMenuAddAccount?.addEventListener('click', (e) => {
    e.stopPropagation();
    hideAccountContextMenu();
    if (!authModal?.classList.contains('open')) {
      openAuthModal();
    }
    if (modalAddOptions) {
      modalAddOptions.style.display = 'flex';
      modalAddOptions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });

  ctxMenuDeleteAccount?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!contextMenuTargetAccountUuid) return;
    const targetUuid = contextMenuTargetAccountUuid;
    hideAccountContextMenu();

    const accIndex = (appConfig.accounts || []).findIndex(a => a.uuid === targetUuid);
    if (accIndex !== -1) {
      await deleteAccountByIndex(accIndex);
    }
  });

  function updateInstancesUI() {
    if (!Array.isArray(appConfig.instances)) {
      appConfig.instances = [];
    }

    const inst = getActiveInstance();

    // Render installed versions as full cards of the same size to the left of Create New Version card
    if (installedVersionsContainer) {
      installedVersionsContainer.innerHTML = '';

      const t = (k, fb) => (window.I18N ? window.I18N.t(k, fb) : fb);
      const activeText = t('version_card_active', '● Active');
      const selectText = t('version_card_select', 'Select');
      const selectedText = t('version_card_selected', 'Selected');
      const folderText = t('version_card_folder', 'Folder');
      const noModsText = t('version_card_no_mods', 'No mods');
      const modsCountTpl = t('version_card_mods_count', '{count} mods');
      const descModsTpl = t('version_card_desc_mods', 'Installed mods: {count}. Right click to delete version.');
      const descNoModsTpl = t('version_card_desc_nomods', 'Minecraft {version} ({loader}) build. Right click to delete.');

      appConfig.instances.forEach(item => {
        const isCurrent = inst && item.id === inst.id;
        const card = document.createElement('div');
        card.className = `mod-card version-card-instance ${isCurrent ? 'active-instance' : ''}`;
        card.setAttribute('title', 'Клик левой кнопкой — выбрать; правой кнопкой — удалить версию');

        // Choose appropriate icon for loader
        let loaderIconSvg = '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/></svg>';
        if (item.loader === 'forge') {
          loaderIconSvg = '<svg viewBox="0 0 24 24"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>';
        } else if (item.loader === 'fabric') {
          loaderIconSvg = '<svg viewBox="0 0 24 24"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.8L19.2 8 12 11.2 4.8 8 12 4.8zM4 9.6l7 3.1v7.1l-7-3.5V9.6zm9 10.2v-7.1l7-3.1v6.7l-7 3.5z"/></svg>';
        } else {
          loaderIconSvg = '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4V4zm2 4h12V6H6v2zm0 4h12v-2H6v2zm0 4h12v-2H6v2z"/></svg>';
        }

        const modsCount = (item.mods || []).length;
        const providerName = item.modProvider === 'curseforge' ? 'CurseForge' : 'Modrinth';
        const modsLabel = modsCount > 0 ? modsCountTpl.replace('{count}', modsCount) : noModsText;
        const descText = modsCount > 0 
          ? descModsTpl.replace('{count}', modsCount) 
          : descNoModsTpl.replace('{version}', item.gameVersion).replace('{loader}', (item.loader || 'fabric').toUpperCase());

        card.innerHTML = `
          <div>
            <div class="mod-card-header">
              <div class="mod-icon-box" style="background: rgba(142, 192, 124, 0.15); color: #8ec07c;">
                ${loaderIconSvg}
              </div>
              <div class="mod-info" style="flex: 1;">
                <div class="version-card-header-top">
                  <span class="mod-title">${escapeHtml(item.name)}</span>
                </div>
                <span class="mod-author">${escapeHtml((item.loader || 'fabric').toUpperCase())} ${escapeHtml(item.gameVersion)} • ${escapeHtml(providerName)}</span>
              </div>
            </div>

            <div class="version-card-badges">
              <span class="minimal-instance-badge">${escapeHtml((item.loader || 'fabric').toUpperCase())} ${escapeHtml(item.gameVersion)}</span>
              <span class="minimal-instance-badge" style="background: rgba(0,175,92,0.15); color: #00af5c;">${escapeHtml(providerName)}</span>
              <span class="minimal-instance-badge" style="background: ${modsCount > 0 ? 'rgba(142,192,124,0.15)' : 'rgba(255,255,255,0.06)'}; color: ${modsCount > 0 ? '#8ec07c' : 'var(--md-sys-color-outline)'};">${escapeHtml(modsLabel)}</span>
            </div>

            <p class="mod-description">${escapeHtml(descText)}</p>
          </div>

          <div class="version-card-footer">
            <button class="btn-version-folder" title="${escapeHtml(t('ctx_open_folder', 'Открыть папку'))}">
              <svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
              <span>${escapeHtml(folderText)}</span>
            </button>
            <button class="btn-version-config" title="${escapeHtml(t('btn_config', 'Конфигурация'))}">
              <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
              <span>${escapeHtml(t('btn_config', 'Конфигурация'))}</span>
            </button>
          </div>
        `;

        // Left click anywhere on card (except folder or config button): switch active instance
        card.addEventListener('click', (e) => {
          if (e.target.closest('.btn-version-folder') || e.target.closest('.btn-version-config')) return;
          selectInstance(item.id);
        });

        // Config button click: open configuration & mod management modal
        const btnConfig = card.querySelector('.btn-version-config');
        btnConfig?.addEventListener('click', (e) => {
          e.stopPropagation();
          openManageModsModal(item.id);
        });

        // Folder button click
        const btnFolder = card.querySelector('.btn-version-folder');
        btnFolder?.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (window.electronAPI?.openModsFolder) {
            await window.electronAPI.openModsFolder(item.id);
          } else if (window.electronAPI?.openMinecraftFolder) {
            await window.electronAPI.openMinecraftFolder();
          }
        });

        // Right click: open context menu with Delete
        card.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          contextMenuTargetInstanceId = item.id;
          showContextMenu(e.clientX, e.clientY);
        });

        installedVersionsContainer.appendChild(card);
      });
    }

    // Keep minimalInstancesList compatibility if exists
    if (minimalInstancesList) {
      minimalInstancesList.innerHTML = '';
    }

    // Sync with bottom release selector & launch banner
    if (inst) {
      if (currentVersionText) {
        currentVersionText.textContent = inst.gameVersion;
      }
      if (launchVersionTitle && !isLaunching) {
        launchVersionTitle.textContent = '';
      }
      const versionLabel = document.querySelector('.version-selector-widget .version-label');
      if (versionLabel) {
        versionLabel.textContent = (inst.loader || 'Fabric').toUpperCase();
      }
    } else {
      if (currentVersionText) {
        currentVersionText.textContent = selectedVersion || '1.21.1';
      }
      if (launchVersionTitle && !isLaunching) {
        launchVersionTitle.textContent = '';
      }
      const versionLabel = document.querySelector('.version-selector-widget .version-label');
      if (versionLabel) {
        versionLabel.textContent = (selectedVersionType || 'Release').toUpperCase();
      }
    }

    // Render active instance mods below
    if (typeof renderInstalledModsInModal === 'function') {
      renderInstalledModsInModal(inst);
    }
  }

  // Manage Instance Mods Modal logic (Opened by clicking "Конфигурация" on instance card)
  const manageInstanceModsModal = document.getElementById('manageInstanceModsModal');
  const manageInstanceModsTitle = document.getElementById('manageInstanceModsTitle');
  const manageInstanceModsSubtitle = document.getElementById('manageInstanceModsSubtitle');
  const manageInstanceNameInput = document.getElementById('manageInstanceNameInput');
  const btnSaveInstanceName = document.getElementById('btnSaveInstanceName');
  const btnCloseManageModsModal = document.getElementById('btnCloseManageModsModal');
  const btnSaveManageMods = document.getElementById('btnSaveManageMods');
  const manageModSearchInput = document.getElementById('manageModSearchInput');
  const manageModsList = document.getElementById('manageModsList');
  const manageModsFooterSummary = document.getElementById('manageModsFooterSummary');

  // Modal subpane elements
  const tabBtnInstalledMods = document.getElementById('tabBtnInstalledMods');
  const tabBtnAddCatalogMods = document.getElementById('tabBtnAddCatalogMods');
  const subpaneInstalledMods = document.getElementById('subpaneInstalledMods');
  const subpaneCatalogMods = document.getElementById('subpaneCatalogMods');
  const btnSwitchToAddMods = document.getElementById('btnSwitchToAddMods');
  const btnManageOpenFolder = document.getElementById('btnManageOpenFolder');
  const btnManageDownloadAll = document.getElementById('btnManageDownloadAll');
  const manageInstalledHeading = document.getElementById('manageInstalledHeading');
  const tabInstalledModsBadge = document.getElementById('tabInstalledModsBadge');
  const manageInstalledModsContainer = document.getElementById('manageInstalledModsContainer');

  let currentManagingInstanceId = null;
  let manageApiHits = [];
  let manageSearchDebounceTimer = null;
  let activeManageCategory = 'all';

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function switchManageModalTab(tab) {
    const inst = (appConfig.instances || []).find(i => i.id === currentManagingInstanceId);
    if (tab === 'catalog') {
      tabBtnAddCatalogMods?.classList.add('active');
      tabBtnInstalledMods?.classList.remove('active');
      if (subpaneCatalogMods) subpaneCatalogMods.style.display = 'block';
      if (subpaneInstalledMods) subpaneInstalledMods.style.display = 'none';
      fetchOrFilterManageMods();
    } else {
      tabBtnInstalledMods?.classList.add('active');
      tabBtnAddCatalogMods?.classList.remove('active');
      if (subpaneInstalledMods) subpaneInstalledMods.style.display = 'block';
      if (subpaneCatalogMods) subpaneCatalogMods.style.display = 'none';
      if (inst) renderInstalledModsInModal(inst);
    }
  }

  tabBtnInstalledMods?.addEventListener('click', () => switchManageModalTab('installed'));
  tabBtnAddCatalogMods?.addEventListener('click', () => switchManageModalTab('catalog'));
  btnSwitchToAddMods?.addEventListener('click', () => switchManageModalTab('catalog'));

  btnManageOpenFolder?.addEventListener('click', async () => {
    if (window.electronAPI?.openModsFolder) {
      await window.electronAPI.openModsFolder(currentManagingInstanceId);
    } else if (window.electronAPI?.openMinecraftFolder) {
      await window.electronAPI.openMinecraftFolder();
    }
  });

  btnManageDownloadAll?.addEventListener('click', async () => {
    if (!currentManagingInstanceId) return;
    const inst = (appConfig.instances || []).find(i => i.id === currentManagingInstanceId);
    if (!inst) return;
    const t = (k, fb) => (window.I18N ? window.I18N.t(k, fb) : fb);
    showSnackbar(t('toast_downloading_mods', 'Скачивание всех модов в папку сборки...'), 'info');
    if (window.electronAPI?.downloadInstanceMods) {
      const res = await window.electronAPI.downloadInstanceMods(inst.id);
      if (res?.success) {
        showSnackbar(t('toast_mods_downloaded_all', `Скачано модов: ${res.count || 0}`), 'success');
        renderInstalledModsInModal(inst);
        updateInstancesUI();
      } else {
        showSnackbar((window.I18N ? window.I18N.t('toast_download_error', 'Ошибка скачивания: {error}') : 'Ошибка скачивания: {error}').replace('{error}', res.error || 'Неизвестная ошибка'), 'error');
      }
    }
  });

  function renderInstalledModsInModal(inst) {
    if (!manageInstalledModsContainer) return;
    if (!inst) {
      manageInstalledModsContainer.innerHTML = '';
      return;
    }

    const t = (k, fb) => (window.I18N ? window.I18N.t(k, fb) : fb);
    const mods = Array.isArray(inst.mods) ? inst.mods : [];
    const count = mods.length;

    if (manageInstalledHeading) {
      manageInstalledHeading.textContent = `${t('mods_instance_title', 'Установленные моды')}: ${inst.name}`;
    }
    if (tabInstalledModsBadge) {
      tabInstalledModsBadge.textContent = count;
    }

    if (inst.loader === 'vanilla') {
      manageInstalledModsContainer.innerHTML = `
        <div class="mods-empty-state" style="padding: 32px 16px; text-align: center; background: var(--md-sys-color-surface-container); border-radius: var(--md-sys-shape-corner-large); border: 1px solid var(--md-sys-color-outline-variant);">
          <svg class="mods-empty-icon" viewBox="0 0 24 24" style="width: 36px; height: 36px; fill: var(--md-sys-color-primary);"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
          <div style="font-size: 14.5px; font-weight: 700; color: var(--md-sys-color-on-surface); margin-top: 8px;">${escapeHtml(t('mods_vanilla_desc', 'Версия Vanilla (чистая игра) не поддерживает моды.'))}</div>
          <p style="font-size: 12px; color: var(--md-sys-color-on-surface-variant); margin-top: 4px;">Чтобы играть с модами, создайте новую версию с загрузчиком Fabric или Forge.</p>
        </div>
      `;
      return;
    }

    if (count === 0) {
      manageInstalledModsContainer.innerHTML = `
        <div class="mods-empty-state" style="padding: 36px 16px; text-align: center; background: var(--md-sys-color-surface-container); border-radius: var(--md-sys-shape-corner-large); border: 1px dashed var(--md-sys-color-outline-variant);">
          <svg class="mods-empty-icon" viewBox="0 0 24 24" style="width: 40px; height: 40px; fill: var(--md-sys-color-on-surface-variant);"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5s-1.12-2.5-2.5-2.5z"/></svg>
          <div style="font-size: 15px; font-weight: 700; color: var(--md-sys-color-on-surface); margin-top: 10px;">${escapeHtml(t('mods_instance_empty', 'В этой версии ещё нет модов'))}</div>
          <p style="font-size: 12.5px; color: var(--md-sys-color-on-surface-variant); margin-top: 4px; max-width: 480px; margin-left: auto; margin-right: auto; line-height: 1.5;">${escapeHtml(t('mods_instance_empty_desc', 'Нажмите «Добавить моды», чтобы выбрать совместимые моды из каталога Modrinth.'))}</p>
          <button class="btn-add-mods-primary btn-modal-switch-add" style="margin-top: 16px;">
            <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            <span>${escapeHtml(t('btn_add_mods_full', 'Добавить моды'))}</span>
          </button>
        </div>
      `;
      manageInstalledModsContainer.querySelector('.btn-modal-switch-add')?.addEventListener('click', () => switchManageModalTab('catalog'));
    } else {
      let cardsHtml = '';
      mods.forEach(mod => {
        const safeTitle = escapeHtml(mod.title || mod.id);
        const safeAuthor = escapeHtml(mod.author || 'Author');
        const safeDesc = escapeHtml((mod.descKey && window.I18N ? window.I18N.t(mod.descKey, mod.description) : mod.description) || (window.I18N ? window.I18N.t('mod_no_desc', 'Описание отсутствует') : 'Описание отсутствует'));
        const safeIcon = (mod.icon_url && /^https?:\/\//i.test(mod.icon_url)) ? escapeHtml(mod.icon_url) : '';

        const iconMarkup = safeIcon
          ? `<img src="${safeIcon}" class="installed-mod-icon" alt="${safeTitle}" onerror="this.style.display='none';" />`
          : `<div class="installed-mod-icon-placeholder"><svg viewBox="0 0 24 24"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5s-1.12-2.5-2.5-2.5z"/></svg></div>`;

        const fileBadge = mod.downloading
          ? `<span class="minimal-instance-badge" style="background: rgba(255, 180, 0, 0.2); color: #ffb400; font-size: 10px; padding: 2px 6px;">Скачивание...</span>`
          : (mod.fileName
              ? `<span class="minimal-instance-badge" style="background: rgba(142, 192, 124, 0.15); color: #8ec07c; font-size: 10px; padding: 2px 6px;" title="${escapeHtml(mod.fileName)}">✓ ${escapeHtml(mod.fileName)}${mod.fileSize ? ` • ${formatBytes(mod.fileSize)}` : ''}</span>`
              : `<button class="btn-retry-download-mod minimal-instance-badge" data-mod-id="${escapeHtml(mod.id)}" style="background: rgba(255,255,255,0.08); color: var(--md-sys-color-primary); cursor: pointer; border: none; font-size: 10px; padding: 2px 6px;">📥 Скачать файл</button>`);

        cardsHtml += `
          <div class="installed-mod-card ${mod.disabled ? 'mod-disabled' : ''}" data-mod-id="${escapeHtml(mod.id)}">
            <div class="installed-mod-top">
              ${iconMarkup}
              <div class="installed-mod-meta">
                <div class="installed-mod-name-row">
                  <span class="installed-mod-name" title="${safeTitle}">${safeTitle}</span>
                  ${mod.disabled ? '<span class="minimal-instance-badge" style="background: rgba(255,255,255,0.06); color: var(--md-sys-color-outline); font-size: 10px;">Отключён</span>' : ''}
                </div>
                <span class="installed-mod-author">by ${safeAuthor}</span>
                <p class="installed-mod-desc">${safeDesc}</p>
              </div>
            </div>
            <div class="installed-mod-footer">
              <div class="installed-mod-badges">
                <span class="minimal-instance-badge" style="font-size: 10px; padding: 2px 6px;">${escapeHtml((inst.loader || 'fabric').toUpperCase())}</span>
                ${fileBadge}
              </div>
              <div class="installed-mod-actions-right">
                <label class="m3-switch-label" title="${mod.disabled ? 'Включить мод' : 'Отключить мод (мягкое отключение без удаления)'}">
                  <span>${mod.disabled ? 'Выкл' : 'Вкл'}</span>
                  <input type="checkbox" class="mod-soft-toggle" data-mod-id="${escapeHtml(mod.id)}" ${mod.disabled ? '' : 'checked'}>
                </label>
                <button class="btn-remove-mod" data-mod-id="${escapeHtml(mod.id)}" title="Удалить мод из версии">
                  <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                  <span>${escapeHtml(t('btn_remove_mod', 'Удалить'))}</span>
                </button>
              </div>
            </div>
          </div>
        `;
      });

      manageInstalledModsContainer.innerHTML = cardsHtml;

      manageInstalledModsContainer.querySelectorAll('.mod-soft-toggle').forEach(input => {
        input.addEventListener('change', async (e) => {
          e.stopPropagation();
          const modId = input.getAttribute('data-mod-id');
          const isEnabled = input.checked;
          const mod = (inst.mods || []).find(m => m.id === modId);
          if (mod) {
            mod.disabled = !isEnabled;
            if (window.electronAPI?.toggleMod) {
              const res = await window.electronAPI.toggleMod(inst.id, modId, isEnabled);
              if (res?.success) {
                if (res.fileName) mod.fileName = res.fileName;
                showSnackbar(isEnabled ? (window.I18N ? window.I18N.t('toast_mod_enabled', 'Мод "{name}" включён') : 'Мод "{name}" включён').replace('{name}', mod.title || mod.id) : (window.I18N ? window.I18N.t('toast_mod_disabled', 'Мод "{name}" отключён (.disabled)') : 'Мод "{name}" отключён (.disabled)').replace('{name}', mod.title || mod.id), 'info');
              }
            }
            saveConfig();
            renderInstalledModsInModal(inst);
          }
        });
      });

      manageInstalledModsContainer.querySelectorAll('.btn-remove-mod').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const modId = btn.getAttribute('data-mod-id');
          if (modId) {
            removeModFromInstance(inst.id, modId);
          }
        });
      });

      manageInstalledModsContainer.querySelectorAll('.btn-retry-download-mod').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const modId = btn.getAttribute('data-mod-id');
          const mod = (inst.mods || []).find(m => m.id === modId);
          if (mod && window.electronAPI?.downloadSingleMod) {
            btn.textContent = (window.I18N ? window.I18N.t('btn_downloading_status', 'Скачивание...') : 'Скачивание...');
            btn.disabled = true;
            try {
              const res = await window.electronAPI.downloadSingleMod(inst.id, mod);
              if (res?.success) {
                mod.fileName = res.fileName;
                mod.fileSize = res.fileSize;
                saveConfig();
                renderInstalledModsInModal(inst);
                showSnackbar((window.I18N ? window.I18N.t('toast_mod_download_single', 'Мод скачан: {file}') : 'Мод скачан: {file}').replace('{file}', mod.fileName), 'success');
              } else {
                showSnackbar((window.I18N ? window.I18N.t('toast_download_error', 'Ошибка скачивания: {error}') : 'Ошибка скачивания: {error}').replace('{error}', res.error || 'Ошибка'), 'error');
                btn.textContent = (window.I18N ? window.I18N.t('btn_download_file', '📥 Скачать файл') : '📥 Скачать файл');
                btn.disabled = false;
              }
            } catch (err) {
              btn.textContent = (window.I18N ? window.I18N.t('btn_download_file', '📥 Скачать файл') : '📥 Скачать файл');
              btn.disabled = false;
            }
          }
        });
      });
    }
  }

  function removeModFromInstance(instanceId, modId) {
    const inst = (appConfig.instances || []).find(i => i.id === instanceId);
    if (!inst || !Array.isArray(inst.mods)) return;
    const idx = inst.mods.findIndex(m => m.id === modId);
    if (idx !== -1) {
      const removed = inst.mods.splice(idx, 1)[0];
      saveConfig();
      updateInstancesUI();
      renderInstalledModsInModal(inst);
      updateManageModalSummary(inst);
      if (window.electronAPI?.deleteModFile) {
        window.electronAPI.deleteModFile(instanceId, modId, removed.fileName);
      }
      const t = (k, fb) => (window.I18N ? window.I18N.t(k, fb) : fb);
      showSnackbar(`${t('toast_mod_removed', 'Мод удалён')}: ${removed.title || modId}`, 'info');
    }
  }

  async function addModToInstance(instanceId, modObj) {
    const inst = (appConfig.instances || []).find(i => i.id === instanceId);
    if (!inst) return;
    if (!Array.isArray(inst.mods)) inst.mods = [];
    if (inst.mods.some(m => m.id === modObj.id)) return;

    const newMod = {
      id: modObj.id,
      slug: modObj.slug || modObj.id,
      title: modObj.title,
      author: modObj.author || 'Author',
      description: modObj.description || '',
      icon_url: modObj.icon_url || '',
      downloads: modObj.downloads || 0,
      categories: modObj.categories || [],
      loaders: modObj.loaders || [inst.loader],
      downloading: true,
      installedAt: Date.now()
    };

    inst.mods.push(newMod);

    saveConfig();
    updateInstancesUI();
    renderInstalledModsInModal(inst);
    updateManageModalSummary(inst);

    const t = (k, fb) => (window.I18N ? window.I18N.t(k, fb) : fb);
    showSnackbar(`${t('toast_downloading_mod', 'Скачивание мода...')}: ${newMod.title || newMod.id}`, 'info');

    if (window.electronAPI?.downloadSingleMod) {
      try {
        const res = await window.electronAPI.downloadSingleMod(instanceId, newMod);
        newMod.downloading = false;
        if (res?.success) {
          newMod.fileName = res.fileName;
          newMod.fileSize = res.fileSize;
          saveConfig();
          renderInstalledModsInModal(inst);
          updateInstancesUI();
          showSnackbar(`${t('toast_mod_downloaded', 'Мод скачан в сборку')}: ${newMod.fileName || newMod.title}`, 'success');
        } else {
          showSnackbar((window.I18N ? window.I18N.t('toast_download_error', 'Ошибка скачивания: {error}') : 'Ошибка скачивания: {error}').replace('{error}', res.error || 'Не удалось загрузить файл'), 'error');
          renderInstalledModsInModal(inst);
        }
      } catch (err) {
        newMod.downloading = false;
        showSnackbar((window.I18N ? window.I18N.t('toast_error_generic', 'Ошибка: {error}') : 'Ошибка: {error}').replace('{error}', err.message), 'error');
        renderInstalledModsInModal(inst);
      }
    }
  }

  function openManageModsModal(instanceId) {
    const inst = (appConfig.instances || []).find(i => i.id === instanceId);
    if (!inst) return;

    currentManagingInstanceId = inst.id;
    activeManageCategory = 'all';
    manageApiHits = [];

    const t = (k, fb) => (window.I18N ? window.I18N.t(k, fb) : fb);
    if (manageInstanceModsTitle) {
      manageInstanceModsTitle.textContent = `${t('manage_mods_modal_title', 'Конфигурация сборки')}: ${inst.name}`;
    }
    if (manageInstanceNameInput) {
      manageInstanceNameInput.value = inst.name || `${(inst.loader || 'fabric').toUpperCase()} ${inst.gameVersion}`;
    }
    updateManageModalSummary(inst);

    if (manageModSearchInput) {
      manageModSearchInput.value = '';
    }

    const chips = document.querySelectorAll('#manageCategoriesChips .filter-chip');
    chips.forEach(c => {
      if (c.getAttribute('data-category') === 'all') c.classList.add('active');
      else c.classList.remove('active');
    });

    // Default to the Installed mods tab
    switchManageModalTab('installed');
    manageInstanceModsModal?.classList.add('open');
  }

  function saveCurrentInstanceName() {
    if (!currentManagingInstanceId) return;
    const inst = (appConfig.instances || []).find(i => i.id === currentManagingInstanceId);
    if (!inst) return;
    const newName = (manageInstanceNameInput?.value || '').trim();
    if (!newName) {
      const fallbackName = `${(inst.loader || 'fabric').toUpperCase()} ${inst.gameVersion}`;
      inst.name = fallbackName;
      if (manageInstanceNameInput) manageInstanceNameInput.value = fallbackName;
    } else {
      inst.name = newName;
    }
    saveConfig();
    updateInstancesUI();
    updateManageModalSummary(inst);
    const t = (k, fb) => (window.I18N ? window.I18N.t(k, fb) : fb);
    if (manageInstanceModsTitle) {
      manageInstanceModsTitle.textContent = `${t('manage_mods_modal_title', 'Конфигурация сборки')}: ${inst.name}`;
    }
    if (appConfig.selectedInstanceId === inst.id && launchVersionTitle && !isLaunching) {
      launchVersionTitle.textContent = '';
    }
    showSnackbar(t('toast_name_saved', 'Название сборки сохранено'), 'success');
  }

  btnSaveInstanceName?.addEventListener('click', saveCurrentInstanceName);
  manageInstanceNameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveCurrentInstanceName();
    }
  });

  function updateManageModalSummary(inst) {
    if (!inst) inst = (appConfig.instances || []).find(i => i.id === currentManagingInstanceId);
    if (!inst) return;
    const modsCount = (inst.mods || []).length;
    if (manageInstanceModsSubtitle) {
      manageInstanceModsSubtitle.textContent = (window.I18N ? window.I18N.t('mods_count_label', '{loader} {version} • {count} модов') : '{loader} {version} • {count} модов').replace('{loader}', (inst.loader || 'fabric').toUpperCase()).replace('{version}', inst.gameVersion).replace('{count}', modsCount);
    }
    if (tabInstalledModsBadge) {
      tabInstalledModsBadge.textContent = modsCount;
    }
    if (manageModsFooterSummary) {
      const selectedWord = window.I18N ? window.I18N.t('wizard_mods_selected_count', 'выбрано') : 'выбрано';
      manageModsFooterSummary.textContent = `${modsCount} ${selectedWord}`;
    }
  }

  function closeManageModsModal() {
    manageInstanceModsModal?.classList.remove('open');
    currentManagingInstanceId = null;
  }

  btnCloseManageModsModal?.addEventListener('click', closeManageModsModal);
  btnSaveManageMods?.addEventListener('click', closeManageModsModal);

  manageInstanceModsModal?.addEventListener('click', (e) => {
    if (e.target === manageInstanceModsModal) {
      closeManageModsModal();
    }
  });

  // Category chips for manage modal
  const manageCategoriesChips = document.querySelectorAll('#manageCategoriesChips .filter-chip');
  manageCategoriesChips.forEach(chip => {
    chip.addEventListener('click', () => {
      manageCategoriesChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeManageCategory = chip.getAttribute('data-category') || 'all';
      renderManageMods();
    });
  });

  // Search input with debounce for manage modal
  manageModSearchInput?.addEventListener('input', () => {
    clearTimeout(manageSearchDebounceTimer);
    manageSearchDebounceTimer = setTimeout(() => {
      fetchOrFilterManageMods();
    }, 350);
  });

  async function fetchOrFilterManageMods() {
    const inst = (appConfig.instances || []).find(i => i.id === currentManagingInstanceId);
    if (!inst || inst.loader === 'vanilla') {
      renderManageMods();
      return;
    }

    const query = (manageModSearchInput?.value || '').trim();
    const loader = inst.loader;
    const gv = inst.gameVersion;

    try {
      if (window.electronAPI?.searchMods) {
        const res = await window.electronAPI.searchMods({ query, loader, gameVersion: gv, limit: 50 });
        if (res?.success && Array.isArray(res.hits)) {
          manageApiHits = res.hits.map(h => ({
            id: h.project_id || h.slug,
            slug: h.slug,
            title: h.title,
            author: h.author,
            description: h.description,
            icon_url: h.icon_url,
            downloads: h.downloads,
            categories: h.categories || [],
            loaders: h.categories ? h.categories.filter(c => ['fabric', 'forge', 'neoforge', 'quilt'].includes(c)) : [loader]
          }));
        }
      }
    } catch (e) {
      console.warn('Live manage mod search error:', e);
    }

    renderManageMods();
  }

  function renderManageMods() {
    if (!manageModsList) return;
    const inst = (appConfig.instances || []).find(i => i.id === currentManagingInstanceId);
    if (!inst) return;

    if (inst.loader === 'vanilla') {
      manageModsList.innerHTML = `
        <div class="mods-empty-state" style="padding: 28px 16px; text-align: center;">
          <div style="font-size: 14.5px; font-weight: 700; color: var(--md-sys-color-on-surface);">Версия Vanilla</div>
          <p style="font-size: 12px; color: var(--md-sys-color-on-surface-variant); margin-top: 4px;">Чистая игра запускается без загрузчика модов.</p>
        </div>
      `;
      return;
    }

    const query = (manageModSearchInput?.value || '').toLowerCase().trim();
    const curatedFiltered = POPULAR_MODS.filter(m => isModCompatibleWithLoader(m.loaders, inst.loader));
    const apiFiltered = manageApiHits.filter(m => isModCompatibleWithLoader(m.loaders, inst.loader));

    const seenIds = new Set();
    const merged = [];
    const primaryList = query ? apiFiltered : curatedFiltered;
    const secondaryList = query ? curatedFiltered : apiFiltered;

    primaryList.forEach(m => {
      if (!seenIds.has(m.id)) {
        seenIds.add(m.id);
        merged.push(m);
      }
    });

    secondaryList.forEach(m => {
      if (!seenIds.has(m.id)) {
        seenIds.add(m.id);
        merged.push(m);
      }
    });

    let finalList = merged;
    if (activeManageCategory !== 'all') {
      finalList = finalList.filter(m => {
        if (!Array.isArray(m.categories)) return false;
        return m.categories.some(c => c.toLowerCase().includes(activeManageCategory.toLowerCase()));
      });
    }

    if (query) {
      finalList = finalList.filter(m => {
        return (m.title || '').toLowerCase().includes(query) ||
               (m.description || '').toLowerCase().includes(query) ||
               (m.author || '').toLowerCase().includes(query);
      });
    }

    manageModsList.innerHTML = '';

    if (finalList.length === 0) {
      manageModsList.innerHTML = `
        <div class="mods-empty-state" style="padding: 24px 16px; text-align: center;">
          <div style="font-size: 13.5px; font-weight: 600; color: var(--md-sys-color-on-surface);">${window.I18N ? window.I18N.t('mods_not_found', 'Моды не найдены') : 'Моды не найдены'}</div><p style="font-size: 11.5px; color: var(--md-sys-color-on-surface-variant); margin-top: 2px;">${window.I18N ? window.I18N.t('mods_not_found_desc', 'Попробуйте изменить категорию или поисковый запрос.') : 'Попробуйте изменить категорию или поисковый запрос.'}</p>
        </div>
      `;
      return;
    }

    const installedModIds = new Set((inst.mods || []).map(m => m.id));

    finalList.forEach(mod => {
      const isSelected = installedModIds.has(mod.id);
      const item = document.createElement('div');
      item.className = 'wizard-mod-item ' + (isSelected ? 'selected' : '');

      const safeTitle = escapeHtml(mod.title || '');
      const safeAuthor = escapeHtml(mod.author || 'Author');
      const safeDesc = escapeHtml((mod.descKey && window.I18N ? window.I18N.t(mod.descKey, mod.description) : mod.description) || (window.I18N ? window.I18N.t('mod_no_desc', 'Описание отсутствует') : 'Описание отсутствует'));
      const safeIcon = (mod.icon_url && /^https?:\/\//i.test(mod.icon_url)) ? escapeHtml(mod.icon_url) : '';

      const iconMarkup = safeIcon
        ? `<img src="${safeIcon}" class="wizard-mod-icon" alt="${safeTitle}" onerror="this.style.display='none';">`
        : `<div class="wizard-mod-icon"><svg viewBox="0 0 24 24"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5s-1.12-2.5-2.5-2.5z"/></svg></div>`;

      const loaderBadges = (mod.loaders || [])
        .filter(l => ['fabric', 'forge', 'neoforge', 'quilt'].includes(l))
        .map(l => `<span class="minimal-instance-badge" style="font-size: 9.5px; padding: 1px 5px; text-transform: uppercase;">${escapeHtml(l)}</span>`)
        .join(' ');

      item.innerHTML = `
        <div class="wizard-mod-info">
          ${iconMarkup}
          <div class="wizard-mod-text">
            <div class="wizard-mod-name-row">
              <span class="wizard-mod-name">${safeTitle}</span>
              <span class="wizard-mod-author">by ${safeAuthor}</span>
              ${loaderBadges}
            </div>
            <span class="wizard-mod-desc">${safeDesc}</span>
          </div>
        </div>
        <div class="wizard-mod-checkbox">${isSelected ? '✓' : ''}</div>
      `;

      item.addEventListener('click', () => {
        if (installedModIds.has(mod.id)) {
          removeModFromInstance(inst.id, mod.id);
        } else {
          addModToInstance(inst.id, mod);
        }
        updateManageModalSummary();
        renderManageMods();
      });

      manageModsList.appendChild(item);
    });
  }

  // Open Mods Folder
  btnOpenModsFolder?.addEventListener('click', async () => {
    if (window.electronAPI?.openModsFolder) {
      await window.electronAPI.openModsFolder(appConfig.selectedInstanceId);
    } else if (window.electronAPI?.openMinecraftFolder) {
      await window.electronAPI.openMinecraftFolder();
    }
  });

  // Wizard Accordion Navigation
  function setWizardStep(stepNum) {
    [wizardStep1, wizardStep2, wizardStep3].forEach((box, idx) => {
      if (idx + 1 === stepNum) {
        box?.classList.add('active');
      } else {
        box?.classList.remove('active');
      }
    });
    // Ensure modal scroll position is reset to top so step headers never clip
    if (createVersionModal) {
      const modalBox = createVersionModal.querySelector('.create-version-wizard-modal');
      if (modalBox) modalBox.scrollTop = 0;
    }
    if (stepNum === 3) {
      fetchOrFilterWizardMods();
    }
  }

  wizardStep1Header?.addEventListener('click', () => setWizardStep(1));
  wizardStep2Header?.addEventListener('click', () => setWizardStep(2));
  wizardStep3Header?.addEventListener('click', () => setWizardStep(3));

  let wizardVersionsExpanded = false;
  const btnToggleAllWizardVersions = document.getElementById('btnToggleAllWizardVersions');
  const txtToggleAllWizardVersions = document.getElementById('txtToggleAllWizardVersions');

  btnToggleAllWizardVersions?.addEventListener('click', () => {
    wizardVersionsExpanded = !wizardVersionsExpanded;
    btnToggleAllWizardVersions.classList.toggle('expanded', wizardVersionsExpanded);
    wizardVersionsGrid?.classList.toggle('expanded', wizardVersionsExpanded);
    if (txtToggleAllWizardVersions) {
      txtToggleAllWizardVersions.textContent = wizardVersionsExpanded 
        ? (window.I18N ? window.I18N.t('cv_hide_versions', 'Скрыть версии') : 'Скрыть версии')
        : (window.I18N ? window.I18N.t('cv_show_all_versions', 'Показать все версии') : 'Показать все версии');
    }
    renderWizardVersions();
  });

  function isSnapshotVersion(v) {
    const id = typeof v === 'string' ? v : (v?.id || '');
    const type = typeof v === 'object' ? v?.type : '';
    if (type === 'snapshot') return true;
    if (/snapshot/i.test(id)) return true;
    if (/[-_](pre|rc|beta|alpha)/i.test(id)) return true;
    if (/^\d{2}w\d{2}[a-z]/i.test(id)) return true;
    return false;
  }

  function isVersionGte(v1, v2) {
    const p1 = (v1 || '').split(/[-_]/)[0].split('.').map(x => parseInt(x, 10) || 0);
    const p2 = (v2 || '').split(/[-_]/)[0].split('.').map(x => parseInt(x, 10) || 0);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const a = p1[i] || 0;
      const b = p2[i] || 0;
      if (a > b) return true;
      if (a < b) return false;
    }
    return true;
  }

  function isVersionSupportedByLoader(v, loader) {
    const id = typeof v === 'string' ? v : (v?.id || '');
    const type = typeof v === 'object' ? v?.type : 'release';
    const isSnapshot = isSnapshotVersion(v);

    if (loader === 'forge') {
      // Forge NEVER supports snapshots!
      if (isSnapshot || type !== 'release') return false;
      if (/^(rd-|inf-|in-|c0\.|b1\.|a1\.)/i.test(id)) return false;
      return true;
    }
    if (loader === 'neoforge') {
      // NeoForge has no snapshots and only supports >= 1.20.2
      if (isSnapshot || type !== 'release') return false;
      return isVersionGte(id, '1.20.2');
    }
    if (loader === 'fabric' || loader === 'quilt') {
      if (isSnapshot) {
        if (/^(rd-|inf-|in-|c0\.|b1\.|a1\.|13w|14w|15w|16w|17w)/i.test(id)) return false;
        return true;
      }
      return isVersionGte(id, '1.14');
    }
    return true; // vanilla
  }

  function updateLoaderCompatibility() {
    const supportsSnapshots = (selectedCvLoader !== 'forge' && selectedCvLoader !== 'neoforge');
    const loaderName = selectedCvLoader.charAt(0).toUpperCase() + selectedCvLoader.slice(1);

    if (!supportsSnapshots) {
      if (cvShowSnapshotsCheckbox) {
        cvShowSnapshotsCheckbox.checked = false;
        cvShowSnapshotsCheckbox.disabled = true;
      }
      if (cvShowSnapshotsLabel) {
        cvShowSnapshotsLabel.classList.add('disabled');
        const notSupportedTpl = window.I18N ? window.I18N.t('cv_snapshots_not_supported', 'Снапшоты недоступны для {loader}') : `Снапшоты недоступны для {loader}`;
        cvShowSnapshotsLabel.title = notSupportedTpl.replace('{loader}', loaderName);
      }
      if (cvShowSnapshotsText) {
        const notSupportedWord = window.I18N ? window.I18N.t('cv_unavailable', 'недоступно') : 'недоступно';
        const baseTxt = window.I18N ? window.I18N.t('cv_show_snapshots', 'Снапшоты') : 'Снапшоты';
        cvShowSnapshotsText.textContent = `${baseTxt} (${notSupportedWord})`;
      }
    } else {
      if (cvShowSnapshotsCheckbox) {
        cvShowSnapshotsCheckbox.disabled = false;
      }
      if (cvShowSnapshotsLabel) {
        cvShowSnapshotsLabel.classList.remove('disabled');
        cvShowSnapshotsLabel.removeAttribute('title');
      }
      if (cvShowSnapshotsText) {
        cvShowSnapshotsText.textContent = window.I18N ? window.I18N.t('cv_show_snapshots', 'Снапшоты') : 'Снапшоты';
      }
    }

    // Check if current version is compatible with selected loader
    if (!isVersionSupportedByLoader(selectedCvVersion, selectedCvLoader)) {
      const popular = LOADER_POPULAR_VERSIONS[selectedCvLoader] || LOADER_POPULAR_VERSIONS.fabric;
      selectedCvVersion = popular[0]?.id || '1.21.1';
      if (wizardStep2Value) {
        wizardStep2Value.textContent = selectedCvVersion;
      }
    }
  }

  function getDynamicPopularVersions(loader) {
    const baseList = LOADER_POPULAR_VERSIONS[loader] || LOADER_POPULAR_VERSIONS.fabric;
    const latestRelease = manifestData?.latest?.release;

    if (latestRelease && isVersionSupportedByLoader(latestRelease, loader)) {
      if (!baseList.some(v => v.id === latestRelease)) {
        const latestTag = window.I18N ? window.I18N.t('label_latest_release', 'Новейшая') : 'Новейшая';
        return [{ id: latestRelease, tag: latestTag, type: 'release' }, ...baseList];
      }
    }
    return baseList;
  }

  // Step 2: Render Version Tiles
  function renderWizardVersions() {
    if (!wizardVersionsGrid) return;
    const query = (wizardVersionSearchInput?.value || '').toLowerCase().trim();
    const loader = selectedCvLoader || 'fabric';
    const supportsSnapshots = (loader !== 'forge' && loader !== 'neoforge');
    const showSnapshots = supportsSnapshots && cvShowSnapshotsCheckbox?.checked;

    let versions = getDynamicPopularVersions(loader);

    if (query || wizardVersionsExpanded || showSnapshots) {
      if (manifestData?.versions && manifestData.versions.length > 0) {
        const allVers = manifestData.versions
          .filter(v => isVersionSupportedByLoader(v, loader))
          .map(v => ({
            id: v.id,
            tag: isSnapshotVersion(v) ? 'Snapshot' : '',
            type: v.type
          }));

        versions = allVers.filter(v => showSnapshots || !isSnapshotVersion(v));
      }
    }

    if (query) {
      versions = versions.filter(v => v.id.toLowerCase().includes(query));
    }

    wizardVersionsGrid.innerHTML = '';
    const sliceCount = (query || wizardVersionsExpanded) ? versions.length : 8;
    const sliceToShow = versions.slice(0, sliceCount);

    if (sliceToShow.length === 0) {
      const emptyMsg = window.I18N ? window.I18N.t('modal_version_not_found', 'Версии не найдены') : 'Версии не найдены';
      wizardVersionsGrid.innerHTML = `<div style="grid-column: 1/-1; padding: 20px; text-align: center; color: var(--md-sys-color-on-surface-variant); font-size: 13px;">${escapeHtml(emptyMsg)}</div>`;
      return;
    }

    sliceToShow.forEach(v => {
      const tile = document.createElement('div');
      tile.className = 'wizard-version-tile ' + (v.id === selectedCvVersion ? 'active' : '');
      tile.innerHTML = `<span>${escapeHtml(v.id)}</span>${v.tag ? `<span class="version-tag">${escapeHtml(v.tag)}</span>` : ''}`;
      tile.addEventListener('click', () => {
        selectedCvVersion = v.id;
        if (wizardStep2Value) wizardStep2Value.textContent = v.id;
        updateWizardDefaultName();
        renderWizardVersions();
        // Advance to Step 3 (Choose mods)
        setWizardStep(3);
      });
      wizardVersionsGrid.appendChild(tile);
    });
  }

  wizardVersionSearchInput?.addEventListener('input', () => {
    renderWizardVersions();
  });

  cvShowSnapshotsCheckbox?.addEventListener('change', () => {
    renderWizardVersions();
  });

  function updateWizardDefaultName() {
    if (cvInstanceNameInput) {
      const loaderName = selectedCvLoader.charAt(0).toUpperCase() + selectedCvLoader.slice(1);
      cvInstanceNameInput.value = `${loaderName} ${selectedCvVersion}`;
    }
  }

  // Step 1: Loader & Provider selection
  cvLoaderCards.forEach(card => {
    card.addEventListener('click', () => {
      cvLoaderCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selectedCvLoader = card.getAttribute('data-loader') || 'fabric';

      const loaderDisplay = selectedCvLoader.charAt(0).toUpperCase() + selectedCvLoader.slice(1);
      if (wizardStep1Value) wizardStep1Value.textContent = loaderDisplay;

      updateLoaderCompatibility();
      updateWizardDefaultName();
      renderWizardVersions();

      // Clear previous selected mods when switching loader to prevent incompatible cross-installation!
      selectedCvMods.clear();
      updateWizardModsSummary();

      // Auto-advance to Step 2 (Select version)
      setWizardStep(2);
    });
  });

  cvProviderCards.forEach(chip => {
    chip.addEventListener('click', () => {
      cvProviderCards.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedCvProvider = chip.getAttribute('data-provider') || 'modrinth';
      fetchOrFilterWizardMods();
    });
  });

  // Step 3: Fetch mods from API with Loader and Category filters
  async function fetchOrFilterWizardMods() {
    if (selectedCvLoader === 'vanilla') {
      renderWizardMods();
      return;
    }

    const query = (wizardModSearchInput?.value || '').trim();
    const loader = selectedCvLoader; // 'fabric', 'forge', 'neoforge', 'quilt'
    const gv = selectedCvVersion;

    try {
      if (window.electronAPI?.searchMods) {
        const res = await window.electronAPI.searchMods({ query, loader, gameVersion: gv, limit: 50 });
        if (res?.success && Array.isArray(res.hits)) {
          wizardApiHits = res.hits.map(h => ({
            id: h.project_id || h.slug,
            slug: h.slug,
            title: h.title,
            author: h.author,
            description: h.description,
            icon_url: h.icon_url,
            downloads: h.downloads,
            categories: h.categories || [],
            loaders: h.categories ? h.categories.filter(c => ['fabric', 'forge', 'neoforge', 'quilt'].includes(c)) : [loader]
          }));
        }
      }
    } catch (e) {
      console.warn('Live mod search error:', e);
    }

    renderWizardMods();
  }

  // Helper to check loader compatibility
  function isModCompatibleWithLoader(modLoaders, targetLoader) {
    if (!Array.isArray(modLoaders) || modLoaders.length === 0) return true;
    if (targetLoader === 'neoforge') {
      return modLoaders.includes('neoforge') || modLoaders.includes('forge');
    }
    if (targetLoader === 'quilt') {
      return modLoaders.includes('quilt') || modLoaders.includes('fabric');
    }
    return modLoaders.includes(targetLoader);
  }

  // Step 3: Render list with strict loader and category filtering
  function renderWizardMods() {
    if (!wizardModsList) return;

    if (selectedCvLoader === 'vanilla') {
      const step1Text = window.I18N ? window.I18N.t('wizard_step_1_title', 'Шаг 1: Загрузчик модов') : 'Шаг 1: Загрузчик модов';
      wizardModsList.innerHTML = `
        <div class="mods-empty-state" style="padding: 28px 16px; text-align: center;">
          <svg class="mods-empty-icon" viewBox="0 0 24 24" style="width: 38px; height: 38px; fill: var(--md-sys-color-primary);"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
          <div style="font-size: 14.5px; font-weight: 700; color: var(--md-sys-color-on-surface); margin-top: 8px;">Версия Vanilla (чистая игра)</div>
          <p style="font-size: 12px; color: var(--md-sys-color-on-surface-variant); margin-top: 4px; line-height: 1.4;">Чистая игра запускается без загрузчика модов.<br>Если вы хотите установить моды, откройте <b>${escapeHtml(step1Text)}</b> и выберите <b>Fabric</b>, <b>Forge</b> или <b>NeoForge</b>.</p>
        </div>
      `;
      return;
    }

    const query = (wizardModSearchInput?.value || '').toLowerCase().trim();

    // 1. Filter curated mods strictly by the selected loader
    const curatedFiltered = POPULAR_MODS.filter(m => isModCompatibleWithLoader(m.loaders, selectedCvLoader));

    // 2. Filter API hits by selected loader
    const apiFiltered = wizardApiHits.filter(m => isModCompatibleWithLoader(m.loaders, selectedCvLoader));

    // 3. Merge without duplicate IDs
    const seenIds = new Set();
    const merged = [];

    // Prioritize API hits if user typed search, otherwise show curated first
    const primaryList = query ? apiFiltered : curatedFiltered;
    const secondaryList = query ? curatedFiltered : apiFiltered;

    primaryList.forEach(m => {
      if (!seenIds.has(m.id)) {
        seenIds.add(m.id);
        merged.push(m);
      }
    });

    secondaryList.forEach(m => {
      if (!seenIds.has(m.id)) {
        seenIds.add(m.id);
        merged.push(m);
      }
    });

    // 4. Filter by Category
    let finalList = merged;
    if (activeWizardCategory !== 'all') {
      finalList = finalList.filter(m => {
        if (!Array.isArray(m.categories)) return false;
        return m.categories.some(c => c.toLowerCase().includes(activeWizardCategory.toLowerCase()));
      });
    }

    // 5. Filter by Query text
    if (query) {
      finalList = finalList.filter(m => {
        return (m.title || '').toLowerCase().includes(query) ||
               (m.description || '').toLowerCase().includes(query) ||
               (m.author || '').toLowerCase().includes(query);
      });
    }

    wizardModsList.innerHTML = '';

    if (finalList.length === 0) {
      wizardModsList.innerHTML = `
        <div class="mods-empty-state" style="padding: 24px 16px; text-align: center;">
          <svg class="mods-empty-icon" viewBox="0 0 24 24" style="width: 32px; height: 32px; fill: var(--md-sys-color-on-surface-variant);"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <div style="font-size: 13.5px; font-weight: 600; color: var(--md-sys-color-on-surface);">${window.I18N ? window.I18N.t('mods_not_found', 'Моды не найдены') : 'Моды не найдены'}</div><p style="font-size: 11.5px; color: var(--md-sys-color-on-surface-variant); margin-top: 2px;">${window.I18N ? window.I18N.t('mods_not_found_desc', 'Попробуйте изменить категорию или поисковый запрос.') : 'Попробуйте изменить категорию или поисковый запрос.'}</p>
        </div>
      `;
      return;
    }

    finalList.forEach(mod => {
      const isSelected = selectedCvMods.has(mod.id);
      const item = document.createElement('div');
      item.className = 'wizard-mod-item ' + (isSelected ? 'selected' : '');
      
      const safeTitle = escapeHtml(mod.title || '');
      const safeAuthor = escapeHtml(mod.author || 'Author');
      const safeDesc = escapeHtml((mod.descKey && window.I18N ? window.I18N.t(mod.descKey, mod.description) : mod.description) || (window.I18N ? window.I18N.t('mod_no_desc', 'Описание отсутствует') : 'Описание отсутствует'));
      const safeIcon = (mod.icon_url && /^https?:\/\//i.test(mod.icon_url)) ? escapeHtml(mod.icon_url) : '';

      const iconMarkup = safeIcon
        ? `<img src="${safeIcon}" class="wizard-mod-icon" alt="${safeTitle}" onerror="this.style.display='none';">`
        : `<div class="wizard-mod-icon"><svg viewBox="0 0 24 24"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5s-1.12-2.5-2.5-2.5z"/></svg></div>`;

      const loaderBadges = (mod.loaders || [])
        .filter(l => ['fabric', 'forge', 'neoforge', 'quilt'].includes(l))
        .map(l => `<span class="minimal-instance-badge" style="font-size: 9.5px; padding: 1px 5px; text-transform: uppercase;">${escapeHtml(l)}</span>`)
        .join(' ');

      item.innerHTML = `
        <div class="wizard-mod-info">
          ${iconMarkup}
          <div class="wizard-mod-text">
            <div class="wizard-mod-name-row">
              <span class="wizard-mod-name">${safeTitle}</span>
              <span class="wizard-mod-author">by ${safeAuthor}</span>
              ${loaderBadges}
            </div>
            <span class="wizard-mod-desc">${safeDesc}</span>
          </div>
        </div>
        <div class="wizard-mod-checkbox">${isSelected ? '✓' : ''}</div>
      `;

      item.addEventListener('click', () => {
        if (selectedCvMods.has(mod.id)) {
          selectedCvMods.delete(mod.id);
        } else {
          selectedCvMods.add(mod.id);
        }
        updateWizardModsSummary();
        renderWizardMods();
      });

      wizardModsList.appendChild(item);
    });
  }

  function updateWizardModsSummary() {
    if (wizardStep3Value) {
      const selectedWord = window.I18N ? window.I18N.t('wizard_mods_selected_count', 'выбрано') : 'выбрано';
      wizardStep3Value.textContent = `${selectedCvMods.size} ${selectedWord}`;
    }
  }

  wizardModSearchInput?.addEventListener('input', () => {
    clearTimeout(wizardSearchDebounceTimer);
    wizardSearchDebounceTimer = setTimeout(() => {
      fetchOrFilterWizardMods();
    }, 300);
  });

  // Open / Close Modal
  btnOpenCreateVersionModal?.addEventListener('click', () => {
    createVersionModal?.classList.add('open');
    setWizardStep(1);
    selectedCvMods.clear();
    updateWizardModsSummary();
    const loaderDisplay = selectedCvLoader.charAt(0).toUpperCase() + selectedCvLoader.slice(1);
    if (wizardStep1Value) wizardStep1Value.textContent = loaderDisplay;
    updateLoaderCompatibility();
    renderWizardVersions();
    if (wizardStep2Value) wizardStep2Value.textContent = selectedCvVersion;
    updateWizardDefaultName();
  });

  btnCloseCreateVersionModal?.addEventListener('click', () => {
    createVersionModal?.classList.remove('open');
  });

  btnCancelCreateVersion?.addEventListener('click', () => {
    createVersionModal?.classList.remove('open');
  });

  createVersionModal?.addEventListener('click', (e) => {
    if (e.target === createVersionModal) {
      createVersionModal.classList.remove('open');
    }
  });

  // Submit Create Version
  btnSubmitCreateVersion?.addEventListener('click', () => {
    const name = cvInstanceNameInput?.value.trim() || `${selectedCvLoader.toUpperCase()} ${selectedCvVersion}`;

    const chosenMods = Array.from(selectedCvMods).map(id => {
      const m = POPULAR_MODS.find(p => p.id === id) || wizardApiHits.find(h => h.id === id) || { id, title: id };
      return {
        id: m.id,
        title: m.title,
        author: m.author || 'Author',
        description: m.description || '',
        icon_url: m.icon_url || '',
        downloads: m.downloads || 0,
        categories: m.categories || [],
        installedAt: Date.now()
      };
    });

    const newInstance = {
      id: 'inst-' + Date.now(),
      name: name,
      gameVersion: selectedCvVersion,
      loader: selectedCvLoader,
      modProvider: selectedCvProvider,
      created: Date.now(),
      mods: chosenMods
    };

    if (!Array.isArray(appConfig.instances)) {
      appConfig.instances = [];
    }

    appConfig.instances.push(newInstance);
    selectInstance(newInstance.id);
    createVersionModal?.classList.remove('open');

    // Show nice feedback via M3 Snackbar
    const baseCreatedMsg = window.I18N?.t('toast_version_created') || 'Version created';
    const msg = `${baseCreatedMsg}: "${name}" (${chosenMods.length})`;
    showSnackbar(msg, 'success');

    if (chosenMods.length > 0 && window.electronAPI?.downloadInstanceMods) {
      showSnackbar((window.I18N ? window.I18N.t('toast_downloading_all_mods', 'Скачивание {count} модов в изолированную папку сборки...') : 'Скачивание {count} модов в изолированную папку сборки...').replace('{count}', chosenMods.length), 'info');
      window.electronAPI.downloadInstanceMods(newInstance.id).then(res => {
        if (res?.success) {
          showSnackbar((window.I18N ? window.I18N.t('toast_all_mods_downloaded', 'Все моды успешно скачаны в сборку "{name}"!') : 'Все моды успешно скачаны в сборку "{name}"!').replace('{name}', name), 'success');
          updateInstancesUI();
        }
      });
    }
  });
  // Initial load of instances UI
  updateInstancesUI();


  // 9. Live Mojang News Fetcher (https://launchercontent.mojang.com/v2/news.json)
  const heroBanner = document.getElementById('heroBanner');
  const heroTitle = document.getElementById('heroTitle');
  const heroSubtitle = document.getElementById('heroSubtitle');
  const heroBadgeText = document.getElementById('heroBadgeText');
  const heroPagination = document.getElementById('heroPagination');
  const newsGrid = document.getElementById('newsGrid');
  const newsViewAll = document.getElementById('newsViewAll');

  let allNewsEntries = [];
  let currentHeroIndex = 0;

  newsViewAll?.addEventListener('click', (e) => {
    e.preventDefault();
    const url = 'https://www.minecraft.net/articles';
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  });

  function updateHeroStory(index) {
    if (!allNewsEntries || allNewsEntries.length === 0) return;
    currentHeroIndex = index % Math.min(3, allNewsEntries.length);
    const item = allNewsEntries[currentHeroIndex];
    if (!item) return;

    if (heroTitle) heroTitle.textContent = item.title || 'Minecraft Update';
    if (heroSubtitle) heroSubtitle.textContent = item.text || 'Discover the latest additions, improvements, and features in Minecraft.';
    
    // Tag
    let tag = (item.tag || '').toUpperCase();
    if (!tag && item.category) {
      if (item.category.toLowerCase().includes('snapshot')) tag = 'SNAPSHOT';
      else if (item.category.toLowerCase().includes('java')) tag = 'JAVA UPDATE';
      else tag = 'NEW UPDATE';
    }
    if (!tag) tag = 'NEW UPDATE';
    if (heroBadgeText) heroBadgeText.textContent = tag;

    // Image
    let imgPath = item.newsPageImage?.url || item.playPageImage?.url || '';
    if (imgPath && imgPath.startsWith('/')) {
      imgPath = 'https://launchercontent.mojang.com' + imgPath;
    }

    const heroBannerImg = document.getElementById('heroBannerImg');
    if (heroBanner) {
      if (heroBannerImg) {
        if (imgPath) {
          heroBannerImg.style.display = 'block';
          heroBannerImg.onerror = () => { heroBannerImg.style.display = 'none'; };
          heroBannerImg.src = imgPath;
        } else {
          heroBannerImg.style.display = 'none';
        }
      }
      heroBanner.onclick = (e) => {
        // If clicked on pagination dot, don't open link
        if (e.target.closest('#heroPagination')) return;
        const link = item.readMoreLink || 'https://www.minecraft.net';
        if (window.electronAPI?.openExternal) {
          window.electronAPI.openExternal(link);
        } else {
          window.open(link, '_blank');
        }
      };
    }

    // Update dots
    const dots = heroPagination?.querySelectorAll('.pag-dot');
    dots?.forEach((dot, dIdx) => {
      if (dIdx === currentHeroIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  // Allow clicking pagination dots
  heroPagination?.addEventListener('click', (e) => {
    const dot = e.target.closest('.pag-dot');
    if (dot) {
      const idx = parseInt(dot.getAttribute('data-index') || '0', 10);
      updateHeroStory(idx);
    }
  });

  function renderNews(entries) {
    if (!entries || entries.length === 0) return;
    allNewsEntries = entries;

    // 1. Update Hero Banner with top featured story
    updateHeroStory(0);

    // 2. Render Cards in Latest News (items 1 and 2)
    if (!newsGrid) return;
    newsGrid.innerHTML = '';

    const cardEntries = entries.slice(1, 3);
    cardEntries.forEach((item, index) => {
      let imgPath = item.newsPageImage?.url || item.playPageImage?.url || '';
      if (imgPath && imgPath.startsWith('/')) {
        imgPath = 'https://launchercontent.mojang.com' + imgPath;
      }

      // Format Date with active locale
      let formattedDate = item.date || '';
      try {
        if (item.date) {
          const d = new Date(item.date);
          if (!isNaN(d.getTime())) {
            const currentLang = (window.I18N?.currentLanguage || 'en_US').replace('_', '-');
            formattedDate = d.toLocaleDateString(currentLang, { month: 'short', day: 'numeric', year: 'numeric' });
          }
        }
      } catch (err) {
        formattedDate = item.date;
      }

      // Determine Tag
      let tag = (item.tag || '').toUpperCase();
      if (!tag && item.category) {
        if (item.category.toLowerCase().includes('snapshot')) tag = 'SNAPSHOT';
        else if (item.category.toLowerCase().includes('java')) tag = 'JAVA';
        else tag = 'UPDATE';
      }
      if (!tag) tag = index === 0 ? 'UPDATE' : 'SNAPSHOT';

      const card = document.createElement('article');
      card.className = `news-card ${index === 0 ? 'news-card-green' : 'news-card-blue'}`;
      card.title = 'Открыть новость на minecraft.net';

      const safeTitle = escapeHtml(item.title || 'Minecraft News');
      const safeTag = escapeHtml(tag);
      const safeDate = escapeHtml(formattedDate);
      const safeImg = (imgPath && /^https?:\/\//i.test(imgPath)) ? escapeHtml(imgPath) : '';

      card.innerHTML = `
        <div class="news-thumbnail">
          ${safeImg ? `<img src="${safeImg}" class="news-thumb-img" alt="${safeTitle}" onerror="this.style.display='none'" />` : ''}
          <span class="news-tag">${safeTag}</span>
        </div>
        <div class="news-info">
          <span class="news-date">${safeDate}</span>
          <h3 class="news-title">${safeTitle}</h3>
        </div>
      `;

      card.addEventListener('click', () => {
        const link = item.readMoreLink || 'https://www.minecraft.net';
        if (window.electronAPI?.openExternal) {
          window.electronAPI.openExternal(link);
        } else {
          window.open(link, '_blank');
        }
      });

      newsGrid.appendChild(card);
    });
  }

  async function loadMojangNews() {
    // 1. Try local storage cache for instant render
    const cached = localStorage.getItem('mojang_news_cache');
    if (cached) {
      try {
        renderNews(JSON.parse(cached));
      } catch (e) {}
    }

    // 2. Fetch live news from Mojang
    try {
      const response = await fetch('https://launchercontent.mojang.com/v2/news.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data && Array.isArray(data.entries) && data.entries.length > 0) {
        localStorage.setItem('mojang_news_cache', JSON.stringify(data.entries));
        renderNews(data.entries);
      }
    } catch (err) {
      console.warn('Could not fetch live Mojang news:', err);
    }
  }

  loadMojangNews();
});

