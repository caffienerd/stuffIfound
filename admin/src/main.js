/* admin/src/main.js — init, auth check, tabs, confirm modal */

const { createClient } = supabase;

window.Admin = {
  db:          createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY),
  currentUser: null,
  currentRole: null,
  confirmCb:   null,
};

// ── Theme ──────────────────────────────────────────────────────
const themeToggle = document.getElementById('theme-toggle');
const savedTheme  = localStorage.getItem('sif-theme') || 'dark';

function applyTheme(t) {
  if (t === 'light') { document.documentElement.setAttribute('data-theme', 'light'); themeToggle.textContent = '○'; }
  else               { document.documentElement.removeAttribute('data-theme');        themeToggle.textContent = '◐'; }
  localStorage.setItem('sif-theme', t);
}
themeToggle.addEventListener('click', () =>
  applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'));
applyTheme(savedTheme);

// ── Auth init ──────────────────────────────────────────────────
async function init() {
  const { data: { session } } = await Admin.db.auth.getSession();
  if (window.location.hash.includes('access_token'))
    history.replaceState(null, '', window.location.pathname);

  if (!session?.user) { showDenied(); return; }
  Admin.currentUser = session.user;

  const { data: roleData } = await Admin.db.from('roles').select('role').eq('user_id', Admin.currentUser.id).single();
  Admin.currentRole = roleData?.role || 'user';

  if (Admin.currentRole !== 'admin' && Admin.currentRole !== 'superadmin') { showDenied(); return; }

  // populate header
  const avatar = Admin.currentUser.user_metadata?.avatar_url || Admin.currentUser.user_metadata?.picture;
  const name   = Admin.currentUser.user_metadata?.full_name  || Admin.currentUser.user_metadata?.user_name || Admin.currentUser.email;
  const avatarEl = document.getElementById('user-avatar');
  avatarEl.src = avatar || ''; avatarEl.style.display = avatar ? 'block' : 'none';
  document.getElementById('user-name').textContent      = name;
  const badge = document.getElementById('user-role-badge');
  badge.textContent = Admin.currentRole;
  badge.className   = `role-badge role-${Admin.currentRole}`;
  document.getElementById('user-menu').style.display    = 'flex';

  if (Admin.currentRole === 'superadmin') {
    document.querySelectorAll('.superadmin-only').forEach(el => el.style.display = 'inline-flex');
  }

  document.getElementById('admin-main').style.display = 'block';

  // load all panels
  AdminTags.load();
  AdminEntries.load();
  if (Admin.currentRole === 'superadmin') AdminUsers.load();
}

document.getElementById('signout-btn').addEventListener('click', async () => {
  await Admin.db.auth.signOut();
  window.location.href = '../';
});

function showDenied() {
  document.getElementById('access-denied').style.display = 'flex';
  document.getElementById('admin-main').style.display    = 'none';
}

// ── Tabs ───────────────────────────────────────────────────────
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => p.style.display = 'none');
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).style.display = 'block';
  });
});

// ── Confirm modal ──────────────────────────────────────────────
function confirmAction(title, msg, cb) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent   = msg;
  document.getElementById('confirm-modal').style.display = 'flex';
  Admin.confirmCb = cb;
}

document.getElementById('confirm-close').addEventListener('click',  () => document.getElementById('confirm-modal').style.display = 'none');
document.getElementById('confirm-cancel').addEventListener('click', () => document.getElementById('confirm-modal').style.display = 'none');
document.getElementById('confirm-ok').addEventListener('click', async () => {
  document.getElementById('confirm-modal').style.display = 'none';
  if (Admin.confirmCb) { await Admin.confirmCb(); Admin.confirmCb = null; }
});
document.getElementById('confirm-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('confirm-modal')) document.getElementById('confirm-modal').style.display = 'none';
});

window.confirmAction = confirmAction;

// ── Tab counts ─────────────────────────────────────────────────
function setTabCount(tab, count) {
  const btn = document.querySelector(`.admin-tab[data-tab="${tab}"]`);
  if (!btn) return;
  // strip any existing count badge first
  btn.childNodes.forEach(n => { if (n.nodeType === 3) n.remove(); });
  btn.querySelector('.tab-count')?.remove();
  const base = {
    tags:    'tags',
    entries: 'entries',
    reports: 'reports',
    unban:   'unban requests',
    users:   'users',
  }[tab] || tab;
  btn.textContent = base;
  if (count > 0) {
    const badge = document.createElement('span');
    badge.className   = 'tab-count';
    badge.textContent = count;
    btn.appendChild(badge);
  }
}
window.setTabCount = setTabCount;

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
window.escHtml = esc;

init();