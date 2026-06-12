/* =========================================================================
 * SportTrack v2 — bluetooth.js
 * Wrapper Bluetooth Low Energy : cardio (HR), foulée (RSC), tapis (FTMS).
 * Expose window.BT (UMD global, pas de build).
 * ========================================================================= */
(function (window) {
  'use strict';

  // ---- UUIDs (noms standards Web Bluetooth) -------------------------------
  var SVC_HR   = 'heart_rate';                  // 0x180D
  var CHR_HRM  = 'heart_rate_measurement';      // 0x2A37
  var SVC_RSC  = 'running_speed_and_cadence';   // 0x181D
  var CHR_RSC  = 'rsc_measurement';             // 0x2A53
  var SVC_FTMS = 'fitness_machine';             // 0x181E
  var CHR_FEAT = 'fitness_machine_feature';     // 0x2ACC
  var CHR_DATA = 'treadmill_data';              // 0x2ACD
  var CHR_CTRL = 'fitness_machine_control_point'; // 0x2AD9
  var CHR_TST  = 'training_status';             // 0x2AD3
  var CHR_FMS  = 'fitness_machine_status';      // 0x2ADA
  var CHR_SPD  = 'supported_speed_range';       // 0x2AD4

  // Libellés français pour le Training Status (0x2AD3)
  var TRAINING_LABELS = {
    0x00: 'Inconnu',
    0x01: 'Inactif',
    0x02: 'Échauffement',
    0x0D: 'Manuel',
    0x10: 'En pause'
  };

  function toast(msg, type) {
    try {
      if (window.APP && typeof window.APP.showToast === 'function') {
        window.APP.showToast(msg, type || 'info');
      }
    } catch (e) { /* ignore */ }
  }

  function delay(ms) {
    return new Promise(function (res) { setTimeout(res, ms); });
  }

  var BT = {

    // -----------------------------------------------------------------------
    // État partagé
    // -----------------------------------------------------------------------
    state: {
      hrConnected: false,
      rscConnected: false,
      treadmillConnected: false,
      controlSupported: false,
      speedControlSupported: false,
      currentSpeed: 0,          // km/h
      currentIncline: 0,        // %
      treadmillStatus: 'unknown', // 'unknown'|'stopped'|'running'|'paused'
      treadmillStatusLabel: '—',
      speedMin: 1,
      speedMax: 20,
      speedInc: 0.5,
      elapsedSec: 0,
      distOffset: 0,            // km — cumul lors des resets tapis
      lastRawDist: null,        // km — dernière distance brute lue
      speedSynced: false
    },

    // Données live dérivées du dernier paquet FTMS (km)
    _liveDist: 0,

    // Devices / characteristics internes
    _hrDevice: null,
    _treadmillDevice: null,
    _ctrlChar: null,

    // -----------------------------------------------------------------------
    // Callbacks consommateurs
    // -----------------------------------------------------------------------
    _onHR: null,
    _onRSC: null,
    _onFTMS: null,

    onHR:   function (cb) { this._onHR = cb; },
    onRSC:  function (cb) { this._onRSC = cb; },
    onFTMS: function (cb) { this._onFTMS = cb; },

    // Notifie l'UI dès qu'un état de connexion change
    _notifyUI: function () {
      try {
        if (window.Live && typeof Live._updateBleDots === 'function') Live._updateBleDots();
      } catch (e) { /* ignore */ }
    },

    toggleHR: function () {
      if (this.state.hrConnected) this.disconnectHR();
      else this.connectHR();
    },

    toggleTreadmill: function () {
      if (this.state.treadmillConnected) this.disconnectTreadmill();
      else this.connectTreadmill();
    },

    _fireHR: function (hr) {
      if (typeof this._onHR === 'function') {
        try { this._onHR(hr); } catch (e) { console.error('[BT] _onHR callback error', e); }
      }
    },

    _fireRSC: function (payload) {
      if (typeof this._onRSC === 'function') {
        try { this._onRSC(payload); } catch (e) { console.error('[BT] _onRSC callback error', e); }
      }
    },

    _fireFTMS: function () {
      if (typeof this._onFTMS === 'function') {
        var s = this.state;
        try {
          this._onFTMS({
            speed: s.currentSpeed,
            cadence: this._lastCadence || 0,
            distance: this._liveDist,
            elapsedSec: s.elapsedSec,
            status: s.treadmillStatus,
            statusLabel: s.treadmillStatusLabel,
            incline: s.currentIncline
          });
        } catch (e) { console.error('[BT] _onFTMS callback error', e); }
      }
    },

    _lastCadence: 0,

    // -----------------------------------------------------------------------
    // Connexion ceinture cardio (+ RSC optionnel)
    // -----------------------------------------------------------------------
    connectHR: async function () {
      if (!navigator.bluetooth) {
        toast('Bluetooth non disponible sur ce navigateur', 'error');
        throw new Error('Web Bluetooth unavailable');
      }
      var self = this;
      try {
        var device = await navigator.bluetooth.requestDevice({
          filters: [{ services: [SVC_HR] }],
          optionalServices: [SVC_RSC]
        });
        this._hrDevice = device;

        device.addEventListener('gattserverdisconnected', function () {
          self.state.hrConnected = false;
          self.state.rscConnected = false;
          self._notifyUI();
          toast('Capteur cardio déconnecté', 'warning');
          self._fireHR(0);
        });

        var server = await device.gatt.connect();

        // Service HR (obligatoire)
        var hrService = await server.getPrimaryService(SVC_HR);
        var hrChar = await hrService.getCharacteristic(CHR_HRM);
        await hrChar.startNotifications();
        hrChar.addEventListener('characteristicvaluechanged', function (ev) {
          self.parseHR(ev.target.value);
        });
        this.state.hrConnected = true;
        this._notifyUI();

        // Service RSC (optionnel)
        try {
          var rscService = await server.getPrimaryService(SVC_RSC);
          var rscChar = await rscService.getCharacteristic(CHR_RSC);
          await rscChar.startNotifications();
          rscChar.addEventListener('characteristicvaluechanged', function (ev) {
            self.parseRSC(ev.target.value);
          });
          this.state.rscConnected = true;
        } catch (e) {
          // Pas de RSC sur ce capteur : non bloquant
          this.state.rscConnected = false;
        }

        toast('Capteur cardio connecté', 'success');
        return true;
      } catch (err) {
        if (err && err.name === 'NotFoundError') {
          // Sélecteur annulé par l'utilisateur : silencieux
          return false;
        }
        console.error('[BT] connectHR', err);
        toast('Échec de connexion au capteur cardio', 'error');
        throw err;
      }
    },

    disconnectHR: function () {
      try {
        if (this._hrDevice && this._hrDevice.gatt && this._hrDevice.gatt.connected) {
          this._hrDevice.gatt.disconnect();
        }
      } catch (e) { /* ignore */ }
      this._hrDevice = null;
      this.state.hrConnected = false;
      this.state.rscConnected = false;
      this._notifyUI();
    },

    // -----------------------------------------------------------------------
    // Connexion tapis FTMS
    // -----------------------------------------------------------------------
    connectTreadmill: async function () {
      if (!navigator.bluetooth) {
        toast('Bluetooth non disponible sur ce navigateur', 'error');
        throw new Error('Web Bluetooth unavailable');
      }
      var self = this;
      try {
        var device = await navigator.bluetooth.requestDevice({
          filters: [{ services: [SVC_FTMS] }]
        });
        this._treadmillDevice = device;

        device.addEventListener('gattserverdisconnected', function () {
          self.state.treadmillConnected = false;
          self.state.controlSupported = false;
          self._ctrlChar = null;
          self.state.treadmillStatus = 'unknown';
          self.state.treadmillStatusLabel = '—';
          self._notifyUI();
          toast('Tapis déconnecté', 'warning');
          self._fireFTMS();
        });

        var server = await device.gatt.connect();
        var service = await server.getPrimaryService(SVC_FTMS);

        // ---- Feature (lecture unique) ----
        try {
          var featChar = await service.getCharacteristic(CHR_FEAT);
          var featVal = await featChar.readValue();
          this.parseFMFeature(featVal);
        } catch (e) {
          console.warn('[BT] fitness_machine_feature indisponible', e);
        }

        // ---- Plage de vitesses (lecture unique) ----
        try {
          var spdChar = await service.getCharacteristic(CHR_SPD);
          var spdVal = await spdChar.readValue();
          this.parseSpeedRange(spdVal);
        } catch (e) {
          console.warn('[BT] supported_speed_range indisponible', e);
        }

        // ---- Données tapis (notify) ----
        try {
          var dataChar = await service.getCharacteristic(CHR_DATA);
          await dataChar.startNotifications();
          dataChar.addEventListener('characteristicvaluechanged', function (ev) {
            self.parseFTMS(ev.target.value);
          });
        } catch (e) {
          console.error('[BT] treadmill_data indisponible', e);
          toast('Données du tapis indisponibles', 'error');
        }

        // ---- Point de contrôle (write + notify) ----
        try {
          this._ctrlChar = await service.getCharacteristic(CHR_CTRL);
          await this._ctrlChar.startNotifications();
          this._ctrlChar.addEventListener('characteristicvaluechanged', function (ev) {
            self.onCtrlResponse(ev.target.value);
          });
          this.state.controlSupported = true;
        } catch (e) {
          console.warn('[BT] control_point indisponible', e);
          this._ctrlChar = null;
          this.state.controlSupported = false;
        }

        // ---- Statut d'entraînement (notify) ----
        try {
          var tstChar = await service.getCharacteristic(CHR_TST);
          await tstChar.startNotifications();
          tstChar.addEventListener('characteristicvaluechanged', function (ev) {
            self.parseTrainingStatus(ev.target.value);
          });
        } catch (e) {
          console.warn('[BT] training_status indisponible', e);
        }

        // ---- Statut machine (notify) ----
        try {
          var fmsChar = await service.getCharacteristic(CHR_FMS);
          await fmsChar.startNotifications();
          fmsChar.addEventListener('characteristicvaluechanged', function (ev) {
            self.parseFMStatus(ev.target.value);
          });
        } catch (e) {
          console.warn('[BT] fitness_machine_status indisponible', e);
        }

        // ---- Demande de contrôle ----
        if (this._ctrlChar) {
          try {
            await this.sendCtrl([0x00]); // Request control
            await delay(300);
          } catch (e) {
            console.warn('[BT] Request control échoué', e);
          }
        }

        this.state.treadmillConnected = true;
        this._notifyUI();
        toast('Tapis connecté', 'success');
        return true;
      } catch (err) {
        if (err && err.name === 'NotFoundError') {
          return false; // sélecteur annulé
        }
        console.error('[BT] connectTreadmill', err);
        toast('Échec de connexion au tapis', 'error');
        throw err;
      }
    },

    disconnectTreadmill: function () {
      try {
        if (this._treadmillDevice && this._treadmillDevice.gatt && this._treadmillDevice.gatt.connected) {
          this._treadmillDevice.gatt.disconnect();
        }
      } catch (e) { /* ignore */ }
      this._treadmillDevice = null;
      this._ctrlChar = null;
      this.state.treadmillConnected = false;
      this.state.controlSupported = false;
      this.state.treadmillStatus = 'unknown';
      this.state.treadmillStatusLabel = '—';
      this._notifyUI();
    },

    // -----------------------------------------------------------------------
    // Commandes
    // -----------------------------------------------------------------------
    sendCtrl: async function (bytes) {
      if (!this._ctrlChar) {
        toast('Contrôle du tapis non disponible', 'warning');
        throw new Error('FTMS control point not available');
      }
      try {
        await this._ctrlChar.writeValue(new Uint8Array(bytes));
      } catch (err) {
        console.error('[BT] sendCtrl', bytes, err);
        toast('Commande tapis refusée', 'error');
        throw err;
      }
    },

    setSpeed: async function (kmh) {
      var s = this.state;
      kmh = Math.max(s.speedMin || 0.5, Math.min(s.speedMax || 20, +kmh));
      if (!isFinite(kmh)) return;
      var val = Math.round(kmh * 100);
      await this.sendCtrl([0x02, val & 0xFF, (val >> 8) & 0xFF]);
      s.currentSpeed = kmh;
      this._fireFTMS();
    },

    setIncline: async function (pct) {
      // FTMS Set Target Inclination (opcode 0x03), sint16 LE en pas de 0,1 %
      var val = Math.round((+pct) * 10);
      if (!isFinite(val)) return;
      if (val < 0) val = 0x10000 + val; // complément à deux
      await this.sendCtrl([0x03, val & 0xFF, (val >> 8) & 0xFF]);
      this.state.currentIncline = +pct;
      this._fireFTMS();
    },

    emergencyStop: async function () {
      await this.sendCtrl([0x08, 0x01]); // Stop
    },

    toggleStartStop: async function () {
      if (this.state.treadmillStatus === 'running') {
        await this.sendCtrl([0x08, 0x02]); // Pause
      } else {
        await this.sendCtrl([0x07]);       // Start / Resume
      }
    },

    // -----------------------------------------------------------------------
    // Parsers
    // -----------------------------------------------------------------------
    parseHR: function (dv) {
      try {
        var flags = dv.getUint8(0);
        var hr = (flags & 0x01) ? dv.getUint16(1, true) : dv.getUint8(1);
        this._fireHR(hr);
        return hr;
      } catch (e) {
        console.error('[BT] parseHR', e);
        return 0;
      }
    },

    parseRSC: function (dv) {
      try {
        var flags = dv.getUint8(0);
        var speed = dv.getUint16(1, true) / 256; // m/s
        var cadence = dv.getUint8(3) * 2;        // pas/min (les deux pieds)
        var distance = null;                      // km
        if (flags & 0x02) {
          var off = 4 + ((flags & 0x01) ? 2 : 0); // saute stride length si présent
          distance = dv.getUint32(off, true) / 10000; // km
        }
        this._fireRSC({ speed: speed, cadence: cadence, distance: distance });
        return { speed: speed, cadence: cadence, distance: distance };
      } catch (e) {
        console.error('[BT] parseRSC', e);
        return null;
      }
    },

    parseFTMS: function (dv) {
      var s = this.state;
      try {
        var flags = dv.getUint16(0, true);
        var offset = 2;

        // Vitesse instantanée (toujours présente)
        var speedKmh = dv.getUint16(offset, true) * 0.01;
        offset += 2;
        s.currentSpeed = speedKmh;
        s.speedSynced = true;

        if (flags & 0x0002) offset += 2; // vitesse moyenne

        if (flags & 0x0004) {
          // Distance totale : uint24 LE en mètres
          var lo = dv.getUint16(offset, true);
          var hi = dv.getUint8(offset + 2);
          var raw = ((hi << 16) | lo) / 1000; // km
          if (s.lastRawDist === null) {
            // Première lecture
            s.distOffset = this._liveDist;
            s.lastRawDist = raw;
          } else if (raw >= s.lastRawDist) {
            s.lastRawDist = raw;
          } else {
            // Le tapis a remis sa distance à zéro
            s.distOffset = this._liveDist;
            s.lastRawDist = raw;
          }
          this._liveDist = s.distOffset + raw;
          offset += 3;
        }

        if (flags & 0x0008) offset += 4; // inclinaison + ramp angle
        if (flags & 0x0010) offset += 4; // élévation +/-
        if (flags & 0x0020) offset += 1; // allure instantanée
        if (flags & 0x0040) offset += 1; // allure moyenne
        if (flags & 0x0080) offset += 2; // énergie totale
        if (flags & 0x0100) offset += 2; // énergie/heure + énergie/min
        if (flags & 0x0200) offset += 5;
        if (flags & 0x0400) {
          // Fréquence cardiaque transmise par le tapis
          this._fireHR(dv.getUint8(offset));
          offset += 1;
        }
        if (flags & 0x0800) offset += 1; // MET
        if ((flags & 0x1000) && offset + 1 < dv.byteLength) {
          s.elapsedSec = dv.getUint16(offset, true);
          offset += 2;
        }

        // Estimation de cadence à partir de la vitesse (foulée ~1,35 m)
        var speedMs = speedKmh / 3.6;
        this._lastCadence = speedMs > 0 ? Math.round(speedMs / 1.35 * 2 * 60) : 0;

        this._fireFTMS();
      } catch (e) {
        console.error('[BT] parseFTMS', e);
      }
    },

    parseFMFeature: function (dv) {
      try {
        var machine = dv.getUint32(0, true);
        var target = dv.getUint32(4, true);
        this.state.speedControlSupported = !!(target & 1);
        return { machine: machine, target: target };
      } catch (e) {
        console.error('[BT] parseFMFeature', e);
        return null;
      }
    },

    parseSpeedRange: function (dv) {
      try {
        this.state.speedMin = dv.getUint16(0, true) * 0.01;
        this.state.speedMax = dv.getUint16(2, true) * 0.01;
        this.state.speedInc = dv.getUint16(4, true) * 0.01;
      } catch (e) {
        console.error('[BT] parseSpeedRange', e);
      }
    },

    parseTrainingStatus: function (dv) {
      try {
        var status = dv.getUint8(dv.byteLength > 1 ? 1 : 0);
        var s = this.state;
        if (status === 0x01) s.treadmillStatus = 'stopped';
        else if (status === 0x02) s.treadmillStatus = 'running';
        else if (status === 0x10) s.treadmillStatus = 'paused';
        else s.treadmillStatus = 'unknown';
        s.treadmillStatusLabel = TRAINING_LABELS[status] || ('Statut 0x' + status.toString(16));
        this._fireFTMS();
      } catch (e) {
        console.error('[BT] parseTrainingStatus', e);
      }
    },

    parseFMStatus: function (dv) {
      var self = this;
      try {
        var op = dv.getUint8(0);
        var s = this.state;
        if (op === 0x04) {
          // Started or resumed
          s.treadmillStatus = 'running';
        } else if (op === 0x02) {
          // Stopped or paused, le paramètre précise lequel
          var param = dv.byteLength > 1 ? dv.getUint8(1) : 0x01;
          s.treadmillStatus = (param === 0x02) ? 'paused' : 'stopped';
        } else if (op === 0x03) {
          s.treadmillStatus = 'stopped';
        } else if (op === 0xFF) {
          // Contrôle perdu : on le redemande
          toast('Contrôle du tapis perdu, nouvelle demande…', 'warning');
          if (this._ctrlChar) {
            this.sendCtrl([0x00]).catch(function (e) {
              console.warn('[BT] re-request control échoué', e);
            });
          }
        }
        this._fireFTMS();
      } catch (e) {
        console.error('[BT] parseFMStatus', e);
      }
    },

    onCtrlResponse: function (dv) {
      try {
        if (dv.getUint8(0) !== 0x80) return; // pas une réponse
        var opcode = dv.getUint8(1);
        var result = dv.getUint8(2);
        if (result === 1) {
          // OK
          if (opcode === 0x00) this.state.controlSupported = true;
          return;
        }
        var what = {
          0x00: 'Demande de contrôle',
          0x02: 'Changement de vitesse',
          0x03: "Changement d'inclinaison",
          0x07: 'Démarrage',
          0x08: 'Arrêt/Pause'
        }[opcode] || ('Opcode 0x' + opcode.toString(16));
        if (result === 2) {
          toast(what + ' : non supporté par le tapis', 'warning');
          if (opcode === 0x02) this.state.speedControlSupported = false;
        } else if (result === 3) {
          toast(what + ' : paramètre invalide', 'warning');
        } else {
          toast(what + ' : échec (code ' + result + ')', 'error');
        }
      } catch (e) {
        console.error('[BT] onCtrlResponse', e);
      }
    }
  };

  window.BT = BT;

})(window);
