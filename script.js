/* stuffIfound — script.js */

const { createClient } = supabase;
const db = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// ── Config ─────────────────────────────────────────────────────
const MAX_NAME_LEN = 60;
const MAX_DESC_LEN = 280;
const EMOJI_RE     = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{FE00}-\u{FEFF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA9F}]/u;
const RATE_LIMIT_KEY  = 'sif-submissions';
const RATE_LIMIT_MAX  = 5;   // max submissions
const RATE_LIMIT_WIN  = 60 * 60 * 1000; // per hour (ms)

// ── State ──────────────────────────────────────────────────────
let allTools       = [];
let activeTag      = 'ALL';
let searchQuery    = '';
let selectedTags   = [];
let currentUser    = null;
let deleteTargetId    = null;
let selectedPlatforms = [];

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
const descCount        = document.getElementById('desc-count');

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

db.auth.getSession().then(({ data: { session } }) => {
  updateAuthUI(session?.user ?? null);
  if (window.location.hash.includes('access_token'))
    history.replaceState(null, '', window.location.pathname);
});
db.auth.onAuthStateChange((_e, session) => {
  updateAuthUI(session?.user ?? null);
  if (window.location.hash.includes('access_token'))
    history.replaceState(null, '', window.location.pathname);
});

// ── OAuth ──────────────────────────────────────────────────────
ghLoginBtn.addEventListener('click', () =>
  db.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: window.location.origin + window.location.pathname } }));
googleLoginBtn.addEventListener('click', () =>
  db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } }));
signoutBtn.addEventListener('click', async () => await db.auth.signOut());

loginBtn.addEventListener('click',       () => { loginModal.style.display = 'flex'; });
loginModalClose.addEventListener('click',() => { loginModal.style.display = 'none'; });
loginModal.addEventListener('click', e  => { if (e.target === loginModal) loginModal.style.display = 'none'; });

// ── Fetch ──────────────────────────────────────────────────────
async function fetchTools() {
  const { data, error } = await db
    .from('tools')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { grid.innerHTML = `<div class="no-results">error: ${error.message}</div>`; return; }
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

  grid.querySelectorAll('.btn-edit').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); openEditModal(btn.dataset.id); }));
  grid.querySelectorAll('.btn-delete').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); openDeleteModal(btn.dataset.id); }));
  grid.querySelectorAll('.tool-card[data-href]').forEach(c =>
    c.addEventListener('click', () => { if (c.dataset.href) window.open(c.dataset.href, '_blank', 'noopener noreferrer'); }));
}

function card(t, i) {
  const tags     = Array.isArray(t.tags) ? t.tags : [];
  const tagsHTML = tags.map(tag =>
    `<span class="card-tag tag-${tag.replace(/\s+/g,'-')}">${tag.toUpperCase()}</span>`
  ).join('');

  const date = t.created_at
    ? new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const platforms   = Array.isArray(t.platforms) ? t.platforms : [];
  const platHTML    = platforms.map(p =>
    `<span class="card-platform">${p}</span>`
  ).join('');
  const isOwner    = currentUser && currentUser.id === t.user_id;
  const ownerBadge = isOwner ? `<span class="owner-badge">you</span>` : '';
  const actions    = isOwner ? `
    <div class="card-actions">
      <button class="btn-edit"   data-id="${t.id}">edit</button>
      <button class="btn-delete" data-id="${t.id}">remove</button>
    </div>` : '';

  return `
    <div class="tool-card${t.link ? ' tool-card--link' : ''}" data-href="${esc(t.link || '')}" style="animation-delay:${Math.min(i*25,300)}ms">
      <div class="card-top">
        <div class="card-tags">${tagsHTML}${ownerBadge}</div>
        <div class="card-name">${esc(t.name || '')}</div>
        ${platHTML ? `<div class="card-platforms">${platHTML}</div>` : ''}
        <div class="card-desc">${esc(t.description || '')}</div>
      </div>
      <div class="card-footer">
        <span class="card-by">${t.added_by ? esc(t.added_by) : ''}</span>
        <span class="card-date">${date}</span>
      </div>
      ${actions}
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
  searchInput.value = ''; searchQuery = '';
  searchClear.style.display = 'none';
  searchInput.focus(); renderTools();
});

// ── Desc char counter ──────────────────────────────────────────
document.getElementById('f-desc').addEventListener('input', function() {
  const len = this.value.length;
  if (descCount) {
    descCount.textContent = `${len} / ${MAX_DESC_LEN}`;
    descCount.style.color = len > MAX_DESC_LEN * 0.9 ? '#f87171' : '';
  }
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
  if (e.key === 'Escape') { closeModal(); loginModal.style.display = 'none'; deleteModal.style.display = 'none'; }
});
function closeModal() { modalOverlay.style.display = 'none'; resetForm(); }

// ── Edit modal ─────────────────────────────────────────────────
function openEditModal(id) {
  const tool = allTools.find(t => t.id === id);
  if (!tool) return;
  document.getElementById('f-edit-id').value = id;
  document.getElementById('f-name').value    = tool.name;
  document.getElementById('f-link').value    = tool.link;
  document.getElementById('f-desc').value    = tool.description;
  selectedTags = Array.isArray(tool.tags) ? [...tool.tags] : [];
  document.querySelectorAll('.tag-option').forEach(o =>
    o.classList.toggle('selected', selectedTags.includes(o.dataset.tag)));
  selectedPlatforms = Array.isArray(tool.platforms) ? [...tool.platforms] : [];
  document.querySelectorAll('.platform-option').forEach(o =>
    o.classList.toggle('selected', selectedPlatforms.includes(o.dataset.platform)));
  modalTitle.textContent      = 'edit entry';
  submitBtn.textContent       = 'save changes →';
  submitSuccess.style.display = 'none';
  hideError();
  modalOverlay.style.display  = 'flex';
}

// ── Delete modal ───────────────────────────────────────────────
function openDeleteModal(id) { deleteTargetId = id; deleteModal.style.display = 'flex'; }
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

// ── Rate limiting ──────────────────────────────────────────────
function getRateData() {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    return raw ? JSON.parse(raw) : { count: 0, windowStart: Date.now() };
  } catch { return { count: 0, windowStart: Date.now() }; }
}

function checkRateLimit() {
  const now  = Date.now();
  let data   = getRateData();
  // reset window if expired
  if (now - data.windowStart > RATE_LIMIT_WIN) {
    data = { count: 0, windowStart: now };
  }
  if (data.count >= RATE_LIMIT_MAX) {
    const minsLeft = Math.ceil((RATE_LIMIT_WIN - (now - data.windowStart)) / 60000);
    return `too many submissions — try again in ${minsLeft} min.`;
  }
  return null;
}

function incrementRateLimit() {
  const now  = Date.now();
  let data   = getRateData();
  if (now - data.windowStart > RATE_LIMIT_WIN) data = { count: 0, windowStart: now };
  data.count++;
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
}

// ── URLhaus malware check (abuse.ch — free, no key needed) ────
async function checkSafeBrowsing(url) {
  try {
    const res = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(url)}`
    });
    const data = await res.json();
    if (data.query_status === 'is_hosting_malware')
      return 'this link is flagged as malware hosting — submission blocked.';
    if (data.query_status === 'is_phishing')
      return 'this link is flagged as phishing — submission blocked.';
    return null;
  } catch {
    return null; // fail open — don't block if API unreachable
  }
}

// ── Platform multi-select ──────────────────────────────────────
document.getElementById('platform-select').addEventListener('click', e => {
  const opt = e.target.closest('.platform-option');
  if (!opt) return;
  opt.classList.toggle('selected');
  const p = opt.dataset.platform;
  selectedPlatforms = opt.classList.contains('selected')
    ? [...selectedPlatforms, p]
    : selectedPlatforms.filter(x => x !== p);
});

// ── Validate ───────────────────────────────────────────────────
function validate(name, link, desc) {
  if (!name || !link || !desc || selectedTags.length === 0)
    return 'fill in all required fields and pick at least one tag.';
  if (name.length > MAX_NAME_LEN)
    return `name too long — max ${MAX_NAME_LEN} chars.`;
  if (desc.length > MAX_DESC_LEN)
    return `description too long — max ${MAX_DESC_LEN} chars.`;
  if (EMOJI_RE.test(name) || EMOJI_RE.test(desc))
    return 'no emojis in name or description.';
  if (!isValidUrl(link))
    return 'enter a valid url (e.g. https://example.com)';
  return null;
}

// ── Submit ─────────────────────────────────────────────────────
submitBtn.addEventListener('click', async () => {
  const editId = document.getElementById('f-edit-id').value;
  const name   = document.getElementById('f-name').value.trim();
  const link   = document.getElementById('f-link').value.trim();
  const desc   = document.getElementById('f-desc').value.trim();

  // basic validation
  const err = validate(name, link, desc);
  if (err) { showError(err); return; }

  // rate limit (new submissions only)
  if (!editId) {
    const rateErr = checkRateLimit();
    if (rateErr) { showError(rateErr); return; }
  }

  hideError();
  submitBtn.disabled    = true;
  submitBtn.textContent = editId ? 'saving...' : 'checking link...';

  // safe browsing check (new submissions only)
  if (!editId) {
    const safeErr = await checkSafeBrowsing(link);
    if (safeErr) {
      showError(safeErr);
      submitBtn.disabled    = false;
      submitBtn.textContent = 'submit →';
      return;
    }
  }

  submitBtn.textContent = editId ? 'saving...' : 'submitting...';

  let error;
  if (editId) {
    ({ error } = await db.from('tools').update({
      name, link, description: desc, tags: selectedTags,
      platforms: selectedPlatforms.length ? selectedPlatforms : null,
    }).eq('id', editId));
  } else {
    ({ error } = await db.from('tools').insert([{
      name, link, description: desc,
      tags:     selectedTags,
      added_by: currentUser?.user_metadata?.full_name
             || currentUser?.user_metadata?.user_name
             || null,
      user_id:   currentUser?.id,
      platforms: selectedPlatforms.length ? selectedPlatforms : null,
    }]));
    if (!error) incrementRateLimit();
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
  document.querySelectorAll('.platform-option').forEach(o => o.classList.remove('selected'));
  if (descCount) descCount.textContent = `0 / ${MAX_DESC_LEN}`;
  selectedTags = [];
  selectedPlatforms = [];
  hideError();
  submitSuccess.style.display = 'none';
  submitBtn.disabled    = false;
  submitBtn.textContent = 'submit →';
}

// ── Boot ───────────────────────────────────────────────────────
fetchTools();