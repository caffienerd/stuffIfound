/* admin/src/users.js — users, roles, ban/unban (superadmin only) */

window.AdminUsers = {

  banTargetId: null,

  async load() {
    const [{ data: rolesData }, { data: bansData }, { data: toolsData }] = await Promise.all([
      Admin.db.from('roles').select('*'),
      Admin.db.from('banned_users').select('*'),
      Admin.db.from('tools').select('user_id, added_by').not('user_id', 'is', null),
    ]);

    // Build user map from roles + tools authors
    const userMap = {};
    (rolesData  || []).forEach(r => { userMap[r.user_id] = { user_id: r.user_id, role: r.role, name: '—' }; });
    (toolsData  || []).forEach(t => {
      if (!userMap[t.user_id]) userMap[t.user_id] = { user_id: t.user_id, role: 'user', name: t.added_by || '—' };
      else userMap[t.user_id].name = t.added_by || userMap[t.user_id].name;
    });

    const allUsers     = Object.values(userMap);
    const bannedIds    = new Set((bansData || []).map(b => b.user_id));
    const unbanReqMap  = Object.fromEntries((bansData || []).filter(b => b.unban_request).map(b => [b.user_id, b]));

    setTabCount('users', allUsers.length);
    this.render(allUsers, bannedIds, unbanReqMap);
  },

  render(allUsers, bannedIds, unbanReqMap) {
    const el = document.getElementById('users-list');
    if (!allUsers.length) { el.innerHTML = '<p class="empty-msg">no users found.</p>'; return; }

    el.innerHTML = allUsers.map(u => {
      const isBanned = bannedIds.has(u.user_id);
      const isSelf   = u.user_id === Admin.currentUser.id;
      const unbanReq = unbanReqMap[u.user_id];

      return `
      <div class="entry-row">
        <div class="entry-info">
          <div class="entry-name">
            ${escHtml(u.name)}
            <span class="role-badge role-${u.role}">${u.role}</span>
            ${isBanned  ? '<span class="role-badge role-banned">banned</span>'          : ''}
            ${unbanReq  ? '<span class="role-badge role-pending">unban request</span>'  : ''}
          </div>
          <div class="entry-meta">${u.user_id}</div>
          ${unbanReq ? `<div class="unban-request-text">"${escHtml(unbanReq.unban_request)}"</div>` : ''}
        </div>
        ${!isSelf ? `
        <div class="user-actions">
          ${!isBanned
            ? `<button class="btn-danger-sm btn-ban-user"   data-id="${u.user_id}" data-name="${escHtml(u.name)}">ban</button>`
            : `<button class="btn-ok-sm    btn-unban-user"  data-id="${u.user_id}">unban</button>`
          }
          <select class="role-select" data-id="${u.user_id}">
            <option value="user"       ${u.role==='user'       ?'selected':''}>user</option>
            <option value="admin"      ${u.role==='admin'      ?'selected':''}>admin</option>
            <option value="superadmin" ${u.role==='superadmin' ?'selected':''}>superadmin</option>
          </select>
        </div>` : '<span class="entry-meta">(you)</span>'}
      </div>`;
    }).join('');

    // Ban buttons
    el.querySelectorAll('.btn-ban-user').forEach(btn =>
      btn.addEventListener('click', () => this.openBanModal(btn.dataset.id, btn.dataset.name))
    );

    // Unban buttons
    el.querySelectorAll('.btn-unban-user').forEach(btn =>
      btn.addEventListener('click', () => confirmAction(
        'unban this user?',
        'they will regain full access to the site.',
        async () => {
          await Admin.db.from('banned_users').delete().eq('user_id', btn.dataset.id);
          await AdminUsers.load();
        }
      ))
    );

    // Role dropdowns
    el.querySelectorAll('.role-select').forEach(sel =>
      sel.addEventListener('change', async function() {
        const { error } = await Admin.db.from('roles').upsert(
          { user_id: this.dataset.id, role: this.value },
          { onConflict: 'user_id' }
        );
        if (error) { alert(`failed: ${error.message}`); return; }
        await AdminUsers.load();
      })
    );
  },

  openBanModal(userId, userName) {
    this.banTargetId = userId;
    document.getElementById('ban-modal-user').textContent = `ban "${userName}"?`;
    document.getElementById('ban-reason-input').value     = '';
    document.getElementById('ban-modal').style.display    = 'flex';
  },

  bindBanModal() {
    const modal = document.getElementById('ban-modal');
    document.getElementById('ban-modal-close').addEventListener('click', () => modal.style.display = 'none');
    document.getElementById('ban-cancel').addEventListener('click',      () => modal.style.display = 'none');
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

    document.getElementById('ban-confirm').addEventListener('click', async () => {
      if (!AdminUsers.banTargetId) return;
      const reason = document.getElementById('ban-reason-input').value.trim();
      const { error } = await Admin.db.from('banned_users').upsert({
        user_id: AdminUsers.banTargetId,
        reason:  reason || null,
        banned_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) { alert(`failed: ${error.message}`); return; }
      modal.style.display = 'none';
      AdminUsers.banTargetId = null;
      await AdminUsers.load();
    });
  },
};

// Bind ban modal once on load
AdminUsers.bindBanModal();