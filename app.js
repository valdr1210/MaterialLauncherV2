(() => {
  const RELEASE_BASE = 'https://github.com/valdr1210/MaterialLauncherV2/releases/download/v1.1.0';

  const PRIMARY_ASSETS = {
    windows: {
      url: `${RELEASE_BASE}/Material.Launcher-Setup-1.1.0.exe`,
      key: 'btn_dl_win'
    },
    linux: {
      url: `${RELEASE_BASE}/Material.Launcher-1.1.0.AppImage`,
      key: 'btn_dl_linux'
    }
  };

  // 1. OS Detection & Auto-selection
  function detectOS() {
    const ua = (navigator.userAgent || '').toLowerCase();
    const platform = (navigator.platform || '').toLowerCase();
    if (ua.includes('linux') || platform.includes('linux')) {
      return 'linux';
    }
    return 'windows';
  }

  function setActiveOS(os) {
    const segButtons = document.querySelectorAll('.seg-btn');
    const panes = document.querySelectorAll('.downloads-grid');

    segButtons.forEach((btn) => {
      const isMatch = btn.dataset.os === os;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-selected', String(isMatch));
    });

    panes.forEach((pane) => {
      pane.classList.toggle('active', pane.dataset.osPane === os);
    });
  }

  const detectedOS = detectOS();
  const primaryBtn = document.getElementById('primaryDownloadBtn');
  const primaryText = document.getElementById('primaryDownloadText');

  function updatePrimaryDownloadLabel() {
    if (!primaryBtn || !primaryText) return;
    const asset = PRIMARY_ASSETS[detectedOS];
    primaryBtn.href = asset.url;
    const dict = window.ML_I18N ? window.ML_I18N.getDict() : null;
    if (dict && dict[asset.key]) {
      primaryText.textContent = dict[asset.key];
    }
  }

  updatePrimaryDownloadLabel();
  window.addEventListener('ml:langchange', updatePrimaryDownloadLabel);
  setActiveOS(detectedOS);

  document.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => setActiveOS(btn.dataset.os));
  });

  const linuxJumpBtn = document.getElementById('linuxDownloadJump');
  if (linuxJumpBtn) {
    linuxJumpBtn.addEventListener('click', () => setActiveOS('linux'));
  }

  // 2. Theme Toggle (Dark / Light)
  const html = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem('ml_site_theme');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    html.setAttribute('data-theme', savedTheme);
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('ml_site_theme', next);
    });
  }

  // 3. M3 Accent Switcher
  function applyAccent(accent) {
    html.setAttribute('data-accent', accent);
    localStorage.setItem('ml_site_accent', accent);
    document.querySelectorAll('.accent-dot').forEach((d) => {
      d.classList.toggle('active', d.dataset.accent === accent);
    });
  }

  const savedAccent = localStorage.getItem('ml_site_accent');
  if (savedAccent) {
    applyAccent(savedAccent);
  }

  document.querySelectorAll('.accent-dot').forEach((dot) => {
    dot.addEventListener('click', () => applyAccent(dot.dataset.accent));
  });

  // 4. Interactive 3D Theme-Slice Showcase
  const themeStack = document.querySelector('.theme-stack');
  const slices = document.querySelectorAll('.theme-slice');
  const labels = document.querySelectorAll('.theme-label');

  function setActiveSlice(sliceName) {
    if (!themeStack) return;
    themeStack.classList.toggle('has-hover', Boolean(sliceName));
    slices.forEach((s) => s.classList.toggle('active', s.dataset.slice === sliceName));
    labels.forEach((l) => l.classList.toggle('active', l.dataset.label === sliceName));
  }

  slices.forEach((slice) => {
    slice.addEventListener('mouseenter', () => setActiveSlice(slice.dataset.slice));
    slice.addEventListener('mouseleave', () => setActiveSlice(null));
    slice.addEventListener('click', () => {
      const targetAccent = slice.dataset.accentTarget;
      if (targetAccent) applyAccent(targetAccent);
    });
  });

  // 5. Scroll-driven animation: move preview down & center, and flatten angle
  const mainEl = document.querySelector('main');
  const heroSection = document.querySelector('.hero');
  const showcase = document.getElementById('themeShowcase');
  const heroContainer = document.querySelector('.hero > .container');
  const heroCopy = document.querySelector('.hero-copy');

  let baseOffsetX = 0;
  let targetOffsetY = 240;
  const targetScale = 1.08;

  function measureShowcaseTarget() {
    if (!showcase || !heroContainer) return;
    const prevTransform = showcase.style.transform;
    showcase.style.transform = 'none';

    const showcaseRect = showcase.getBoundingClientRect();
    const containerRect = heroContainer.getBoundingClientRect();
    const copyRect = heroCopy ? heroCopy.getBoundingClientRect() : null;

    const showcaseCenterX = showcaseRect.left + showcaseRect.width / 2;
    const containerCenterX = containerRect.left + containerRect.width / 2;
    baseOffsetX = containerCenterX - showcaseCenterX;

    if (window.innerWidth <= 980) {
      baseOffsetX = 0;
      targetOffsetY = 16;
      if (heroSection) heroSection.style.paddingBottom = '88px';
    } else {
      const desiredTop = copyRect ? copyRect.bottom + 18 : showcaseRect.top + 220;
      targetOffsetY = Math.max(200, desiredTop - showcaseRect.top);
      const overhang = (showcaseRect.top + targetOffsetY + showcaseRect.height * targetScale) - containerRect.bottom;
      if (heroSection) {
        heroSection.style.paddingBottom = `${Math.max(40, Math.ceil(overhang + 8))}px`;
      }
    }

    showcase.style.transform = prevTransform;
  }

  let rafPending = false;
  let currentProgress = 0;
  let glowProgress = 0;
  let targetProgress = 0;

  function getTargetProgress() {
    const scrollStart = 70;
    const scrollRange = 360;
    const dist = window.scrollY - scrollStart;
    if (dist <= 0) return 0;
    if (scrollRange - dist <= 30) return 1;
    return Math.min(dist / scrollRange, 1);
  }

  function applyTransform(progress, gProgress) {
    if (!showcase || !themeStack) return;
    const eased = progress * progress * (3 - 2 * progress);
    const glowEased = gProgress * gProgress * (3 - 2 * gProgress);

    const isMoving =
      (progress > 0.015 && progress < 0.985) ||
      Math.abs(targetProgress - progress) > 0.004;

    showcase.classList.toggle('is-moving', isMoving);
    if (isMoving) {
      setActiveSlice(null);
    }

    const tx = baseOffsetX * eased;
    const ty = targetOffsetY * eased;
    const glowTy = targetOffsetY * glowEased;
    const scale = window.innerWidth <= 980 ? 1 : 1 + (targetScale - 1) * eased;

    const skew = 9 * (1 - eased);
    const rotY = -14 * (1 - eased);

    if (mainEl) {
      mainEl.style.setProperty('--glow-x', `${(72 - 22 * glowEased).toFixed(2)}%`);
      mainEl.style.setProperty('--glow-y', `${(300 + glowTy).toFixed(1)}px`);
    }

    showcase.style.setProperty('--flatten', eased.toFixed(4));
    if (eased >= 0.999) {
      showcase.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px) scale(${scale.toFixed(3)})`;
      themeStack.style.transform = 'none';
    } else if (eased <= 0.001) {
      showcase.style.transform = 'none';
      themeStack.style.transform = 'perspective(1400px) skewY(9deg) rotateY(-14deg)';
    } else {
      showcase.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
      themeStack.style.transform = `perspective(1400px) skewY(${skew.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
    }
  }

  function tickScrollTransform() {
    const diff = targetProgress - currentProgress;
    const glowDiff = targetProgress - glowProgress;

    if (Math.abs(diff) < 0.0008 && Math.abs(glowDiff) < 0.0008) {
      currentProgress = targetProgress;
      glowProgress = targetProgress;
      applyTransform(currentProgress, glowProgress);
      rafPending = false;
      return;
    }

    currentProgress = Math.abs(diff) < 0.0008 ? targetProgress : currentProgress + diff * 0.14;
    glowProgress = Math.abs(glowDiff) < 0.0008 ? targetProgress : glowProgress + glowDiff * 0.04;
    applyTransform(currentProgress, glowProgress);
    requestAnimationFrame(tickScrollTransform);
  }

  function onScrollOrResize(remeasure = false) {
    if (remeasure) measureShowcaseTarget();
    targetProgress = getTargetProgress();
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(tickScrollTransform);
    }
  }

  measureShowcaseTarget();
  currentProgress = glowProgress = targetProgress = getTargetProgress();
  applyTransform(currentProgress, glowProgress);
  window.addEventListener('scroll', () => onScrollOrResize(false), { passive: true });
  window.addEventListener('resize', () => onScrollOrResize(true), { passive: true });
})();
