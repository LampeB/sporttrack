/* ==========================================================================
 * SportTrack v2 — goals.js
 * Contrôleur de la section "Objectifs" (#section-goals).
 * Gère deux onglets : Objectifs (hebdomadaires/séance) et Voyage virtuel.
 * Expose window.Goals (UMD global).
 * Dépendances : window.DB, window.APP, window.CONFIG
 * ========================================================================== */
(function (window) {
  'use strict';

  var Goals = {
    _currentTheme: 'world',
    _goals: [],
    _weeklySessions: [],
    _totalKm: 0
  };

  /* ------------------------------------------------------------------
   * Initialisation
   * ------------------------------------------------------------------ */

  Goals.init = function () {
    // Thème de voyage sauvegardé
    try {
      Goals._currentTheme = localStorage.getItem('st_voyage_theme') || 'world';
    } catch (e) {
      Goals._currentTheme = 'world';
    }

    // Mise à jour du libellé de cible quand le type change
    var typeSelect = document.getElementById('goal-type-select');
    if (typeSelect) {
      typeSelect.onchange = function (e) {
        var labels = {
          weekly_distance: 'Cible (km)',
          weekly_duration: 'Cible (min)',
          weekly_sessions: 'Nombre de séances',
          daily_steps: 'Nombre de pas',
          session_distance: 'Distance (km)'
        };
        var labelEl = document.getElementById('goal-target-label');
        if (labelEl) labelEl.textContent = labels[e.target.value] || 'Cible';
      };
    }

    return Goals.load();
  };

  /* ------------------------------------------------------------------
   * Chargement des données
   * ------------------------------------------------------------------ */

  Goals.load = function () {
    return Promise.all([DB.getGoals(), DB.getWeeklySessions()])
      .then(function (results) {
        Goals._goals = results[0] || [];
        Goals._weeklySessions = results[1] || [];
        Goals._renderGoals();
        Goals._renderVoyage();

        // Distance totale (toutes les séances) pour le voyage virtuel
        return DB.getSessions(1000, 0).then(function (all) {
          Goals._totalKm = (all || []).reduce(function (sum, s) {
            return sum + (s.distance_m || 0) / 1000;
          }, 0);
          Goals._renderVoyageProgress(Goals._totalKm);
        });
      })
      .catch(function (err) {
        console.error('Goals.load:', err);
        APP.showToast('Erreur lors du chargement des objectifs', 'error');
      });
  };

  /* ------------------------------------------------------------------
   * Onglet Objectifs
   * ------------------------------------------------------------------ */

  Goals._renderGoals = function () {
    var container = document.getElementById('goals-list');
    if (!container) return;

    if (!Goals._goals.length) {
      container.innerHTML =
        '<div class="empty-state" style="padding:32px">Aucun objectif actif — ajoutez-en un !</div>';
      return;
    }

    container.innerHTML = Goals._goals.map(function (g) {
      return Goals._renderGoalCard(g);
    }).join('');
  };

  // Lundi 00:00 de la semaine courante
  function mondayOfCurrentWeek() {
    var now = new Date();
    var day = now.getDay();
    var diff = (day === 0 ? -6 : 1 - day);
    var monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  // Séances de la semaine courante (started_at >= lundi 00:00)
  function sessionsThisWeek() {
    var monday = mondayOfCurrentWeek();
    return (Goals._weeklySessions || []).filter(function (s) {
      return new Date(s.started_at) >= monday;
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtNum(n, decimals) {
    return n.toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals === undefined ? 1 : decimals
    });
  }

  /**
   * Calcule la progression d'un objectif.
   * @returns {{current:number, target:number, unit:string, label:string}}
   */
  Goals._goalProgress = function (g) {
    var week = sessionsThisWeek();
    var current = 0;
    var unit = '';
    var label = '';

    switch (g.type) {
      case 'weekly_distance':
        label = 'Distance cette semaine';
        unit = 'km';
        current = week.reduce(function (sum, s) {
          return sum + (s.distance_m || 0) / 1000;
        }, 0);
        break;

      case 'weekly_duration':
        label = 'Durée cette semaine';
        unit = 'min';
        current = week.reduce(function (sum, s) {
          return sum + (s.duration_s || 0) / 60;
        }, 0);
        break;

      case 'weekly_sessions':
        label = 'Séances cette semaine';
        unit = 'séances';
        current = week.length;
        break;

      case 'daily_steps':
        // Non stocké en base : alimenté par la séance en direct
        label = "Pas aujourd'hui";
        unit = 'pas';
        current = 0;
        break;

      case 'session_distance':
        label = 'Distance par séance';
        unit = 'km';
        var last = (Goals._weeklySessions || [])
          .slice()
          .sort(function (a, b) {
            return new Date(b.started_at) - new Date(a.started_at);
          })[0];
        current = last ? (last.distance_m || 0) / 1000 : 0;
        break;

      default:
        label = 'Objectif';
        unit = '';
        current = 0;
    }

    return {
      current: current,
      target: g.target || 0,
      unit: unit,
      label: label
    };
  };

  Goals._renderGoalCard = function (g) {
    var p = Goals._goalProgress(g);
    var current = p.current;
    var target = p.target;
    var unit = p.unit;
    var label = p.label;

    var pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
    var done = pct >= 100;
    var remaining = Math.max(0, target - current);

    var statusText = done
      ? 'Objectif atteint !'
      : 'Encore ' + fmtNum(remaining) + ' ' + unit;

    var note = g.type === 'daily_steps'
      ? '<div class="goal-note" style="font-size:12px;opacity:.7">Compté pendant la séance en direct</div>'
      : '';

    var html = '';
    html += '<div class="goal-card">';

    // Ligne libellé / valeur
    html += '<div class="goal-label-row" style="display:flex;justify-content:space-between;align-items:center">';
    html += '<span class="goal-label">' + escapeHtml(label) + '</span>';
    html += '<span><span class="goal-value">' + fmtNum(current) + '</span> / ' + fmtNum(target) + ' ' + escapeHtml(unit) + '</span>';
    html += '</div>';

    // Barre de progression
    html += '<div class="progress-bar">';
    html += '<div class="progress-fill' + (done ? ' green' : '') + '" style="width:' + pct.toFixed(1) + '%"></div>';
    html += '</div>';

    // Pied de carte : statut + suppression
    html += '<div class="goal-footer" style="display:flex;justify-content:space-between;align-items:center">';
    html += '<span class="goal-status">' + statusText + '</span>';
    html += '<button class="btn-icon btn-delete" title="Supprimer" onclick="Goals.deleteGoal(' + JSON.stringify(g.id) + ')">🗑️</button>';
    html += '</div>';

    html += note;
    html += '</div>';

    return html;
  };

  /* ------------------------------------------------------------------
   * Onglets
   * ------------------------------------------------------------------ */

  Goals.showTab = function (tab) {
    var goalsContent = document.getElementById('goals-tab-content');
    var voyageContent = document.getElementById('voyage-tab-content');
    var tabGoals = document.getElementById('tab-goals');
    var tabVoyage = document.getElementById('tab-voyage');

    if (goalsContent) goalsContent.style.display = tab === 'goals' ? '' : 'none';
    if (voyageContent) voyageContent.style.display = tab === 'voyage' ? '' : 'none';
    if (tabGoals) tabGoals.classList.toggle('active', tab === 'goals');
    if (tabVoyage) tabVoyage.classList.toggle('active', tab === 'voyage');
  };

  /* ------------------------------------------------------------------
   * Formulaire d'ajout d'objectif
   * ------------------------------------------------------------------ */

  Goals.showAddGoal = function () {
    var form = document.getElementById('add-goal-form');
    if (form) form.style.display = '';
  };

  Goals.hideAddGoal = function () {
    var form = document.getElementById('add-goal-form');
    if (form) form.style.display = 'none';
  };

  Goals.saveGoal = function () {
    var type = document.getElementById('goal-type-select').value;
    var target = parseFloat(document.getElementById('goal-target-input').value);

    if (!target || target <= 0) {
      APP.showToast('Cible invalide', 'error');
      return Promise.resolve();
    }

    return DB.saveGoal({ type: type, target: target, period: 'week', active: true })
      .then(function () {
        Goals.hideAddGoal();
        var input = document.getElementById('goal-target-input');
        if (input) input.value = '';
        APP.showToast('Objectif ajouté !', 'success');
        return Goals.load();
      })
      .catch(function (err) {
        console.error('Goals.saveGoal:', err);
        APP.showToast("Erreur lors de l'ajout de l'objectif", 'error');
      });
  };

  Goals.deleteGoal = function (id) {
    if (!confirm('Supprimer cet objectif ?')) return Promise.resolve();

    return DB.deleteGoal(id)
      .then(function () {
        APP.showToast('Objectif supprimé', 'success');
        return Goals.load();
      })
      .catch(function (err) {
        console.error('Goals.deleteGoal:', err);
        APP.showToast('Erreur lors de la suppression', 'error');
      });
  };

  /* ------------------------------------------------------------------
   * Onglet Voyage virtuel
   * ------------------------------------------------------------------ */

  Goals._renderVoyage = function () {
    // Pastilles de thème
    var pills = document.getElementById('theme-pills');
    if (pills && window.CONFIG && CONFIG.themes) {
      pills.innerHTML = Object.entries(CONFIG.themes).map(function (entry) {
        var key = entry[0];
        var t = entry[1];
        return '<button class="theme-pill' + (key === Goals._currentTheme ? ' active' : '') +
          '" onclick="Goals.selectTheme(\'' + key + '\')">' + t.name + '</button>';
      }).join('');
    }

    // Total km : toutes les séances si déjà chargées, sinon repli sur la semaine
    var weeklyKm = (Goals._weeklySessions || []).reduce(function (sum, s) {
      return sum + (s.distance_m || 0) / 1000;
    }, 0);

    Goals._renderVoyageProgress(Goals._totalKm || weeklyKm);
  };

  Goals._renderVoyageProgress = function (totalKm) {
    if (!window.CONFIG || !CONFIG.themes) return;

    var theme = CONFIG.themes[Goals._currentTheme] || CONFIG.themes.world;
    if (!theme || !theme.milestones || !theme.milestones.length) return;

    var milestones = theme.milestones.slice().sort(function (a, b) {
      return a.km - b.km;
    });

    var totalEl = document.getElementById('voyage-total-km');
    if (totalEl) {
      totalEl.textContent = totalKm.toLocaleString('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    var nextIdx = milestones.findIndex(function (m) { return m.km > totalKm; });
    var next = nextIdx >= 0 ? milestones[nextIdx] : null;
    var prevIdx = nextIdx > 0 ? nextIdx - 1 : (nextIdx === -1 ? milestones.length - 1 : -1);
    var prev = prevIdx >= 0 ? milestones[prevIdx] : null;

    var fromKm = prev ? prev.km : 0;
    var pct = next ? Math.min(100, ((totalKm - fromKm) / (next.km - fromKm)) * 100) : 100;
    var remaining = next ? Math.max(0, next.km - totalKm) : 0;

    var fromEl = document.getElementById('voyage-from');
    if (fromEl) {
      fromEl.textContent = prev
        ? prev.emoji + ' ' + prev.to
        : milestones[0].emoji + ' ' + milestones[0].from;
    }

    var toEl = document.getElementById('voyage-to');
    if (toEl) {
      toEl.textContent = next ? next.emoji + ' ' + next.to : '🏆 Fin !';
    }

    var barEl = document.getElementById('voyage-bar');
    if (barEl) barEl.style.width = pct.toFixed(1) + '%';

    var pctEl = document.getElementById('voyage-pct');
    if (pctEl) pctEl.textContent = pct.toFixed(0) + '%';

    var remainingEl = document.getElementById('voyage-remaining');
    if (remainingEl) {
      remainingEl.textContent = remaining > 0
        ? remaining.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' km'
        : 'Étape franchie !';
    }

    // Dernières étapes franchies
    var reached = milestones.filter(function (m) { return m.km <= totalKm; });
    var reachedEl = document.getElementById('voyage-reached');
    if (reachedEl) {
      if (reached.length) {
        reachedEl.innerHTML = '<strong>Étapes franchies :</strong><br>' +
          reached.slice(-3).reverse().map(function (m) {
            return m.emoji + ' ' + m.to + ' (' + m.km.toLocaleString('fr-FR') + ' km)';
          }).join('<br>');
      } else {
        reachedEl.innerHTML = '';
      }
    }
  };

  Goals.selectTheme = function (key) {
    Goals._currentTheme = key;
    try {
      localStorage.setItem('st_voyage_theme', key);
    } catch (e) { /* stockage indisponible */ }
    Goals._renderVoyage();
  };

  /* ------------------------------------------------------------------
   * Export global
   * ------------------------------------------------------------------ */

  window.Goals = Goals;

})(window);
