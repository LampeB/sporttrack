// gps.js — Module GPS pour les courses en extérieur.
// Suivi de position (navigator.geolocation), calcul de distance (haversine),
// auto-pause, splits au kilomètre, carte Leaflet (window.L).
// Expose window.GPS.

window.GPS = (function() {

  // Horodatages internes (non exposés dans state)
  let startTimestamp = null; // pos.timestamp du premier fix
  let prevTimestamp = null;  // pos.timestamp du fix précédent

  const LOW_SPEED_KMH = 1.8;      // < ~1.8 km/h = marche/arrêt
  const AUTO_PAUSE_DELAY_MS = 5000;

  const state = {
    active: false,
    paused: false,        // état d'auto-pause
    watchId: null,
    points: [],           // [{lat, lng, elevation, t, speed, distance}]
    totalDistance: 0,     // km
    currentSpeed: 0,      // km/h
    currentPace: 0,       // sec/km
    currentElevation: 0,  // m
    accuracy: null,       // m
    splits: [],           // [{km, time, pace}]
    lastKmMark: 0,        // km entiers au dernier split
    lowSpeedSince: null,  // timestamp du passage sous le seuil de vitesse
    map: null,
    polyline: null,
    marker: null,
    onUpdate: null,       // callback(state)
  };

  // --- Distance haversine entre deux points, en km ---
  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // --- Carte Leaflet ---
  function initMap(containerId) {
    if (!window.L) {
      console.error('GPS.initMap: Leaflet (window.L) non disponible');
      return;
    }
    if (state.map) state.map.remove();

    state.map = L.map(containerId, { zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(state.map);

    state.polyline = L.polyline([], { color: '#7c6fff', weight: 4 }).addTo(state.map);

    // Marqueur personnalisé (point coloré)
    const icon = L.divIcon({
      className: '',
      html: '<div style="width:14px;height:14px;border-radius:50%;background:#7c6fff;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.5)"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    state.marker = L.marker([0, 0], { icon }).addTo(state.map);

    // Vue par défaut (Paris) en attendant le premier fix
    state.map.setView([48.8566, 2.3522], 13);

    // Si des points existent déjà (carte ré-initialisée en cours de session)
    if (state.points.length) {
      const latlngs = state.points.map(function(p) { return [p.lat, p.lng]; });
      state.polyline.setLatLngs(latlngs);
      const last = latlngs[latlngs.length - 1];
      state.marker.setLatLng(last);
      state.map.setView(last, 16);
    }
  }

  function destroyMap() {
    if (state.map) {
      state.map.remove();
      state.map = null;
      state.polyline = null;
      state.marker = null;
    }
  }

  // --- Suivi ---
  function start(onUpdate) {
    if (!navigator.geolocation) {
      if (window.APP && APP.showToast) APP.showToast('GPS non disponible sur cet appareil', 'error');
      return false;
    }
    if (state.active) return true; // déjà en cours

    state.onUpdate = onUpdate || null;
    state.active = true;
    state.paused = false;
    state.lowSpeedSince = null;
    startTimestamp = null;
    prevTimestamp = null;

    state.watchId = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000,
    });
    return true;
  }

  function onPosition(pos) {
    if (!state.active) return;

    const coords = pos.coords;
    const latitude = coords.latitude;
    const longitude = coords.longitude;
    const altitude = coords.altitude;
    const accuracy = coords.accuracy;

    if (startTimestamp === null) startTimestamp = pos.timestamp;

    state.accuracy = Math.round(accuracy);
    // L'altitude GPS est imprécise — on reporte simplement ce qu'on reçoit
    state.currentElevation = (altitude !== null && altitude !== undefined && !isNaN(altitude))
      ? Math.round(altitude)
      : state.currentElevation;

    const now = Math.round((pos.timestamp - startTimestamp) / 1000); // secondes depuis le départ
    const prev = state.points[state.points.length - 1];

    let dist = 0, speedKmh = 0;
    if (prev && prevTimestamp !== null) {
      dist = haversine(prev.lat, prev.lng, latitude, longitude);
      const dt = (pos.timestamp - prevTimestamp) / 1000; // secondes
      speedKmh = dt > 0 ? (dist / dt * 3600) : 0;
    }
    prevTimestamp = pos.timestamp;

    state.currentSpeed = speedKmh;
    state.currentPace = speedKmh > 0.5 ? Math.round(3600 / speedKmh) : 0;

    // --- Auto-pause ---
    if (speedKmh < LOW_SPEED_KMH) {
      if (!state.lowSpeedSince) {
        state.lowSpeedSince = Date.now();
      } else if (Date.now() - state.lowSpeedSince > AUTO_PAUSE_DELAY_MS) {
        if (!state.paused) {
          state.paused = true;
          if (window.APP && APP.showToast) APP.showToast('Auto-pause activée', 'info');
        }
      }
    } else {
      if (state.paused && window.APP && APP.showToast) APP.showToast('Reprise de la course', 'info');
      state.lowSpeedSince = null;
      state.paused = false;
    }

    if (state.paused) {
      // En pause : on notifie quand même l'UI (précision, état pause) sans accumuler
      if (state.onUpdate) state.onUpdate(getState());
      return;
    }

    state.totalDistance += dist;

    const point = {
      lat: latitude,
      lng: longitude,
      elevation: altitude,
      t: now,
      speed: speedKmh,
      distance: state.totalDistance,
    };
    state.points.push(point);

    // --- Mise à jour de la carte ---
    if (state.polyline) state.polyline.addLatLng([latitude, longitude]);
    if (state.marker) {
      state.marker.setLatLng([latitude, longitude]);
      if (state.points.length === 1 && state.map) state.map.setView([latitude, longitude], 16);
    }
    if (state.map && state.points.length % 10 === 0) state.map.panTo([latitude, longitude]);

    // --- Splits au kilomètre ---
    const km = Math.floor(state.totalDistance);
    if (km > state.lastKmMark) {
      state.splits.push({ km: km, time: now, pace: state.currentPace });
      state.lastKmMark = km;
    }

    if (state.onUpdate) state.onUpdate(getState());
  }

  function onError(err) {
    console.error('GPS error:', err.code, err.message);
    let msg = 'Erreur GPS';
    if (err.code === 1) msg = 'Accès à la position refusé — vérifiez les autorisations';
    else if (err.code === 2) msg = 'Position GPS indisponible';
    else if (err.code === 3) msg = 'Délai GPS dépassé — signal faible';
    if (window.APP && APP.showToast) APP.showToast(msg, 'error');
  }

  function stop() {
    if (state.watchId !== null) navigator.geolocation.clearWatch(state.watchId);
    state.active = false;
    state.watchId = null;
  }

  function reset() {
    stop();
    state.points = [];
    state.totalDistance = 0;
    state.splits = [];
    state.lastKmMark = 0;
    state.currentSpeed = 0;
    state.currentPace = 0;
    state.currentElevation = 0;
    state.accuracy = null;
    state.lowSpeedSince = null;
    state.paused = false;
    startTimestamp = null;
    prevTimestamp = null;
    if (state.polyline) state.polyline.setLatLngs([]);
  }

  function getState() {
    return {
      active: state.active,
      paused: state.paused,
      points: state.points,
      totalDistance: state.totalDistance,
      currentSpeed: state.currentSpeed,
      currentPace: state.currentPace,
      currentElevation: state.currentElevation,
      accuracy: state.accuracy,
      splits: state.splits,
    };
  }

  // --- Dénivelé positif cumulé (résumé de fin de session) ---
  // Somme des différences d'altitude positives entre points consécutifs
  // (les altitudes null/undefined sont ignorées).
  function calcElevationGain(points) {
    if (!points || !points.length) return 0;
    let gain = 0;
    let prevElev = null;
    for (let i = 0; i < points.length; i++) {
      const e = points[i].elevation;
      if (e === null || e === undefined || isNaN(e)) continue;
      if (prevElev !== null && e > prevElev) gain += e - prevElev;
      prevElev = e;
    }
    return Math.round(gain);
  }

  return {
    state: state,
    haversine: haversine,
    initMap: initMap,
    destroyMap: destroyMap,
    start: start,
    stop: stop,
    reset: reset,
    getState: getState,
    calcElevationGain: calcElevationGain,
  };
})();
