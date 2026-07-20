/* ============================================================
   Petisbar Teodoro — Logger
   Registro auditável de todas as ações do sistema.
   Mantém os últimos 500 logs em memória e 200 no localStorage.

   FUTURO: enviar logs ao backend via batch (flush a cada 30s).
   ============================================================ */

const LOG_KEY   = 'distrito-logs-v1';
const MAX_MEM   = 500;
const MAX_DISK  = 200;

const Logger = {
  _logs: [],

  /* Carrega logs persistidos ao inicializar */
  _init() {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      if (raw) this._logs = JSON.parse(raw);
    } catch {
      this._logs = [];
    }
  },

  /* Registra uma entrada de log */
  log(event, data = {}) {
    const entry = {
      id:    `log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      event,
      data:  this._sanitize(data),
      ts:    new Date().toISOString(),
    };

    this._logs.unshift(entry);

    // Circular buffer em memória
    if (this._logs.length > MAX_MEM) this._logs.length = MAX_MEM;

    // Persiste subconjunto em disco
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(this._logs.slice(0, MAX_DISK)));
    } catch {
      // Quota excedida — não crítico
    }

    console.debug(`[Petisbar Teodoro] ${event}`, data);
  },

  /* Retorna os últimos N logs */
  getLogs(limit = 50) {
    return this._logs.slice(0, limit);
  },

  /* Filtra logs por evento (busca parcial) */
  getByEvent(prefix, limit = 50) {
    return this._logs
      .filter(l => l.event.startsWith(prefix))
      .slice(0, limit);
  },

  /* Limpa logs de memória e disco */
  clear() {
    this._logs = [];
    try { localStorage.removeItem(LOG_KEY); } catch {}
  },

  /* Remove dados sensíveis antes de persistir */
  _sanitize(data) {
    if (!data || typeof data !== 'object') return data;
    const clone = { ...data };
    ['senha', 'password', 'token', 'cpf'].forEach(k => {
      if (k in clone) clone[k] = '***';
    });
    return clone;
  },
};

Logger._init();
