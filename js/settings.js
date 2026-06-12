/* ============================================================
 * SportTrack v2 — settings.js
 * Section "Paramètres" (#section-settings)
 * Expose : window.Settings
 * Dépendances globales : DB, Auth, APP, CONFIG, computeFcmax
 * ============================================================ */
(function () {
  'use strict';

  const Settings = {
    _profile: null,
    _overlayUrl: '',

    /* ---------------------------------------------------------
     * Initialisation : charge le profil, remplit le formulaire,
     * affiche les zones, met à jour l'URL d'overlay et les infos
     * utilisateur (nav + section "À propos").
     * --------------------------------------------------------- */
    init() {
      Settings.load();
      Settings.updateThemeToggle();
    },

    /* ---------------------------------------------------------
     * Chargement du profil + infos utilisateur
     * --------------------------------------------------------- */
    async load() {
      try {
        const profile = await DB.getProfile();
        if (profile) {
          Settings._profile = profile;
          document.getElementById('prof-name').value = profile.name || '';
          document.getElementById('prof-birth-year').value = profile.birth_year || '';
          document.getElementById('prof-sex').value = profile.sex || 'male';
          document.getElementById('prof-weight').value = profile.weight_kg || '';
          document.getElementById('prof-height').value = profile.height_cm || '';
        }
      } catch (err) {
        console.error('[Settings] Erreur de chargement du profil :', err);
        APP.showToast('Impossible de charger le profil', 'error');
      }

      Settings._renderZones();
      Settings.updateOverlayUrl();

      // Infos utilisateur (nav + section paramètres)
      Auth.getUser().then((user) => {
        if (!user) return;
        const infoEl = document.getElementById('settings-user-info');
        if (infoEl) infoEl.textContent = 'Connecté : ' + user.email;
        const navUser = document.getElementById('nav-user-info');
        if (navUser) navUser.textContent = user.email;
      }).catch((err) => {
        console.error('[Settings] Erreur de récupération utilisateur :', err);
      });
    },

    /* ---------------------------------------------------------
     * Enregistrement du profil
     * --------------------------------------------------------- */
    async saveProfile() {
      const profile = {
        id: Settings._profile?.id,
        name: document.getElementById('prof-name').value.trim() || 'Mon profil',
        birth_year: parseInt(document.getElementById('prof-birth-year').value, 10) || null,
        sex: document.getElementById('prof-sex').value,
        weight_kg: parseFloat(document.getElementById('prof-weight').value) || null,
        height_cm: parseInt(document.getElementById('prof-height').value, 10) || null,
      };

      try {
        const saved = await DB.saveProfile(profile);
        if (saved) Settings._profile = saved;
        else Settings._profile = { ...Settings._profile, ...profile };
        Settings._renderZones();
        APP.showToast('Profil enregistré !', 'success');
      } catch (err) {
        console.error('[Settings] Erreur d\'enregistrement du profil :', err);
        APP.showToast('Erreur lors de l\'enregistrement', 'error');
      }
    },

    /* ---------------------------------------------------------
     * Affichage des zones cardiaques
     * --------------------------------------------------------- */
    _renderZones() {
      const container = document.getElementById('zones-display');
      if (!container) return;

      const profile = Settings._profile;
      if (!profile || !profile.birth_year) {
        container.innerHTML =
          '<p style="color:var(--text-3);font-size:13px">Renseignez votre profil pour voir vos zones.</p>';
        return;
      }

      const max = computeFcmax(profile);
      const age = new Date().getFullYear() - profile.birth_year;

      container.innerHTML = CONFIG.zones.map((z, i) => {
        const minBpm = Math.round(max * z.pctMin);
        const maxBpm = z.pctMax >= 1.1 ? max + '+' : Math.round(max * z.pctMax);
        return '<div class="stat-card zone-' + (i + 1) + '" style="border-top:3px solid ' + z.color + '">' +
          '<span class="val" style="color:' + z.color + ';font-size:1rem">' + (i + 1) + '</span>' +
          '<span class="lbl" style="font-weight:600;color:var(--text-1)">' + z.name + '</span>' +
          '<span class="lbl">' + minBpm + '–' + maxBpm + ' bpm</span>' +
          '</div>';
      }).join('');

      // FC max théorique au-dessus des zones
      const info = document.createElement('p');
      info.style.cssText = 'font-size:13px;color:var(--text-2);margin-bottom:12px;grid-column:1/-1';
      info.textContent = 'FC max théorique : ' + max + ' bpm (âge : ' + age + ' ans)';
      container.prepend(info);
    },

    /* ---------------------------------------------------------
     * URL d'overlay OBS
     * --------------------------------------------------------- */
    updateOverlayUrl() {
      const style = document.getElementById('overlay-style-select')?.value || 'minimal';
      const baseUrl = window.location.origin +
        window.location.pathname.replace('index.html', '').replace(/\/$/, '');
      const url = baseUrl + '/overlay.html?style=' + style;
      const el = document.getElementById('overlay-url-text');
      if (el) el.textContent = url;
      Settings._overlayUrl = url;
    },

    copyOverlayUrl() {
      if (!Settings._overlayUrl) return;
      navigator.clipboard.writeText(Settings._overlayUrl)
        .then(() => APP.showToast('URL copiée !', 'success'))
        .catch(() => {
          // Repli : sélectionner le texte pour copie manuelle
          const el = document.getElementById('overlay-url-text');
          if (!el) return;
          const range = document.createRange();
          range.selectNode(el);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          APP.showToast('Sélectionnez le texte et copiez manuellement', 'info');
        });
    },

    /* ---------------------------------------------------------
     * Synchronisation du toggle de thème
     * (APP.toggleTheme() est appelé depuis le HTML)
     * --------------------------------------------------------- */
    updateThemeToggle() {
      const isLight = document.body.classList.contains('light');
      document.getElementById('theme-toggle')?.classList.toggle('on', isLight);
    },
  };

  window.Settings = Settings;
})();
