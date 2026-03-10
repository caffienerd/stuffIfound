/* admin/src/reports.js — reports panel + unban requests panel */

// ── Reports ────────────────────────────────────────────────────
window.AdminReports = {

  allReports: [],

  async load() {
    const { data } = await Admin.db
      .from('reports')
      .select('*, tools(name, link)')
      .order('created_at', { ascending: false });
    this.allReports = data || [];
    const openCount = this.allReports.filter(r => !r.resolved).length;
    setTabCount('reports', openCount);
    this.render();
    this.bindToggle();
  },

  render() {
    const showResolved = document.getElementById('show-resolved')?.checked;
    const list = this.allReports.filter(r => showResolved ? true : !r.resolved);
    const el   = document.getElementById('reports-list');

    if (!list.length) {
      el.innerHTML = `<p class="empty-msg">${showResolved ? 'no reports.' : 'no open reports.'}</p>`;
      return;
    }

    el.innerHTML = list.map(r => {
      const date     = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const toolName = r.tools?.name || r.tool_id;
      const toolLink = r.tools?.link || '';
      return `
      <div class="entry-row ${r.resolved ? 'entry-row--resolved' : ''}">
        <div class="entry-info">
          <div class="entry-name">
            ${escHtml(toolName)}
            <span class="report-reason-badge">${escHtml(r.reason)}</span>
            ${r.resolved ? '<span class="role-badge role-user">resolved</span>' : '<span class="role-badge role-banned">open</span>'}
          </div>
          <div class="entry-meta">${date} · <a href="${escHtml(toolLink)}" target="_blank" class="entry-link-inline">${escHtml(toolLink)}</a></div>
        </div>
        ${!r.resolved ? `
        <div class="user-actions">
          <button class="btn-ok-sm btn-resolve-report" data-id="${r.id}">resolve</button>
          <button class="btn-danger-sm btn-resolve-delete" data-id="${r.id}" data-tool="${r.tool_id}">remove entry</button>
        </div>` : ''}
      </div>`;
    }).join('');

    // resolve only
    el.querySelectorAll('.btn-resolve-report').forEach(btn =>
      btn.addEventListener('click', () => confirmAction(
        'mark as resolved?', 'the entry will stay, report closed.',
        async () => {
          await Admin.db.from('reports').update({
            resolved: true, resolved_by: Admin.currentUser.id, resolved_at: new Date().toISOString()
          }).eq('id', btn.dataset.id);
          await AdminReports.load();
        }
      ))
    );

    // remove entry + resolve
    el.querySelectorAll('.btn-resolve-delete').forEach(btn =>
      btn.addEventListener('click', () => confirmAction(
        'remove entry and resolve report?', 'this permanently deletes the entry.',
        async () => {
          await Admin.db.from('tools').delete().eq('id', btn.dataset.tool);
          await Admin.db.from('reports').update({
            resolved: true, resolved_by: Admin.currentUser.id, resolved_at: new Date().toISOString()
          }).eq('id', btn.dataset.id);
          await AdminReports.load();
          await AdminEntries.load();
        }
      ))
    );
  },

  bindToggle() {
    const chk = document.getElementById('show-resolved');
    if (chk) chk.onchange = () => this.render();
  },
};

// ── Unban requests ─────────────────────────────────────────────
window.AdminUnban = {

  async load() {
    const { data } = await Admin.db
      .from('banned_users')
      .select('*')
      .not('unban_request', 'is', null)
      .order('unban_requested_at', { ascending: false });

    const el = document.getElementById('unban-list');
    setTabCount('unban', data?.length || 0);
    if (!data?.length) { el.innerHTML = '<p class="empty-msg">no pending unban requests.</p>'; return; }

    // also get names from roles table
    const { data: rolesData } = await Admin.db.from('roles').select('user_id, role');
    const roleMap = Object.fromEntries((rolesData || []).map(r => [r.user_id, r.role]));

    el.innerHTML = data.map(b => {
      const date = b.unban_requested_at
        ? new Date(b.unban_requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '';
      return `
      <div class="entry-row">
        <div class="entry-info">
          <div class="entry-name">
            ${escHtml(b.user_id)}
            <span class="role-badge role-banned">banned</span>
          </div>
          <div class="entry-meta">ban reason: ${escHtml(b.reason || '—')} · request sent ${date}</div>
          <div class="unban-request-text">"${escHtml(b.unban_request)}"</div>
        </div>
        <div class="user-actions">
          <button class="btn-ok-sm btn-approve-unban" data-id="${b.user_id}">unban</button>
          <button class="btn-danger-sm btn-deny-unban"   data-id="${b.user_id}">deny</button>
        </div>
      </div>`;
    }).join('');

    // approve = delete from banned_users
    el.querySelectorAll('.btn-approve-unban').forEach(btn =>
      btn.addEventListener('click', () => confirmAction(
        'approve unban?', 'the user will regain full access.',
        async () => {
          await Admin.db.from('banned_users').delete().eq('user_id', btn.dataset.id);
          await AdminUnban.load();
          await AdminUsers.load();
        }
      ))
    );

    // deny = clear just the unban_request field, keep banned
    el.querySelectorAll('.btn-deny-unban').forEach(btn =>
      btn.addEventListener('click', () => confirmAction(
        'deny unban request?', 'the user stays banned, request is cleared.',
        async () => {
          await Admin.db.from('banned_users').update({
            unban_request: null, unban_requested_at: null
          }).eq('user_id', btn.dataset.id);
          await AdminUnban.load();
        }
      ))
    );
  },
};

// hook into admin init — load when tab is clicked or on boot
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.tab === 'reports') AdminReports.load();
      if (tab.dataset.tab === 'unban')   AdminUnban.load();
    });
  });
});