/* tags.js — fetch tags from DB, render filter bar + form select, inject CSS */

async function fetchTags() {
  const { data } = await App.db.from('tags').select('*').order('name');
  App.allTags = data || [];
  renderTagFilters();
  renderTagSelect();
  injectTagStyles();
}

function renderTagFilters() {
  const bar = document.getElementById('tag-filters');
  bar.innerHTML = `<button class="tag-btn active" data-tag="ALL">all</button>`;
  App.allTags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className   = 'tag-btn';
    btn.dataset.tag = tag.name;
    btn.textContent = tag.name.toLowerCase();
    bar.appendChild(btn);
  });
}

function renderTagSelect() {
  const sel = document.getElementById('tag-select');
  sel.innerHTML = '';
  App.allTags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className   = 'tag-option';
    btn.dataset.tag = tag.name;
    btn.textContent = tag.name.toLowerCase();
    if (App.selectedTags.includes(tag.name)) btn.classList.add('selected');
    sel.appendChild(btn);
  });
}

function injectTagStyles() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  let css = '';
  App.allTags.forEach(tag => {
    const color = isDark ? tag.color_dark : tag.color_light;
    css += `.tag-${tag.name.replace(/\s+/g,'-')} { color:${color}; border-color:${color}; }\n`;
  });
  let el = document.getElementById('dynamic-tag-styles');
  if (!el) { el = document.createElement('style'); el.id = 'dynamic-tag-styles'; document.head.appendChild(el); }
  el.textContent = css;
}

// ── Single delegated listener on the static modal body ─────────
// This fires correctly no matter how many times renderTagSelect() rebuilds the buttons
document.getElementById('modal-overlay').addEventListener('click', e => {
  const opt = e.target.closest('#tag-select .tag-option');
  if (!opt) return;
  opt.classList.toggle('selected');
  const tag = opt.dataset.tag;
  App.selectedTags = opt.classList.contains('selected')
    ? [...App.selectedTags, tag]
    : App.selectedTags.filter(t => t !== tag);
});

window.Tags = { fetchTags, renderTagSelect, injectTagStyles };