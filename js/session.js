// =====================================================
// SportTrack v2 — session.js
// Gestion du cycle de vie d'une séance d'entraînement.
// Expose window.Session (UMD global, sans build).
// Dépendances globales : DB, BT, GPS, CONFIG, getZone,
// calcKcal, APP.showToast.
// =====================================================
window.Session = (function () {
  'use strict';

  // ---------------------------------------------------
  // État interne
  // ---------------------------------------------------
  const state = {
    active: false,
    paused: false,
    type: 'treadmill', // 'treadmill' | 'outdoor'
    startTime: null,   // Date.now()
    pauseTime: null,
    totalPausedMs: 0,
    duration: 0,       // secondes (hors pause)
    sessionId: null,   // id Supabase une fois la ligne créée

    // Métriques live (mises à jour par les callbacks BT/GPS)
    hr: 0,
    speed: 0,          // km/h
    pace: 0,           // sec/km
    distance: 0,       // mètres
    cadence: 0,
    elevation: 0,      // mètres (outdoor)
    incline: 0,        // % (treadmill)

    // Accumulateurs
    hrSamples: [],     // {t, hr}
    zoneSeconds: [0, 0, 0, 0, 0], // index 0-4 pour zones 1-5
    peakHr: 0,
    minHr: 999,
    peakSpeed: 0,
    peakCadence: 0,
    cadenceSum: 0,
    cadenceCount: 0,

    // Buffer de points (flush vers la DB toutes les 5 s)
    pointBuffer: [],
    lastPointSave: 0,  // secondes

    // Intervals
    tickInterval: null,
    demoInterval: null,

    // Mode démo
    demoActive: false,
    demoTime: 0,       // secondes écoulées en démo

    // Callbacks
    _listeners: [],
    profile: null,     // profil chargé pour les calculs
  };

  // ---------------------------------------------------
  // Utilitaires
  // ---------------------------------------------------

  // Pseudo-aléatoire répétable pour le mode démo (0..1)
  function demoRand(t, seed) {
    const x = Math.sin(t * 127.1 + 13 + (seed || 0)) * 43758.5453;
    return Math.abs(x % 1);
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function avgOf(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function getState() {
    return {
      ...state,
      zoneSeconds: [...state.zoneSeconds],
      hrSamples: state.hrSamples,
    };
  }

  function fireListeners() {
    const snapshot = getState();
    state._listeners.forEach(cb => {
      try { cb(snapshot); } catch (e) { console.error('Session listener:', e); }
    });
  }

  function updateZone() {
    // Les pics/min sont mis à jour à chaque échantillon HR reçu
    if (state.hr > 0) {
      if (state.hr > state.peakHr) state.peakHr = state.hr;
      if (state.hr < state.minHr) state.minHr = state.hr;
    }
  }

  // ---------------------------------------------------
  // Mode démo : simulation HR / vitesse / cadence
  // ---------------------------------------------------
  function demoStep() {
    const t = state.demoTime;

    const hr = 140 + 25 * Math.sin(t / 80) + (demoRand(t, 1) - 0.5) * 8;
    state.hr = Math.round(clamp(hr, 60, 200));
    updateZone();

    const speed = state.type === 'treadmill'
      ? 8 + 2 * Math.sin(t / 60)
      : 9 + 1.5 * Math.sin(t / 50);
    state.speed = Math.round(speed * 100) / 100;

    state.cadence = Math.round(160 + 10 * Math.sin(t / 40) + demoRand(t, 2) * 6);
    state.pace = state.speed > 0 ? Math.round(3600 / state.speed) : 0;

    // Distance et altitude n'avancent que si la séance est active et non en pause
    if (state.active && !state.paused) {
      state.distance += state.speed / 3.6; // m/s pendant 1 s
      if (state.type === 'outdoor') {
        state.elevation += (demoRand(t, 3) - 0.45) * 0.3;
      } else {
        state.incline = Math.max(0, Math.round((2 + 2 * Math.sin(t / 90)) * 10) / 10);
      }
    }

    state.demoTime += 1;
  }

  function startDemo() {
    if (state.demoInterval) return;
    state.demoActive = true;
    state.demoTime = 0;
    state.demoInterval = setInterval(demoStep, 1000);
  }

  function stopDemo() {
    if (state.demoInterval) {
      clearInterval(state.demoInterval);
      state.demoInterval = null;
    }
    state.demoActive = false;
    state.demoTime = 0;
    // Remise à zéro des valeurs simulées (la distance parcourue est conservée)
    state.hr = 0;
    state.speed = 0;
    state.pace = 0;
    state.cadence = 0;
  }

  function toggleDemo() {
    if (state.demoActive) {
      stopDemo();
    } else {
      startDemo();
    }
    const el = document.getElementById('demo-toggle');
    if (el) el.classList.toggle('on', state.demoActive);
    if (window.APP && APP.showToast) {
      APP.showToast(state.demoActive ? 'Mode démo activé' : 'Mode démo désactivé', 'info');
    }
    fireListeners();
    return state.demoActive;
  }

  // ---------------------------------------------------
  // Persistance des points
  // ---------------------------------------------------
  function buildPoint() {
    let lat = null, lng = null;
    if (state.type === 'outdoor' && window.GPS && GPS.state && Array.isArray(GPS.state.points) && GPS.state.points.length) {
      const last = GPS.state.points[GPS.state.points.length - 1];
      lat = (last.lat != null) ? last.lat : null;
      lng = (last.lng != null) ? last.lng : ((last.lon != null) ? last.lon : null);
    }
    return {
      t: state.duration,
      hr: state.hr,
      speed_kmh: Math.round(state.speed * 100) / 100,
      cadence: state.cadence,
      distance_m: Math.round(state.distance),
      incline_pct: state.type === 'treadmill' ? state.incline : null,
      lat: lat,
      lng: lng,
      elevation_m: state.type === 'outdoor' ? Math.round(state.elevation * 10) / 10 : null,
    };
  }

  async function flushPoints() {
    if (!state.sessionId || !state.pointBuffer.length) return;
    const batch = state.pointBuffer.splice(0, state.pointBuffer.length);
    try {
      await DB.saveBatchPoints(state.sessionId, batch);
    } catch (e) {
      console.error('Session flushPoints:', e);
      // Réinsère le lot pour retenter au prochain flush
      state.pointBuffer = batch.concat(state.pointBuffer);
    }
  }

  async function pushLive() {
    try {
      await DB.upsertLive({
        active: true,
        type: state.type,
        hr: state.hr,
        speed_kmh: Math.round(state.speed * 100) / 100,
        pace_s_per_km: state.pace,
        distance_m: Math.round(state.distance),
        cadence: state.cadence,
        duration_s: state.duration,
        started_at: state.startTime ? new Date(state.startTime).toISOString() : null,
      });
    } catch (e) {
      console.error('Session pushLive:', e);
    }
  }

  // ---------------------------------------------------
  // Ticker (toutes les secondes)
  // ---------------------------------------------------
  function tick() {
    if (!state.active) return;

    if (!state.paused) {
      state.duration += 1;

      // Comptage du temps par zone cardiaque
      if (state.hr > 0) {
        const zone = window.getZone(state.hr, state.profile);
        if (zone && zone.id >= 1 && zone.id <= 5) {
          state.zoneSeconds[zone.id - 1] += 1;
        }
        state.hrSamples.push({ t: state.duration, hr: state.hr });
        if (state.hr > state.peakHr) state.peakHr = state.hr;
        if (state.hr < state.minHr) state.minHr = state.hr;
      }

      // Pics vitesse / cadence
      if (state.speed > state.peakSpeed) state.peakSpeed = state.speed;
      if (state.cadence > state.peakCadence) state.peakCadence = state.cadence;
      if (state.cadence > 0) {
        state.cadenceSum += state.cadence;
        state.cadenceCount += 1;
      }

      // Toutes les 5 s : point + live + flush éventuel
      if (state.duration - state.lastPointSave >= 5) {
        state.lastPointSave = state.duration;
        state.pointBuffer.push(buildPoint());
        if (state.pointBuffer.length >= 10) flushPoints();
        pushLive();
      }
    }

    fireListeners();
  }

  // ---------------------------------------------------
  // Branchement des capteurs
  // ---------------------------------------------------
  function attachSensors() {
    if (window.BT) {
      try {
        BT.onHR(hr => {
          if (!state.demoActive) {
            state.hr = hr || 0;
            updateZone();
          }
        });
        BT.onFTMS(data => {
          if (state.demoActive || !data) return;
          state.speed = data.speed || 0;
          state.pace = data.speed > 0 ? Math.round(3600 / data.speed) : 0;
          if (data.distance != null) state.distance = data.distance * 1000;
          if (data.cadence != null) state.cadence = data.cadence;
          state.incline = data.incline || 0;
        });
        BT.onRSC(data => {
          if (state.demoActive || !data) return;
          state.speed = (data.speed || 0) * 3.6;
          state.pace = state.speed > 0 ? Math.round(3600 / state.speed) : 0;
          if (data.cadence != null) state.cadence = data.cadence;
          if (data.distance != null) state.distance = data.distance * 1000;
        });
      } catch (e) {
        console.error('Session attachSensors (BT):', e);
      }
    }

    if (state.type === 'outdoor' && window.GPS) {
      try {
        GPS.start(function(data) {
          if (state.demoActive || !data) return;
          if (data.currentSpeed != null) {
            state.speed = data.currentSpeed; // km/h
            state.pace = data.currentSpeed > 0 ? Math.round(3600 / data.currentSpeed) : 0;
          }
          if (data.totalDistance != null) state.distance = data.totalDistance * 1000; // km→m
          if (data.currentElevation != null) state.elevation = data.currentElevation;
        });
      } catch (e) {
        console.error('Session attachSensors (GPS):', e);
      }
    }
  }

  function detachSensors() {
    if (window.BT) {
      try {
        BT.onHR(null);
        BT.onFTMS(null);
        BT.onRSC(null);
      } catch (e) {
        console.error('Session detachSensors (BT):', e);
      }
    }
    if (window.GPS) {
      try {
        if (GPS.state && GPS.state.active && GPS.stop) GPS.stop();
      } catch (e) {
        console.error('Session detachSensors (GPS):', e);
      }
    }
  }

  // ---------------------------------------------------
  // Cycle de vie
  // ---------------------------------------------------
  async function start(type) {
    if (state.active) {
      console.warn('Session.start: séance déjà en cours');
      return null;
    }

    state.type = (type === 'outdoor') ? 'outdoor' : 'treadmill';

    // Chargement du profil pour les calculs (FCmax, kcal…)
    try {
      state.profile = await DB.getProfile();
    } catch (e) {
      console.error('Session.start getProfile:', e);
      state.profile = null;
    }

    // Réinitialisation des accumulateurs
    state.startTime = Date.now();
    state.pauseTime = null;
    state.totalPausedMs = 0;
    state.duration = 0;
    state.sessionId = null;
    state.hr = 0;
    state.speed = 0;
    state.pace = 0;
    state.distance = 0;
    state.cadence = 0;
    state.elevation = 0;
    state.incline = 0;
    state.hrSamples = [];
    state.zoneSeconds = [0, 0, 0, 0, 0];
    state.peakHr = 0;
    state.minHr = 999;
    state.peakSpeed = 0;
    state.peakCadence = 0;
    state.cadenceSum = 0;
    state.cadenceCount = 0;
    state.pointBuffer = [];
    state.lastPointSave = 0;
    state.paused = false;
    state.active = true;

    attachSensors();

    // Ticker 1 s
    if (state.tickInterval) clearInterval(state.tickInterval);
    state.tickInterval = setInterval(tick, 1000);

    // Création de la ligne de session en DB
    try {
      const row = await DB.saveSession({
        type: state.type,
        started_at: new Date(state.startTime).toISOString(),
      });
      state.sessionId = row && row.id ? row.id : null;
    } catch (e) {
      console.error('Session.start saveSession:', e);
      if (window.APP && APP.showToast) {
        APP.showToast('Séance démarrée hors-ligne (DB indisponible)', 'warning');
      }
    }

    pushLive();
    fireListeners();
    return state.sessionId;
  }

  function pause() {
    if (!state.active || state.paused) return;
    state.paused = true;
    state.pauseTime = Date.now();
    fireListeners();
  }

  function resume() {
    if (!state.active || !state.paused) return;
    if (state.pauseTime) {
      state.totalPausedMs += Date.now() - state.pauseTime;
    }
    state.pauseTime = null;
    state.paused = false;
    fireListeners();
  }

  async function stop() {
    if (!state.active) return null;

    // Arrêt des tickers
    if (state.tickInterval) {
      clearInterval(state.tickInterval);
      state.tickInterval = null;
    }
    if (state.demoActive) stopDemo();
    const el = document.getElementById('demo-toggle');
    if (el) el.classList.remove('on');

    detachSensors();

    // ----- Calcul du résumé -----
    const hrValues = state.hrSamples.map(s => s.hr);
    const avgHr = Math.round(avgOf(hrValues));
    const durationS = state.duration;
    const distanceM = Math.round(state.distance);

    // Cadence moyenne accumulée seconde par seconde pendant la séance
    const avgCadence = state.cadenceCount > 0
      ? state.cadenceSum / state.cadenceCount
      : 0;

    let elevationGain = 0, elevationLoss = 0;
    if (state.type === 'outdoor' && window.GPS && GPS.state && Array.isArray(GPS.state.points)) {
      const pts = GPS.state.points;
      for (let i = 1; i < pts.length; i++) {
        const prev = (pts[i - 1].elevation != null) ? pts[i - 1].elevation : pts[i - 1].ele;
        const cur = (pts[i].elevation != null) ? pts[i].elevation : pts[i].ele;
        if (prev == null || cur == null) continue;
        const diff = cur - prev;
        if (diff > 0) elevationGain += diff;
        else elevationLoss += -diff;
      }
    }

    const summary = {
      duration_s: durationS,
      distance_m: distanceM,
      steps: Math.round(durationS * avgCadence / 60),
      avg_hr: avgHr,
      max_hr: state.peakHr,
      min_hr: state.minHr === 999 ? 0 : state.minHr,
      avg_speed_kmh: durationS > 0
        ? Math.round((distanceM / 1000) / (durationS / 3600) * 100) / 100
        : 0,
      max_speed_kmh: Math.round(state.peakSpeed * 100) / 100,
      avg_pace_s_per_km: distanceM > 0
        ? Math.round(durationS / (distanceM / 1000))
        : 0,
      calories: window.calcKcal(avgHr, durationS / 60, state.profile),
      zone1_s: state.zoneSeconds[0],
      zone2_s: state.zoneSeconds[1],
      zone3_s: state.zoneSeconds[2],
      zone4_s: state.zoneSeconds[3],
      zone5_s: state.zoneSeconds[4],
      ended_at: new Date().toISOString(),
    };

    if (state.type === 'outdoor') {
      summary.elevation_gain_m = Math.round(elevationGain);
      summary.elevation_loss_m = Math.round(elevationLoss);
    }

    // ----- Persistance -----
    if (state.sessionId) {
      try {
        const sb = DB.getClient && DB.getClient();
        if (sb) {
          await sb.from('sessions').update(summary).eq('id', state.sessionId);
        }
      } catch (e) {
        console.error('Session.stop update session:', e);
        if (window.APP && APP.showToast) {
          APP.showToast('Erreur lors de la sauvegarde de la séance', 'error');
        }
      }

      try {
        await flushPoints();
      } catch (e) {
        console.error('Session.stop flushPoints:', e);
      }
    }

    try {
      await DB.clearLive();
    } catch (e) {
      console.error('Session.stop clearLive:', e);
    }

    const result = { id: state.sessionId, type: state.type, ...summary };

    // ----- Réinitialisation de l'état -----
    state.active = false;
    state.paused = false;
    state.startTime = null;
    state.pauseTime = null;
    state.totalPausedMs = 0;
    state.duration = 0;
    state.sessionId = null;
    state.hr = 0;
    state.speed = 0;
    state.pace = 0;
    state.distance = 0;
    state.cadence = 0;
    state.elevation = 0;
    state.incline = 0;
    state.hrSamples = [];
    state.zoneSeconds = [0, 0, 0, 0, 0];
    state.peakHr = 0;
    state.minHr = 999;
    state.peakSpeed = 0;
    state.peakCadence = 0;
    state.cadenceSum = 0;
    state.cadenceCount = 0;
    state.pointBuffer = [];
    state.lastPointSave = 0;

    fireListeners();
    return result;
  }

  // ---------------------------------------------------
  // API publique
  // ---------------------------------------------------
  return {
    start,
    stop,
    pause,
    resume,
    toggleDemo,
    getState,
    onUpdate(cb) {
      if (typeof cb === 'function') state._listeners.push(cb);
    },
    offUpdate(cb) {
      state._listeners = state._listeners.filter(l => l !== cb);
    },
    getDemoMode() {
      return state.demoActive;
    },
  };
})();
