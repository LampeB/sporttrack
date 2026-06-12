/* ============================================================
 * SportTrack v2 — history.js
 * Contrôleur de la section "Historique" (#section-history)
 * Expose window.History
 * Dépendances : window.DB, window.Charts, window.APP, helpers
 * globaux (fmtPace, fmtDur, fmtDist, fmtDate, CONFIG)
 * ============================================================ */
(function () {
  'use strict';

  // ---------- État ----------
  let _sessions = [];
  let _offset = 0;
  const PAGE_SIZE = 20;
  let _currentDetail = null;
  let _initialized = false;

  // ---------- Helpers ----------

  function escapeHtml(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function dash(v) {
    return (v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v))) ? '—' : v;
  }

  function statCard(label, value, unit) {
    return '<div class="stat-card">' +
        '<div class="stat-label">' + escapeHtml(label) + '</div>' +
        '<div class="stat-value">' + value +
          (unit ? ' <span class="stat-unit">' + escapeHtml(unit) + '</span>' : '') +
        '</div>' +
      '</div>';
  }

  // ---------- Init ----------

  function init() {
    if (_initialized) return;
    _initialized = true;
    load();
  }

  // ---------- Chargement ----------

  async function load() {
    _sessions = [];
    _offset = 0;
    try {
      const sessions = await DB.getSessions(PAGE_SIZE, 0);
      _sessions = sessions || [];
      _offset = _sessions.length;
    } catch (e) {
      console.error('History.load:', e);
      APP.showToast('Erreur de chargement de l\'historique', 'error');
      _sessions = [];
    }
    renderList();
    loadWeeklyChart();
    const countEl = document.getElementById('history-count');
    if (countEl) {
      countEl.textContent = _sessions.length ? _sessions.length + ' séances' : 'Aucune séance';
    }
  }

  async function loadMore() {
    try {
      const next = await DB.getSessions(PAGE_SIZE, _offset);
      if (next && next.length) {
        _sessions = _sessions.concat(next);
        _offset += next.length;
        renderList();
        const countEl = document.getElementById('history-count');
        if (countEl) countEl.textContent = _sessions.length + ' séances';
      } else {
        APP.showToast('Toutes les séances sont affichées', 'info');
      }
    } catch (e) {
      console.error('History.loadMore:', e);
      APP.showToast('Erreur de chargement', 'error');
    }
  }

  // ---------- Liste ----------

  function renderList() {
    const list = document.getElementById('session-list');
    if (!list) return;
    if (!_sessions.length) {
      list.innerHTML = '<div class="empty-state">Aucune séance enregistrée</div>';
      return;
    }
    list.innerHTML = _sessions.map(function (s, i) { return renderSessionCard(s, i); }).join('');
  }

  function renderSessionCard(s, i) {
    const isTreadmill = s.type === 'treadmill';
    const icon = isTreadmill ? '🏃' : '🌿';
    const badgeClass = 'badge-' + (isTreadmill ? 'accent' : 'green');
    const badgeText = isTreadmill ? 'Tapis' : 'Outdoor';
    const idArg = JSON.stringify(s.id);

    const total = (s.zone1_s || 0) + (s.zone2_s || 0) + (s.zone3_s || 0) +
                  (s.zone4_s || 0) + (s.zone5_s || 0);

    const zoneSegments = [1, 2, 3, 4, 5].map(function (z) {
      const sec = s['zone' + z + '_s'] || 0;
      const pct = total > 0 ? (sec / total * 100) : 0;
      return '<div class="zone-bar" style="width:' + pct.toFixed(2) + '%;' +
             'background:' + CONFIG.zones[z - 1].color + '"></div>';
    }).join('');

    return '' +
      '<div class="session-card" data-index="' + i + '" onclick="History.openDetail(' + idArg + ')">' +
        '<div class="session-card-header">' +
          '<span class="session-icon">' + icon + '</span>' +
          '<span class="badge ' + badgeClass + '">' + badgeText + '</span>' +
          '<span class="session-date">' + escapeHtml(fmtDate(s.started_at)) + '</span>' +
          '<button class="btn-icon btn-delete" title="Supprimer" ' +
            'onclick="event.stopPropagation();History.deleteSession(' + idArg + ')">🗑️</button>' +
        '</div>' +
        '<div class="session-card-stats">' +
          '<div class="stat-cell">' +
            '<span class="stat-cell-value">' + fmtDist(s.distance_m || 0) + '</span>' +
            '<span class="stat-cell-label">km</span>' +
          '</div>' +
          '<div class="stat-cell">' +
            '<span class="stat-cell-value">' + fmtDur(s.duration_s || 0) + '</span>' +
            '<span class="stat-cell-label">durée</span>' +
          '</div>' +
          '<div class="stat-cell">' +
            '<span class="stat-cell-value">' + (s.avg_hr || '—') + '</span>' +
            '<span class="stat-cell-label">FC moy</span>' +
          '</div>' +
          '<div class="stat-cell">' +
            '<span class="stat-cell-value">' +
              (s.avg_pace_s_per_km ? fmtPace(s.avg_pace_s_per_km) : '—') +
            '</span>' +
            '<span class="stat-cell-label">allure</span>' +
          '</div>' +
        '</div>' +
        '<div class="zone-bar-track">' + zoneSegments + '</div>' +
      '</div>';
  }

  // ---------- Détail ----------

  async function openDetail(id) {
    let full = null;
    try {
      full = await DB.getSession(id);
    } catch (e) {
      console.error('History.openDetail:', e);
    }
    if (!full) {
      APP.showToast('Erreur chargement séance', 'error');
      return;
    }
    _currentDetail = full;

    const listView = document.getElementById('history-list-view');
    const detailView = document.getElementById('history-detail-view');
    if (listView) listView.style.display = 'none';
    if (detailView) detailView.style.display = '';

    const profile = await DB.getProfile();

    const content = document.getElementById('history-detail-content');
    if (content) content.innerHTML = renderDetailHTML(full, profile);

    // Rendu des graphiques une fois le DOM prêt
    setTimeout(function () {
      if (full.points && full.points.length > 0) {
        Charts.renderHR('detail-chart-hr', full.points, profile);
        Charts.renderSpeed('detail-chart-speed', full.points);
        if (full.type === 'outdoor') {
          Charts.renderElevation('detail-chart-elevation', full.points);
        }
      }
      Charts.renderZoneDonut('detail-chart-zones', full, profile);
    }, 50);
  }

  function renderDetailHTML(s, profile) {
    const isTreadmill = s.type === 'treadmill';
    const icon = isTreadmill ? '🏃' : '🌿';
    const badgeClass = 'badge-' + (isTreadmill ? 'accent' : 'green');
    const badgeText = isTreadmill ? 'Tapis' : 'Outdoor';

    // ----- Cartes résumé -----
    let cards = '';
    cards += statCard('Distance', fmtDist(s.distance_m || 0), 'km');
    cards += statCard('Durée', fmtDur(s.duration_s || 0), '');
    cards += statCard('FC moyenne', dash(s.avg_hr), s.avg_hr ? 'bpm' : '');
    cards += statCard('FC max', dash(s.max_hr), s.max_hr ? 'bpm' : '');
    if (s.min_hr) cards += statCard('FC min', s.min_hr, 'bpm');
    cards += statCard('Allure moy', s.avg_pace_s_per_km ? fmtPace(s.avg_pace_s_per_km) : '—', s.avg_pace_s_per_km ? '/km' : '');
    cards += statCard('Meilleure allure', s.best_pace_s_per_km ? fmtPace(s.best_pace_s_per_km) : '—', s.best_pace_s_per_km ? '/km' : '');
    cards += statCard('Calories', dash(s.calories_kcal), s.calories_kcal ? 'kcal' : '');
    cards += statCard('Pas', dash(s.steps), '');
    cards += statCard('Vitesse moy', s.avg_speed_kmh != null ? Number(s.avg_speed_kmh).toFixed(1) : '—', s.avg_speed_kmh != null ? 'km/h' : '');
    if (s.max_speed_kmh != null) {
      cards += statCard('Vitesse max', Number(s.max_speed_kmh).toFixed(1), 'km/h');
    }
    cards += statCard('Cadence moy', dash(s.avg_cadence), s.avg_cadence ? 'ppm' : '');

    if (isTreadmill) {
      cards += statCard('Inclinaison moy', s.avg_incline_pct != null ? Number(s.avg_incline_pct).toFixed(1) : '—', s.avg_incline_pct != null ? '%' : '');
      cards += statCard('Inclinaison max', s.max_incline_pct != null ? Number(s.max_incline_pct).toFixed(1) : '—', s.max_incline_pct != null ? '%' : '');
    } else {
      cards += statCard('Dénivelé+', s.elevation_gain_m != null ? Math.round(s.elevation_gain_m) : '—', s.elevation_gain_m != null ? 'm' : '');
      cards += statCard('Dénivelé-', s.elevation_loss_m != null ? Math.round(s.elevation_loss_m) : '—', s.elevation_loss_m != null ? 'm' : '');
    }

    // ----- Graphiques -----
    let charts = '';
    charts += '<h3 class="detail-section-title">Fréquence cardiaque</h3>' +
      '<div class="chart-wrap"><canvas id="detail-chart-hr"></canvas></div>';
    charts += '<h3 class="detail-section-title">Vitesse</h3>' +
      '<div class="chart-wrap"><canvas id="detail-chart-speed"></canvas></div>';
    charts += '<h3 class="detail-section-title">Zones cardiaques</h3>' +
      '<div style="position:relative;height:200px"><canvas id="detail-chart-zones"></canvas></div>';
    if (!isTreadmill) {
      charts += '<h3 class="detail-section-title">Dénivelé</h3>' +
        '<div class="chart-wrap"><canvas id="detail-chart-elevation"></canvas></div>';
    }

    // ----- Notes + Export -----
    const notes =
      '<h3 class="detail-section-title">Notes</h3>' +
      '<textarea id="detail-notes" class="notes-input" rows="3" ' +
        'placeholder="Ajouter une note…">' + escapeHtml(s.notes || '') + '</textarea>' +
      '<div class="detail-actions">' +
        '<button class="btn btn-primary" onclick="History.saveNotes()">Enregistrer la note</button>' +
        '<button class="btn btn-secondary" onclick="History.exportCSV(History.getCurrentDetail())">Exporter CSV</button>' +
      '</div>';

    return '' +
      '<div class="detail-header">' +
        '<button class="btn-icon" onclick="History.closeDetail()" title="Retour">←</button>' +
        '<span class="session-icon">' + icon + '</span>' +
        '<span class="badge ' + badgeClass + '">' + badgeText + '</span>' +
        '<span class="session-date">' + escapeHtml(fmtDate(s.started_at)) + '</span>' +
      '</div>' +
      '<div class="stats-grid">' + cards + '</div>' +
      charts +
      notes;
  }

  function closeDetail() {
    _currentDetail = null;
    Charts.destroyAll();
    const listView = document.getElementById('history-list-view');
    const detailView = document.getElementById('history-detail-view');
    if (listView) listView.style.display = '';
    if (detailView) detailView.style.display = 'none';
  }

  function getCurrentDetail() {
    return _currentDetail;
  }

  async function saveNotes() {
    if (!_currentDetail) return;
    const ta = document.getElementById('detail-notes');
    if (!ta) return;
    try {
      _currentDetail.notes = ta.value;
      await DB.updateSession(_currentDetail.id, { notes: ta.value });
      APP.showToast('Note enregistrée', 'success');
    } catch (e) {
      console.error('History.saveNotes:', e);
      APP.showToast('Erreur lors de l\'enregistrement', 'error');
    }
  }

  // ---------- Suppression ----------

  async function deleteSession(id) {
    if (!confirm('Supprimer cette séance ?')) return;
    try {
      await DB.deleteSession(id);
      _sessions = _sessions.filter(function (s) { return s.id !== id; });
      APP.showToast('Séance supprimée', 'success');
      if (_currentDetail && _currentDetail.id === id) closeDetail();
      renderList();
      const countEl = document.getElementById('history-count');
      if (countEl) {
        countEl.textContent = _sessions.length ? _sessions.length + ' séances' : 'Aucune séance';
      }
    } catch (e) {
      console.error('History.deleteSession:', e);
      APP.showToast('Erreur lors de la suppression', 'error');
    }
  }

  // ---------- Graphique hebdomadaire ----------

  async function loadWeeklyChart() {
    try {
      const sessions = await DB.getWeeklySessions();
      Charts.renderWeekly('chart-weekly', sessions);
    } catch (e) {
      console.error('History.loadWeeklyChart:', e);
    }
  }

  // ---------- Export CSV ----------

  function csvEscape(v) {
    if (v === null || v === undefined) return '';
    const str = String(v);
    if (/[";\n\r]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function exportCSV(session) {
    const s = session || _currentDetail;
    if (!s) {
      APP.showToast('Aucune séance à exporter', 'error');
      return;
    }

    const SEP = ';';
    const lines = [];

    // --- Résumé de la séance ---
    const summaryFields = [
      ['id', s.id],
      ['type', s.type],
      ['date', s.started_at],
      ['duree_s', s.duration_s],
      ['distance_m', s.distance_m],
      ['fc_moyenne', s.avg_hr],
      ['fc_max', s.max_hr],
      ['fc_min', s.min_hr],
      ['allure_moy_s_par_km', s.avg_pace_s_per_km],
      ['meilleure_allure_s_par_km', s.best_pace_s_per_km],
      ['calories_kcal', s.calories_kcal],
      ['pas', s.steps],
      ['vitesse_moy_kmh', s.avg_speed_kmh],
      ['vitesse_max_kmh', s.max_speed_kmh],
      ['cadence_moy', s.avg_cadence],
      ['inclinaison_moy_pct', s.avg_incline_pct],
      ['inclinaison_max_pct', s.max_incline_pct],
      ['denivele_pos_m', s.elevation_gain_m],
      ['denivele_neg_m', s.elevation_loss_m],
      ['zone1_s', s.zone1_s],
      ['zone2_s', s.zone2_s],
      ['zone3_s', s.zone3_s],
      ['zone4_s', s.zone4_s],
      ['zone5_s', s.zone5_s],
      ['notes', s.notes]
    ];

    lines.push(summaryFields.map(function (f) { return csvEscape(f[0]); }).join(SEP));
    lines.push(summaryFields.map(function (f) { return csvEscape(f[1]); }).join(SEP));

    // --- Points détaillés ---
    if (s.points && s.points.length) {
      lines.push('');
      const keys = Object.keys(s.points[0]);
      lines.push(keys.map(csvEscape).join(SEP));
      s.points.forEach(function (p) {
        lines.push(keys.map(function (k) { return csvEscape(p[k]); }).join(SEP));
      });
    }

    // BOM UTF-8 pour Excel
    const csv = '﻿' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    const datePart = s.started_at ? String(s.started_at).slice(0, 10) : 'session';
    a.href = url;
    a.download = 'sporttrack_' + datePart + '_' + s.id + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

    APP.showToast('Export CSV généré', 'success');
  }

  // ---------- API publique ----------

  window.History = {
    init: init,
    load: load,
    loadMore: loadMore,
    openDetail: openDetail,
    closeDetail: closeDetail,
    deleteSession: deleteSession,
    exportCSV: exportCSV,
    saveNotes: saveNotes,
    getCurrentDetail: getCurrentDetail
  };
})();
