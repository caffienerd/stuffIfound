/* stuffIfound — script.js */

const { createClient } = supabase;
const db = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// ── State ──────────────────────────────────────────────────────
let allTools       = [];
let activeTag      = 'ALL';
let searchQuery    = '';
let selectedTags   = [];
let currentUser    = null;
let deleteTargetId = null;

// ── DOM ────────────────────────────────────────────────────────
const grid             = document.getElementById('tools-grid');
const noResults        = document.getElementById('no-results');
const toolCount        = document.getElementById('tool-count');
const searchInput      = document.getElementById('search');
const searchClear      = document.getElementById('search-clear');
const tagFilters       = document.getElementById('tag-filters');
const addBtn           = document.getElementById('add-btn');
const modalOverlay     = document.getElementById('modal-overlay');
const modalClose       = document.getElementById('modal-close');
const modalTitle       = document.getElementById('modal-title');
const tagSelect        = document.getElementById('tag-select');
const submitBtn        = document.getElementById('submit-btn');
const formError        = document.getElementById('form-error');
const submitSuccess    = document.getElementById('submit-success');
const loginBtn         = document.getElementById('login-btn');
const loginModal       = document.getElementById('login-modal');
const loginModalClose  = document.getElementById('login-modal-close');
const userMenu         = document.getElementById('user-menu');
const userAvatar       = document.getElementById('user-avatar');
const userName         = document.getElementById('user-name');
const signoutBtn       = document.getElementById('signout-btn');
const ghLoginBtn       = document.getElementById('gh-login-btn');
const googleLoginBtn   = document.getElementById('google-login-btn');
const deleteModal      = document.getElementById('delete-modal');
const deleteCancel     = document.getElementById('delete-cancel');
const deleteCancelBtn  = document.getElementById('delete-cancel-btn');
const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
const themeToggle      = document.getElementById('theme-toggle');

// ── Theme ──────────────────────────────────────────────────────
const savedTheme = localStorage.getItem('sif-theme') || 'dark';
function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    themeToggle.textContent = '○';
    themeToggle.title = 'switch to dark';
  } else {
    document.documentElement.removeAttribute('data-theme');
    themeToggle.textContent = '◐';
    themeToggle.title = 'switch to light';
  }
  localStorage.setItem('sif-theme', theme);
}
themeToggle.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  applyTheme(cur === 'light' ? 'dark' : 'light');
});
applyTheme(savedTheme);

// ── Auth UI ────────────────────────────────────────────────────
function updateAuthUI(user) {
  currentUser = user;
  if (user) {
    loginBtn.style.display  = 'none';
    userMenu.style.display  = 'flex';
    addBtn.style.display    = 'inline-flex';
    const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture;
    const name   = user.user_metadata?.full_name || user.user_metadata?.user_name || user.email;
    userAvatar.src           = avatar || '';
    userAvatar.style.display = avatar ? 'block' : 'none';
    userName.textContent     = name;
  } else {
    loginBtn.style.display  = 'inline-flex';
    userMenu.style.display  = 'none';
    addBtn.style.display    = 'none';
  }
  renderTools();
}

// Handle OAuth hash redirect — Supabase puts tokens in the URL fragment
// getSession() reads it automatically; we just clean the URL after
db.auth.getSession().then(({ data: { session } }) => {
  updateAuthUI(session?.user ?? null);
  if (window.location.hash.includes('access_token')) {
    history.replaceState(null, '', window.location.pathname);
  }
});

db.auth.onAuthStateChange((_event, session) => {
  updateAuthUI(session?.user ?? null);
  if (window.location.hash.includes('access_token')) {
    history.replaceState(null, '', window.location.pathname);
  }
});

// ── OAuth buttons ──────────────────────────────────────────────
ghLoginBtn.addEventListener('click', () => {
  db.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: window.location.origin + window.location.pathname } });
});
googleLoginBtn.addEventListener('click', () => {
  db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } });
});
signoutBtn.addEventListener('click', async () => {
  await db.auth.signOut();
});

loginBtn.addEventListener('click', () => { loginModal.style.display = 'flex'; });
loginModalClose.addEventListener('click', () => { loginModal.style.display = 'none'; });
loginModal.addEventListener('click', e => { if (e.target === loginModal) loginModal.style.display = 'none'; });

// ── Fetch ──────────────────────────────────────────────────────
async function fetchTools() {
  const { data, error } = await db
    .from('tools')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    grid.innerHTML = `<div class="no-results">error: ${error.message}</div>`;
    return;
  }
  allTools = data || [];
  toolCount.textContent = `${allTools.length} things`;
  renderTools();
}

// ── Filter ─────────────────────────────────────────────────────
function getFiltered() {
  return allTools.filter(t => {
    const tagMatch    = activeTag === 'ALL' || (Array.isArray(t.tags) && t.tags.includes(activeTag));
    const q           = searchQuery.toLowerCase();
    const searchMatch = !q || t.name?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q);
    return tagMatch && searchMatch;
  });
}

// ── Render ─────────────────────────────────────────────────────
function renderTools() {
  const filtered = getFiltered();
  if (filtered.length === 0) {
    grid.innerHTML = '';
    noResults.style.display = 'block';
    return;
  }
  noResults.style.display = 'none';
  grid.innerHTML = filtered.map((t, i) => card(t, i)).join('');

  grid.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openEditModal(btn.dataset.id); });
  });
  grid.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openDeleteModal(btn.dataset.id); });
  });
  // whole card is clickable
  grid.querySelectorAll('.tool-card[data-href]').forEach(card => {
    card.addEventListener('click', () => window.open(card.dataset.href, '_blank', 'noopener noreferrer'));
  });
}

function card(t, i) {
  const tags     = Array.isArray(t.tags) ? t.tags : [];
  const tagsHTML = tags.map(tag =>
    `<span class="card-tag tag-${tag.replace(/\s+/g,'-')}">${tag.toUpperCase()}</span>`
  ).join('');

  const date = t.created_at
    ? new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const isOwner    = currentUser && currentUser.id === t.user_id;
  const ownerBadge = isOwner ? `<span class="owner-badge">you</span>` : '';
  const ownerActions = isOwner ? `
    <div class="card-actions">
      <button class="btn-edit" data-id="${t.id}">edit</button>
      <button class="btn-delete" data-id="${t.id}">remove</button>
    </div>` : '';

  const addedBy = t.added_by || '';

  return `
    <div class="tool-card${t.link ? ' tool-card--link' : ''}" data-href="${esc(t.link || '')}" style="animation-delay:${Math.min(i*25,300)}ms">
      <div class="card-top">
        <div class="card-tags">${tagsHTML}${ownerBadge}</div>
        <div class="card-name">${esc(t.name || '')}</div>
        <div class="card-desc">${esc(t.description || '')}</div>
      </div>
      <div class="card-footer">
        <span class="card-by">${addedBy ? esc(addedBy) : ''}</span>
        <span class="card-date">${date}</span>
      </div>
      ${ownerActions}
    </div>`;
}

const esc = s => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── Tag filter ─────────────────────────────────────────────────
tagFilters.addEventListener('click', e => {
  const btn = e.target.closest('.tag-btn');
  if (!btn) return;
  document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeTag = btn.dataset.tag;
  renderTools();
});

// ── Search ─────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  searchClear.style.display = searchQuery ? 'inline' : 'none';
  renderTools();
});
searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  searchClear.style.display = 'none';
  searchInput.focus();
  renderTools();
});

// ── Add modal ──────────────────────────────────────────────────
addBtn.addEventListener('click', () => {
  document.getElementById('f-edit-id').value = '';
  modalTitle.textContent = 'add something';
  submitBtn.textContent  = 'submit →';
  resetForm();
  modalOverlay.style.display = 'flex';
  document.getElementById('f-name').focus();
});

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
    loginModal.style.display  = 'none';
    deleteModal.style.display = 'none';
  }
});

function closeModal() {
  modalOverlay.style.display = 'none';
  resetForm();
}

// ── Edit modal ─────────────────────────────────────────────────
function openEditModal(id) {
  const tool = allTools.find(t => t.id === id);
  if (!tool) return;

  document.getElementById('f-edit-id').value = id;
  document.getElementById('f-name').value    = tool.name;
  document.getElementById('f-link').value    = tool.link;
  document.getElementById('f-desc').value    = tool.description;

  selectedTags = Array.isArray(tool.tags) ? [...tool.tags] : [];
  document.querySelectorAll('.tag-option').forEach(o => {
    o.classList.toggle('selected', selectedTags.includes(o.dataset.tag));
  });

  modalTitle.textContent      = 'edit entry';
  submitBtn.textContent       = 'save changes →';
  submitSuccess.style.display = 'none';
  hideError();
  modalOverlay.style.display  = 'flex';
}

// ── Delete modal ───────────────────────────────────────────────
function openDeleteModal(id) {
  deleteTargetId = id;
  deleteModal.style.display = 'flex';
}

deleteCancel.addEventListener('click',    () => { deleteModal.style.display = 'none'; });
deleteCancelBtn.addEventListener('click', () => { deleteModal.style.display = 'none'; });
deleteModal.addEventListener('click', e  => { if (e.target === deleteModal) deleteModal.style.display = 'none'; });

deleteConfirmBtn.addEventListener('click', async () => {
  if (!deleteTargetId) return;
  const { error } = await db.from('tools').delete().eq('id', deleteTargetId);
  if (error) { alert(`failed: ${error.message}`); return; }
  deleteModal.style.display = 'none';
  deleteTargetId = null;
  await fetchTools();
});

// ── Tag multi-select ───────────────────────────────────────────
tagSelect.addEventListener('click', e => {
  const opt = e.target.closest('.tag-option');
  if (!opt) return;
  opt.classList.toggle('selected');
  const tag = opt.dataset.tag;
  selectedTags = opt.classList.contains('selected')
    ? [...selectedTags, tag]
    : selectedTags.filter(t => t !== tag);
});

// ── Submit (add or edit) ───────────────────────────────────────
submitBtn.addEventListener('click', async () => {
  const editId = document.getElementById('f-edit-id').value;
  const name   = document.getElementById('f-name').value.trim();
  const link   = document.getElementById('f-link').value.trim();
  const desc   = document.getElementById('f-desc').value.trim();

  if (!name || !link || !desc || selectedTags.length === 0) {
    showError('fill in all required fields and pick at least one tag.');
    return;
  }
  if (!isValidUrl(link)) {
    showError('enter a valid url (e.g. https://example.com)');
    return;
  }

  hideError();
  submitBtn.disabled    = true;
  submitBtn.textContent = editId ? 'saving...' : 'submitting...';

  let error;
  if (editId) {
    ({ error } = await db.from('tools').update({
      name, link, description: desc, tags: selectedTags,
    }).eq('id', editId));
  } else {
    ({ error } = await db.from('tools').insert([{
      name, link, description: desc,
      tags:     selectedTags,
      added_by: currentUser?.user_metadata?.full_name
             || currentUser?.user_metadata?.user_name
             || null,
      user_id:  currentUser?.id,
    }]));
  }

  submitBtn.disabled    = false;
  submitBtn.textContent = editId ? 'save changes →' : 'submit →';

  if (error) { showError(`failed: ${error.message}`); return; }

  submitSuccess.style.display = 'block';
  await fetchTools();
  setTimeout(closeModal, 900);
});

// ── Helpers ────────────────────────────────────────────────────
const showError  = msg => { formError.textContent = msg; formError.style.display = 'block'; };
const hideError  = ()  => { formError.style.display = 'none'; };
const isValidUrl = s   => { try { new URL(s); return true; } catch { return false; } };

function resetForm() {
  ['f-name','f-link','f-desc'].forEach(id => document.getElementById(id).value = '');
  document.querySelectorAll('.tag-option').forEach(o => o.classList.remove('selected'));
  selectedTags = [];
  hideError();
  submitSuccess.style.display = 'none';
  submitBtn.disabled    = false;
  submitBtn.textContent = 'submit →';
}

// ── Boot ───────────────────────────────────────────────────────
fetchTools();