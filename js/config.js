window.CONFIG = {
  supabase: {
    url: 'https://wrgjvvivrhkofcxzwung.supabase.co',
    anonKey: 'sb_publishable_jbH64mc4IwA3V7yDQHj5YA_P6ADUq7D',
  },
  zones: [
    { id: 'r', name: 'Repos',        pctMin: 0.00, pctMax: 0.40, color: 'var(--zr)', dimColor: 'var(--zr-dim)' },
    { id: 'l', name: 'Légère',       pctMin: 0.40, pctMax: 0.50, color: 'var(--zl)', dimColor: 'var(--zl-dim)' },
    { id: 1,   name: 'Échauffement', pctMin: 0.50, pctMax: 0.60, color: 'var(--z1)', dimColor: 'var(--z1-dim)' },
    { id: 2,   name: 'Endurance',    pctMin: 0.60, pctMax: 0.70, color: 'var(--z2)', dimColor: 'var(--z2-dim)' },
    { id: 3,   name: 'Aérobie',      pctMin: 0.70, pctMax: 0.80, color: 'var(--z3)', dimColor: 'var(--z3-dim)' },
    { id: 4,   name: 'Seuil',        pctMin: 0.80, pctMax: 0.90, color: 'var(--z4)', dimColor: 'var(--z4-dim)' },
    { id: 5,   name: 'Maximum',      pctMin: 0.90, pctMax: 1.20, color: 'var(--z5)', dimColor: 'var(--z5-dim)' },
  ],
  themes: {
    world: { name: '🗺️ Villes du monde', milestones: [
      { km:0.33,emoji:'🗼',from:'Trocadéro',to:'Tour Eiffel (sommet)'},
      { km:4,emoji:'⛪',from:'Tour Eiffel',to:'Notre-Dame de Paris'},
      { km:24,emoji:'🏰',from:'Notre-Dame',to:'Château de Versailles'},
      { km:168,emoji:'🍾',from:'Versailles',to:'Reims'},
      { km:340,emoji:'🇧🇪',from:'Reims',to:'Bruxelles'},
      { km:660,emoji:'🇬🇧',from:'Bruxelles',to:'Londres'},
      { km:1020,emoji:'🇳🇱',from:'Londres',to:'Amsterdam'},
      { km:1800,emoji:'🏛️',from:'Amsterdam',to:'Rome'},
      { km:3200,emoji:'🇷🇺',from:'Rome',to:'Moscou'},
      { km:5000,emoji:'🌆',from:'Moscou',to:'Dubaï'},
      { km:6900,emoji:'🇮🇳',from:'Dubaï',to:'Mumbai'},
      { km:9000,emoji:'🇨🇳',from:'Mumbai',to:'Pékin'},
      { km:11100,emoji:'⛩️',from:'Pékin',to:'Tokyo'},
      { km:18900,emoji:'🦘',from:'Tokyo',to:'Sydney'},
      { km:40075,emoji:'🌍',from:'Sydney',to:'Trocadéro (tour du monde !)'},
    ]},
    lotr: { name: '🧙 Seigneur des Anneaux', milestones: [
      { km:5,emoji:'🌳',from:'Bag End',to:'Centre du Comté'},
      { km:150,emoji:'🏘️',from:'Centre du Comté',to:'Bree'},
      { km:350,emoji:'⚔️',from:'Bree',to:'Amon Sûl (Weathertop)'},
      { km:460,emoji:'🏔️',from:'Amon Sûl',to:'Fondcombe (Rivendell)'},
      { km:750,emoji:'⛏️',from:'Fondcombe',to:'Mines de la Moria'},
      { km:900,emoji:'🌿',from:'Moria',to:'Lothlórien'},
      { km:1200,emoji:'🏰',from:'Lothlórien',to:'Gouffre de Helm'},
      { km:1600,emoji:'🌲',from:'Gouffre de Helm',to:'Fangorn'},
      { km:1740,emoji:'🏛️',from:'Fangorn',to:'Minas Tirith'},
      { km:2200,emoji:'🌋',from:'Minas Tirith',to:'Cirith Ungol'},
      { km:2860,emoji:'💍',from:'Cirith Ungol',to:'Mont Destin (Orodruin)'},
    ]},
    tdf: { name: '🚴 Tour de France', milestones: [
      { km:7,emoji:'⏱️',from:'Départ',to:'Fin du Prologue (CLM)'},
      { km:200,emoji:'🏁',from:'Fin du Prologue',to:"Fin de l'Étape 1"},
      { km:600,emoji:'🏔️',from:"Fin de l'Étape 1",to:'1ère arrivée en altitude'},
      { km:1000,emoji:'🌬️',from:'1ère arrivée altitude',to:'Mont Ventoux'},
      { km:1400,emoji:'📅',from:'Mont Ventoux',to:'Fin de la 1ère semaine'},
      { km:1750,emoji:'⛰️',from:'Fin semaine 1',to:"Alpe d'Huez"},
      { km:2100,emoji:'🏔️',from:"Alpe d'Huez",to:'Col du Galibier'},
      { km:2600,emoji:'📅',from:'Col du Galibier',to:'Fin de la 2ème semaine'},
      { km:2950,emoji:'🏔️',from:'Fin semaine 2',to:'Tourmalet (Pyrénées)'},
      { km:3200,emoji:'⏱️',from:'Tourmalet',to:'Avant-dernière étape (CLM)'},
      { km:3492,emoji:'🏆',from:'CLM',to:'Paris — Champs-Élysées'},
    ]},
    seoul: { name: '🏯 Séoul', milestones: [
      { km:1.5,emoji:'🏯',from:'Gyeongbokgung',to:'Insadong'},
      { km:3,emoji:'🗼',from:'Insadong',to:'Tour N Seoul (Namsan)'},
      { km:6,emoji:'🌉',from:'Tour N Seoul',to:'Pont Banpo'},
      { km:10,emoji:'🎶',from:'Pont Banpo',to:'Hongdae'},
      { km:16,emoji:'🛍️',from:'Hongdae',to:'Gangnam (COEX)'},
      { km:28,emoji:'🏟️',from:'Gangnam',to:'Stade de Sangam'},
      { km:42,emoji:'🏰',from:'Stade de Sangam',to:'Forteresse de Hwaseong'},
      { km:100,emoji:'✈️',from:'Suwon',to:"Aéroport d'Incheon"},
      { km:240,emoji:'🏛️',from:'Incheon',to:'Gyeongju (ancienne capitale Silla)'},
      { km:350,emoji:'🌊',from:'Gyeongju',to:'Busan (mer du Japon)'},
    ]},
    pokemon: { name: '🔴 Pokémon Rouge', milestones: [
      { km:2.5,emoji:'🌿',from:'Bourg Palette',to:'Jadielle City (Route 1)'},
      { km:8,emoji:'🪨',from:'Jadielle City',to:'1er badge — Argenta'},
      { km:20,emoji:'💧',from:'Argenta',to:'2e badge — Azuria'},
      { km:34,emoji:'⚡',from:'Azuria',to:'3e badge — Keminai'},
      { km:48,emoji:'🌸',from:'Keminai',to:"4e badge — Cramois'île"},
      { km:62,emoji:'☠️',from:"Cramois'île",to:'5e badge — Fuchsia'},
      { km:74,emoji:'🔮',from:'Fuchsia',to:'6e badge — Parmanie'},
      { km:84,emoji:'🔥',from:'Parmanie',to:"7e badge — Île Cendrée"},
      { km:96,emoji:'🌍',from:"Île Cendrée",to:'8e badge — Jadielle'},
      { km:115,emoji:'🏆',from:'Jadielle',to:'Plateau Indigo — Champion !'},
    ]},
    skyrim: { name: '🐉 Skyrim', milestones: [
      { km:8,emoji:'🌲',from:'Helgen',to:'Blancherive (Whiterun)'},
      { km:20,emoji:'🐉',from:'Blancherive',to:'Tour du Dragon (1er dragon)'},
      { km:40,emoji:'🏔️',from:'Tour du Dragon',to:'Haut-Hrothgar (Gorge du Monde)'},
      { km:65,emoji:'🏰',from:'Haut-Hrothgar',to:'Solitude (Palais des Rois)'},
      { km:90,emoji:'❄️',from:'Solitude',to:'Vendeaume (Windhelm)'},
      { km:120,emoji:'🌋',from:'Vendeaume',to:"Rifton — Crypte d'Ustengrav"},
      { km:180,emoji:'🏴',from:"Crypte d'Ustengrav",to:'Markarth'},
      { km:250,emoji:'🌀',from:'Markarth',to:'Skuldafn (Temple du Dragon)'},
      { km:350,emoji:'⚔️',from:'Skuldafn',to:'Sovngarde — Alduin (boss final)'},
    ]},
    eldenring: { name: '⚔️ Elden Ring', milestones: [
      { km:6,emoji:'🌿',from:'Nécrolimbe',to:'Château Stormveil (Margit)'},
      { km:18,emoji:'🌊',from:'Château Stormveil',to:'Liurnia du Lac (Rennala)'},
      { km:35,emoji:'🩸',from:'Liurnia du Lac',to:'Caelid — Cité de Redmane'},
      { km:55,emoji:'🌄',from:'Caelid',to:"Plateau d'Altus (Radahn)"},
      { km:80,emoji:'👑',from:"Plateau d'Altus",to:'Leyndell — Capitale Royale'},
      { km:115,emoji:'🏔️',from:'Leyndell',to:'Montagne des Géants'},
      { km:160,emoji:'🌀',from:'Montagne des Géants',to:'Farum Azula — Maliketh'},
      { km:210,emoji:'🌸',from:'Farum Azula',to:"Domaine de l'Ombre (DLC)"},
      { km:290,emoji:'💀',from:"Domaine de l'Ombre",to:'Elden Beast — Fin du jeu'},
    ]},
    darksouls: { name: '🔥 Dark Souls', milestones: [
      { km:3,emoji:'⛓️',from:'Asile Psychiatrique',to:'Sanctuaire du Feu'},
      { km:8,emoji:'🏰',from:'Sanctuaire du Feu',to:'Paroisse des Morts-Vivants'},
      { km:14,emoji:'✨',from:'Paroisse des Morts',to:'Anor Londo (Ornstein & Smough)'},
      { km:22,emoji:'🌊',from:'Anor Londo',to:'Blighttown — Queelag'},
      { km:35,emoji:'🍄',from:'Blighttown',to:'Cité des Démons'},
      { km:48,emoji:'❄️',from:'Cité des Démons',to:'Archives du Duc — Seath'},
      { km:62,emoji:'💀',from:'Archives du Duc',to:'Tombe des Géants (Nito)'},
      { km:78,emoji:'🕳️',from:'Tombe des Géants',to:'Nouveau Londo — Four Kings'},
      { km:100,emoji:'🔥',from:'Nouveau Londo',to:'Kiln of the First Flame — Gwyn'},
    ]},
  },
};

// Helper: compute fcmax from profile
window.computeFcmax = function(profile) {
  if (!profile) return 190;
  const age = new Date().getFullYear() - (profile.birth_year || 1990);
  return profile.sex === 'female' ? 226 - age : 220 - age;
};

// Helper: get zone for a given HR
window.getZone = function(hr, profile) {
  if (!hr || hr <= 0) return null;
  const max = window.computeFcmax(profile);
  const pct = hr / max;
  return CONFIG.zones.find(z => pct >= z.pctMin && pct < z.pctMax) || CONFIG.zones[CONFIG.zones.length - 1];
};

// Format helpers (French)
window.fmtPace = function(secPerKm) {
  if (!secPerKm || secPerKm <= 0 || secPerKm > 3600) return "--'--\"";
  const m = Math.floor(secPerKm / 60), s = Math.round(secPerKm % 60);
  return m + "'" + String(s).padStart(2,'0') + '"';
};
window.fmtDur = function(seconds) {
  if (!seconds || seconds < 0) return '00:00';
  const h = Math.floor(seconds/3600), m = Math.floor((seconds%3600)/60), s = Math.floor(seconds%60);
  if (h > 0) return [h,m,s].map(n=>String(n).padStart(2,'0')).join(':');
  return [m,s].map(n=>String(n).padStart(2,'0')).join(':');
};
window.fmtDist = function(meters) {
  return (meters/1000).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
};
window.fmtDate = function(iso) {
  return new Date(iso).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
};
window.calcKcal = function(avgHr, durationMin, profile) {
  if (!profile || !avgHr || !durationMin) return 0;
  const age = new Date().getFullYear() - (profile.birth_year || 1990);
  const w = profile.weight_kg || 70;
  let kcalPerMin;
  if (profile.sex === 'female') {
    kcalPerMin = (-20.4022 + 0.4472*avgHr - 0.1263*w + 0.074*age) / 4.184;
  } else {
    kcalPerMin = (-55.0969 + 0.6309*avgHr + 0.1988*w + 0.2017*age) / 4.184;
  }
  return Math.max(0, Math.round(kcalPerMin * durationMin));
};
