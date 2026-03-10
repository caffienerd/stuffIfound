/* main.js — boot, fetchTools, renderTools, card */

// ── Fetch tools ────────────────────────────────────────────────
async function fetchTools() {
  const { data, error } = await App.db.from('tools').select('*').order('created_at', { ascending: false });
  if (error) {
    document.getElementById('tools-grid').innerHTML = `<div class="no-results">error: ${error.message}</div>`;
    return;
  }
  App.allTools = data || [];
  document.getElementById('tool-count').textContent = `${App.allTools.length} things`;
  if (window.Bookmarks) await Bookmarks.fetchBookmarks();
  renderTools();
}

// ── Filter ─────────────────────────────────────────────────────
function getFiltered() {
  return App.allTools.filter(t => {
    if (App.showingSaved) return App.bookmarks.has(t.id);
    const tagMatch    = App.activeTag === 'ALL' || (Array.isArray(t.tags) && t.tags.includes(App.activeTag));
    const q           = App.searchQuery.toLowerCase();
    const searchMatch = !q || t.name?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q);
    return tagMatch && searchMatch;
  });
}

// ── Render ─────────────────────────────────────────────────────
function renderTools() {
  const grid     = document.getElementById('tools-grid');
  const noRes    = document.getElementById('no-results');
  const filtered = getFiltered();

  if (filtered.length === 0) {
    grid.innerHTML = '';
    noRes.style.display = 'block';
    return;
  }
  noRes.style.display = 'none';
  grid.innerHTML = filtered.map((t, i) => buildCard(t, i)).join('');

  grid.querySelectorAll('.btn-edit').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); window.Submit?.openEditModal(btn.dataset.id); }));
  grid.querySelectorAll('.btn-delete').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); window.Submit?.openDeleteModal(btn.dataset.id); }));
  grid.querySelectorAll('.btn-bookmark').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); Bookmarks.toggleBookmark(btn.dataset.id); }));
  grid.querySelectorAll('.btn-report').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); Report.openReportModal(btn.dataset.id, btn.dataset.name); }));
  grid.querySelectorAll('.tool-card[data-href]').forEach(c =>
    c.addEventListener('click', () => { if (c.dataset.href) window.open(c.dataset.href, '_blank', 'noopener noreferrer'); }));
}

// ── Card ───────────────────────────────────────────────────────
function buildCard(t, i) {
  const tags      = Array.isArray(t.tags)      ? t.tags      : [];
  const platforms = Array.isArray(t.platforms) ? t.platforms : [];
  const isDark    = document.documentElement.getAttribute('data-theme') !== 'light';

  const tagsHTML = tags.map(tag => {
    const td    = App.allTags.find(x => x.name === tag);
    const color = td ? (isDark ? td.color_dark : td.color_light) : '#888';
    return `<span class="card-tag" style="color:${color};border-color:${color}">${tag.toUpperCase()}</span>`;
  }).join('');

  const platHTML  = platforms.map(p => `<span class="card-platform">${p}</span>`).join('');
  const date      = t.created_at
    ? new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const isOwner    = App.currentUser && App.currentUser.id === t.user_id;
  const canEdit    = isOwner || App.currentRole === 'admin' || App.currentRole === 'superadmin';
  const ownerBadge = isOwner ? `<span class="owner-badge">you</span>` : '';

  const isSaved = App.bookmarks?.has(t.id) ?? false;
  const bmCount = App.bookmarkCounts?.[t.id] || 0;
  const bmHTML  = (App.currentUser && window.Bookmarks) ? `
    <button class="btn-bookmark${isSaved ? ' bookmarked' : ''}" data-id="${t.id}" title="${isSaved ? 'remove bookmark' : 'bookmark'}">
      ${bmCount > 0 ? `<span class="bm-count">${bmCount}</span>` : ''}${Bookmarks.bookmarkIcon(isSaved)}
    </button>` : '';

  const reportHTML = (App.currentUser && !isOwner) ? `
    <button class="btn-report" data-id="${t.id}" data-name="${esc(t.name || '')}" title="report">⚑</button>` : '';

  const ownerActions = canEdit ? `
    <button class="btn-edit"   data-id="${t.id}">edit</button>
    <button class="btn-delete" data-id="${t.id}">remove</button>` : '';

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
        <div class="card-foot-actions">
          ${bmHTML}
          ${reportHTML}
          ${ownerActions}
        </div>
      </div>
    </div>`;
}

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── Boot ───────────────────────────────────────────────────────
async function init() {
  await Tags.fetchTags();
  await fetchTools();
}

init();
window.Main = { fetchTools, renderTools };