/* ============================================================
   SportTrack v2 — charts.js
   Chart.js v4 wrappers. Expose window.Charts.
   Dark theme, no build step (UMD globals).
   ============================================================ */
(function () {
  'use strict';

  // ---- Global Chart.js defaults (set once) ----
  if (window.Chart) {
    Chart.defaults.color = 'rgba(136,136,170,0.8)';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.07)';
    Chart.defaults.font.family = "system-ui,-apple-system,'Segoe UI',sans-serif";
  }

  // ---- Palette (hex equivalents of CSS vars, safe for canvas gradients) ----
  const COLORS = {
    accent: '#7c6fff',
    energy: '#ff6b35',
    green: '#22d3a0',
    zones: ['#94a3b8', '#22d3ee', '#22c55e', '#f97316', '#ef4444'],
  };

  // ---- Registry of live chart instances ----
  const _charts = {};

  function _destroyIfExists(id) {
    if (_charts[id]) {
      _charts[id].destroy();
      delete _charts[id];
    }
  }

  function _getCtx(canvasId) {
    const el = document.getElementById(canvasId);
    if (!el || typeof el.getContext !== 'function') return null;
    return el.getContext('2d');
  }

  // mm:ss (or h:mm:ss) label for a time offset in seconds
  function _fmtTime(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  // Vertical gradient: color (top) → transparent (bottom)
  function _gradient(ctx, hex, alphaTop) {
    const h = ctx.canvas.clientHeight || ctx.canvas.height || 300;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    const a = Math.round((alphaTop == null ? 0.35 : alphaTop) * 255).toString(16).padStart(2, '0');
    g.addColorStop(0, hex + a);
    g.addColorStop(1, hex + '00');
    return g;
  }

  // Shared options for line/area charts over time
  function _baseLineOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(20,20,35,0.92)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 10,
          displayColors: false,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxRotation: 0, autoSkip: false },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          beginAtZero: false,
        },
      },
    };
  }

  // Build x-tick callback that shows a label every `stepSec` seconds of elapsed time
  function _timeTickCallback(times, stepSec) {
    return function (value, index) {
      const t = times[index];
      if (t == null) return '';
      if (index === 0) return _fmtTime(t);
      const prev = times[index - 1];
      // show label when crossing a stepSec boundary
      if (Math.floor(t / stepSec) !== Math.floor(prev / stepSec)) return _fmtTime(Math.floor(t / stepSec) * stepSec);
      return '';
    };
  }

  /* ============================================================
     1. renderHR(canvasId, points, profile)
     ============================================================ */
  function renderHR(canvasId, points, profile) {
    _destroyIfExists(canvasId);
    const ctx = _getCtx(canvasId);
    if (!ctx) return null;

    const pts = (points || []).filter(p => p && p.hr != null && p.hr > 0);
    if (!pts.length) return null;

    const times = pts.map(p => p.t || 0);
    const labels = times.map(_fmtTime);
    const data = pts.map(p => p.hr);

    // Zone boundary lines (dashed) via a tiny inline plugin
    let boundaries = [];
    if (profile && window.computeFcmax && window.CONFIG && CONFIG.zones) {
      const fcmax = computeFcmax(profile);
      boundaries = CONFIG.zones.map((z, i) => ({
        hr: Math.round(fcmax * z.pctMin),
        color: COLORS.zones[i] || COLORS.accent,
      }));
    }

    const zoneLinesPlugin = {
      id: 'st_zoneLines',
      afterDatasetsDraw(chart) {
        if (!boundaries.length) return;
        const { ctx: c, chartArea, scales } = chart;
        if (!chartArea || !scales.y) return;
        c.save();
        c.setLineDash([4, 4]);
        c.lineWidth = 1;
        boundaries.forEach(b => {
          const y = scales.y.getPixelForValue(b.hr);
          if (y < chartArea.top || y > chartArea.bottom) return;
          c.strokeStyle = b.color + '66';
          c.beginPath();
          c.moveTo(chartArea.left, y);
          c.lineTo(chartArea.right, y);
          c.stroke();
          c.fillStyle = b.color + 'cc';
          c.font = '10px ' + Chart.defaults.font.family;
          c.textBaseline = 'bottom';
          c.fillText(String(b.hr), chartArea.left + 4, y - 2);
        });
        c.restore();
      },
    };

    const minHr = Math.min.apply(null, data);
    const maxHr = Math.max.apply(null, data);

    const options = _baseLineOptions();
    options.scales.x.ticks.callback = _timeTickCallback(times, 300); // every 5 min
    options.scales.y.suggestedMin = Math.max(40, Math.floor((minHr - 10) / 10) * 10);
    options.scales.y.suggestedMax = Math.ceil((maxHr + 10) / 10) * 10;
    options.plugins.tooltip.callbacks = {
      title: items => _fmtTime(times[items[0].dataIndex]),
      label: item => {
        const hr = item.parsed.y;
        let zoneTxt = '';
        if (window.getZone) {
          const z = getZone(hr, profile);
          if (z) zoneTxt = ' · Z' + z.id + ' ' + z.name;
        }
        return hr + ' bpm' + zoneTxt;
      },
    };

    _charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: COLORS.accent,
          borderWidth: 2,
          backgroundColor: _gradient(ctx, COLORS.accent, 0.35),
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHitRadius: 8,
        }],
      },
      options,
      plugins: [zoneLinesPlugin],
    });
    return _charts[canvasId];
  }

  /* ============================================================
     2. renderSpeed(canvasId, points)
     ============================================================ */
  function renderSpeed(canvasId, points) {
    _destroyIfExists(canvasId);
    const ctx = _getCtx(canvasId);
    if (!ctx) return null;

    const pts = (points || []).filter(p => p && p.speed_kmh != null && p.speed_kmh >= 0);
    if (!pts.length) return null;

    const times = pts.map(p => p.t || 0);
    const labels = times.map(_fmtTime);
    const data = pts.map(p => Math.round(p.speed_kmh * 100) / 100);

    const options = _baseLineOptions();
    options.scales.x.ticks.callback = _timeTickCallback(times, 300);
    options.scales.y.beginAtZero = true;
    options.scales.y.title = { display: true, text: 'km/h' };
    options.plugins.tooltip.callbacks = {
      title: items => _fmtTime(times[items[0].dataIndex]),
      label: item => {
        const v = item.parsed.y;
        const pace = v > 0 ? window.fmtPace(3600 / v) : "--'--\"";
        return v.toFixed(1) + ' km/h · ' + pace + '/km';
      },
    };

    _charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: COLORS.energy,
          borderWidth: 2,
          backgroundColor: _gradient(ctx, COLORS.energy, 0.3),
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHitRadius: 8,
        }],
      },
      options,
    });
    return _charts[canvasId];
  }

  /* ============================================================
     3. renderZoneDonut(canvasId, session, profile)
     ============================================================ */
  function renderZoneDonut(canvasId, session, profile) {
    _destroyIfExists(canvasId);
    const ctx = _getCtx(canvasId);
    if (!ctx || !session) return null;

    const raw = [1, 2, 3, 4, 5].map(i => Number(session['zone' + i + '_s']) || 0);
    const total = raw.reduce((a, b) => a + b, 0);
    if (total <= 0) return null;

    const labels = [];
    const data = [];
    const colors = [];
    raw.forEach((sec, i) => {
      if (sec > 0) {
        const zone = (window.CONFIG && CONFIG.zones && CONFIG.zones[i]) || null;
        labels.push('Z' + (i + 1) + (zone ? ' ' + zone.name : ''));
        data.push(sec);
        colors.push(COLORS.zones[i]);
      }
    });

    _charts[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: 'rgba(15,15,28,0.9)',
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
      options: {
        cutout: '65%',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, padding: 12 },
          },
          tooltip: {
            backgroundColor: 'rgba(20,20,35,0.92)',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: item => {
                const sec = item.parsed;
                const pct = Math.round((sec / total) * 100);
                return ' ' + window.fmtDur(sec) + ' (' + pct + '%)';
              },
            },
          },
        },
      },
    });
    return _charts[canvasId];
  }

  /* ============================================================
     4. renderElevation(canvasId, points)
     ============================================================ */
  function renderElevation(canvasId, points) {
    _destroyIfExists(canvasId);
    const ctx = _getCtx(canvasId);
    if (!ctx) return null;

    const pts = (points || []).filter(p => p && p.elevation_m != null && isFinite(p.elevation_m));
    if (!pts.length) return null;

    const times = pts.map(p => p.t || 0);
    const labels = times.map(_fmtTime);
    const data = pts.map(p => Math.round(p.elevation_m * 10) / 10);

    const minEl = Math.min.apply(null, data);
    const maxEl = Math.max.apply(null, data);
    const pad = Math.max(5, (maxEl - minEl) * 0.15);

    const options = _baseLineOptions();
    options.scales.x.ticks.callback = _timeTickCallback(times, 300);
    options.scales.y.suggestedMin = Math.floor(minEl - pad);
    options.scales.y.suggestedMax = Math.ceil(maxEl + pad);
    options.scales.y.title = { display: true, text: 'm' };
    options.plugins.tooltip.callbacks = {
      title: items => _fmtTime(times[items[0].dataIndex]),
      label: item => Math.round(item.parsed.y) + ' m',
    };

    _charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: COLORS.green,
          borderWidth: 2,
          backgroundColor: _gradient(ctx, COLORS.green, 0.3),
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHitRadius: 8,
        }],
      },
      options,
    });
    return _charts[canvasId];
  }

  /* ============================================================
     5. renderWeekly(canvasId, sessions)
     ============================================================ */
  const FR_DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  function _dayKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function renderWeekly(canvasId, sessions) {
    _destroyIfExists(canvasId);
    const ctx = _getCtx(canvasId);
    if (!ctx) return null;

    // Build the last 7 days (oldest → today)
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push({ key: _dayKey(d), label: FR_DAYS[d.getDay()], treadmill: 0, outdoor: 0 });
    }
    const byKey = {};
    days.forEach(d => { byKey[d.key] = d; });

    (sessions || []).forEach(s => {
      if (!s || !s.started_at) return;
      const d = new Date(s.started_at);
      if (isNaN(d.getTime())) return;
      const bucket = byKey[_dayKey(d)];
      if (!bucket) return;
      const km = (Number(s.distance_m) || 0) / 1000;
      if (s.type === 'outdoor') bucket.outdoor += km;
      else bucket.treadmill += km;
    });

    const round2 = v => Math.round(v * 100) / 100;

    _charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: days.map(d => d.label),
        datasets: [
          {
            label: 'Tapis',
            data: days.map(d => round2(d.treadmill)),
            backgroundColor: COLORS.accent,
            borderRadius: 4,
            stack: 'dist',
          },
          {
            label: 'Extérieur',
            data: days.map(d => round2(d.outdoor)),
            backgroundColor: COLORS.green,
            borderRadius: 4,
            stack: 'dist',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, padding: 12 },
          },
          tooltip: {
            backgroundColor: 'rgba(20,20,35,0.92)',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: item => ' ' + item.dataset.label + ' : ' + item.parsed.y.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' km',
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            title: { display: true, text: 'km' },
            ticks: { precision: 1 },
          },
        },
      },
    });
    return _charts[canvasId];
  }

  /* ============================================================
     6/7. destroy / destroyAll
     ============================================================ */
  function destroy(canvasId) {
    _destroyIfExists(canvasId);
  }

  function destroyAll() {
    Object.keys(_charts).forEach(_destroyIfExists);
  }

  window.Charts = { renderHR, renderSpeed, renderZoneDonut, renderElevation, renderWeekly, destroy, destroyAll };
})();
