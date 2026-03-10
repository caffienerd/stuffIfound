/* admin/src/entries.js — entries list and delete */

window.AdminEntries = {

  allEntries: [],

  async load() {
    const { data } = await Admin.db.from('tools').select('*').order('created_at', { ascending: false });
    this.allEntries = data || [];
    setTabCount('entries', this.allEntries.length);
    this.render(this.allEntries);
    this.bindSearch();
  },

  render(list) {
    const el = document.getElementById('entries-list');
    if (!list.length) { el.innerHTML = '<p class="empty-msg">no entries.</p>'; return; }
    el.innerHTML = list.map(e => {
      const date = e.created_at
        ? new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '';
      const tags = (e.tags || []).join(', ');
      return `
      <div class="entry-row">
        <div class="entry-info">
          <div class="entry-name">${escHtml(e.name)}</div>
          <div class="entry-meta">${escHtml(e.added_by || 'unknown')} · ${date} · <span class="entry-tags">${tags}</span></div>
          <div class="entry-link">${escHtml(e.link)}</div>
        </div>
        <button class="btn-danger-sm btn-delete-entry" data-id="${e.id}" data-name="${escHtml(e.name)}">remove</button>
      </div>`;
    }).join('');

    el.querySelectorAll('.btn-delete-entry').forEach(btn =>
      btn.addEventListener('click', () => confirmAction(
        `remove "${btn.dataset.name}"?`,
        'this will permanently delete this entry.',
        async () => {
          await Admin.db.from('tools').delete().eq('id', btn.dataset.id);
          await AdminEntries.load();
        }
      ))
    );
  },

  bindSearch() {
    document.getElementById('entry-search').oninput = function() {
      const q = this.value.toLowerCase();
      AdminEntries.render(AdminEntries.allEntries.filter(e =>
        e.name?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.added_by?.toLowerCase().includes(q)
      ));
    };
  },
};