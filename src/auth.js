/* auth.js — login, logout, ban check, role fetch */

async function fetchRole(userId) {
  const { data } = await App.db.from('roles').select('role').eq('user_id', userId).maybeSingle();
  return data?.role || 'user';
}

async function checkBanned(userId) {
  const { data } = await App.db.from('banned_users').select('*').eq('user_id', userId).maybeSingle();
  return data || null;
}

async function updateAuthUI(user) {
  App.currentUser = user;

  if (user) {
    const ban = await checkBanned(user.id);
    if (ban) { showBanScreen(ban); return; }

    App.currentRole = await fetchRole(user.id);

    document.getElementById('login-btn').style.display  = 'none';
    document.getElementById('user-menu').style.display  = 'flex';
    document.getElementById('add-btn').style.display    = 'inline-flex';

    const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture;
    const name   = user.user_metadata?.full_name  || user.user_metadata?.user_name || user.email;
    const avatarEl = document.getElementById('user-avatar');
    avatarEl.src           = avatar || '';
    avatarEl.style.display = avatar ? 'block' : 'none';
    document.getElementById('user-name').textContent = name;

    if (App.currentRole === 'admin' || App.currentRole === 'superadmin') {
      document.getElementById('admin-link').style.display = 'inline-flex';
    }
  } else {
    App.currentRole = 'user';
    document.getElementById('login-btn').style.display  = 'inline-flex';
    document.getElementById('user-menu').style.display  = 'none';
    document.getElementById('add-btn').style.display    = 'none';
    document.getElementById('admin-link').style.display = 'none';
  }

  if (window.Bookmarks) {
    Bookmarks.renderSavedFilter();
    await Bookmarks.fetchBookmarks();
  }
  window.Main?.renderTools();
}

function showBanScreen(ban) {
  document.getElementById('main-content').style.display = 'none';
  document.getElementById('add-btn').style.display      = 'none';
  document.getElementById('login-btn').style.display    = 'none';
  document.getElementById('user-menu').style.display    = 'flex';
  document.getElementById('ban-screen').style.display   = 'flex';
  document.getElementById('ban-reason').textContent     = ban.reason ? `reason: ${ban.reason}` : '';

  if (ban.unban_request) {
    document.getElementById('unban-section').innerHTML =
      '<p class="ban-hint" style="color:var(--muted)">✓ unban request already submitted — waiting for review.</p>';
    return;
  }

  document.getElementById('unban-submit').addEventListener('click', async () => {
    const msg = document.getElementById('unban-message').value.trim();
    const errEl = document.getElementById('unban-error');
    if (!msg) { errEl.textContent = 'write something first.'; errEl.style.display = 'block'; return; }
    errEl.style.display = 'none';
    const btn = document.getElementById('unban-submit');
    btn.disabled = true; btn.textContent = 'sending...';
    const { error } = await App.db.from('banned_users').update({
      unban_request: msg, unban_requested_at: new Date().toISOString()
    }).eq('user_id', App.currentUser.id);
    if (error) {
      errEl.textContent = 'failed to send. try again.'; errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'send request →';
      return;
    }
    document.getElementById('unban-section').innerHTML =
      '<p class="ban-hint" style="color:var(--muted)">✓ unban request submitted — waiting for review.</p>';
  });
}

// ── Init auth ──────────────────────────────────────────────────
App.db.auth.onAuthStateChange((event, session) => {
  updateAuthUI(session?.user ?? null);
  if (window.location.hash.includes('access_token'))
    history.replaceState(null, '', window.location.pathname);
});

// ── OAuth buttons ──────────────────────────────────────────────
document.getElementById('gh-login-btn').addEventListener('click', () =>
  App.db.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: window.location.origin + window.location.pathname } }));

document.getElementById('google-login-btn').addEventListener('click', () =>
  App.db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } }));

document.getElementById('signout-btn').addEventListener('click', async () => await App.db.auth.signOut());

window.Auth = { updateAuthUI };