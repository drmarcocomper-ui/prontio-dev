// assets/js/core/session.js
// Controle da sessão do usuário no front-end.
// - guarda usuário logado
// - guarda últimos IDs acessados (ex.: último paciente)
// - controla timeout de inatividade (somente no front)
//
// Observação: regras de negócio de sessão e autenticação REAL
// continuam no backend (Apps Script). Aqui é apenas estado de interface.

(function (global) {
  "use strict";

  const PRONTIO = global.PRONTIO = global.PRONTIO || {};
  PRONTIO.core = PRONTIO.core || {};

  const STORAGE_KEY = "prontio.session.v1";

  let memoryState = {
    user: null,
    lastPatientId: null,
    lastAgendaDate: null,
    lastActivityAt: Date.now()
  };

  let idleTimer = null;

  function loadFromStorage() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      memoryState = Object.assign(memoryState, parsed);
    } catch (err) {
      console.warn("[Session] Erro ao ler localStorage", err);
    }
  }

  function saveToStorage() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
    } catch (err) {
      console.warn("[Session] Erro ao gravar localStorage", err);
    }
  }

  function touchActivity() {
    memoryState.lastActivityAt = Date.now();
    saveToStorage();
  }

  const Session = {
    /**
     * Inicializa sessão (chamar em main.js, assim que possível)
     */
    init() {
      loadFromStorage();
      this._setupActivityListeners();
    },

    /**
     * Define usuário logado
     * @param {Object|null} user
     */
    setUser(user) {
      memoryState.user = user || null;
      touchActivity();
    },

    /**
     * Retorna usuário logado (objeto ou null)
     */
    getUser() {
      return memoryState.user;
    },

    /**
     * Remove dados de sessão (ex.: logout)
     */
    clear() {
      memoryState = {
        user: null,
        lastPatientId: null,
        lastAgendaDate: null,
        lastActivityAt: Date.now()
      };
      saveToStorage();
    },

    setLastPatientId(id) {
      memoryState.lastPatientId = id || null;
      touchActivity();
    },

    getLastPatientId() {
      return memoryState.lastPatientId;
    },

    setLastAgendaDate(dateStr) {
      // string no formato YYYY-MM-DD (quem define é o backend)
      memoryState.lastAgendaDate = dateStr || null;
      touchActivity();
    },

    getLastAgendaDate() {
      return memoryState.lastAgendaDate;
    },

    /**
     * Inicia controle de inatividade no front.
     * @param {Object} options
     * @param {number} options.timeoutMs - tempo em ms (ex.: 30 * 60 * 1000)
     * @param {Function} options.onTimeout - callback chamado ao estourar
     */
    startIdleTimer(options) {
      const timeoutMs = (options && options.timeoutMs) || 30 * 60 * 1000;
      const onTimeout = (options && options.onTimeout) || function () {
        console.warn("[Session] Timeout de inatividade disparado (default).");
      };

      if (idleTimer) {
        clearInterval(idleTimer);
      }

      idleTimer = global.setInterval(() => {
        const now = Date.now();
        const diff = now - (memoryState.lastActivityAt || now);
        if (diff >= timeoutMs) {
          clearInterval(idleTimer);
          idleTimer = null;
          onTimeout();
        }
      }, 60 * 1000); // verifica a cada 1 minuto
    },

    /**
     * Registra listeners para atualizar lastActivityAt
     * sempre que o usuário interagir com a interface.
     * (somente front-end)
     */
    _setupActivityListeners() {
      const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];
      events.forEach(ev => {
        global.addEventListener(ev, touchActivity, { passive: true });
      });
    }
  };

  PRONTIO.core.session = Session;

})(window);
