/* ============================================================
   Petisbar Teodoro — Utilities
   Funções puras sem side-effects. Nunca acessa DOM, Storage ou API.
   ============================================================ */

const Utils = {
  /* ── Formatters ─────────────────────────────────────────────── */

  currency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  },

  pct(ratio) {
    return `${Math.round((ratio || 0) * 100)}%`;
  },

  number(value) {
    return new Intl.NumberFormat('pt-BR').format(value || 0);
  },

  /* ── Date Helpers ────────────────────────────────────────────── */

  // Returns "2026-07-09"
  today() {
    return new Date().toISOString().slice(0, 10);
  },

  // Returns "2026-07"
  currentMonth() {
    return new Date().toISOString().slice(0, 7);
  },

  // "2026-07-09" → "09/07/2026"
  formatDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  },

  // "2026-07-09" → "09/07"
  formatShortDate(iso) {
    if (!iso) return '—';
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  },

  // Returns "14:32"
  timeNow() {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  },

  // Full locale date: "quarta-feira, 9 de julho de 2026"
  fullDate() {
    return new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  },

  /* ── ID Generation ───────────────────────────────────────────── */

  uid() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  },

  nextOrderId(orders = []) {
    if (!orders.length) return '#001';
    const nums = orders
      .map(o => parseInt((o.id || '').replace('#', ''), 10))
      .filter(n => !isNaN(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return `#${String(max + 1).padStart(3, '0')}`;
  },

  /* ── String Helpers ─────────────────────────────────────────── */

  initials(name = '') {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('');
  },

  capitalize(str = '') {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  /* ── Calculation Helpers ─────────────────────────────────────── */

  cmvPercent(cmvTotal, revenue) {
    if (!revenue) return 0;
    return Math.round((Math.abs(cmvTotal) / revenue) * 100);
  },

  marginPercent(profit, revenue) {
    if (!revenue) return 0;
    return Math.round((profit / revenue) * 100);
  },

  /* ── Security ───────────────────────────────────────────────── */

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  },

  /* ── DOM Helpers ────────────────────────────────────────────── */

  qs(selector, root = document) {
    return root.querySelector(selector);
  },

  qsa(selector, root = document) {
    return [...root.querySelectorAll(selector)];
  },

  /* ── Debounce ────────────────────────────────────────────────── */

  debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  },
};
