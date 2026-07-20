/* ============================================================
   Petisbar Teodoro — UI
   Carregamento de componentes, notificações, modal.
   Nunca contém regras de negócio — só apresentação.
   ============================================================ */

const UI = {
  /* ── Component Loader ────────────────────────────────────────── */

  // Detecta o prefixo correto de acordo com a profundidade da página
  _componentBase() {
    // Funciona tanto no subdiretório do GitHub Pages quanto em domínio próprio.
    return window.location.pathname.includes('/pages/') ? '../' : './';
  },

  async loadComponent(slotId, componentPath) {
    const el = document.getElementById(slotId);
    if (!el) return;
    try {
      const base = this._componentBase();
      const res  = await fetch(`${base}${componentPath}`);
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${componentPath}`);
      el.innerHTML = await res.text();
    } catch (err) {
      console.error('[UI] loadComponent:', err);
    }
  },

  async loadSidebar() {
    await this.loadComponent('sidebar-slot', 'components/sidebar.html');
  },

  async loadHeader() {
    await this.loadComponent('header-slot', 'components/header.html');
  },

  /* ── Navigation ──────────────────────────────────────────────── */

  setActiveNav(page) {
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
  },

  setHeaderTitle(title) {
    const el = document.getElementById('header-title');
    if (el) el.textContent = title;
  },

  setHeaderDate() {
    const el = document.getElementById('header-date');
    if (el) el.textContent = Utils.fullDate();
  },

  setUserInfo(name = 'Administrador') {
    const initEl = document.getElementById('user-initials');
    const nameEl = document.getElementById('user-name');
    if (initEl) initEl.textContent = Utils.initials(name);
    if (nameEl) nameEl.textContent = name;
  },

  /* ── Toast Notifications ─────────────────────────────────────── */

  _toastContainer() {
    let el = document.getElementById('toast-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast-container';
      document.body.appendChild(el);
    }
    return el;
  },

  toast(message, type = 'success', duration = 3500) {
    const icons = {
      success: '✓',
      danger:  '✕',
      warning: '⚠',
      info:    'ℹ',
    };

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `<span>${icons[type] || '•'}</span><span>${message}</span>`;

    const container = this._toastContainer();
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  /* ── Modal ───────────────────────────────────────────────────── */

  _activeModal: null,

  openModal({ title, body, onConfirm, confirmLabel = 'Salvar', confirmClass = 'btn-primary', size = '' }) {
    this.closeModal();

    const sizeClass = size === 'wide' ? 'modal--wide' : size === 'small' ? 'modal--small' : '';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal ${sizeClass}" role="dialog" aria-modal="true">
        <div class="modal__header">
          <h2 class="modal__title">${title}</h2>
          <button class="modal__close" id="modal-close" aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="modal__body" id="modal-body">
          ${body}
        </div>
        <div class="modal__footer">
          <button class="btn btn-ghost" id="modal-cancel">Cancelar</button>
          <button class="btn ${confirmClass}" id="modal-confirm">${confirmLabel}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this._activeModal = overlay;

    // Focus trap
    const firstInput = overlay.querySelector('input, select, textarea');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);

    // Close handlers
    overlay.querySelector('#modal-close').addEventListener('click', () => this.closeModal());
    overlay.querySelector('#modal-cancel').addEventListener('click', () => this.closeModal());
    overlay.addEventListener('click', e => { if (e.target === overlay) this.closeModal(); });

    // Confirm handler
    if (onConfirm) {
      overlay.querySelector('#modal-confirm').addEventListener('click', () => {
        const form = overlay.querySelector('form');
        const data = form ? Object.fromEntries(new FormData(form)) : {};
        onConfirm(data);
      });
    }

    // Escape key
    this._escHandler = e => { if (e.key === 'Escape') this.closeModal(); };
    document.addEventListener('keydown', this._escHandler);
  },

  closeModal() {
    if (this._activeModal) {
      this._activeModal.remove();
      this._activeModal = null;
    }
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
  },

  /* ── Loading ─────────────────────────────────────────────────── */

  setLoading(el, loading) {
    if (!el) return;
    if (loading) {
      el.dataset.originalText = el.textContent;
      el.textContent = '';
      el.classList.add('btn-loading');
      el.disabled = true;
    } else {
      el.textContent = el.dataset.originalText || el.textContent;
      el.classList.remove('btn-loading');
      el.disabled = false;
    }
  },
};
