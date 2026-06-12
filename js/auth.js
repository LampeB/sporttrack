window.Auth = (function() {
  let _onAuthChange = null;

  async function init(onAuthChange) {
    _onAuthChange = onAuthChange;
    const sb = DB.getClient();
    if (!sb) {
      // No Supabase config — show settings prompt
      _onAuthChange(null);
      return;
    }
    sb.auth.onAuthStateChange((_event, session) => {
      _onAuthChange(session ? session.user : null);
    });
    // Check existing session
    const { data } = await sb.auth.getSession();
    _onAuthChange(data.session ? data.session.user : null);
  }

  async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const pw = document.getElementById('auth-password').value;
    const btn = document.getElementById('auth-submit');
    const spinner = document.getElementById('auth-spinner');
    const btnText = document.getElementById('auth-btn-text');
    const errEl = document.getElementById('auth-error');

    btn.disabled = true;
    spinner.style.display = '';
    btnText.style.display = 'none';
    errEl.style.display = 'none';

    const sb = DB.getClient();
    if (!sb) {
      errEl.textContent = "Supabase non configuré. Renseignez l'URL et la clé dans js/config.js.";
      errEl.style.display = '';
      btn.disabled = false;
      spinner.style.display = 'none';
      btnText.style.display = '';
      return;
    }

    // Try sign in first, then sign up if user doesn't exist
    let { error } = await sb.auth.signInWithPassword({ email, password: pw });
    if (error && error.message.includes('Invalid login credentials')) {
      // First time: create account
      const result = await sb.auth.signUp({ email, password: pw });
      error = result.error;
    }
    if (error) {
      errEl.textContent = error.message;
      errEl.style.display = '';
    }
    btn.disabled = false;
    spinner.style.display = 'none';
    btnText.style.display = '';
  }

  async function logout() {
    const sb = DB.getClient();
    if (sb) await sb.auth.signOut();
  }

  async function getUser() {
    const sb = DB.getClient();
    if (!sb) return null;
    const { data } = await sb.auth.getUser();
    return data.user || null;
  }

  return { init, handleLogin, logout, getUser };
})();
