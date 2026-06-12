/* ============================================================
   SportTrack v2 — live.js
   Contrôle la section "En direct" (#section-live).
   Expose window.Live
   ============================================================ */
(function () {
  'use strict';

  window._sessionType = 'treadmill';

  var _wasActive = false;
  var _liveHrMin = null;
  var _liveHrMax = null;

  /* ---------- Initialisation (à l'activation de la section) ---------- */
  function init() {
    if (window.Session && typeof Session.onUpdate === 'function') {
      Session.onUpdate(Live._onSessionUpdate);
    }
    Live._updateBleDots();
    if (window.Charts) Charts.initLiveHR('live-hr-chart');
    // Afficher le bon panneau selon le type courant
    Live._refreshPanel();
  }

  /* ---------- Callback de mise à jour de séance ---------- */
  function _onSessionUpdate(state) {
    if (!state) return;

    var el;

    el = document.getElementById('live-hr');
    if (el) el.textContent = state.hr || '--';

    el = document.getElementById('live-pace');
    if (el) el.textContent = state.pace ? fmtPace(state.pace) : "--'--\"";

    el = document.getElementById('live-speed');
    if (el) el.textContent = state.speed ? state.speed.toFixed(1) : '0.0';

    el = document.getElementById('live-dist');
    if (el) el.textContent = fmtDist(state.distance);

    el = document.getElementById('live-cadence');
    if (el) el.textContent = state.cadence || '0';

    el = document.getElementById('live-calories');
    if (el) el.textContent = state.calories || '0';

    el = document.getElementById('live-elapsed');
    if (el) el.textContent = fmtDur(state.duration);

    // Arc de remplissage progressif : 0 → pct% de FCmax
    var zone = getZone(state.hr, state.profile);
    var hasHr = state.hr > 0;
    var C = 376.99;
    var pct = hasHr ? Math.min(1, state.hr / computeFcmax(state.profile)) : 0;
    var fillArc = document.getElementById('hr-fill-arc');
    if (fillArc) {
      fillArc.style.strokeDashoffset = C * (1 - pct);
      fillArc.style.stroke = zone ? zone.color : 'var(--accent)';
      fillArc.style.strokeOpacity = hasHr ? '1' : '0';
    }

    // Badge de zone
    var badge = document.getElementById('live-zone-badge');
    if (badge) {
      if (zone && state.hr > 0) {
        badge.textContent = zone.name;
        badge.style.display = '';
        badge.style.background = zone.dimColor;
        badge.style.color = zone.color;
      } else {
        badge.style.display = 'none';
      }
    }

    // Minuteur de séance / bannière / bouton
    var timerDisplay = document.getElementById('session-timer-display');
    var banner = document.getElementById('session-banner');
    var btn = document.getElementById('btn-session');
    var subtitle = document.getElementById('live-subtitle');

    if (state.active) {
      if (timerDisplay) timerDisplay.textContent = fmtDur(state.duration);
      if (banner) banner.style.display = '';
      if (btn) {
        btn.textContent = state.paused ? '▶ Reprendre' : '⏸ Pause';
        btn.style.background = 'var(--energy)';
      }
      if (subtitle) subtitle.textContent = 'Séance en cours…';
    } else {
      if (banner) banner.style.display = 'none';
      if (btn) {
        btn.textContent = '▶ Démarrer la séance';
        btn.style.background = '';
      }
      if (subtitle) subtitle.textContent = 'Connectez un capteur pour démarrer';
    }

    // Live HR chart
    var chartCard = document.getElementById('live-hr-chart-card');
    if (window.Charts) {
      if (state.active) {
        // Reset chart data at session start
        if (!_wasActive) {
          Charts.clearLiveHR('live-hr-chart');
          _liveHrMin = null;
          _liveHrMax = null;
          if (chartCard) chartCard.style.display = '';
        }
        if (state.hr > 0) {
          var zoneColor = zone ? zone.color : null;
          Charts.pushLiveHR('live-hr-chart', state.duration, state.hr, zoneColor);
          _liveHrMin = (_liveHrMin === null) ? state.hr : Math.min(_liveHrMin, state.hr);
          _liveHrMax = (_liveHrMax === null) ? state.hr : Math.max(_liveHrMax, state.hr);
          var statEl = document.getElementById('live-hr-chart-stat');
          if (statEl && _liveHrMin !== null) {
            statEl.textContent = 'min ' + _liveHrMin + ' · max ' + _liveHrMax + ' bpm';
          }
        }
      } else if (_wasActive) {
        if (chartCard) chartCard.style.display = 'none';
      }
    }
    _wasActive = !!state.active;

    // Pastilles BLE
    Live._updateBleDots();
  }

  /* ---------- Type de séance ---------- */
  function setType(type) {
    window._sessionType = type;
    var t = document.getElementById('type-treadmill');
    var o = document.getElementById('type-outdoor');
    if (t) t.classList.toggle('active', type === 'treadmill');
    if (o) o.classList.toggle('active', type === 'outdoor');
    Live._refreshPanel();
  }

  function _refreshPanel() {
    var panel = document.getElementById('live-treadmill-panel');
    if (panel) panel.style.display = (window._sessionType === 'treadmill') ? '' : 'none';
  }

  /* ---------- Démarrer / Pause / Reprendre ---------- */
  async function toggleSession() {
    var state = Session.getState();
    if (state.active) {
      if (state.paused) {
        Session.resume();
      } else {
        Session.pause();
      }
    } else {
      await Session.start(window._sessionType || 'treadmill');
    }
  }

  /* ---------- Arrêter la séance ---------- */
  async function stopSession() {
    var state = Session.getState();
    if (state && state.duration > 30) {
      var ok = window.confirm('Terminer et enregistrer la séance ?');
      if (!ok) return;
    }
    var summary = await Session.stop();
    if (summary) {
      APP.showToast(
        'Séance enregistrée ! ' + fmtDist(summary.distance_m) + ' km en ' + fmtDur(summary.duration_s),
        'success'
      );
      APP.navigate('history');
    }
  }

  /* ---------- Pastilles et libellés BLE ---------- */
  function _updateBleDots() {
    if (!window.BT || !BT.state) return;
    var bt = BT.state;

    var hrDot = document.getElementById('ble-hr-dot');
    if (hrDot) hrDot.classList.toggle('connected', !!bt.hrConnected);

    var tDot = document.getElementById('ble-treadmill-dot');
    if (tDot) tDot.classList.toggle('connected', !!bt.treadmillConnected);

    var hrLabel = document.getElementById('ble-hr-label');
    if (hrLabel) hrLabel.textContent = bt.hrConnected ? 'FC connectée' : 'Cardio';

    var tLabel = document.getElementById('ble-treadmill-label');
    if (tLabel) tLabel.textContent = bt.treadmillConnected ? 'Tapis connecté' : 'Tapis roulant';

    var btnHr = document.getElementById('btn-connect-hr');
    if (btnHr) btnHr.textContent = bt.hrConnected ? 'Déconnecter' : 'Connecter';

    var btnT = document.getElementById('btn-connect-treadmill');
    if (btnT) btnT.textContent = bt.treadmillConnected ? 'Déconnecter' : 'Connecter';
  }

  window.Live = {
    init: init,
    setType: setType,
    toggleSession: toggleSession,
    stopSession: stopSession,
    _updateBleDots: _updateBleDots,
    _onSessionUpdate: _onSessionUpdate,
    _refreshPanel: _refreshPanel
  };
})();
