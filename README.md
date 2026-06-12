# SportTrack v2

Tracker de séances running. Tapis roulant (BLE/FTMS), course outdoor (GPS), overlay OBS.

## Prérequis

- Navigateur Chrome ou Edge (Web Bluetooth nécessaire)
- Compte [Supabase](https://supabase.com) (gratuit)

## Configuration Supabase

1. Créez un projet sur supabase.com
2. Dans l'éditeur SQL, exécutez le schéma ci-dessous
3. Copiez l'URL et la clé anon depuis Paramètres > API
4. Ouvrez Settings dans l'app et entrez vos informations

### Schéma SQL

```sql
create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text, birth_year int, sex text, weight_kg numeric, height_cm int,
  created_at timestamptz default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  type text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_s int, distance_m numeric, steps int,
  avg_hr int, max_hr int, min_hr int,
  avg_speed_kmh numeric, max_speed_kmh numeric,
  avg_pace_s_per_km int, best_pace_s_per_km int,
  calories int, avg_cadence int, max_cadence int,
  avg_incline_pct numeric, max_incline_pct numeric,
  elevation_gain_m numeric, elevation_loss_m numeric,
  zone1_s int, zone2_s int, zone3_s int, zone4_s int, zone5_s int,
  notes text, created_at timestamptz default now()
);

create table session_points (
  id bigserial primary key,
  session_id uuid references sessions(id) on delete cascade,
  t int, hr int, speed_kmh numeric, cadence int, distance_m numeric,
  incline_pct numeric, lat numeric, lng numeric, elevation_m numeric
);

create table live_session (
  id int primary key default 1,
  user_id uuid references auth.users,
  active boolean default false, type text,
  duration_s int, hr int, speed_kmh numeric, pace_s_per_km int,
  distance_m numeric, cadence int, calories int, zone text,
  updated_at timestamptz default now()
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  type text, target numeric, period text default 'week',
  active boolean default true, created_at timestamptz default now()
);

-- RLS
alter table profiles enable row level security;
alter table sessions enable row level security;
alter table session_points enable row level security;
alter table live_session enable row level security;
alter table goals enable row level security;

create policy "own" on profiles for all using (auth.uid() = user_id);
create policy "own" on sessions for all using (auth.uid() = user_id);
create policy "own" on session_points for all using (
  session_id in (select id from sessions where user_id = auth.uid())
);
create policy "own_write" on live_session for all using (auth.uid() = user_id);
create policy "anon_read" on live_session for select using (true);
create policy "own" on goals for all using (auth.uid() = user_id);
```

## Overlay OBS

1. Dans Paramètres, copiez l'URL overlay
2. Dans OBS : Sources > Navigateur, collez l'URL
3. Taille recommandée : 1920×80 (sport-bar), 200×300 (minimal/neon)
4. L'overlay se met à jour automatiquement pendant vos séances

## Déploiement GitHub Pages

1. Poussez le code sur un repo GitHub
2. Settings > Pages > Source: main, / (root)
3. Accédez depuis n'importe quel appareil

## Développement local

```bash
npx serve .
# ou
python -m http.server 8080
```

> Web Bluetooth ne fonctionne pas en file:// — utilisez un serveur local ou GitHub Pages.
