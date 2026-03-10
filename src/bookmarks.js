/* bookmarks.js — bookmark toggle, counts, saved filter */

// ── State ──────────────────────────────────────────────────────
App.bookmarks      = new Set(); // tool_ids bookmarked by current user
App.bookmarkCounts = {};        // tool_id → count
App.showingSaved   = false;

// ── Fetch ──────────────────────────────────────────────────────
async function fetchBookmarks() {
  if (!App.currentUser) { App.bookmarks = new Set(); App.bookmarkCounts = {}; return; }

  // own bookmarks + all counts in parallel
  const [{ data: mine }, { data: counts }] = await Promise.all([
    App.db.from('bookmarks').select('tool_id').eq('user_id', App.currentUser.id),
    App.db.from('bookmarks').select('tool_id'),
  ]);

  App.bookmarks = new Set((mine || []).map(b => b.tool_id));

  // tally counts
  App.bookmarkCounts = {};
  (counts || []).forEach(b => {
    App.bookmarkCounts[b.tool_id] = (App.bookmarkCounts[b.tool_id] || 0) + 1;
  });
}

// ── Toggle ─────────────────────────────────────────────────────
async function toggleBookmark(toolId) {
  if (!App.currentUser) {
    document.getElementById('login-modal').style.display = 'flex';
    return;
  }

  const saved = App.bookmarks.has(toolId);

  if (saved) {
    App.bookmarks.delete(toolId);
    App.bookmarkCounts[toolId] = Math.max((App.bookmarkCounts[toolId] || 1) - 1, 0);
    await App.db.from('bookmarks').delete()
      .eq('user_id', App.currentUser.id).eq('tool_id', toolId);
  } else {
    App.bookmarks.add(toolId);
    App.bookmarkCounts[toolId] = (App.bookmarkCounts[toolId] || 0) + 1;
    await App.db.from('bookmarks').insert({ user_id: App.currentUser.id, tool_id: toolId });
  }

  // optimistically re-render just this card's bookmark btn
  const btn = document.querySelector(`.btn-bookmark[data-id="${toolId}"]`);
  if (btn) updateBookmarkBtn(btn, toolId);

  // if we're in saved view and just unbookmarked, re-render
  if (App.showingSaved) window.Main?.renderTools();
}

function updateBookmarkBtn(btn, toolId) {
  const saved  = App.bookmarks.has(toolId);
  const count  = App.bookmarkCounts[toolId] || 0;
  btn.classList.toggle('bookmarked', saved);
  btn.innerHTML = `${count > 0 ? `<span class="bm-count">${count}</span>` : ''}${bookmarkIcon(saved)}`;
}

function bookmarkIcon(filled) {
  return filled
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h14a1 1 0 0 1 1 1v17.5l-8-4-8 4V4a1 1 0 0 1 1-1z"/></svg>`
    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3h14a1 1 0 0 1 1 1v17.5l-8-4-8 4V4a1 1 0 0 1 1-1z"/></svg>`;
}

// ── Saved filter button ────────────────────────────────────────
function renderSavedFilter() {
  const bar = document.getElementById('tag-filters');
  // remove existing saved btn if present
  bar.querySelector('.btn-saved')?.remove();

  if (!App.currentUser) return;

  const btn = document.createElement('button');
  btn.className   = 'tag-btn btn-saved';
  btn.dataset.tag = '__SAVED__';
  btn.textContent = 'saved';
  if (App.showingSaved) btn.classList.add('active');

  // insert right after the "all" button
  const allBtn = bar.querySelector('[data-tag="ALL"]');
  if (allBtn?.nextSibling) {
    bar.insertBefore(btn, allBtn.nextSibling);
  } else {
    bar.appendChild(btn);
  }
}

// intercept tag filter clicks for saved
document.getElementById('tag-filters').addEventListener('click', e => {
  const btn = e.target.closest('.btn-saved');
  if (!btn) return;
  App.showingSaved = !App.showingSaved;
  if (App.showingSaved) {
    App.activeTag = 'ALL';
    document.querySelectorAll('.tag-btn:not(.btn-saved)').forEach(b => b.classList.remove('active'));
  }
  btn.classList.toggle('active', App.showingSaved);
  window.Main?.renderTools();
});

window.Bookmarks = { fetchBookmarks, toggleBookmark, bookmarkIcon, renderSavedFilter };