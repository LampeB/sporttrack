window.DB = (function() {
  let _client = null;

  function client() {
    if (!_client && CONFIG.supabase.url && CONFIG.supabase.anonKey) {
      _client = window.supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
    }
    return _client;
  }

  function reinit() { _client = null; client(); }

  async function getProfile() {
    const sb = client(); if (!sb) return null;
    const { data, error } = await sb.from('profiles').select('*').limit(1).single();
    if (error && error.code !== 'PGRST116') console.error('getProfile:', error);
    return data || null;
  }

  async function saveProfile(profile) {
    const sb = client(); if (!sb) return;
    const user = (await sb.auth.getUser()).data.user;
    if (!user) return;
    const row = { ...profile, user_id: user.id };
    if (profile.id) {
      await sb.from('profiles').update(row).eq('id', profile.id);
    } else {
      const { data } = await sb.from('profiles').insert(row).select().single();
      return data;
    }
  }

  async function getSessions(limit = 20, offset = 0) {
    const sb = client(); if (!sb) return [];
    const { data, error } = await sb.from('sessions')
      .select('id,type,started_at,ended_at,duration_s,distance_m,avg_hr,max_hr,avg_pace_s_per_km,calories,steps,zone1_s,zone2_s,zone3_s,zone4_s,zone5_s')
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) console.error('getSessions:', error);
    return data || [];
  }

  async function getSession(id) {
    const sb = client(); if (!sb) return null;
    const [{ data: session }, { data: points }] = await Promise.all([
      sb.from('sessions').select('*').eq('id', id).single(),
      sb.from('session_points').select('*').eq('session_id', id).order('t', { ascending: true }),
    ]);
    return session ? { ...session, points: points || [] } : null;
  }

  async function saveSession(session) {
    const sb = client(); if (!sb) return null;
    const user = (await sb.auth.getUser()).data.user;
    if (!user) return null;
    const row = { ...session, user_id: user.id };
    const { data, error } = await sb.from('sessions').insert(row).select().single();
    if (error) console.error('saveSession:', error);
    return data;
  }

  async function saveSessionPoint(sessionId, point) {
    const sb = client(); if (!sb) return;
    await sb.from('session_points').insert({ session_id: sessionId, ...point });
  }

  async function saveBatchPoints(sessionId, points) {
    const sb = client(); if (!sb) return;
    const rows = points.map(p => ({ session_id: sessionId, ...p }));
    await sb.from('session_points').insert(rows);
  }

  async function upsertLive(data) {
    const sb = client(); if (!sb) return;
    const user = (await sb.auth.getUser()).data.user;
    if (!user) return;
    await sb.from('live_session').upsert({ id: 1, user_id: user.id, ...data, updated_at: new Date().toISOString() });
  }

  async function clearLive() {
    const sb = client(); if (!sb) return;
    await sb.from('live_session').upsert({ id: 1, active: false, hr: 0, updated_at: new Date().toISOString() });
  }

  async function getGoals() {
    const sb = client(); if (!sb) return [];
    const { data } = await sb.from('goals').select('*').eq('active', true).order('created_at');
    return data || [];
  }

  async function saveGoal(goal) {
    const sb = client(); if (!sb) return;
    const user = (await sb.auth.getUser()).data.user;
    if (!user) return;
    await sb.from('goals').insert({ ...goal, user_id: user.id });
  }

  async function deleteGoal(id) {
    const sb = client(); if (!sb) return;
    await sb.from('goals').update({ active: false }).eq('id', id);
  }

  async function deleteSession(id) {
    const sb = client(); if (!sb) return;
    await sb.from('sessions').delete().eq('id', id);
  }

  async function getWeeklySessions() {
    const sb = client(); if (!sb) return [];
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    const { data } = await sb.from('sessions')
      .select('started_at,duration_s,distance_m,type')
      .gte('started_at', weekAgo)
      .order('started_at');
    return data || [];
  }

  function getClient() { return client(); }

  return { reinit, getProfile, saveProfile, getSessions, getSession, saveSession,
           saveSessionPoint, saveBatchPoints, upsertLive, clearLive,
           getGoals, saveGoal, deleteGoal, deleteSession, getWeeklySessions, getClient };
})();
