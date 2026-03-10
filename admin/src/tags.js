/* admin/src/tags.js — tag CRUD */

window.AdminTags = {

  allTags: [],

  async load() {
    const { data } = await Admin.db.from('tags').select('*').order('name');
    this.allTags = data || [];
    this.render();
    this.bindForm();
  },

  render() {
    const list = document.getElementById('tags-list');
    if (!this.allTags.length) { list.innerHTML = '<p class="empty-msg">no tags yet.</p>'; return; }
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    list.innerHTML = this.allTags.map(tag => {
      const color = isDark ? tag.color_dark : tag.color_light;
      return `
      <div class="tag-row">
        <span class="tag-preview" style="color:${color};border-color:${color}">${tag.name}</span>
        <div class="tag-colors">
          <span class="color-dot" style="background:${tag.color_dark}"  title="dark: ${tag.color_dark}"></span>
          <span class="color-dot" style="background:${tag.color_light}" title="light: ${tag.color_light}"></span>
        </div>
        <button class="btn-danger-sm btn-delete-tag" data-id="${tag.id}" data-name="${tag.name}">remove</button>
      </div>`;
    }).join('');

    list.querySelectorAll('.btn-delete-tag').forEach(btn =>
      btn.addEventListener('click', () => confirmAction(
        `remove tag "${btn.dataset.name}"?`,
        `existing entries keep this tag — it's just removed from the list.`,
        async () => {
          await Admin.db.from('tags').delete().eq('id', btn.dataset.id);
          await AdminTags.load();
        }
      ))
    );
  },

  bindForm() {
    document.getElementById('add-tag-btn').onclick = () => {
      document.getElementById('add-tag-form').style.display = 'flex';
    };
    document.getElementById('cancel-tag-btn').onclick = () => {
      document.getElementById('add-tag-form').style.display = 'none';
      document.getElementById('new-tag-name').value = '';
      document.getElementById('tag-form-error').style.display = 'none';
    };
    document.getElementById('save-tag-btn').onclick = async () => {
      const name  = document.getElementById('new-tag-name').value.trim().toUpperCase();
      const dark  = document.getElementById('new-tag-dark').value;
      const light = document.getElementById('new-tag-light').value;
      const errEl = document.getElementById('tag-form-error');

      if (!name) { errEl.textContent = 'enter a tag name.'; errEl.style.display = 'block'; return; }
      if (this.allTags.find(t => t.name === name)) {
        errEl.textContent = 'tag already exists.'; errEl.style.display = 'block'; return;
      }
      errEl.style.display = 'none';
      const { error } = await Admin.db.from('tags').insert([{ name, color_dark: dark, color_light: light }]);
      if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; return; }
      document.getElementById('new-tag-name').value = '';
      document.getElementById('add-tag-form').style.display = 'none';
      await this.load();
    };
  },
};