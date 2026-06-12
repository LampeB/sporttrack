/* ============================================================
 * SportTrack v2 — app.js
 * Contrôleur principal de l'application.
 * Expose window.APP : démarrage, routage, navigation, thème, toasts.
 *
 * Dépendances (globaux UMD) :
 *   window.CONFIG, window.DB, window.Auth, window.BT, window.GPS,
 *   window.Session, window.Live, window.Treadmill, window.History,
 *   window.Goals, window.Settings
 * ============================================================ */
(function () {
  'use strict';

  const APP = {
    /** Section actuellement affichée */
    currentSection: 'live',

    /** Sections déjà initialisées (lazy init) */
    _initialized: {},

    /** Thème courant ('dark' | 'light') */
    _theme: localStorage.getItem('st_theme') || 'dark',

    /* ----------------------------------------------------------
     * Démarrage
     * -------------------------------------------------------- */

    async boot() {
      // Appliquer le thème sauvegardé
      if (APP._theme === 'light') document.body.classList.add('light');
      document.getElementById('theme-toggle')?.classList.toggle('on', APP._theme === 'light');

      // Premier lancement : si Supabase n'est pas configuré,
      // afficher le formulaire de configuration sur l'écran d'auth
      APP._checkSupabaseConfig();

      // Liaison des boutons globaux (hors onclick inline de l'HTML)
      APP._bindNav();

      // Init de l'authentification — garde d'accès à l'application
      try {
        await Auth.init(APP._onAuthChange);
      } catch (err) {
        console.error('[APP] Échec de l\'initialisation Auth :', err);
        APP.showToast('Erreur d\'initialisation de l\'authentification', 'error');
        // En cas d'échec, rester sur l'écran d'auth
        APP._onAuthChange(null);
      }
    },

    /* ----------------------------------------------------------
     * Authentification (garde d'accès)
     * -------------------------------------------------------- */

    _onAuthChange(user) {
      const authScreen = document.getElementById('auth-screen');
      const app = document.getElementById('app');
      if (user) {
        if (authScreen) authScreen.style.display = 'none';
        if (app) app.style.display = '';
        APP._onLoggedIn();
      } else {
        if (authScreen) authScreen.style.display = '';
        if (app) app.style.display = 'none';
      }
    },

    async _onLoggedIn() {
      // Naviguer vers la section par défaut
      APP.navigate('live');
    },

    /* ----------------------------------------------------------
     * Configuration Supabase (premier lancement)
     * -------------------------------------------------------- */

    _checkSupabaseConfig() {
      const url = localStorage.getItem('st_supabase_url');
      const key = localStorage.getItem('st_supabase_key');
      const configSection = document.getElementById('auth-supabase-config');
      if (!configSection) return;
      configSection.style.display = (!url || !key) ? '' : 'none';
    },

    saveSupabaseConfig() {
      const url = document.getElementById('sb-url-input')?.value.trim();
      const key = document.getElementById('sb-key-input')?.value.trim();
      if (!url || !key) {
        APP.showToast('URL et clé requis', 'error');
        return;
      }
      localStorage.setItem('st_supabase_url', url);
      localStorage.setItem('st_supabase_key', key);

      // Mettre à jour CONFIG et réinitialiser le client DB
      CONFIG.supabase.url = url;
      CONFIG.supabase.anonKey = key;
      DB.reinit();

      const configSection = document.getElementById('auth-supabase-config');
      if (configSection) configSection.style.display = 'none';
      APP.showToast('Supabase configuré !', 'success');

      // Relancer l'init de l'authentification
      Auth.init(APP._onAuthChange);
    },

    /* ----------------------------------------------------------
     * Routage / Navigation
     * -------------------------------------------------------- */

    navigate(section) {
      // Masquer toutes les sections
      document.querySelectorAll('.app-section').forEach(el => el.classList.remove('active'));

      // Afficher la section cible
      const target = document.getElementById('section-' + section);
      if (target) target.classList.add('active');

      // Mettre à jour l'état actif des items de nav (sidebar + barre du bas)
      document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.section === section);
      });

      APP.currentSection = section;

      // Initialisation paresseuse de la section
      APP._initSection(section);
    },

    _initSection(section) {
      if (APP._initialized[section]) {
        // Recharger les données lors d'une nouvelle visite
        switch (section) {
          case 'history': History.load(); break;
          case 'goals': Goals.load(); break;
          case 'settings': Settings.load(); break;
          case 'outdoor': GPS.initMap('map'); break;
        }
        return;
      }
      APP._initialized[section] = true;
      try {
        switch (section) {
          case 'live': Live.init(); break;
          case 'treadmill': Treadmill.init(); break;
          case 'outdoor': GPS.initMap('map'); break;
          case 'history': History.init(); History.load(); break;
          case 'goals': Goals.init(); Goals.load(); break;
          case 'settings': Settings.init(); Settings.load(); break;
        }
      } catch (err) {
        console.error('[APP] Échec de l\'init de la section "' + section + '" :', err);
        APP.showToast('Erreur lors du chargement de la section', 'error');
        // Permettre une nouvelle tentative au prochain passage
        APP._initialized[section] = false;
      }
    },

    refresh() {
      APP._initSection(APP.currentSection);
    },

    _bindNav() {
      // Les items de navigation ont déjà des onclick inline dans l'HTML.
      // On se contente ici du bouton de config Supabase.
      document.getElementById('sb-config-save')?.addEventListener('click', APP.saveSupabaseConfig);
    },

    /* ----------------------------------------------------------
     * Toasts
     * -------------------------------------------------------- */

    showToast(msg, type = 'info', duration = 3000) {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const el = document.createElement('div');
      el.className = 'toast toast-' + type;
      el.textContent = msg;
      container.appendChild(el);
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(120px)';
        el.style.transition = 'opacity .3s, transform .3s';
        setTimeout(() => el.remove(), 300);
      }, duration);
    },

    /* ----------------------------------------------------------
     * Thème
     * -------------------------------------------------------- */

    toggleTheme() {
      const isLight = document.body.classList.toggle('light');
      APP._theme = isLight ? 'light' : 'dark';
      localStorage.setItem('st_theme', APP._theme);
      document.getElementById('theme-toggle')?.classList.toggle('on', isLight);
      if (window.Settings && Settings.updateThemeToggle) Settings.updateThemeToggle();
    },
  };

  window.APP = APP;

  // Démarrage une fois le DOM prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => APP.boot());
  } else {
    APP.boot();
  }
})();
