/* ============================================================
   SportTrack v2 — treadmill.js
   Contrôle la section "Tapis roulant" (#section-treadmill).
   Expose window.Treadmill
   ============================================================ */
(function () {
  'use strict';

  var _state = { currentSpeed: 0, currentIncline: 0 };

  /* ---------- Initialisation ---------- */
  function init() {
    if (window.BT) {
      if (typeof BT.onFTMS === 'function') {
        BT.onFTMS(Treadmill._onFTMS);
      }
      if (typeof BT.onHR === 'function') {
        BT.onHR(function (hr) {
          var el = document.getElementById('t-hr');
          if (el) el.textContent = hr || '--';
        });
      }
    }
    Treadmill._updateStatusText();
  }

  /* ---------- Données FTMS ---------- */
  function _onFTMS(data) {
    if (!data) data = {};

    var el;

    el = document.getElementById('t-speed-val');
    if (el) el.textContent = (data.speed || 0).toFixed(1);

    el = document.getElementById('t-dist');
    if (el) el.textContent = fmtDist((data.distance || 0) * 1000);

    el = document.getElementById('t-elapsed');
    if (el) el.textContent = fmtDur(data.elapsedSec || 0);

    el = document.getElementById('t-status-label');
    if (el) el.textContent = data.statusLabel || '—';

    // Met à jour le curseur sans déclencher onSlider
    var slider = document.getElementById('t-speed-slider');
    if (slider && data.speed > 0) slider.value = data.speed;

    // Bouton démarrer/arrêter
    var btn = document.getElementById('btn-treadmill-startstop');
    if (btn) {
      if (data.speed > 0 || data.status === 'running') {
        btn.textContent = '⏸';
        btn.style.background = 'var(--energy)';
      } else {
        btn.textContent = '▶';
        btn.style.background = '';
      }
    }

    Treadmill._state.currentSpeed = data.speed || 0;
    Treadmill._state.currentIncline = data.incline || 0;

    el = document.getElementById('t-incline-val');
    if (el) el.textContent = (data.incline || 0).toFixed(1);

    Treadmill._updateStatusText();
  }

  /* ---------- Réglage de la vitesse ---------- */
  function adjustSpeed(delta) {
    var slider = document.getElementById('t-speed-slider');
    var current = Treadmill._state.currentSpeed || (slider ? parseFloat(slider.value) : 0) || 8;
    var min = (BT.state && BT.state.speedMin) || 1;
    var max = (BT.state && BT.state.speedMax) || 20;
    var next = Math.max(min, Math.min(max, current + delta));

    var target = document.getElementById('t-speed-target');
    if (target) target.textContent = next.toFixed(1);

    BT.setSpeed(next);
  }

  function onSlider(val) {
    var target = document.getElementById('t-speed-target');
    if (target) target.textContent = parseFloat(val).toFixed(1);
    BT.setSpeed(+val);
  }

  /* ---------- Réglage de l'inclinaison ---------- */
  function adjustIncline(delta) {
    var current = Treadmill._state.currentIncline || 0;
    var next = Math.max(0, Math.min(15, current + delta));
    Treadmill._state.currentIncline = next;

    var el = document.getElementById('t-incline-val');
    if (el) el.textContent = next.toFixed(1);

    BT.setIncline(next);
  }

  /* ---------- Démarrer / Arrêter ---------- */
  function toggleStartStop() {
    if (Treadmill._state.currentSpeed > 0 || (BT.state && BT.state.treadmillStatus === 'running')) {
      BT.emergencyStop();
    } else {
      BT.toggleStartStop();
    }
  }

  /* ---------- Préréglages ---------- */
  function preset(speed, incline) {
    BT.setSpeed(speed);
    if (incline !== undefined) BT.setIncline(incline);
    APP.showToast('Préréglage: ' + speed + ' km/h' + (incline ? ' / +' + incline + '%' : ''), 'info');
  }

  /* ---------- Texte d'état ---------- */
  function _updateStatusText() {
    if (!window.BT || !BT.state) return;
    var connected = BT.state.treadmillConnected;
    var status = BT.state.treadmillStatusLabel || '—';

    var el = document.getElementById('treadmill-status-text');
    if (el) el.textContent = connected ? 'Connecté — ' + status : 'Non connecté';

    el = document.getElementById('t-ctrl-status');
    if (el) {
      el.textContent = BT.state.ctrlStatus || (connected ? '✓ Prêt' : 'Connectez le tapis pour commencer');
    }
  }

  window.Treadmill = {
    init: init,
    adjustSpeed: adjustSpeed,
    onSlider: onSlider,
    adjustIncline: adjustIncline,
    toggleStartStop: toggleStartStop,
    preset: preset,
    _onFTMS: _onFTMS,
    _updateStatusText: _updateStatusText,
    _state: _state
  };
})();
