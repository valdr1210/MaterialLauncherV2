(() => {
  const TRANSLATIONS = {
    en: {
      page_title: 'Material Launcher — Minecraft Launcher in Material Design 3',
      nav_features: 'Features',
      nav_preview: 'Interface',
      nav_downloads: 'Download',
      btn_download_short: 'Download',
      theme_toggle_title: 'Switch theme',
      hero_badge: 'Material Design 3 • Version 1.0.0',
      hero_title_1: 'Minecraft launcher',
      hero_title_2: 'with ',
      hero_title_accent: 'nothing extra',
      btn_dl_win: 'Download for Windows (.exe)',
      btn_dl_linux: 'Download for Linux (.AppImage)',
      preview_hint: 'Hover over any colored stripe to preview the theme',
      theme_emerald: 'Emerald',
      theme_ocean: 'Ocean',
      theme_lavender: 'Lavender',
      theme_sunset: 'Sunset',
      theme_sakura: 'Sakura',
      features_eyebrow: 'Why Material Launcher',
      features_title: 'Built for comfortable gaming',
      features_subtitle: 'No cluttered menus, banners, or outdated interfaces — just clean Material You and the tools you need at hand.',
      feat_1_title: 'Google Material Design 3',
      feat_1_desc: 'Soft rounded corners, adaptive dark and light themes, accent color palette, and smooth animations on every interaction.',
      feat_2_title: 'Built-in Mod Browser',
      feat_2_desc: 'Search and install mods from Modrinth and CurseForge right inside the launcher, and create separate modpacks for your versions.',
      feat_3_title: 'Any Loaders & Accounts',
      feat_3_desc: 'Vanilla, Fabric, Forge, NeoForge, and Quilt. Sign in via official Microsoft (OAuth 2.0), Ely.by with skins, or offline mode.',
      feat_4_title: 'Custom Game Folder & Migration',
      feat_4_desc: 'Pick any drive to store versions and mods without cluttering drive C:, with smart file migration or cleanup.',
      feat_5_title: 'Auto Java & Crash Diagnostics',
      feat_5_desc: 'Automatically finds or downloads the right Java version and analyzes crash logs to explain what went wrong.',
      feat_6_title: '8 Languages Out of the Box',
      feat_6_desc: 'Full localization in English, Russian, German, French, Spanish, Portuguese, Chinese, and Japanese.',
      dl_title: 'Download Material Launcher',
      dl_subtitle: 'Choose your operating system and preferred package format. All builds are free with no registration required.',
      dl_action: 'Download →',
      badge_recommended: 'Recommended',
      badge_universal: 'Universal',
      tag_archive: 'Archive',
      tag_sandbox: 'Sandbox',
      win_setup_title: 'Installer (Setup)',
      win_setup_desc: 'Classic setup wizard with folder selection, desktop shortcut, and Start Menu entry.',
      win_port_title: 'Portable Version',
      win_port_desc: 'Single executable file: launch and play from any drive or USB stick without installation.',
      win_msi_title: 'Windows Installer',
      win_msi_desc: 'Standard MSI package for system-wide deployment and Windows management.',
      win_zip_title: 'Unpacked Archive',
      win_zip_desc: 'Ready-to-run program folder inside a ZIP archive — just extract anywhere.',
      lin_appimage_title: 'AppImage',
      lin_appimage_desc: 'Runs on any Linux distro without installation. Make it executable and launch.',
      lin_deb_title: 'DEB Package',
      lin_deb_desc: 'For Ubuntu, Debian, Linux Mint, Pop!_OS, and derivatives. Install via apt.',
      lin_rpm_title: 'RPM Package',
      lin_rpm_desc: 'For Fedora, openSUSE, Red Hat, and other RPM-based distributions.',
      lin_flatpak_title: 'Flatpak Bundle',
      lin_flatpak_desc: 'Offline Flatpak bundle with permission sandboxing and desktop integration.',
      lin_targz_title: 'Binary tar.gz',
      lin_targz_desc: 'Classic Linux archive with the ready-to-run executable.',
      lin_zip_title: 'Linux ZIP',
      lin_zip_desc: 'Portable archive for quick extraction on any Linux system.',
      footer_copy: 'Open Source • MIT License • Not an official Mojang / Microsoft product',
      footer_releases: 'Releases',
      footer_issues: 'Report an Issue'
    },
    ru: {
      page_title: 'Material Launcher — Minecraft лаунчер в стиле Material Design 3',
      nav_features: 'Возможности',
      nav_preview: 'Интерфейс',
      nav_downloads: 'Скачать',
      btn_download_short: 'Скачать',
      theme_toggle_title: 'Переключить тему',
      hero_badge: 'Material Design 3 • Версия 1.0.0',
      hero_title_1: 'Minecraft лаунчер,',
      hero_title_2: 'в котором ',
      hero_title_accent: 'ничего лишнего',
      btn_dl_win: 'Скачать для Windows (.exe)',
      btn_dl_linux: 'Скачать для Linux (.AppImage)',
      preview_hint: 'Наведите на любую цветную полосу, чтобы увидеть тему',
      theme_emerald: 'Изумруд',
      theme_ocean: 'Океан',
      theme_lavender: 'Лаванда',
      theme_sunset: 'Закат',
      theme_sakura: 'Сакура',
      features_eyebrow: 'Почему Material Launcher',
      features_title: 'Создан для комфортной игры',
      features_subtitle: 'Никаких перегруженных меню, баннеров и устаревших интерфейсов — только чистый Material You и нужные инструменты под рукой.',
      feat_1_title: 'Google Material Design 3',
      feat_1_desc: 'Мягкие скругления, адаптивная тёмная и светлая темы, палитра акцентных цветов и плавная анимация каждого отклика.',
      feat_2_title: 'Встроенный браузер модов',
      feat_2_desc: 'Ищите и устанавливайте моды с Modrinth и CurseForge прямо внутри лаунчера, создавайте отдельные сборки под нужные версии.',
      feat_3_title: 'Любые загрузчики и аккаунты',
      feat_3_desc: 'Vanilla, Fabric, Forge, NeoForge и Quilt. Авторизация через официальный Microsoft (OAuth 2.0), Ely.by со скинами и офлайн-режим.',
      feat_4_title: 'Своя папка игры и перенос',
      feat_4_desc: 'Выбирайте любой диск для хранения версий и модов, чтобы не засорять диск C:, с умным переносом или очисткой старых файлов.',
      feat_5_title: 'Автоподбор Java и диагностика',
      feat_5_desc: 'Лаунчер сам находит нужную версию Java, загружает её при необходимости и анализирует краш-логи, подсказывая причину вылета.',
      feat_6_title: '8 языков из коробки',
      feat_6_desc: 'Полная локализация на английский, русский, немецкий, французский, испанский, португальский, китайский и японский языки.',
      dl_title: 'Скачать Material Launcher',
      dl_subtitle: 'Выберите вашу операционную систему и удобный формат пакета. Все сборки доступны бесплатно без регистрации.',
      dl_action: 'Скачать →',
      badge_recommended: 'Рекомендуется',
      badge_universal: 'Универсальный',
      tag_archive: 'Архив',
      tag_sandbox: 'Песочница',
      win_setup_title: 'Установщик (Setup)',
      win_setup_desc: 'Классический мастер установки с выбором папки, ярлыком на рабочем столе и в меню «Пуск».',
      win_port_title: 'Портативная версия',
      win_port_desc: 'Один исполняемый файл: запустил и играешь с любого диска или флешки без установки.',
      win_msi_title: 'Windows Installer',
      win_msi_desc: 'Стандартный MSI-пакет для системного развёртывания и управления через Windows.',
      win_zip_title: 'Распакованный архив',
      win_zip_desc: 'Готовая папка с программой внутри ZIP-архива — достаточно распаковать в любое место.',
      lin_appimage_title: 'AppImage',
      lin_appimage_desc: 'Работает на любом дистрибутиве Linux без установки. Сделайте файл исполняемым и запускайте.',
      lin_deb_title: 'DEB-пакет',
      lin_deb_desc: 'Для Ubuntu, Debian, Linux Mint, Pop!_OS и производных. Установка через apt.',
      lin_rpm_title: 'RPM-пакет',
      lin_rpm_desc: 'Для Fedora, openSUSE, Red Hat и других RPM-дистрибутивов.',
      lin_flatpak_title: 'Flatpak Bundle',
      lin_flatpak_desc: 'Офлайн-бандл Flatpak с изоляцией прав и системной интеграцией.',
      lin_targz_title: 'Бинарный tar.gz',
      lin_targz_desc: 'Классический Linux-архив с готовым исполняемым файлом.',
      lin_zip_title: 'Linux ZIP',
      lin_zip_desc: 'Портативный архив для быстрой распаковки на любой Linux-системе.',
      footer_copy: 'Open Source • MIT License • Не является официальным продуктом Mojang / Microsoft',
      footer_releases: 'Релизы',
      footer_issues: 'Сообщить об ошибке'
    },
    de: {
      page_title: 'Material Launcher — Minecraft-Launcher im Material Design 3',
      nav_features: 'Funktionen',
      nav_preview: 'Oberfläche',
      nav_downloads: 'Herunterladen',
      btn_download_short: 'Download',
      theme_toggle_title: 'Design wechseln',
      hero_badge: 'Material Design 3 • Version 1.0.0',
      hero_title_1: 'Minecraft-Launcher',
      hero_title_2: 'ohne ',
      hero_title_accent: 'unnötigen Ballast',
      btn_dl_win: 'Für Windows herunterladen (.exe)',
      btn_dl_linux: 'Für Linux herunterladen (.AppImage)',
      preview_hint: 'Bewege die Maus über einen Farbstreifen, um das Theme zu sehen',
      theme_emerald: 'Smaragd',
      theme_ocean: 'Ozean',
      theme_lavender: 'Lavendel',
      theme_sunset: 'Sonnenuntergang',
      theme_sakura: 'Sakura',
      features_eyebrow: 'Warum Material Launcher',
      features_title: 'Für komfortables Spielen entwickelt',
      features_subtitle: 'Keine überladenen Menüs, Banner oder veraltete Oberflächen — nur klares Material You und alle wichtigen Werkzeuge griffbereit.',
      feat_1_title: 'Google Material Design 3',
      feat_1_desc: 'Weiche Rundungen, adaptive dunkle und helle Themes, Akzentfarbpalette und flüssige Animationen bei jeder Aktion.',
      feat_2_title: 'Integrierter Mod-Browser',
      feat_2_desc: 'Suche und installiere Mods von Modrinth und CurseForge direkt im Launcher und erstelle eigene Instanzen.',
      feat_3_title: 'Alle Loader & Konten',
      feat_3_desc: 'Vanilla, Fabric, Forge, NeoForge und Quilt. Anmeldung über Microsoft (OAuth 2.0), Ely.by mit Skins oder Offline-Modus.',
      feat_4_title: 'Eigener Spielordner & Migration',
      feat_4_desc: 'Wähle ein beliebiges Laufwerk für Versionen und Mods mit intelligenter Dateimigration oder Bereinigung.',
      feat_5_title: 'Auto-Java & Absturzdiagnose',
      feat_5_desc: 'Findet oder lädt automatisch die passende Java-Version und analysiert Absturzberichte.',
      feat_6_title: '8 Sprachen direkt integriert',
      feat_6_desc: 'Vollständige Übersetzung in Englisch, Russisch, Deutsch, Französisch, Spanisch, Portugiesisch, Chinesisch und Japanisch.',
      dl_title: 'Material Launcher herunterladen',
      dl_subtitle: 'Wähle dein Betriebssystem und das gewünschte Paketformat. Alle Builds sind kostenlos und ohne Registrierung.',
      dl_action: 'Laden →',
      badge_recommended: 'Empfohlen',
      badge_universal: 'Universell',
      tag_archive: 'Archiv',
      tag_sandbox: 'Sandbox',
      win_setup_title: 'Installer (Setup)',
      win_setup_desc: 'Klassischer Installationsassistent mit Ordnerwahl, Desktop- und Startmenü-Verknüpfung.',
      win_port_title: 'Portable Version',
      win_port_desc: 'Eine einzelne ausführbare Datei: von jedem Laufwerk oder USB-Stick ohne Installation starten.',
      win_msi_title: 'Windows Installer',
      win_msi_desc: 'Standard-MSI-Paket für die systemweite Bereitstellung.',
      win_zip_title: 'Entpacktes Archiv',
      win_zip_desc: 'Einsatzbereiter Programmordner im ZIP-Archiv — einfach beliebig entpacken.',
      lin_appimage_title: 'AppImage',
      lin_appimage_desc: 'Läuft auf jeder Linux-Distribution ohne Installation. Ausführbar machen und starten.',
      lin_deb_title: 'DEB-Paket',
      lin_deb_desc: 'Für Ubuntu, Debian, Linux Mint, Pop!_OS und Derivate. Installation via apt.',
      lin_rpm_title: 'RPM-Paket',
      lin_rpm_desc: 'Für Fedora, openSUSE, Red Hat und andere RPM-Distributionen.',
      lin_flatpak_title: 'Flatpak-Bundle',
      lin_flatpak_desc: 'Offline-Flatpak-Bundle mit Sandbox-Isolation und Desktop-Integration.',
      lin_targz_title: 'Binär-tar.gz',
      lin_targz_desc: 'Klassisches Linux-Archiv mit fertiger ausführbarer Datei.',
      lin_zip_title: 'Linux-ZIP',
      lin_zip_desc: 'Portables Archiv zum schnellen Entpacken auf jedem Linux-System.',
      footer_copy: 'Open Source • MIT-Lizenz • Kein offizielles Produkt von Mojang / Microsoft',
      footer_releases: 'Releases',
      footer_issues: 'Fehler melden'
    },
    fr: {
      page_title: 'Material Launcher — Lanceur Minecraft en Material Design 3',
      nav_features: 'Fonctionnalités',
      nav_preview: 'Interface',
      nav_downloads: 'Télécharger',
      btn_download_short: 'Télécharger',
      theme_toggle_title: 'Changer de thème',
      hero_badge: 'Material Design 3 • Version 1.0.0',
      hero_title_1: 'Lanceur Minecraft',
      hero_title_2: 'sans ',
      hero_title_accent: 'rien de superflu',
      btn_dl_win: 'Télécharger pour Windows (.exe)',
      btn_dl_linux: 'Télécharger pour Linux (.AppImage)',
      preview_hint: 'Survolez une bande colorée pour voir le thème',
      theme_emerald: 'Émeraude',
      theme_ocean: 'Océan',
      theme_lavender: 'Lavande',
      theme_sunset: 'Coucher de soleil',
      theme_sakura: 'Sakura',
      features_eyebrow: 'Pourquoi Material Launcher',
      features_title: 'Conçu pour jouer confortablement',
      features_subtitle: 'Pas de menus encombrés, de bannières ni d’interfaces datées — juste du Material You épuré et l’essentiel à portée de main.',
      feat_1_title: 'Google Material Design 3',
      feat_1_desc: 'Coins arrondis doux, thèmes sombre et clair adaptatifs, palette de couleurs d’accentuation et animations fluides.',
      feat_2_title: 'Navigateur de mods intégré',
      feat_2_desc: 'Recherchez et installez des mods depuis Modrinth et CurseForge directement dans le lanceur.',
      feat_3_title: 'Tous les chargeurs & comptes',
      feat_3_desc: 'Vanilla, Fabric, Forge, NeoForge et Quilt. Connexion Microsoft (OAuth 2.0), Ely.by avec skins ou mode hors ligne.',
      feat_4_title: 'Dossier personnalisé & migration',
      feat_4_desc: 'Choisissez n’importe quel disque pour stocker versions et mods avec migration ou nettoyage intelligent.',
      feat_5_title: 'Java auto & diagnostic',
      feat_5_desc: 'Trouve ou télécharge automatiquement la bonne version de Java et analyse les rapports de plantage.',
      feat_6_title: '8 langues incluses',
      feat_6_desc: 'Traduction complète en anglais, russe, allemand, français, espagnol, portugais, chinois et japonais.',
      dl_title: 'Télécharger Material Launcher',
      dl_subtitle: 'Choisissez votre système d’exploitation et votre format préféré. Gratuit et sans inscription.',
      dl_action: 'Télécharger →',
      badge_recommended: 'Recommandé',
      badge_universal: 'Universel',
      tag_archive: 'Archive',
      tag_sandbox: 'Bac à sable',
      win_setup_title: 'Installateur (Setup)',
      win_setup_desc: 'Assistant d’installation classique avec choix du dossier et raccourcis.',
      win_port_title: 'Version portable',
      win_port_desc: 'Un seul fichier exécutable : lancez et jouez depuis n’importe quel disque sans installation.',
      win_msi_title: 'Windows Installer',
      win_msi_desc: 'Paquet MSI standard pour le déploiement système sous Windows.',
      win_zip_title: 'Archive décompressée',
      win_zip_desc: 'Dossier prêt à l’emploi dans une archive ZIP — extrayez-le où vous voulez.',
      lin_appimage_title: 'AppImage',
      lin_appimage_desc: 'Fonctionne sur toute distribution Linux sans installation. Rendez-le exécutable et lancez.',
      lin_deb_title: 'Paquet DEB',
      lin_deb_desc: 'Pour Ubuntu, Debian, Linux Mint, Pop!_OS et dérivés. Installation via apt.',
      lin_rpm_title: 'Paquet RPM',
      lin_rpm_desc: 'Pour Fedora, openSUSE, Red Hat et autres distributions RPM.',
      lin_flatpak_title: 'Bundle Flatpak',
      lin_flatpak_desc: 'Paquet Flatpak hors ligne avec isolation et intégration système.',
      lin_targz_title: 'Binaire tar.gz',
      lin_targz_desc: 'Archive Linux classique avec l’exécutable prêt à l’emploi.',
      lin_zip_title: 'Linux ZIP',
      lin_zip_desc: 'Archive portable pour une extraction rapide sur tout système Linux.',
      footer_copy: 'Open Source • Licence MIT • N’est pas un produit officiel de Mojang / Microsoft',
      footer_releases: 'Versions',
      footer_issues: 'Signaler un bug'
    },
    es: {
      page_title: 'Material Launcher — Lanzador de Minecraft en Material Design 3',
      nav_features: 'Características',
      nav_preview: 'Interfaz',
      nav_downloads: 'Descargar',
      btn_download_short: 'Descargar',
      theme_toggle_title: 'Cambiar tema',
      hero_badge: 'Material Design 3 • Versión 1.0.0',
      hero_title_1: 'Lanzador de Minecraft',
      hero_title_2: 'sin ',
      hero_title_accent: 'nada de más',
      btn_dl_win: 'Descargar para Windows (.exe)',
      btn_dl_linux: 'Descargar para Linux (.AppImage)',
      preview_hint: 'Pasa el cursor sobre cualquier franja de color para ver el tema',
      theme_emerald: 'Esmeralda',
      theme_ocean: 'Océano',
      theme_lavender: 'Lavanda',
      theme_sunset: 'Atardecer',
      theme_sakura: 'Sakura',
      features_eyebrow: 'Por qué Material Launcher',
      features_title: 'Diseñado para jugar cómodo',
      features_subtitle: 'Sin menús recargados, banners ni interfaces antiguas — solo Material You limpio y las herramientas que necesitas.',
      feat_1_title: 'Google Material Design 3',
      feat_1_desc: 'Bordes redondeados suaves, temas oscuro y claro adaptativos, paleta de acentos y animaciones fluidas.',
      feat_2_title: 'Navegador de mods integrado',
      feat_2_desc: 'Busca e instala mods de Modrinth y CurseForge directamente en el lanzador y crea perfiles separados.',
      feat_3_title: 'Todos los loaders y cuentas',
      feat_3_desc: 'Vanilla, Fabric, Forge, NeoForge y Quilt. Acceso con Microsoft (OAuth 2.0), Ely.by con skins o modo sin conexión.',
      feat_4_title: 'Carpeta propia y migración',
      feat_4_desc: 'Elige cualquier disco para guardar versiones y mods sin llenar el disco C:, con migración inteligente.',
      feat_5_title: 'Java automático y diagnóstico',
      feat_5_desc: 'Detecta o descarga la versión correcta de Java y analiza registros de errores al instante.',
      feat_6_title: '8 idiomas incluidos',
      feat_6_desc: 'Localización completa en inglés, ruso, alemán, francés, español, portugués, chino y japonés.',
      dl_title: 'Descargar Material Launcher',
      dl_subtitle: 'Elige tu sistema operativo y formato preferido. Todas las compilaciones son gratuitas y sin registro.',
      dl_action: 'Descargar →',
      badge_recommended: 'Recomendado',
      badge_universal: 'Universal',
      tag_archive: 'Archivo',
      tag_sandbox: 'Aislado',
      win_setup_title: 'Instalador (Setup)',
      win_setup_desc: 'Asistente clásico con selección de carpeta, acceso directo en el escritorio y menú Inicio.',
      win_port_title: 'Versión portátil',
      win_port_desc: 'Un único ejecutable: inicia y juega desde cualquier disco o USB sin instalar.',
      win_msi_title: 'Windows Installer',
      win_msi_desc: 'Paquete MSI estándar para despliegue en Windows.',
      win_zip_title: 'Archivo ZIP',
      win_zip_desc: 'Carpeta lista para usar dentro de un ZIP — descomprime donde quieras.',
      lin_appimage_title: 'AppImage',
      lin_appimage_desc: 'Funciona en cualquier distribución Linux sin instalación. Hazlo ejecutable y abre.',
      lin_deb_title: 'Paquete DEB',
      lin_deb_desc: 'Para Ubuntu, Debian, Linux Mint, Pop!_OS y derivados. Instalación con apt.',
      lin_rpm_title: 'Paquete RPM',
      lin_rpm_desc: 'Para Fedora, openSUSE, Red Hat y otras distros RPM.',
      lin_flatpak_title: 'Paquete Flatpak',
      lin_flatpak_desc: 'Paquete Flatpak sin conexión con aislamiento de permisos.',
      lin_targz_title: 'Binario tar.gz',
      lin_targz_desc: 'Archivo clásico de Linux con el ejecutable listo.',
      lin_zip_title: 'Linux ZIP',
      lin_zip_desc: 'Archivo portátil para extracción rápida en cualquier Linux.',
      footer_copy: 'Código abierto • Licencia MIT • No es un producto oficial de Mojang / Microsoft',
      footer_releases: 'Versiones',
      footer_issues: 'Reportar un error'
    },
    pt: {
      page_title: 'Material Launcher — Launcher de Minecraft em Material Design 3',
      nav_features: 'Recursos',
      nav_preview: 'Interface',
      nav_downloads: 'Baixar',
      btn_download_short: 'Baixar',
      theme_toggle_title: 'Alternar tema',
      hero_badge: 'Material Design 3 • Versão 1.0.0',
      hero_title_1: 'Launcher de Minecraft',
      hero_title_2: 'sem ',
      hero_title_accent: 'nada sobrando',
      btn_dl_win: 'Baixar para Windows (.exe)',
      btn_dl_linux: 'Baixar para Linux (.AppImage)',
      preview_hint: 'Passe o mouse sobre qualquer faixa colorida para ver o tema',
      theme_emerald: 'Esmeralda',
      theme_ocean: 'Oceano',
      theme_lavender: 'Lavanda',
      theme_sunset: 'Pôr do sol',
      theme_sakura: 'Sakura',
      features_eyebrow: 'Por que Material Launcher',
      features_title: 'Feito para jogar com conforto',
      features_subtitle: 'Sem menus poluídos, banners ou interfaces antigas — apenas Material You limpo e as ferramentas certas à mão.',
      feat_1_title: 'Google Material Design 3',
      feat_1_desc: 'Cantos arredondados suaves, temas claro e escuro adaptáveis, paleta de destaque e animações fluidas.',
      feat_2_title: 'Navegador de mods integrado',
      feat_2_desc: 'Busque e instale mods do Modrinth e CurseForge direto no launcher e crie instâncias separadas.',
      feat_3_title: 'Todos os loaders e contas',
      feat_3_desc: 'Vanilla, Fabric, Forge, NeoForge e Quilt. Entre com Microsoft (OAuth 2.0), Ely.by com skins ou modo offline.',
      feat_4_title: 'Pasta personalizada e migração',
      feat_4_desc: 'Escolha qualquer disco para salvar versões e mods sem encher o disco C:, com migração inteligente.',
      feat_5_title: 'Java automático e diagnóstico',
      feat_5_desc: 'Encontra ou baixa o Java ideal automaticamente e analisa relatórios de erro.',
      feat_6_title: '8 idiomas nativos',
      feat_6_desc: 'Tradução completa em inglês, russo, alemão, francês, espanhol, português, chinês e japonês.',
      dl_title: 'Baixar Material Launcher',
      dl_subtitle: 'Escolha seu sistema operacional e formato preferido. Todas as versões são gratuitas e sem cadastro.',
      dl_action: 'Baixar →',
      badge_recommended: 'Recomendado',
      badge_universal: 'Universal',
      tag_archive: 'Arquivo',
      tag_sandbox: 'Sandbox',
      win_setup_title: 'Instalador (Setup)',
      win_setup_desc: 'Assistente clássico com escolha de pasta, atalho na área de trabalho e menu Iniciar.',
      win_port_title: 'Versão portátil',
      win_port_desc: 'Arquivo único executável: abra e jogue de qualquer disco ou pendrive sem instalar.',
      win_msi_title: 'Windows Installer',
      win_msi_desc: 'Pacote MSI padrão para implantação no Windows.',
      win_zip_title: 'Arquivo ZIP',
      win_zip_desc: 'Pasta pronta dentro de um ZIP — basta extrair em qualquer lugar.',
      lin_appimage_title: 'AppImage',
      lin_appimage_desc: 'Funciona em qualquer distro Linux sem instalação. Torne executável e abra.',
      lin_deb_title: 'Pacote DEB',
      lin_deb_desc: 'Para Ubuntu, Debian, Linux Mint, Pop!_OS e derivados. Instale via apt.',
      lin_rpm_title: 'Pacote RPM',
      lin_rpm_desc: 'Para Fedora, openSUSE, Red Hat e outras distros RPM.',
      lin_flatpak_title: 'Pacote Flatpak',
      lin_flatpak_desc: 'Pacote Flatpak offline com isolamento de permissões.',
      lin_targz_title: 'Binário tar.gz',
      lin_targz_desc: 'Arquivo clássico do Linux com executável pronto.',
      lin_zip_title: 'Linux ZIP',
      lin_zip_desc: 'Arquivo portátil para extração rápida em qualquer sistema Linux.',
      footer_copy: 'Código aberto • Licença MIT • Não é um produto oficial da Mojang / Microsoft',
      footer_releases: 'Lançamentos',
      footer_issues: 'Relatar erro'
    },
    zh: {
      page_title: 'Material Launcher — Material Design 3 风格的 Minecraft 启动器',
      nav_features: '特性',
      nav_preview: '界面',
      nav_downloads: '下载',
      btn_download_short: '下载',
      theme_toggle_title: '切换主题',
      hero_badge: 'Material Design 3 • 版本 1.0.0',
      hero_title_1: '极简纯净的',
      hero_title_2: 'Minecraft ',
      hero_title_accent: '启动器',
      btn_dl_win: '下载 Windows 版 (.exe)',
      btn_dl_linux: '下载 Linux 版 (.AppImage)',
      preview_hint: '将鼠标悬停在任意色条上即可预览主题',
      theme_emerald: '翡翠绿',
      theme_ocean: '海洋蓝',
      theme_lavender: '薰衣草',
      theme_sunset: '日落橙',
      theme_sakura: '樱花粉',
      features_eyebrow: '为什么选择 Material Launcher',
      features_title: '为舒适游玩而打造',
      features_subtitle: '没有杂乱的菜单、广告横幅或过时的界面 —— 只有纯粹的 Material You 与触手可及的工具。',
      feat_1_title: 'Google Material Design 3',
      feat_1_desc: '柔和圆角、自适应深浅色主题、动态强调色板与丝滑交互动画。',
      feat_2_title: '内置模组浏览器',
      feat_2_desc: '直接在启动器内搜索并安装 Modrinth 和 CurseForge 模组，轻松管理独立整合包。',
      feat_3_title: '全加载器与多账号支持',
      feat_3_desc: '支持 Vanilla、Fabric、Forge、NeoForge 与 Quilt。支持微软正版 (OAuth 2.0)、Ely.by 皮肤与离线模式。',
      feat_4_title: '自定义游戏目录与迁移',
      feat_4_desc: '自由选择任意磁盘存放版本与模组，不占用 C 盘空间，支持智能迁移或清理旧文件。',
      feat_5_title: '自动 Java 与崩溃诊断',
      feat_5_desc: '自动匹配或下载合适版本的 Java，并智能分析崩溃日志提示原因。',
      feat_6_title: '内置 8 种语言',
      feat_6_desc: '完整支持英语、俄语、德语、法语、西班牙语、葡萄牙语、简体中文和日语。',
      dl_title: '下载 Material Launcher',
      dl_subtitle: '选择您的操作系统与安装包格式。所有版本均免费且无需注册。',
      dl_action: '下载 →',
      badge_recommended: '推荐',
      badge_universal: '通用版',
      tag_archive: '压缩包',
      tag_sandbox: '沙盒',
      win_setup_title: '安装程序 (Setup)',
      win_setup_desc: '经典安装向导，支持自定义路径、桌面与开始菜单快捷方式。',
      win_port_title: '绿色便携版',
      win_port_desc: '单文件直接运行，无需安装即可在任意磁盘或 U 盘上游玩。',
      win_msi_title: 'Windows Installer',
      win_msi_desc: '标准 MSI 安装包，适合系统级部署与管理。',
      win_zip_title: '免安装压缩包',
      win_zip_desc: '内含完整程序文件夹的 ZIP 压缩包，解压即可使用。',
      lin_appimage_title: 'AppImage',
      lin_appimage_desc: '无需安装即可在任意 Linux 发行版运行，赋予执行权限即可启动。',
      lin_deb_title: 'DEB 安装包',
      lin_deb_desc: '适用于 Ubuntu、Debian、Linux Mint、Pop!_OS 等发行版，支持 apt 安装。',
      lin_rpm_title: 'RPM 安装包',
      lin_rpm_desc: '适用于 Fedora、openSUSE、Red Hat 等 RPM 发行版。',
      lin_flatpak_title: 'Flatpak 离线包',
      lin_flatpak_desc: '支持权限沙盒隔离与系统集成的 Flatpak 离线包。',
      lin_targz_title: '二进制 tar.gz',
      lin_targz_desc: '包含可执行文件的经典 Linux 压缩包。',
      lin_zip_title: 'Linux ZIP',
      lin_zip_desc: '便携压缩包，可在任意 Linux 系统中快速解压运行。',
      footer_copy: '开源项目 • MIT 协议 • 非 Mojang / Microsoft 官方产品',
      footer_releases: '发布版本',
      footer_issues: '反馈问题'
    },
    ja: {
      page_title: 'Material Launcher — Material Design 3 対応 Minecraft ランチャー',
      nav_features: '機能',
      nav_preview: 'UI プレビュー',
      nav_downloads: 'ダウンロード',
      btn_download_short: 'ダウンロード',
      theme_toggle_title: 'テーマを切り替え',
      hero_badge: 'Material Design 3 • バージョン 1.0.0',
      hero_title_1: '余計なもののない',
      hero_title_2: 'Minecraft ',
      hero_title_accent: 'ランチャー',
      btn_dl_win: 'Windows 版をダウンロード (.exe)',
      btn_dl_linux: 'Linux 版をダウンロード (.AppImage)',
      preview_hint: 'カラーストライプにカーソルを合わせるとテーマを確認できます',
      theme_emerald: 'エメラルド',
      theme_ocean: 'オーシャン',
      theme_lavender: 'ラベンダー',
      theme_sunset: 'サンセット',
      theme_sakura: 'サクラ',
      features_eyebrow: '選ばれる理由',
      features_title: '快適なプレイのために',
      features_subtitle: '煩雑なメニューや広告バナー、古いデザインは不要。洗練された Material You と必要なツールだけをまとめました。',
      feat_1_title: 'Google Material Design 3',
      feat_1_desc: '柔らかな角丸、ダーク/ライト自動対応、アクセントカラー、滑らかなモーションを実現。',
      feat_2_title: '内蔵 Mod ブラウザ',
      feat_2_desc: 'Modrinth と CurseForge の Mod をランチャー内から検索・導入し、環境ごとに管理できます。',
      feat_3_title: '各種ローダー＆アカウント対応',
      feat_3_desc: 'Vanilla・Fabric・Forge・NeoForge・Quilt 対応。Microsoft (OAuth 2.0)、Ely.by（スキン対応）、オフライン利用可能。',
      feat_4_title: '保存先フォルダ変更＆移行',
      feat_4_desc: 'C ドライブを圧迫せず任意のドライブに保存でき、既存ファイルのスマート移行や削除にも対応。',
      feat_5_title: 'Java 自動選択＆クラッシュ診断',
      feat_5_desc: '最適な Java を自動で検出・取得し、クラッシュログを解析して原因を案内します。',
      feat_6_title: '8 言語を標準搭載',
      feat_6_desc: '英語・ロシア語・ドイツ語・フランス語・スペイン語・ポルトガル語・中国語・日本語に完全対応。',
      dl_title: 'Material Launcher をダウンロード',
      dl_subtitle: 'お使いの OS とパッケージ形式を選択してください。すべて無料・登録不要です。',
      dl_action: 'ダウンロード →',
      badge_recommended: '推奨',
      badge_universal: '汎用',
      tag_archive: 'アーカイブ',
      tag_sandbox: 'サンドボックス',
      win_setup_title: 'インストーラー (Setup)',
      win_setup_desc: 'フォルダ選択やショートカット作成ができる標準インストールウィザード。',
      win_port_title: 'ポータブル版',
      win_port_desc: 'インストール不要の単体実行ファイル。どのドライブや USB からでも起動可能。',
      win_msi_title: 'Windows Installer',
      win_msi_desc: 'システム全体への展開・管理向け標準 MSI パッケージ。',
      win_zip_title: '展開済みアーカイブ',
      win_zip_desc: '実行可能なフォルダ一式をまとめた ZIP。お好きな場所に解凍して使えます。',
      lin_appimage_title: 'AppImage',
      lin_appimage_desc: 'インストール不要でどの Linux ディストリビューションでも動作。実行権限を付けて起動。',
      lin_deb_title: 'DEB パッケージ',
      lin_deb_desc: 'Ubuntu、Debian、Linux Mint、Pop!_OS 向け。apt で導入可能。',
      lin_rpm_title: 'RPM パッケージ',
      lin_rpm_desc: 'Fedora、openSUSE、Red Hat などの RPM 系ディストリビューション向け。',
      lin_flatpak_title: 'Flatpak バンドル',
      lin_flatpak_desc: '権限サンドボックスとデスクトップ統合を備えたオフライン Flatpak パッケージ。',
      lin_targz_title: 'バイナリ tar.gz',
      lin_targz_desc: '実行ファイルを収めた標準的な Linux アーカイブ。',
      lin_zip_title: 'Linux ZIP',
      lin_zip_desc: 'どの Linux 環境でもすぐ展開できるポータブルアーカイブ。',
      footer_copy: 'オープンソース • MIT ライセンス • Mojang / Microsoft の公式製品ではありません',
      footer_releases: 'リリース',
      footer_issues: '不具合を報告'
    }
  };

  // Country code -> supported language & native prompt
  const COUNTRY_TO_LANG = {
    RU: 'ru', BY: 'ru', KZ: 'ru', KG: 'ru',
    DE: 'de', AT: 'de', CH: 'de', LI: 'de',
    FR: 'fr', BE: 'fr', MC: 'fr', LU: 'fr',
    ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es',
    EC: 'es', GT: 'es', CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es',
    SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es',
    BR: 'pt', PT: 'pt', AO: 'pt', MZ: 'pt',
    CN: 'zh', TW: 'zh', HK: 'zh', MO: 'zh', SG: 'zh',
    JP: 'ja'
  };

  const SUGGEST_PROMPTS = {
    ru: { text: 'Переключить сайт на Русский язык?', accept: 'Переключить', dismiss: 'Оставить English' },
    de: { text: 'Website auf Deutsch umstellen?', accept: 'Wechseln', dismiss: 'English behalten' },
    fr: { text: 'Passer le site en Français ?', accept: 'Changer', dismiss: 'Garder English' },
    es: { text: '¿Cambiar el sitio a Español?', accept: 'Cambiar', dismiss: 'Mantener English' },
    pt: { text: 'Mudar o site para Português?', accept: 'Mudar', dismiss: 'Manter English' },
    zh: { text: '将页面切换为简体中文？', accept: '切换', dismiss: '保留 English' },
    ja: { text: 'サイトを日本語に切り替えますか？', accept: '切り替える', dismiss: 'English のまま' }
  };

  let currentLang = localStorage.getItem('ml_site_lang');
  if (!currentLang || !TRANSLATIONS[currentLang]) {
    currentLang = 'en';
  }

  function applyLanguage(lang, save = false) {
    if (!TRANSLATIONS[lang]) lang = 'en';
    currentLang = lang;
    if (save) {
      localStorage.setItem('ml_site_lang', lang);
    }

    const dict = TRANSLATIONS[lang];
    document.documentElement.lang = lang;
    if (dict.page_title) document.title = dict.page_title;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (dict[key] !== undefined) {
        el.textContent = dict[key];
      }
    });

    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.dataset.i18nTitle;
      if (dict[key] !== undefined) {
        el.title = dict[key];
      }
    });

    const select = document.getElementById('langSelect');
    if (select && select.value !== lang) {
      select.value = lang;
    }

    window.dispatchEvent(new CustomEvent('ml:langchange', { detail: { lang, dict } }));
  }

  function showLanguageSuggestion(lang) {
    const prompt = SUGGEST_PROMPTS[lang];
    const banner = document.getElementById('langSuggestBanner');
    const textEl = document.getElementById('langSuggestText');
    const acceptBtn = document.getElementById('langSuggestAccept');
    const dismissBtn = document.getElementById('langSuggestDismiss');

    if (!prompt || !banner || !textEl || !acceptBtn || !dismissBtn) return;

    textEl.textContent = prompt.text;
    acceptBtn.textContent = prompt.accept;
    dismissBtn.textContent = prompt.dismiss;
    banner.hidden = false;
    requestAnimationFrame(() => banner.classList.add('visible'));

    acceptBtn.onclick = () => {
      applyLanguage(lang, true);
      banner.classList.remove('visible');
      setTimeout(() => { banner.hidden = true; }, 220);
    };

    dismissBtn.onclick = () => {
      sessionStorage.setItem('ml_lang_dismissed', '1');
      banner.classList.remove('visible');
      setTimeout(() => { banner.hidden = true; }, 220);
    };
  }

  async function detectCountryAndSuggest() {
    if (localStorage.getItem('ml_site_lang') || sessionStorage.getItem('ml_lang_dismissed')) {
      return;
    }

    const providers = [
      { url: 'https://ipapi.co/json/', pick: (d) => d && d.country_code },
      { url: 'https://get.geojs.io/v1/ip/country.json', pick: (d) => d && d.country }
    ];

    for (const provider of providers) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(provider.url, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) continue;
        const data = await res.json();
        const code = String(provider.pick(data) || '').toUpperCase();
        const suggested = COUNTRY_TO_LANG[code];
        if (suggested && suggested !== currentLang) {
          showLanguageSuggestion(suggested);
        }
        return;
      } catch (_) {
        // try next provider
      }
    }
  }

  window.ML_I18N = {
    getCurrentLang: () => currentLang,
    getDict: () => TRANSLATIONS[currentLang] || TRANSLATIONS.en,
    applyLanguage
  };

  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('langSelect');
    if (select) {
      select.value = currentLang;
      select.addEventListener('change', (e) => {
        applyLanguage(e.target.value, true);
        const banner = document.getElementById('langSuggestBanner');
        if (banner) {
          banner.classList.remove('visible');
          banner.hidden = true;
        }
      });
    }
    applyLanguage(currentLang, false);
    detectCountryAndSuggest();
  });
})();
