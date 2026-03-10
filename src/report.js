/* report.js — report button + modal */

const REPORT_REASONS = ['broken link', 'spam', 'inappropriate', 'duplicate', 'other'];

// ── Inject report modal into DOM ───────────────────────────────
function initReportModal() {
  const el = document.createElement('div');
  el.id        = 'report-modal';
  el.className = 'modal-overlay';
  el.style.display = 'none';
  el.innerHTML = `
    <div class="modal modal--narrow">
      <div class="modal-header">
        <span class="modal-title">report entry</span>
        <button id="report-modal-close" class="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <p id="report-tool-name" class="auth-hint"></p>
        <div class="field">
          <label>reason <span class="req">*</span></label>
          <div class="tag-select" id="report-reason-select">
            ${REPORT_REASONS.map(r =>
              `<button class="tag-option report-reason-opt" data-reason="${r}">${r}</button>`
            ).join('')}
          </div>
        </div>
        <div id="report-error"   class="form-error"    style="display:none"></div>
        <div id="report-success" class="submit-success" style="display:none">✓ reported — we'll look into it.</div>
        <button id="report-submit-btn" class="btn-submit">submit report →</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  // close
  document.getElementById('report-modal-close').addEventListener('click', closeReportModal);
  el.addEventListener('click', e => { if (e.target === el) closeReportModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeReportModal(); });

  // reason select
  el.addEventListener('click', e => {
    const opt = e.target.closest('.report-reason-opt');
    if (!opt) return;
    el.querySelectorAll('.report-reason-opt').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
  });

  // submit
  document.getElementById('report-submit-btn').addEventListener('click', submitReport);
}

let reportTargetId = null;

function openReportModal(toolId, toolName) {
  if (!App.currentUser) {
    document.getElementById('login-modal').style.display = 'flex';
    return;
  }
  reportTargetId = toolId;
  document.getElementById('report-tool-name').textContent = `"${toolName}"`;
  document.querySelectorAll('.report-reason-opt').forEach(o => o.classList.remove('selected'));
  document.getElementById('report-error').style.display   = 'none';
  document.getElementById('report-success').style.display = 'none';
  const btn = document.getElementById('report-submit-btn');
  btn.style.display = 'block'; btn.disabled = false; btn.textContent = 'submit report →';
  document.getElementById('report-modal').style.display = 'flex';
}

function closeReportModal() {
  document.getElementById('report-modal').style.display = 'none';
  reportTargetId = null;
}

async function submitReport() {
  const selected = document.querySelector('.report-reason-opt.selected');
  const errEl    = document.getElementById('report-error');
  if (!selected) { errEl.textContent = 'pick a reason.'; errEl.style.display = 'block'; return; }

  errEl.style.display = 'none';
  const btn = document.getElementById('report-submit-btn');
  btn.disabled = true; btn.textContent = 'submitting...';

  const { error } = await App.db.from('reports').insert({
    tool_id:    reportTargetId,
    user_id:    App.currentUser.id,
    reason:     selected.dataset.reason,
  });

  if (error) {
    errEl.textContent = error.message; errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'submit report →';
    return;
  }

  document.getElementById('report-success').style.display = 'block';
  btn.style.display = 'none';
  setTimeout(closeReportModal, 1500);
}

initReportModal();
window.Report = { openReportModal };