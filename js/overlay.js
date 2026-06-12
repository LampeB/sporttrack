/* ============================================================
   SportTrack v2 — overlay.js
   Contrôleur autonome de l'overlay OBS (overlay.html uniquement).
   IIFE auto-contenue — n'expose aucune variable globale.
   Dépendances : config.js (CONFIG, fmtPace, fmtDur, fmtDist),
                 supabase-js (UMD, window.supabase).
   ============================================================ */
(function() {
  'use strict';

  /* ---------- Paramètres d'URL ---------- */
  // ?style=minimal|sport-bar|neon|compact&show=hr,pace,dist,time,cad
  const params = new URLSearchParams(window.location.search);
  const style = params.get('style') || 'minimal';
  const show = (params.get('show') || 'hr,pace,dist,time').split(',').map(s => s.trim()).filter(Boolean);

  /* ---------- Couleurs de zone (style neon) ---------- */
  const ZONE_COLORS = {
    'Échauffement': '#94a3b8',
    'Endurance':    '#22d3ee',
    'Aérobie':      '#22c55e',
    'Seuil':        '#f97316',
    'Maximum':      '#ef4444'
  };
  const NEON_DEFAULT = '#22d3a0';

  /* ---------- Application du style ---------- */
  function applyStyle() {
    const root = document.getElementById('overlay-root');
    if (!root) return;

    root.dataset.style = style;

    // Masque les éléments absents de la liste "show"
    const map = { hr: '.ov-hr', pace: '.ov-pace', dist: '.ov-dist', time: '.ov-time', cad: '.ov-cad' };
    Object.entries(map).forEach(([key, sel]) => {
      document.querySelectorAll(sel).forEach(el => {
        el.classList.toggle('overlay-hidden', !show.includes(key));
      });
    });

    // sport-bar : les séparateurs sont gérés en CSS (border-right sur .ov-item)
  }

  /* ---------- Mise à jour de l'affichage ---------- */
  function updateDisplay(data) {
    if (!data) return;
    const active = !!data.active;

    // Fréquence cardiaque
    const hrEl = document.getElementById('ov-hr');
    if (hrEl) hrEl.textContent = (active && data.hr) ? data.hr : '--';

    // Allure (s/km)
    const paceEl = document.getElementById('ov-pace');
    if (paceEl) paceEl.textContent = (active && data.pace_s_per_km) ? fmtPace(data.pace_s_per_km) : "--'--\"";

    // Distance (m)
    const distEl = document.getElementById('ov-dist');
    if (distEl) distEl.textContent = (active && data.distance_m) ? fmtDist(data.distance_m) : '0.00';

    // Durée (s)
    const timeEl = document.getElementById('ov-time');
    if (timeEl) timeEl.textContent = (active && data.duration_s) ? fmtDur(data.duration_s) : '00:00';

    // Cadence
    const cadEl = document.getElementById('ov-cad');
    if (cadEl) cadEl.textContent = (active && data.cadence) ? data.cadence : '--';

    // Style neon : la couleur suit la zone cardiaque
    if (style === 'neon') {
      const root = document.getElementById('overlay-root');
      if (root) {
        if (active && data.zone) {
          const color = ZONE_COLORS[data.zone] || NEON_DEFAULT;
          root.style.color = color;
          root.style.borderColor = color + '66';
        } else {
          root.style.color = '';
          root.style.borderColor = '';
        }
      }
    }
  }

  /* ---------- Initialisation Supabase ---------- */
  function init() {
    // Attend que config.js et supabase-js soient chargés (scripts deferred)
    if (!window.CONFIG || !window.supabase) {
      setTimeout(init, 100);
      return;
    }

    applyStyle();

    const url = window.CONFIG.supabase && window.CONFIG.supabase.url;
    const key = window.CONFIG.supabase && window.CONFIG.supabase.anonKey;

    if (!url || !key) {
      // Pas de configuration — affiche les tirets par défaut
      updateDisplay({ active: false });
      return;
    }

    const sb = window.supabase.createClient(url, key);

    // Abonnement temps réel à la ligne live_session (id = 1)
    sb.channel('live-overlay')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_session',
        filter: 'id=eq.1'
      }, payload => {
        updateDisplay(payload.new);
      })
      .subscribe();

    // Récupération initiale de l'état courant
    sb.from('live_session').select('*').eq('id', 1).single()
      .then(({ data }) => { if (data) updateDisplay(data); })
      .catch(() => { /* ligne absente — on garde les valeurs par défaut */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
