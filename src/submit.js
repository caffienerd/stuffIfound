/* submit.js — add/edit form, validation, rate limiting, urlhaus check */

const MAX_NAME_LEN   = 60;
const MAX_DESC_LEN   = 280;
const EMOJI_RE       = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{FE00}-\u{FEFF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA9F}]/u;
const RATE_LIMIT_KEY = 'sif-submissions';
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WIN = 60 * 60 * 1000;

// ── Rate limiting ──────────────────────────────────────────────
function getRateData() {
  try { const r = localStorage.getItem(RATE_LIMIT_KEY); return r ? JSON.parse(r) : { count: 0, windowStart: Date.now() }; }
  catch { return { count: 0, windowStart: Date.now() }; }
}
function checkRateLimit() {
  const now = Date.now(); let d = getRateData();
  if (now - d.windowStart > RATE_LIMIT_WIN) d = { count: 0, windowStart: now };
  if (d.count >= RATE_LIMIT_MAX) {
    const m = Math.ceil((RATE_LIMIT_WIN - (now - d.windowStart)) / 60000);
    return `too many submissions — try again in ${m} min.`;
  }
  return null;
}
function incrementRateLimit() {
  const now = Date.now(); let d = getRateData();
  if (now - d.windowStart > RATE_LIMIT_WIN) d = { count: 0, windowStart: now };
  d.count++;
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(d));
}

// ── URLhaus check ──────────────────────────────────────────────
async function checkSafeBrowsing(url) {
  try {
    const res  = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(url)}`
    });
    const data = await res.json();
    if (data.query_status === 'is_hosting_malware') return 'this link is flagged as malware — blocked.';
    if (data.query_status === 'is_phishing')        return 'this link is flagged as phishing — blocked.';
    return null;
  } catch { return null; }
}

// ── Validation ─────────────────────────────────────────────────
function validate(name, link, desc) {
  if (!name || !link || !desc || App.selectedTags.length === 0)
    return 'fill in all required fields and pick at least one tag.';
  if (name.length > MAX_NAME_LEN) return `name too long — max ${MAX_NAME_LEN} chars.`;
  if (desc.length > MAX_DESC_LEN) return `description too long — max ${MAX_DESC_LEN} chars.`;
  if (EMOJI_RE.test(name) || EMOJI_RE.test(desc)) return 'no emojis in name or description.';
  try { new URL(link); } catch { return 'enter a valid url (e.g. https://example.com)'; }
  return null;
}

// ── Form helpers ───────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('form-error');
  el.textContent = msg; el.style.display = 'block';
}
function hideError() { document.getElementById('form-error').style.display = 'none'; }

function resetForm() {
  ['f-name','f-link','f-desc'].forEach(id => document.getElementById(id).value = '');
  document.querySelectorAll('.tag-option').forEach(o => o.classList.remove('selected'));
  document.querySelectorAll('.platform-option').forEach(o => o.classList.remove('selected'));
  document.getElementById('desc-count').textContent = `0 / ${MAX_DESC_LEN}`;
  App.selectedTags      = [];
  App.selectedPlatforms = [];
  hideError();
  const btn = document.getElementById('submit-btn');
  document.getElementById('submit-success').style.display = 'none';
  btn.disabled = false; btn.textContent = 'submit →';
}

// ── Open add modal ─────────────────────────────────────────────
document.getElementById('add-btn').addEventListener('click', () => {
  if (!App.currentUser) {
    document.getElementById('login-modal').style.display = 'flex';
    return;
  }
  document.getElementById('f-edit-id').value = '';
  document.getElementById('modal-title').textContent = 'add something';
  document.getElementById('submit-btn').textContent  = 'submit →';
  resetForm();
  window.Tags?.renderTagSelect();
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('f-name').focus();
});

// ── Open edit modal ────────────────────────────────────────────
function openEditModal(id) {
  const tool = App.allTools.find(t => t.id === id);
  if (!tool) return;
  document.getElementById('f-edit-id').value = id;
  document.getElementById('f-name').value    = tool.name;
  document.getElementById('f-link').value    = tool.link;
  document.getElementById('f-desc').value    = tool.description;
  App.selectedTags      = Array.isArray(tool.tags)      ? [...tool.tags]      : [];
  App.selectedPlatforms = Array.isArray(tool.platforms) ? [...tool.platforms] : [];
  window.Tags?.renderTagSelect();
  document.querySelectorAll('.platform-option').forEach(o =>
    o.classList.toggle('selected', App.selectedPlatforms.includes(o.dataset.platform)));
  document.getElementById('modal-title').textContent      = 'edit entry';
  document.getElementById('submit-btn').textContent       = 'save changes →';
  document.getElementById('submit-success').style.display = 'none';
  hideError();
  document.getElementById('modal-overlay').style.display = 'flex';
}

// ── Open delete modal ──────────────────────────────────────────
function openDeleteModal(id) {
  App.deleteTargetId = id;
  document.getElementById('delete-modal').style.display = 'flex';
}

document.getElementById('delete-confirm-btn').addEventListener('click', async () => {
  if (!App.deleteTargetId) return;
  const { error } = await App.db.from('tools').delete().eq('id', App.deleteTargetId);
  if (error) { alert(`failed: ${error.message}`); return; }
  document.getElementById('delete-modal').style.display = 'none';
  App.deleteTargetId = null;
  await window.Main?.fetchTools();
});

// ── Submit ─────────────────────────────────────────────────────
document.getElementById('submit-btn').addEventListener('click', async () => {
  const editId = document.getElementById('f-edit-id').value;
  const name   = document.getElementById('f-name').value.trim();
  const link   = document.getElementById('f-link').value.trim();
  const desc   = document.getElementById('f-desc').value.trim();

  const err = validate(name, link, desc);
  if (err) { showError(err); return; }
  if (!editId) { const re = checkRateLimit(); if (re) { showError(re); return; } }

  hideError();
  const btn = document.getElementById('submit-btn');
  btn.disabled = true; btn.textContent = editId ? 'saving...' : 'checking link...';

  if (!editId) {
    const safeErr = await checkSafeBrowsing(link);
    if (safeErr) { showError(safeErr); btn.disabled = false; btn.textContent = 'submit →'; return; }
  }

  btn.textContent = editId ? 'saving...' : 'submitting...';
  let error;

  if (editId) {
    ({ error } = await App.db.from('tools').update({
      name, link, description: desc, tags: App.selectedTags,
      platforms: App.selectedPlatforms.length ? App.selectedPlatforms : null,
    }).eq('id', editId));
  } else {
    ({ error } = await App.db.from('tools').insert([{
      name, link, description: desc,
      tags:      App.selectedTags,
      platforms: App.selectedPlatforms.length ? App.selectedPlatforms : null,
      added_by:  App.currentUser?.user_metadata?.full_name || App.currentUser?.user_metadata?.user_name || null,
      user_id:   App.currentUser?.id,
    }]));
    if (!error) incrementRateLimit();
  }

  btn.disabled = false; btn.textContent = editId ? 'save changes →' : 'submit →';
  if (error) { showError(`failed: ${error.message}`); return; }

  document.getElementById('submit-success').style.display = 'block';
  await window.Main?.fetchTools();
  setTimeout(() => window.UI?.closeAddModal(), 900);
});

window.Submit = { resetForm, openEditModal, openDeleteModal };