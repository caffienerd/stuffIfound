/* ui.js — theme, search, modals, misc DOM */

// ── Shared state (global) ──────────────────────────────────────
window.App = {
  db:                supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY),
  allTools:          [],
  allTags:           [],
  activeTag:         'ALL',
  searchQuery:       '',
  currentUser:       null,
  currentRole:       'user',
  deleteTargetId:    null,
  selectedTags:      [],
  selectedPlatforms: [],
};

// ── Theme ──────────────────────────────────────────────────────
const themeToggle = document.getElementById('theme-toggle');
const savedTheme  = localStorage.getItem('sif-theme') || 'dark';

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    themeToggle.textContent = '○';
  } else {
    document.documentElement.removeAttribute('data-theme');
    themeToggle.textContent = '◐';
  }
  localStorage.setItem('sif-theme', theme);
}

themeToggle.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  applyTheme(cur === 'light' ? 'dark' : 'light');
  setTimeout(() => window.Tags?.injectTagStyles(), 50);
});

applyTheme(savedTheme);

// ── Search ─────────────────────────────────────────────────────
const searchInput = document.getElementById('search');
const searchClear = document.getElementById('search-clear');

searchInput.addEventListener('input', () => {
  App.searchQuery = searchInput.value.trim();
  searchClear.style.display = App.searchQuery ? 'inline' : 'none';
  window.Main?.renderTools();
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  App.searchQuery   = '';
  searchClear.style.display = 'none';
  searchInput.focus();
  window.Main?.renderTools();
});

// ── Tag filter bar ─────────────────────────────────────────────
document.getElementById('tag-filters').addEventListener('click', e => {
  const btn = e.target.closest('.tag-btn');
  if (!btn || btn.classList.contains('btn-saved')) return;
  document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  App.activeTag    = btn.dataset.tag;
  App.showingSaved = false;
  window.Main?.renderTools();
});

// ── Desc char counter ──────────────────────────────────────────
document.getElementById('f-desc').addEventListener('input', function() {
  const len = this.value.length;
  const el  = document.getElementById('desc-count');
  el.textContent = `${len} / 280`;
  el.style.color = len > 252 ? '#f87171' : '';
});

// ── Platform multi-select ──────────────────────────────────────
document.getElementById('platform-select').addEventListener('click', e => {
  const opt = e.target.closest('.platform-option');
  if (!opt) return;
  opt.classList.toggle('selected');
  const p = opt.dataset.platform;
  App.selectedPlatforms = opt.classList.contains('selected')
    ? [...App.selectedPlatforms, p]
    : App.selectedPlatforms.filter(x => x !== p);
});

// ── Modals ─────────────────────────────────────────────────────
const loginModal  = document.getElementById('login-modal');
const modalOverlay = document.getElementById('modal-overlay');
const deleteModal  = document.getElementById('delete-modal');

document.getElementById('login-btn').addEventListener('click',         () => { loginModal.style.display = 'flex'; });
document.getElementById('login-modal-close').addEventListener('click', () => { loginModal.style.display = 'none'; });
loginModal.addEventListener('click', e => { if (e.target === loginModal) loginModal.style.display = 'none'; });

document.getElementById('modal-close').addEventListener('click', closeAddModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeAddModal(); });

document.getElementById('delete-cancel').addEventListener('click',     () => { deleteModal.style.display = 'none'; });
document.getElementById('delete-cancel-btn').addEventListener('click', () => { deleteModal.style.display = 'none'; });
deleteModal.addEventListener('click', e => { if (e.target === deleteModal) deleteModal.style.display = 'none'; });

document.addEventListener('keydown', e => {
  // Focus search on Ctrl+K or /
  const anyModalOpen = () =>
    document.getElementById('modal-overlay').style.display  !== 'none' ||
    document.getElementById('login-modal').style.display    !== 'none' ||
    document.getElementById('delete-modal').style.display   !== 'none' ||
    document.getElementById('report-modal')?.style.display  !== 'none';

  if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement !== searchInput)) {
    if (anyModalOpen()) return;
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
    return;
  }
  if (e.key !== 'Escape') return;
  // Escape: blur search if focused, else close modals
  if (document.activeElement === searchInput) {
    searchInput.blur();
    return;
  }
  closeAddModal();
  loginModal.style.display  = 'none';
  deleteModal.style.display = 'none';
});

function closeAddModal() {
  modalOverlay.style.display = 'none';
  window.Submit?.resetForm();
}

window.UI = { closeAddModal };